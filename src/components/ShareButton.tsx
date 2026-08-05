'use client'
import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useLang } from '@/lib/LangContext'

interface Props {
  url: string
  title: string
  compact?: boolean
  buttonStyle?: React.CSSProperties
}

const BRAND = '#003DA6'
const QR_SIZE = 220   // taille CSS affichée
const SCALE = 4       // canvas physique 4× → print-ready 880 px, crisp écran
const LOGO_W = 160    // badge logo (px CSS) — 640 px physiques = taille exacte du PNG HD
const LOGO_H = 36     // 144 px physiques = taille exacte du PNG HD

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}


export default function ShareButton({ url, title, compact, buttonStyle }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { t } = useLang()

  const fullUrl = `https://www.memorabilius.fr${url}`

  useEffect(() => {
    if (!showModal) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      const phys = QR_SIZE * SCALE  // 880 px — canvas physique

      // ① QR rendu par toCanvas → structure garantie correcte (finder, timing, format)
      await QRCode.toCanvas(canvas, fullUrl, {
        width: phys,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: BRAND, light: '#ffffff' },
      })
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`
      if (cancelled) return

      // ctx en px physiques (toCanvas ne pose pas de scale transform)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // ② Badge logo centré — halo blanc → rect bleu → logo PNG
      const cx = phys / 2, cy = phys / 2
      const lgW = LOGO_W * SCALE   // 640 px physiques = taille PNG HD
      const lgH = LOGO_H * SCALE   // 144 px physiques = taille PNG HD
      const pad = 3 * SCALE, bR = 8 * SCALE

      // Halo blanc fin
      ctx.fillStyle = 'white'
      rrect(ctx, cx - lgW / 2 - pad, cy - lgH / 2 - pad,
            lgW + pad * 2, lgH + pad * 2, bR + pad)
      ctx.fill()

      // Rectangle bleu
      ctx.fillStyle = BRAND
      rrect(ctx, cx - lgW / 2, cy - lgH / 2, lgW, lgH, bR)
      ctx.fill()

      // Logo officiel PNG HD — 640×144 px physiques, rendu 1:1 → pixel-perfect
      const logo = new Image()
      logo.src = '/memorabilius-logo-qr-hd.png'
      await logo.decode()
      if (cancelled) return
      ctx.save()
      rrect(ctx, cx - lgW / 2, cy - lgH / 2, lgW, lgH, bR)
      ctx.clip()
      ctx.drawImage(logo, cx - lgW / 2, cy - lgH / 2, lgW, lgH)
      ctx.restore()
    }, 50)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [showModal, fullUrl])

  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'memorabilius-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <>
      <button onClick={() => setShowModal(true)} style={buttonStyle ?? {
        background: 'none', border: '1px solid #ddd', borderRadius: 8,
        padding: compact ? '10px 10px' : '6px 12px', cursor: 'pointer',
        fontSize: compact ? 16 : 13, fontWeight: 700,
        color: '#666', display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {compact ? '🔗' : t('gallery_share')}
      </button>

      {showModal && (
        <div onClick={() => setShowModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, padding: 32,
            maxWidth: 400, width: '100%', textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative',
          }}>
            <button onClick={() => setShowModal(false)} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999',
            }}>×</button>

            <h3 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{t('gallery_share')}</h3>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 20 }}>{title}</p>

            <div style={{ background: '#f4f6fb', borderRadius: 16, padding: 20, marginBottom: 14, display: 'inline-block' }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <button onClick={downloadQR} style={{
                background: BRAND, color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>
                ⬇ Télécharger le QR
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={fullUrl} readOnly style={{
                flex: 1, fontSize: 12, padding: '8px 12px',
                background: '#f8f8f8', border: '1px solid #eee', borderRadius: 8,
              }} />
              <button onClick={copy} style={{
                background: copied ? '#2ecc71' : BRAND, color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer',
                fontSize: 13, whiteSpace: 'nowrap', transition: 'background 0.2s',
              }}>
                {copied ? '✓ Copié' : 'Copier'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: '#f0f0f0', color: '#333', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                𝕏 Twitter
              </a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: '#e8f0fe', color: '#1877F2', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                Facebook
              </a>
              <a href={`https://wa.me/?text=${encodeURIComponent(title + ' ' + fullUrl)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ background: '#e8f5e9', color: '#25D366', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
