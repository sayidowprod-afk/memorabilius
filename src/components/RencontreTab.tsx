'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import SkeletonBlock from '@/components/SkeletonBlock'

declare const BarcodeDetector: any

const SITE_URL = 'https://www.memorabilius.fr'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Onglet « Rencontre » de la page Échanges : pour un salon ou une rencontre en vrai.
// Chacun montre son QR (un simple lien vers cet onglet) ; l'autre le scanne (appareil photo du téléphone ou bouton « Scanner » ici) et voit
// d'un coup ce que chacun a pour l'autre. Les correspondances viennent des mêmes calculs que l'onglet « Pour toi » (/api/trades/matches) :
// rien de plus n'est exposé que ce que les membres voient déjà dans leurs échanges.
type Props = {
  userId: string
  matches: any[] | null
  partnerId: string | null
  onPartner: (id: string | null) => void
  onPropose: (m: { id: string; name: string; theyHave: any[]; theyWantFromMe: any[] }) => void
  onViewCard: (card: any, owner: string | null) => void
}

export default function RencontreTab({ userId, matches, partnerId, onPartner, onPropose, onViewCard }: Props) {
  const [qr, setQr] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [partner, setPartner] = useState<{ name: string; avatar: string | null } | null>(null)
  const link = `${SITE_URL}/trades?tab=rencontre&avec=${userId}`

  useEffect(() => {
    QRCode.toDataURL(link, { width: 520, margin: 2, errorCorrectionLevel: 'M' }).then(setQr).catch(() => {})
  }, [link])

  // profil de l'autre (pour l'afficher même quand rien ne correspond)
  useEffect(() => {
    setPartner(null)
    if (!partnerId || !UUID.test(partnerId)) return
    let off = false
    Promise.resolve(supabase.from('profiles').select('display_name, avatar_url').eq('id', partnerId).maybeSingle())
      .then(({ data }) => { if (!off && data) setPartner({ name: data.display_name || 'Collectionneur', avatar: data.avatar_url || null }) })
      .catch(() => {})
    return () => { off = true }
  }, [partnerId])

  const match = partnerId && matches ? matches.find((m: any) => m.id === partnerId) : null
  const name = match?.name || partner?.name || 'Collectionneur'
  const avatar = match?.avatar || partner?.avatar || null

  const cards = (list: any[], owner: string | null) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {list.slice(0, 12).map((c: any) => (
        <button key={c.id} type="button" onClick={() => c.image_recto && onViewCard(c, owner)} title={[c.nom, c.annee, c.marque, c.collection].filter(Boolean).join(' · ')}
          style={{ width: 72, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: c.image_recto ? 'pointer' : 'default', color: 'inherit' }}>
          <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', background: 'var(--bg3, #f4f4f4)' }}>
            {c.image_recto && <img loading="lazy" src={c.image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, marginTop: 3, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
        </button>
      ))}
      {list.length > 12 && <div style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text3, #888)' }}>+{list.length - 12}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ fontSize: 13, color: 'var(--text3, #888)', margin: 0, lineHeight: 1.5 }}>
        En salon ou à une rencontre : montre ton QR à l’autre collectionneur, ou scanne le sien. Tu vois tout de suite ce qu’il a pour toi, et ce que tu as pour lui.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ border: '2px solid #003DA6', background: 'var(--card-bg, #fff)', padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text3, #888)' }}>Mon QR de rencontre</div>
          <div style={{ background: '#fff', padding: 6, width: '100%', maxWidth: 260 }}>
            {qr ? <img src={qr} alt="Mon QR de rencontre" style={{ width: '100%', display: 'block' }} /> : <SkeletonBlock style={{ width: '100%', aspectRatio: '1' }} />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3, #888)', textAlign: 'center' }}>Monte la luminosité de l’écran pour qu’il se scanne bien.</div>
        </div>

        <div style={{ border: '2px solid var(--border, #e5e5e5)', background: 'var(--card-bg, #fff)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text3, #888)' }}>Scanner son QR</div>
          <button type="button" onClick={() => { setScanMsg(''); setScanning(true) }}
            style={{ background: '#003DA6', color: '#fff', border: 'none', padding: '14px 18px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            📷 Scanner un QR
          </button>
          <div style={{ fontSize: 12, color: 'var(--text3, #888)', lineHeight: 1.5 }}>
            Tu peux aussi le scanner avec l’appareil photo de ton téléphone : le lien ouvre directement cet onglet.
          </div>
          {scanMsg && <div style={{ fontSize: 13, color: '#d6293e', fontWeight: 700 }}>{scanMsg}</div>}
        </div>
      </div>

      {partnerId && (
        <div style={{ border: match?.perfect ? '2px solid #f39c12' : '1px solid var(--border, #eee)', background: 'var(--card-bg, #fff)', padding: 16 }}>
          {partnerId === userId ? (
            <div style={{ fontSize: 14, fontWeight: 700 }}>C’est ton propre QR. Fais-le scanner par l’autre collectionneur.</div>
          ) : !UUID.test(partnerId) ? (
            <div style={{ fontSize: 14, fontWeight: 700 }}>Ce lien de rencontre n’est pas valide.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                <img src={avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=003DA6&color=fff`} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text3, #888)' }}>Rencontre avec</div>
                  <Link href={`/galerie/${partnerId}`} style={{ fontWeight: 900, fontSize: 18, color: 'inherit', textDecoration: 'none' }}>{name}</Link>
                </div>
                {match?.perfect && <span style={{ background: '#f39c12', color: '#fff', fontSize: 11, fontWeight: 900, padding: '3px 10px', borderRadius: 20 }}>⭐ Échange parfait</span>}
                <button type="button" onClick={() => onPartner(null)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border, #ddd)', padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'inherit' }}>Fermer</button>
              </div>
              {matches === null ? (
                <SkeletonBlock style={{ height: 110 }} />
              ) : !match ? (
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                  Rien en commun pour l’instant : aucune carte à vendre ou échanger de {name} ne correspond à ta wishlist, et inversement.
                  <div style={{ marginTop: 10 }}>
                    <Link href={`/galerie/${partnerId}`} style={{ fontWeight: 800, color: '#003DA6' }}>Voir sa galerie →</Link>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text3, #888)', marginBottom: 8 }}>Il a pour toi ({match.theyHave.length})</div>
                      {match.theyHave.length ? cards(match.theyHave, match.id) : <div style={{ fontSize: 13, color: 'var(--text3, #888)' }}>Aucune carte de ta wishlist.</div>}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text3, #888)', marginBottom: 8 }}>Tu as pour lui ({match.theyWantFromMe.length})</div>
                      {match.theyWantFromMe.length ? cards(match.theyWantFromMe, null) : <div style={{ fontSize: 13, color: 'var(--text3, #888)' }}>Aucune de tes cartes à échanger ne l’intéresse.</div>}
                    </div>
                  </div>
                  <button type="button" onClick={() => onPropose(match)}
                    style={{ marginTop: 16, background: '#1b5e20', color: '#fff', border: 'none', padding: '12px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                    🔄 Proposer un échange
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {scanning && (
        <QrScan
          onClose={() => setScanning(false)}
          onFound={val => {
            setScanning(false)
            try {
              const u = new URL(/^https?:\/\//i.test(val) ? val : 'https://' + val.replace(/^\/+/, ''))
              const id = u.searchParams.get('avec') || ''
              if (u.searchParams.get('tab') === 'rencontre' && UUID.test(id)) { onPartner(id); return }
            } catch { /* QR illisible */ }
            setScanMsg('Ce QR n’est pas un QR de rencontre Memorabilius.')
          }}
          onError={msg => { setScanning(false); setScanMsg(msg) }}
        />
      )}
    </div>
  )
}

// Caméra arrière plein écran qui lit un QR (lecteur natif s'il existe, sinon jsQR : WebView Android, Safari, Firefox).
function QrScan({ onClose, onFound, onError }: { onClose: () => void; onFound: (val: string) => void; onError: (msg: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let stopped = false
    let raf = 0
    let stream: MediaStream | null = null
    const stop = () => { stopped = true; if (raf) cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()) }
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return }
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        try { await v.play() } catch { /* lecture démarrée malgré tout */ }
        let native: any = null
        if (typeof BarcodeDetector !== 'undefined') { try { native = new BarcodeDetector({ formats: ['qr_code'] }) } catch { native = null } }
        const jsQR = native ? null : (await import('jsqr')).default
        const grab = document.createElement('canvas')
        const gctx = grab.getContext('2d', { willReadFrequently: true })!
        let last = 0
        const scan = async () => {
          if (stopped) return
          if (!v || v.readyState < 2) { raf = requestAnimationFrame(scan); return }
          try {
            let val: string | null = null
            if (native) {
              const codes = await native.detect(v)
              val = codes.map((c: any) => c.rawValue as string).find((x: string) => !!x) || null
            } else if (jsQR && performance.now() - last > 120) {
              last = performance.now()
              const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight))
              grab.width = Math.max(1, Math.round(v.videoWidth * k)); grab.height = Math.max(1, Math.round(v.videoHeight * k))
              gctx.drawImage(v, 0, 0, grab.width, grab.height)
              const img = gctx.getImageData(0, 0, grab.width, grab.height)
              val = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data || null
            }
            if (val) { stop(); onFound(val); return }
          } catch { /* image ignorée */ }
          raf = requestAnimationFrame(scan)
        }
        raf = requestAnimationFrame(scan)
      } catch {
        stop(); onError('Impossible d’ouvrir la caméra. Autorise-la, ou scanne le QR avec l’appareil photo de ton téléphone.')
      }
    })()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div role="dialog" aria-label="Scanner un QR" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <video ref={videoRef} playsInline muted style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', left: '50%', top: '42%', width: 230, height: 230, transform: 'translate(-50%,-50%)', border: '3px solid #fff', boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 14, textShadow: '0 1px 4px #000' }}>Vise le QR de l’autre collectionneur</div>
        <button type="button" onClick={onClose} style={{ background: '#fff', color: '#111', border: 'none', padding: '12px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>,
    document.body
  )
}
