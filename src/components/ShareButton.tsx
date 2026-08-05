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
const LOGO_W = 100
const LOGO_H = 22

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

function drawFinder(ctx: CanvasRenderingContext2D, fx: number, fy: number, cell: number) {
  const s = 7 * cell
  const r1 = cell * 0.9   // outer corner radius
  const r2 = cell * 0.6   // inner white gap radius
  const r3 = cell * 0.55  // center dot radius
  ctx.fillStyle = BRAND
  rrect(ctx, fx, fy, s, s, r1); ctx.fill()
  ctx.fillStyle = 'white'
  rrect(ctx, fx + cell, fy + cell, 5 * cell, 5 * cell, r2); ctx.fill()
  ctx.fillStyle = BRAND
  rrect(ctx, fx + 2 * cell, fy + 2 * cell, 3 * cell, 3 * cell, r3); ctx.fill()
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

      canvas.width = physSize
      canvas.height = physSize
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Compute module grid
      const qr = QRCode.create(fullUrl, { errorCorrectionLevel: 'H' })
      const N = qr.modules.size
      const cell = physSize / (N + 4) // margin=2 → 4 extra modules
      const q = 2 * cell              // quiet zone offset in px

      // White background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, physSize, physSize)

      // Finder zone exclusion (finder 7×7 + 1-module separator = 8 wide)
      const inFinder = (r: number, c: number) =>
        (r < 8 && c < 8) ||
        (r < 8 && c >= N - 8) ||
        (r >= N - 8 && c < 8)

      // Logo zone exclusion — keeps module area clear behind the logo
      const lgW = (LOGO_W + 18) * dpr
      const lgH = (LOGO_H + 18) * dpr
      const lgX0 = physSize / 2 - lgW / 2
      const lgY0 = physSize / 2 - lgH / 2
      const inLogo = (r: number, c: number) => {
        const px = q + (c + 0.5) * cell
        const py = q + (r + 0.5) * cell
        return px > lgX0 && px < lgX0 + lgW && py > lgY0 && py < lgY0 + lgH
      }

      // Draw data modules as circles
      const dotR = cell * 0.43
      ctx.fillStyle = BRAND
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (inFinder(r, c) || inLogo(r, c)) continue
          if (!qr.modules.get(r, c)) continue
          const x = q + (c + 0.5) * cell
          const y = q + (r + 0.5) * cell
          ctx.beginPath()
          ctx.arc(x, y, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (cancelled) return

      // Draw 3 styled finder patterns (rounded squares, proper structure)
      drawFinder(ctx, q, q, cell)
      drawFinder(ctx, q + (N - 7) * cell, q, cell)
      drawFinder(ctx, q, q + (N - 7) * cell, cell)

      // Logo — white halo → blue badge → PNG
      const cx = physSize / 2, cy = physSize / 2
      const bW = LOGO_W * dpr, bH = LOGO_H * dpr
      const pad = 8 * dpr, bR = 7 * dpr

      // White halo (blends into QR white background, hides any dots beneath)
      ctx.fillStyle = 'white'
      rrect(ctx, cx - bW / 2 - pad, cy - bH / 2 - pad, bW + pad * 2, bH + pad * 2, bR + pad)
      ctx.fill()

      // Blue badge
      ctx.fillStyle = BRAND
      rrect(ctx, cx - bW / 2, cy - bH / 2, bW, bH, bR)
      ctx.fill()

      // Thin white ring around badge for visual separation
      ctx.strokeStyle = 'white'
      ctx.lineWidth = dpr * 1.5
      rrect(ctx, cx - bW / 2 + dpr, cy - bH / 2 + dpr, bW - dpr * 2, bH - dpr * 2, bR - dpr)
      ctx.stroke()

      // Logo image
      try {
        const img = new Image()
        img.src = '/memorabilius-logo-qr.png'
        await img.decode()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, cx - bW / 2, cy - bH / 2, bW, bH)
      } catch {
        ctx.fillStyle = 'white'
        ctx.font = `bold ${9 * dpr}px Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('MEMORABILIUS', cx, cy)
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
