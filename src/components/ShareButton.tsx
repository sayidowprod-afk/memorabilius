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
const LOGO_W = 110
const LOGO_H = 24

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

// Ballon de basket (orange)
function basketball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = '#E8621A'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx - r * 0.28, cy - r)
  ctx.bezierCurveTo(cx - r * 0.85, cy - r * 0.45, cx - r * 0.85, cy + r * 0.45, cx - r * 0.28, cy + r); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(cx + r * 0.28, cy - r)
  ctx.bezierCurveTo(cx + r * 0.85, cy - r * 0.45, cx + r * 0.85, cy + r * 0.45, cx + r * 0.28, cy + r); ctx.stroke()
  ctx.restore()
}

// Ballon de foot (noir + hexagones)
function soccer(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = 'white'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  // Pentagone central noir
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2
    i === 0 ? ctx.moveTo(cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38)
            : ctx.lineTo(cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38)
  }
  ctx.closePath(); ctx.fill()
  // Petits pentagones autour
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(a) * r * 0.72
    const py = cy + Math.sin(a) * r * 0.72
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const b = (i / 5) * Math.PI * 2 - Math.PI / 2
      i === 0 ? ctx.moveTo(px + Math.cos(b) * r * 0.22, py + Math.sin(b) * r * 0.22)
              : ctx.lineTo(px + Math.cos(b) * r * 0.22, py + Math.sin(b) * r * 0.22)
    }
    ctx.closePath(); ctx.fill()
  }
}

// Ballon de foot US (brun + lacets)
function football(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = '#7B3F00'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.strokeStyle = 'white'; ctx.lineCap = 'round'
  // Lacet horizontal
  ctx.lineWidth = r * 0.14
  ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.stroke()
  // Barres perpendiculaires
  ctx.lineWidth = r * 0.1
  for (const ox of [-0.3, 0, 0.3]) {
    ctx.beginPath(); ctx.moveTo(cx + ox * r, cy - r * 0.25); ctx.lineTo(cx + ox * r, cy + r * 0.25); ctx.stroke()
  }
  ctx.restore()
}

// Balle de baseball (blanc + coutures rouges)
function baseball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = '#f8f8f0'
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#999'; ctx.lineWidth = 0.5
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.strokeStyle = '#CC1111'; ctx.lineWidth = r * 0.1; ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.1, cy - r * 0.9)
  ctx.bezierCurveTo(cx - r * 0.45, cy - r * 0.45, cx - r * 0.45, cy + r * 0.45, cx - r * 0.1, cy + r * 0.9)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx + r * 0.1, cy - r * 0.9)
  ctx.bezierCurveTo(cx + r * 0.45, cy - r * 0.45, cx + r * 0.45, cy + r * 0.45, cx + r * 0.1, cy + r * 0.9)
  ctx.stroke()
  // Petites barres des coutures
  ctx.lineWidth = r * 0.07
  for (const t of [-0.5, 0, 0.5]) {
    const lx1 = cx - r * 0.1 + t * r * 0.05, ly = cy + t * r * 0.7
    ctx.beginPath(); ctx.moveTo(lx1 - r * 0.12, ly); ctx.lineTo(lx1 + r * 0.12, ly); ctx.stroke()
    const rx1 = cx + r * 0.1 - t * r * 0.05
    ctx.beginPath(); ctx.moveTo(rx1 - r * 0.12, ly); ctx.lineTo(rx1 + r * 0.12, ly); ctx.stroke()
  }
  ctx.restore()
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

      const dpr = window.devicePixelRatio || 1
      const physSize = QR_SIZE * dpr

      // ① Render QR at physical pixel size — finder patterns intact, retina-sharp
      await QRCode.toCanvas(canvas, fullUrl, {
        width: physSize, margin: 2,
        color: { dark: BRAND, light: '#FFFFFF' },
        errorCorrectionLevel: 'H',
      })
      // toCanvas sets canvas.width/height = physSize; fix CSS display size
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`
      if (cancelled) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // All subsequent drawing in physical pixels (no ctx.scale needed)
      const N = QRCode.create(fullUrl, { errorCorrectionLevel: 'H' }).modules.size
      const cell = physSize / (N + 4)  // margin=2 → 4 extra modules
      const q = 2 * cell               // quiet zone offset
      const ballR = cell * 1.55        // covers the 3×3 center dot of each finder

      // ② Small sports ball overlaid on the center 3×3 of each corner finder
      //    Outer ring (1-module dark border) stays intact → scanner works
      const ballsData = [
        { cx: q + 3.5 * cell,          cy: q + 3.5 * cell,          draw: basketball },
        { cx: physSize - q - 3.5*cell, cy: q + 3.5 * cell,          draw: soccer     },
        { cx: q + 3.5 * cell,          cy: physSize - q - 3.5*cell, draw: football   },
        { cx: physSize - q - 3.5*cell, cy: physSize - q - 3.5*cell, draw: baseball   },
      ]
      for (const b of ballsData) {
        ctx.fillStyle = 'white'
        ctx.beginPath(); ctx.arc(b.cx, b.cy, ballR + dpr, 0, Math.PI * 2); ctx.fill()
        b.draw(ctx, b.cx, b.cy, ballR)
      }

      // ③ Logo Memorabilius central (physical pixel coordinates)
      const pcx = physSize / 2, pcy = physSize / 2
      const lgW = LOGO_W * dpr, lgH = LOGO_H * dpr
      const lgPad = 6 * dpr, lgRad = 8 * dpr

      ctx.fillStyle = 'white'
      rrect(ctx, pcx - lgW/2 - lgPad, pcy - lgH/2 - lgPad, lgW + lgPad*2, lgH + lgPad*2, lgRad + lgPad)
      ctx.fill()
      ctx.fillStyle = BRAND
      rrect(ctx, pcx - lgW/2, pcy - lgH/2, lgW, lgH, lgRad)
      ctx.fill()

      try {
        const img = new Image()
        img.src = '/memorabilius-logo-qr.png'
        await img.decode()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, pcx - lgW/2, pcy - lgH/2, lgW, lgH)
      } catch {
        ctx.fillStyle = 'white'
        ctx.font = `bold ${10 * dpr}px Arial, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('MEMORABILIUS', pcx, pcy)
      }
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
