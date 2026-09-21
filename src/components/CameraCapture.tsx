'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'

interface FrameRect { x: number; y: number; w: number; h: number }

interface Props {
  onCapture: (blob: Blob, frameRect?: FrameRect) => void
  onClose: () => void
  ratio?: number
}

// Meme aperçu (getUserMedia) + cadre de cadrage sur TOUTES les plateformes,
// natif inclus -- essaye d'abord ImageCapture.takePhoto() (vraie photo
// capteur, pas juste une frame video plafonnee a 1920x1080), avec repli
// silencieux sur la capture video si indisponible. Confirme : le WebView
// Android (Chromium, meme moteur que Chrome desktop/mobile) supporte
// ImageCapture depuis Chromium 59 (2017), largement couvert par les
// appareils compatibles Capacitor -- donc pas besoin d'ouvrir l'appli
// appareil photo native (testee brievement, @capacitor/camera) qui donnait
// une bonne qualite mais perdait le cadre de cadrage custom (UI native,
// pas la notre). Voir capture() plus bas pour le detail du flux ImageCapture.
export default function CameraCapture({ onCapture, onClose, ratio }: Props) {
  // Vue camera censee etre immersive (position:fixed zIndex 9999) -- la nav
  // globale (zIndex 99999) restait affichee par-dessus et recouvrait le
  // bouton de capture en bas de l'ecran, rendant la prise de photo impossible.
  useEffect(() => {
    document.body.classList.add('camera-fullscreen-active')
    return () => { document.body.classList.remove('camera-fullscreen-active') }
  }, [])

  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const imageCaptureRef = useRef<{ takePhoto: () => Promise<Blob> } | null>(null)
  const [torch, setTorch] = useState(false)
  const [torchCapable, setTorchCapable] = useState(false)   // useState → re-render quand détecté
  const [focusPt, setFocusPt] = useState<{ x: number; y: number } | null>(null)

  const startCamera = () => {
    setError(null)
    setReady(false)
    const attach = (stream: MediaStream) => {
      streamRef.current = stream
      const track = stream.getVideoTracks()[0]
      const caps = (track.getCapabilities?.() ?? {}) as any
      if (caps.torch) setTorchCapable(true)
      // ImageCapture.takePhoto() demande une vraie photo au capteur (pas juste
      // une frame du flux video affiche, plafonne a 1920x1080 plus haut) --
      // bien supporte sur Chrome/Android (le cas PWA vise ici), absent sur
      // Safari/iOS. Repli silencieux sur la capture video existante si
      // indisponible ou si takePhoto() echoue -- voir capture().
      try {
        imageCaptureRef.current = typeof (window as any).ImageCapture === 'function'
          ? new (window as any).ImageCapture(track) : null
      } catch { imageCaptureRef.current = null }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    }
    const handleError = (err: unknown) => {
      const name = (err as any)?.name ?? ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
        setError('permission-denied')
      else if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
        setError('Aucune caméra détectée sur cet appareil')
      else if (name === 'NotReadableError' || name === 'TrackStartError')
        setError('Caméra utilisée par une autre application — fermez les autres apps qui utilisent la caméra')
      else
        setError('Caméra inaccessible')
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(attach)
      .catch(() =>
        // Fallback sans contrainte facingMode (desktop / webcam)
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          .then(attach)
          .catch(handleError)
      )
  }

  useEffect(() => {
    startCamera()
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !torchCapable) return
    const next = !torch
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: next }] })
      setTorch(next)
    } catch { /* non supporté */ }
  }

  const handleTapFocus = async (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track || !ready) return
    const video = videoRef.current!
    const rect = video.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    setFocusPt({ x: clientX - rect.left, y: clientY - rect.top })
    setTimeout(() => setFocusPt(null), 900)

    const caps = (track.getCapabilities?.() ?? {}) as any
    const supportedModes: string[] = caps.focusMode ?? []

    try {
      // 'single-shot' déclenche un cycle de mise au point puis verrouille
      // 'manual' = garder la distance actuelle (NE refocalise PAS — à éviter)
      if (supportedModes.includes('single-shot')) {
        await (track as any).applyConstraints({ advanced: [{ pointOfInterest: { x, y }, focusMode: 'single-shot' }] })
        // Reprendre autofocus continu après 2s pour les prochains réglages
        setTimeout(async () => {
          try { await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] }) } catch {}
        }, 2000)
      } else {
        // Fallback : juste déplacer le point d'intérêt sans changer le mode
        await (track as any).applyConstraints({ advanced: [{ pointOfInterest: { x, y } }] })
      }
    } catch { /* non supporté sur cet appareil */ }
  }

  // Force un cycle de mise au point juste avant la prise de vue. Sans ça,
  // ImageCapture.takePhoto() peut partir avant que le capteur ait vraiment
  // convergé -- l'aperçu vidéo (autofocus continu, déjà "assez net" pour de
  // l'affichage temps réel) donne l'illusion que c'est net, mais la photo
  // capturée en pleine résolution peut rester légèrement floue. Signalé après
  // avoir retiré le redimensionnement systématique des photos (qui masquait
  // ce flou par lissage) : "toutes les photos rendent floues sur le site".
  const ensureFocused = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      const caps = (track.getCapabilities?.() ?? {}) as any
      const supportedModes: string[] = caps.focusMode ?? []
      if (supportedModes.includes('single-shot')) {
        await (track as any).applyConstraints({ advanced: [{ focusMode: 'single-shot' }] })
        await new Promise(r => setTimeout(r, 350))
      }
    } catch { /* tant pis, on capture quand meme */ }
  }

  const capture = async () => {
    const video = videoRef.current
    if (!video) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const dw = video.clientWidth
    const dh = video.clientHeight

    // Cadre overlay — doit correspondre exactement à OverlayMask
    // Portrait : width = min(78vw, 56vh)
    // Paysage  : width = min(ratio*44vh, 78vw)
    const isLandscape = CARD_RATIO > 1
    let frameW = isLandscape
      ? Math.min(CARD_RATIO * dh * 0.44, dw * 0.78)
      : Math.min(dw * 0.78, dh * 0.56)
    let frameH = frameW / CARD_RATIO
    const frameX = (dw - frameW) / 2
    const frameY = (dh - frameH) / 2

    // Mapping display → video naturelle
    // La vidéo est object-fit:cover → calcule le crop réel
    const videoAspect = vw / vh
    const displayAspect = dw / dh
    let srcX = 0, srcY = 0, srcW = vw, srcH = vh
    if (videoAspect > displayAspect) {
      srcW = vh * displayAspect
      srcX = (vw - srcW) / 2
    } else {
      srcH = vw / displayAspect
      srcY = (vh - srcH) / 2
    }
    const scaleX = srcW / dw
    const scaleY = srcH / dh

    // Zone du cadre en coordonnées vidéo naturelle (avec 6% de padding)
    const PAD = 0.06
    const fx = srcX + frameX * scaleX
    const fy = srcY + frameY * scaleY
    const fw = frameW * scaleX
    const fh = frameH * scaleY
    let frameRect: FrameRect = {
      x: Math.max(0, fx - fw * PAD),
      y: Math.max(0, fy - fh * PAD),
      w: Math.min(vw, fw * (1 + PAD * 2)),
      h: Math.min(vh, fh * (1 + PAD * 2)),
    }

    await ensureFocused()

    // ImageCapture.takePhoto() capture une vraie photo depuis le capteur
    // (pas juste la frame video affichee, plafonnee a 1920x1080) -- doit
    // etre appele AVANT d'arreter les pistes (a besoin d'une piste vivante).
    // La photo peut avoir une resolution differente de vw/vh (le flux
    // preview) -- on remet le frameRect a l'echelle en consequence.
    let blob: Blob | null = null
    if (imageCaptureRef.current) {
      try {
        const photoBlob = await imageCaptureRef.current.takePhoto()
        const bmp = await createImageBitmap(photoBlob)
        const scale = bmp.width / vw
        frameRect = { x: frameRect.x * scale, y: frameRect.y * scale, w: frameRect.w * scale, h: frameRect.h * scale }
        bmp.close?.()
        // Pleine resolution renvoyee telle quelle -- un cap ici degraderait
        // aussi l'image finale stockee en galerie (image_recto/HD/Viewer3D),
        // pas seulement ce qui part en reseau (voir scanner/page.tsx pour la
        // seule copie reduite, faite localement juste pour son propre appel).
        blob = photoBlob
      } catch { blob = null }
    }

    if (!blob) {
      // Repli : capture de la frame video affichee (comportement precedent).
      const canvas = document.createElement('canvas')
      canvas.width = vw
      canvas.height = vh
      canvas.getContext('2d')!.drawImage(video, 0, 0, vw, vh)
      blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    }

    streamRef.current?.getTracks().forEach(t => t.stop())
    if (blob) onCapture(blob, frameRect)
  }

  const CARD_RATIO = ratio ?? (2.5 / 3.5)

  const content = (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes focusFade { 0%{opacity:1;transform:scale(1)} 60%{opacity:1;transform:scale(0.85)} 100%{opacity:0;transform:scale(0.8)} }`}</style>
      {error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 16, padding: '0 28px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>📷</span>
          {error === 'permission-denied' ? (
            <>
              <p style={{ fontSize: 15, margin: 0, fontWeight: 700 }}>Accès à la caméra refusé</p>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 16px', textAlign: 'left', width: '100%', maxWidth: 340 }}>
                {Capacitor.isNativePlatform() ? (
                  <>
                    {/* App native : pas de barre d'adresse ni de permission "par site"
                        (c'est une permission systeme Android) -- les instructions
                        navigateur ci-dessous referencent une UI qui n'existe pas ici. */}
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#86CEBC' }}>Sur l'app Memorabilius :</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                      <li>Ouvre <strong>Paramètres</strong> de ton téléphone</li>
                      <li>Va dans <strong>Applications</strong> → <strong>Memorabilius</strong></li>
                      <li>Appuie sur <strong>Autorisations</strong> → <strong>Appareil photo</strong></li>
                      <li>Autorise, puis reviens ici et réessaie</li>
                    </ol>
                  </>
                ) : /iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '') ? (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#86CEBC' }}>Sur Safari / iOS :</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                      <li>Ouvre <strong>Réglages</strong> → <strong>Applications</strong> → <strong>Safari</strong></li>
                      <li>Appuie sur <strong>Caméra</strong></li>
                      <li>Sélectionne <strong>Autoriser</strong></li>
                      <li>Reviens ici et appuie sur <strong>Réessayer</strong></li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: '#86CEBC' }}>Sur Chrome / Android :</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                      <li>Appuie sur l'icône 🔒 dans la barre d'adresse</li>
                      <li>Sélectionne <strong>Paramètres du site</strong></li>
                      <li>Change <strong>Caméra</strong> sur <strong>Autoriser</strong></li>
                      <li>Recharge la page et réessaie</li>
                    </ol>
                  </>
                )}
              </div>
            </>
          ) : (
            <p style={{ fontSize: 15, margin: 0, lineHeight: 1.5 }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startCamera} style={{ padding: '10px 24px', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Réessayer</button>
            <button onClick={onClose} style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
          </div>
        </div>
      ) : (
        <>
          {/* Vidéo — tap pour faire la mise au point */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onClick={handleTapFocus}
            onTouchStart={handleTapFocus}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'crosshair' }}
          />

          {/* Indicateur de mise au point */}
          {focusPt && (
            <div style={{
              position: 'absolute',
              left: focusPt.x - 28, top: focusPt.y - 28,
              width: 56, height: 56,
              border: '2px solid #ffeb3b',
              borderRadius: 4,
              pointerEvents: 'none',
              animation: 'focusFade 0.9s ease forwards',
            }} />
          )}

          {/* Overlay sombre avec découpe */}
          {ready && (
            <OverlayMask cardRatio={CARD_RATIO} />
          )}

          {/* Boutons */}
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
            <button onClick={onClose}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid white', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
            <button onClick={capture} disabled={!ready}
              style={{ width: 72, height: 72, borderRadius: '50%', background: ready ? 'white' : '#666', border: '4px solid rgba(255,255,255,0.5)', cursor: ready ? 'pointer' : 'default', boxShadow: '0 0 0 3px white' }}>
            </button>
            {torchCapable ? (
              <button onClick={toggleTorch}
                title={torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
                style={{ width: 48, height: 48, borderRadius: '50%', background: torch ? 'rgba(255,235,59,0.35)' : 'rgba(255,255,255,0.2)', border: `2px solid ${torch ? '#ffeb3b' : 'white'}`, color: torch ? '#ffeb3b' : 'white', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {torch ? '🔦' : '💡'}
              </button>
            ) : (
              <div style={{ width: 48 }} />
            )}
          </div>

          {ready && (
            <p style={{ position: 'absolute', top: 'calc(var(--safe-area-inset-top, env(safe-area-inset-top)) + 16px)', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0, pointerEvents: 'none' }}>
              Touchez l'écran pour faire la mise au point
            </p>
          )}

          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'white', fontSize: 14 }}>Chargement…</p>
            </div>
          )}
        </>
      )}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

function OverlayMask({ cardRatio }: { cardRatio: number }) {
  // Portrait (ratio < 1) : largeur contrainte → min(78vw, 56vh)
  // Paysage (ratio > 1) : hauteur contrainte → width = ratio * min(44vh, 78vw/ratio)
  const isLandscape = cardRatio > 1
  const frameWidth = isLandscape ? `min(${(cardRatio * 44).toFixed(1)}vh, 78vw)` : 'min(78vw, 56vh)'

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Fond sombre via box-shadow géant sur le cadre */}
      <div style={{
        position: 'relative',
        width: frameWidth,
        aspectRatio: `${cardRatio}`,
        borderRadius: 10,
        boxShadow: '0 0 0 200vmax rgba(0,0,0,0.60)',
        border: '2px solid rgba(255,255,255,0.6)',
        zIndex: 1,
      }}>
        {/* Coins cyan */}
        {[
          { top: -3, left: -3, borderTop: '4px solid #00e5ff', borderLeft: '4px solid #00e5ff' },
          { top: -3, right: -3, borderTop: '4px solid #00e5ff', borderRight: '4px solid #00e5ff' },
          { bottom: -3, right: -3, borderBottom: '4px solid #00e5ff', borderRight: '4px solid #00e5ff' },
          { bottom: -3, left: -3, borderBottom: '4px solid #00e5ff', borderLeft: '4px solid #00e5ff' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderRadius: 2, ...s }} />
        ))}
        <p style={{
          position: 'absolute', bottom: -36, left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.8)',
          fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap',
        }}>
          Alignez la carte dans le cadre
        </p>
      </div>
    </div>
  )
}
