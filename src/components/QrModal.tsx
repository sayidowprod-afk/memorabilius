'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface QrModalProps {
  url: string
  title: string
  onClose: () => void
}

export default function QrModal({ url, title, onClose }: QrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then(QRCode => {
      if (cancelled) return
      const fullUrl = url.startsWith('http') ? url : `https://memorabilius.fr${url}`
      QRCode.toDataURL(fullUrl, { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } })
        .then(du => { if (!cancelled) setDataUrl(du) })
    })
    return () => { cancelled = true }
  }, [url])

  const download = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
    a.click()
  }

  const modal = (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 340, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>QR Code</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ fontSize: 13, color: '#555', textAlign: 'center', fontWeight: 600 }}>{title}</div>

        {dataUrl ? (
          <img src={dataUrl} alt="QR Code" style={{ width: 220, height: 220, imageRendering: 'pixelated' }} />
        ) : (
          <div style={{ width: 220, height: 220, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
            Génération…
          </div>
        )}

        <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', wordBreak: 'break-all' }}>
          memorabilius.fr{url.startsWith('http') ? '' : url}
        </div>

        <button
          onClick={download}
          disabled={!dataUrl}
          style={{
            background: dataUrl ? '#003DA6' : '#ccc',
            color: '#fff', border: 'none', borderRadius: 50, padding: '11px 24px',
            fontWeight: 800, fontSize: 14, cursor: dataUrl ? 'pointer' : 'default', width: '100%',
          }}
        >
          ⬇ Télécharger PNG
        </button>

        <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center' }}>
          Imprime ce QR et colle-le sur ton classeur physique
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
