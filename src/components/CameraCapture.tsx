'use client'
import { useEffect, useRef, useState } from 'react'

type Pt = { x: number; y: number }

interface Props {
  onCapture: (blob: Blob, corners: Pt[]) => void
  onClose: () => void
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    }).catch(() => setError('Caméra non accessible'))

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const dw = video.clientWidth
    const dh = video.clientHeight

    // Cadre overlay : centré, ratio 2.5/3.5, 78% de la plus petite dimension
    const CARD_RATIO = 2.5 / 3.5
    const PAD = 0.11
    let frameW = dw * (1 - PAD * 2)
    let frameH = frameW / CARD_RATIO
    if (frameH > dh * (1 - PAD * 2)) {
      frameH = dh * (1 - PAD * 2)
      frameW = frameH * CARD_RATIO
    }
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

    // Coins du cadre en coordonnées vidéo naturelle
    const corners: Pt[] = [
      { x: srcX + frameX * scaleX, y: srcY + frameY * scaleY },
      { x: srcX + (frameX + frameW) * scaleX, y: srcY + frameY * scaleY },
      { x: srcX + (frameX + frameW) * scaleX, y: srcY + (frameY + frameH) * scaleY },
      { x: srcX + frameX * scaleX, y: srcY + (frameY + frameH) * scaleY },
    ]

    // Canvas à pleine résolution vidéo
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    canvas.getContext('2d')!.drawImage(video, 0, 0, vw, vh)

    streamRef.current?.getTracks().forEach(t => t.stop())

    canvas.toBlob(blob => {
      if (blob) onCapture(blob, corners)
    }, 'image/jpeg', 0.92)
  }

  // Dimensions du cadre overlay en CSS (pour l'affichage)
  const CARD_RATIO = 2.5 / 3.5
  const PAD = 0.11

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 999, display: 'flex', flexDirection: 'column' }}>
      {error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 16 }}>
          <p style={{ fontSize: 16 }}>{error}</p>
          <button onClick={onClose} style={{ padding: '10px 24px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
        </div>
      ) : (
        <>
          {/* Vidéo */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Overlay sombre avec découpe */}
          {ready && (
            <OverlayMask cardRatio={CARD_RATIO} pad={PAD} />
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
            <div style={{ width: 48 }} />
          </div>

          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'white', fontSize: 14 }}>Chargement…</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function OverlayMask({ cardRatio, pad }: { cardRatio: number; pad: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <mask id="card-mask">
            <rect width="100%" height="100%" fill="white" />
            {/* Découpe carte — dimensions calculées en CSS via viewBox relatif */}
            <rect
              x={`${pad * 100}%`}
              y="0"
              width={`${(1 - pad * 2) * 100}%`}
              height="100%"
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#card-mask)" />
      </svg>

      {/* Cadre blanc autour de la zone carte */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `calc(100% - ${pad * 2 * 100}vw)`,
        aspectRatio: `${cardRatio}`,
        border: '2px solid rgba(255,255,255,0.85)',
        borderRadius: 8,
        boxShadow: '0 0 0 1px rgba(0,229,255,0.5)',
      }}>
        {/* Coins */}
        {[['0','0'],['100%','0'],['100%','100%'],['0','100%']].map(([l, t], i) => (
          <div key={i} style={{
            position: 'absolute',
            left: l === '0' ? -2 : undefined,
            right: l === '100%' ? -2 : undefined,
            top: t === '0' ? -2 : undefined,
            bottom: t === '100%' ? -2 : undefined,
            width: 20, height: 20,
            borderTop: t === '0' ? '3px solid #00e5ff' : undefined,
            borderBottom: t === '100%' ? '3px solid #00e5ff' : undefined,
            borderLeft: l === '0' ? '3px solid #00e5ff' : undefined,
            borderRight: l === '100%' ? '3px solid #00e5ff' : undefined,
          }} />
        ))}
        <p style={{ position: 'absolute', bottom: -28, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>
          Alignez la carte dans le cadre
        </p>
      </div>
    </div>
  )
}
