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
const LOGO_W = 130    // badge logo (px CSS)
const LOGO_H = 28

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

      // Canvas 4× → crisp écran toute DPR + print-ready à 300 dpi (~7 cm)
      canvas.width = QR_SIZE * SCALE
      canvas.height = QR_SIZE * SCALE
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(SCALE, SCALE)  // tout le dessin en coordonnées CSS (px)

      // 'M' = 15 % de correction → modules plus grands pour même URL vs 'H' (30 %)
      const qr = QRCode.create(fullUrl, { errorCorrectionLevel: 'M' })
      const N = qr.modules.size
      const cell = QR_SIZE / (N + 4)  // marge 2 modules × 2 côtés = 4
      const q = 2 * cell

      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, QR_SIZE, QR_SIZE)

      const inFinder = (r: number, c: number) =>
        (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8)

      const lgPad = 9
      const lgX0 = QR_SIZE / 2 - (LOGO_W + lgPad * 2) / 2
      const lgY0 = QR_SIZE / 2 - (LOGO_H + lgPad * 2) / 2
      const inLogo = (r: number, c: number) => {
        const px = q + (c + 0.5) * cell
        const py = q + (r + 0.5) * cell
        return px > lgX0 && px < lgX0 + LOGO_W + lgPad * 2
            && py > lgY0 && py < lgY0 + LOGO_H + lgPad * 2
      }

      const dotR = cell * 0.46
      ctx.fillStyle = BRAND
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (inFinder(r, c) || inLogo(r, c)) continue
          if (!qr.modules.get(r, c)) continue
          ctx.beginPath()
          ctx.arc(q + (c + 0.5) * cell, q + (r + 0.5) * cell, dotR, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (cancelled) return

      drawFinder(ctx, q, q, cell)
      drawFinder(ctx, q + (N - 7) * cell, q, cell)
      drawFinder(ctx, q, q + (N - 7) * cell, cell)

      // Logo : halo blanc → badge bleu → PNG
      const cx = QR_SIZE / 2, cy = QR_SIZE / 2
      const bR = 7

      ctx.fillStyle = 'white'
      rrect(ctx, cx - LOGO_W / 2 - lgPad, cy - LOGO_H / 2 - lgPad,
            LOGO_W + lgPad * 2, LOGO_H + lgPad * 2, bR + lgPad)
      ctx.fill()

      ctx.fillStyle = BRAND
      rrect(ctx, cx - LOGO_W / 2, cy - LOGO_H / 2, LOGO_W, LOGO_H, bR)
      ctx.fill()

      try {
        const img = new Image()
        img.src = '/memorabilius-logo-qr.png'
        await img.decode()
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, cx - LOGO_W / 2, cy - LOGO_H / 2, LOGO_W, LOGO_H)
      } catch {
        ctx.fillStyle = 'white'
        ctx.font = 'bold 10px Arial, sans-serif'
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
