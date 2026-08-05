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
const LOGO_SIZE = 46
// Icône app embarquée (android-chrome 192x192 → 96x96) — pas de requête réseau dans le canvas
const ICON_B64 = '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'

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
      })
      if (cancelled) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      // Logo Memorabilius centré — icône en base64 rendue blanche sur cercle bleu
      const cx = QR_SIZE / 2
      const cy = QR_SIZE / 2
      const r = LOGO_SIZE / 2
      const pad = 6
      // Fond blanc carré
      ctx.fillStyle = 'white'
      ctx.fillRect(cx - r - pad, cy - r - pad, (r + pad) * 2, (r + pad) * 2)
      // Cercle bleu
      ctx.fillStyle = BRAND
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      // Icône : rendue blanche via offscreen canvas (destination-in)
      await new Promise<void>(resolve => {
        const logo = new Image()
        logo.onload = () => {
          const tmp = document.createElement('canvas')
          tmp.width = tmp.height = LOGO_SIZE * 2
          const tc = tmp.getContext('2d')!
          tc.fillStyle = 'white'
          tc.fillRect(0, 0, tmp.width, tmp.height)
          tc.globalCompositeOperation = 'destination-in'
          tc.drawImage(logo, 0, 0, tmp.width, tmp.height)
          ctx.drawImage(tmp, cx - r, cy - r, LOGO_SIZE, LOGO_SIZE)
          resolve()
        }
        logo.onerror = () => resolve()
        logo.src = `data:image/png;base64,${ICON_B64}`
      })
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
