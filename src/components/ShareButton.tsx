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
const QR_SIZE = 220
// Logo Memorabilius blanc (110x24) — wordmark officiel, fond transparent
const LOGO_W = 110
const LOGO_H = 24
const LOGO_B64 = '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'

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
      canvas.width = QR_SIZE
      canvas.height = QR_SIZE
      await QRCode.toCanvas(canvas, fullUrl, {
        width: QR_SIZE,
        margin: 2,
        color: { dark: BRAND, light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      })
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Logo Memorabilius centré — wordmark blanc sur rectangle bleu
      const cx = QR_SIZE / 2
      const cy = QR_SIZE / 2
      const iPad = 6   // intérieur: espace entre logo et bord bleu
      const oPad = 5   // extérieur: bordure blanche autour du rect bleu
      const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.arcTo(x + w, y, x + w, y + r, r)
        ctx.lineTo(x + w, y + h - r)
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
        ctx.lineTo(x + r, y + h)
        ctx.arcTo(x, y + h, x, y + h - r, r)
        ctx.lineTo(x, y + r)
        ctx.arcTo(x, y, x + r, y, r)
        ctx.closePath()
      }
      // Fond blanc (bordure externe)
      ctx.fillStyle = 'white'
      rr(ctx, cx - LOGO_W/2 - iPad - oPad, cy - LOGO_H/2 - iPad - oPad,
         LOGO_W + (iPad + oPad)*2, LOGO_H + (iPad + oPad)*2, 10)
      ctx.fill()
      // Rectangle bleu
      ctx.fillStyle = BRAND
      rr(ctx, cx - LOGO_W/2 - iPad, cy - LOGO_H/2 - iPad,
         LOGO_W + iPad*2, LOGO_H + iPad*2, 7)
      ctx.fill()
      // Logo blanc dessus — URL same-origin évite les problèmes de base64
      try {
        const img = new Image()
        img.src = '/memorabilius-logo-white.png'
        await img.decode()
        ctx.drawImage(img, cx - LOGO_W/2, cy - LOGO_H/2, LOGO_W, LOGO_H)
      } catch {
        // Fallback texte
        ctx.fillStyle = 'white'
        ctx.font = 'bold 10px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('memorabilius', cx, cy)
      }
    }, 50)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [showModal, fullUrl])

  const copy = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'memorabilius-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const share = () => setShowModal(true)

  return (
    <>
      <button onClick={share} style={buttonStyle ?? {
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

            {/* QR Code branded */}
            <div style={{ background: '#f4f6fb', borderRadius: 16, padding: 20, marginBottom: 14, display: 'inline-block' }}>
              <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6 }} />
            </div>

            {/* Download */}
            <div style={{ marginBottom: 16 }}>
              <button onClick={downloadQR} style={{
                background: BRAND, color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
              }}>
                ⬇ Télécharger le QR
              </button>
            </div>

            {/* Lien */}
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

            {/* Réseaux sociaux */}
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
