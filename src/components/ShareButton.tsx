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
const BASKET = '#E8621A'
const QR_SIZE = 220

function drawBasketball(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Fond orange
  ctx.fillStyle = BASKET
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // Lignes de couture — clippées dans le cercle
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = Math.max(1, r * 0.08)
  ctx.lineCap = 'round'

  // Ligne horizontale
  ctx.beginPath()
  ctx.moveTo(cx - r, cy)
  ctx.lineTo(cx + r, cy)
  ctx.stroke()

  // Ligne verticale
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.lineTo(cx, cy + r)
  ctx.stroke()

  // Courbe gauche
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.28, cy - r)
  ctx.bezierCurveTo(cx - r * 0.85, cy - r * 0.45, cx - r * 0.85, cy + r * 0.45, cx - r * 0.28, cy + r)
  ctx.stroke()

  // Courbe droite
  ctx.beginPath()
  ctx.moveTo(cx + r * 0.28, cy - r)
  ctx.bezierCurveTo(cx + r * 0.85, cy - r * 0.45, cx + r * 0.85, cy + r * 0.45, cx + r * 0.28, cy + r)
  ctx.stroke()

  ctx.restore()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export default function ShareButton({ url, title, compact, buttonStyle }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { t } = useLang()

  const fullUrl = `https://www.memorabilius.fr${url}`

  useEffect(() => {
    if (!showModal) return
    let cancelled = false
    const timer = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      // Canvas DPR-aware pour netteté retina
      const dpr = window.devicePixelRatio || 1
      canvas.width = QR_SIZE * dpr
      canvas.height = QR_SIZE * dpr
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      // Matrice QR brute (modules)
      const qr = QRCode.create(fullUrl, { errorCorrectionLevel: 'H' })
      const N = qr.modules.size
      const quiet = 2   // modules de marge
      const cell = QR_SIZE / (N + quiet * 2)

      // Fond blanc
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, QR_SIZE, QR_SIZE)

      // Modules ronds (cercles)
      ctx.fillStyle = BRAND
      for (let row = 0; row < N; row++) {
        for (let col = 0; col < N; col++) {
          if (!qr.modules.get(row, col)) continue
          const x = (quiet + col + 0.5) * cell
          const y = (quiet + row + 0.5) * cell
          ctx.beginPath()
          ctx.arc(x, y, cell * 0.43, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (cancelled) return

      const cx = QR_SIZE / 2
      const cy = QR_SIZE / 2

      // Mini ballons de basket dans la zone de données (pas dans les coins)
      // Positions choisies loin des finder patterns (coins) et du logo central
      const miniR = 6
      const miniPositions = [
        { x: 50,  y: 65  },  // entre TL finder et le centre
        { x: 170, y: 65  },  // entre TR finder et le centre
        { x: 50,  y: 155 },  // entre BL finder et le centre
        { x: 170, y: 155 },  // coin bas-droit de la zone de données
      ]
      for (const p of miniPositions) {
        // Effacer les modules derrière
        ctx.fillStyle = 'white'
        ctx.beginPath()
        ctx.arc(p.x, p.y, miniR + 3, 0, Math.PI * 2)
        ctx.fill()
        drawBasketball(ctx, p.x, p.y, miniR)
      }

      // Logo central MEMORABILIUS
      const logoW = 114, logoH = 24, logoR = 8
      const lgPad = 6

      // Bordure blanche
      ctx.fillStyle = 'white'
      rrect(ctx, cx - logoW/2 - lgPad, cy - logoH/2 - lgPad,
            logoW + lgPad*2, logoH + lgPad*2, logoR + lgPad)
      ctx.fill()

      // Rectangle bleu
      ctx.fillStyle = BRAND
      rrect(ctx, cx - logoW/2, cy - logoH/2, logoW, logoH, logoR)
      ctx.fill()

      // Texte
      ctx.fillStyle = 'white'
      ctx.font = 'bold 10px Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('MEMORABILIUS', cx, cy)
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
