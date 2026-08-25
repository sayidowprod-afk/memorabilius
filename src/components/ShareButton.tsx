'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { useLang } from '@/lib/LangContext'
import { useIsNative } from '@/lib/useIsNative'
import { saveOrShareFile } from '@/lib/saveOrShare'

interface Props {
  url: string
  title: string
  subtitle?: string
  compact?: boolean
  // Etiquette sous l'icone en mode compact -- les tooltips `title` ne
  // s'affichent jamais au toucher (mobile), un bouton icone seul y reste
  // incomprehensible. Optionnel pour ne pas casser les usages existants.
  showLabel?: boolean
  buttonStyle?: React.CSSProperties
  // Contrôle externe (ex: déclenché depuis un menu "···") — si `open` est
  // fourni, le composant devient contrôlé et n'affiche plus son propre bouton
  // à moins que hideTrigger soit explicitement false.
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
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


export default function ShareButton({ url, title, subtitle, compact, showLabel, buttonStyle, open, onOpenChange, hideTrigger }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const showModal = open !== undefined ? open : internalOpen
  const setShowModal = (v: boolean) => {
    if (onOpenChange) onOpenChange(v)
    if (open === undefined) setInternalOpen(v)
  }
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { t } = useLang()
  const isNative = useIsNative()

  const fullUrl = `https://www.memorabilius.fr${url}`

  const openShare = async () => {
    if (isNative) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title, text: subtitle, url: fullUrl, dialogTitle: t('gallery_share') })
        return
      } catch {}
    }
    setShowModal(true)
  }

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

  const downloadQR = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const phys = canvas.width  // 880 px
    const lines: { text: string; size: number; weight: string; color: string }[] = []
    if (title) lines.push({ text: title, size: 38, weight: '800', color: '#111111' })
    if (subtitle) lines.push({ text: subtitle, size: 28, weight: '600', color: '#555555' })

    if (lines.length === 0) {
      await saveOrShareFile(canvas.toDataURL('image/png'), 'memorabilius-qr.png')
      return
    }

    const lineH = 52
    const topPad = 32
    const botPad = 40
    const out = document.createElement('canvas')
    out.width = phys
    out.height = phys + topPad + lines.length * lineH + botPad
    const ctx = out.getContext('2d')!

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(canvas, 0, 0)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    let y = phys + topPad
    for (const l of lines) {
      ctx.font = `${l.weight} ${l.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillStyle = l.color
      ctx.fillText(l.text, phys / 2, y, phys - 40)
      y += lineH
    }

    await saveOrShareFile(out.toDataURL('image/png'), 'memorabilius-qr.png')
  }

  return (
    <>
      {!hideTrigger && (
        <button onClick={openShare} title={t('gallery_share')} aria-label={t('gallery_share')} style={buttonStyle ?? {
          background: 'none', border: '1px solid #ddd', borderRadius: 8,
          padding: compact ? (showLabel ? '6px 8px' : '10px 10px') : '6px 12px', cursor: 'pointer',
          fontSize: compact ? 16 : 13, fontWeight: 700,
          color: '#666', display: 'flex', flexDirection: compact && showLabel ? 'column' : 'row', alignItems: 'center', gap: compact && showLabel ? 2 : 6,
        }}>
          {compact ? '🔗' : t('gallery_share')}
          {compact && showLabel && <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1 }}>{t('gallery_share')}</span>}
        </button>
      )}

      {showModal && createPortal(
        <div onClick={() => setShowModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 10000002, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
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
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {copied ? <><span className="selection-check-pop">✓</span> Copié</> : 'Copier'}
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
        </div>,
        document.body
      )}
    </>
  )
}
