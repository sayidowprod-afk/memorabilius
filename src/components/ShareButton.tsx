'use client'
import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useLang } from '@/lib/LangContext'

interface Props {
  url: string
  title: string
  compact?: boolean
}

const BRAND = '#003DA6'
const QR_SIZE = 220
const LOGO_SIZE = 46

export default function ShareButton({ url, title, compact }: Props) {
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
      const logo = new Image()
      logo.onload = () => {
        if (cancelled) return
        const x = (QR_SIZE - LOGO_SIZE) / 2
        const y = (QR_SIZE - LOGO_SIZE) / 2
        const pad = 5
        ctx.fillStyle = 'white'
        ctx.fillRect(x - pad, y - pad, LOGO_SIZE + pad * 2, LOGO_SIZE + pad * 2)
        ctx.drawImage(logo, x, y, LOGO_SIZE, LOGO_SIZE)
      }
      logo.src = '/memorabilius-logo-transparent.png'
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

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title, url: fullUrl })
    } else {
      setShowModal(true)
    }
  }

  return (
    <>
      <button onClick={share} style={{
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
