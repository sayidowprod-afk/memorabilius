'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useIsNative } from '@/lib/useIsNative'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { levelFromXP } from '@/lib/leveling'

interface Props {
  userId: string
  url: string
  displayName: string
  avatarUrl: string
  accent: string
  totalCards: number
  isDonor?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BRAND = '#003DA6'
const QR_SIZE = 130
const QR_SCALE = 4
const QR_LOGO_W = 95   // même ratio que ShareButton (160/220 du QR)
const QR_LOGO_H = 21
const CARD_W = 320

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (n >> 16) + amt))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt))
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}

export default function CollectorCard({ userId, url, displayName, avatarUrl, accent, totalCards, isDonor, open, onOpenChange }: Props) {
  const { t } = useLang()
  const isNative = useIsNative()
  const [copied, setCopied] = useState(false)
  const [level, setLevel] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  const fullUrl = `https://www.memorabilius.fr${url}`
  const dark = shade(accent, -40)

  useEffect(() => {
    if (!open) return
    supabase.rpc('get_user_xp_total', { p_user_id: userId }).then(({ data }) => {
      setLevel(levelFromXP(data ?? 0).level)
    })
  }, [open, userId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const canvas = qrCanvasRef.current
      if (!canvas || cancelled) return
      const phys = QR_SIZE * QR_SCALE

      // QR bleu de marque + badge logo au centre — même design que le QR
      // de partage générique (ShareButton).
      await QRCode.toCanvas(canvas, fullUrl, {
        width: phys, margin: 2, errorCorrectionLevel: 'H',
        color: { dark: BRAND, light: '#ffffff' },
      })
      canvas.style.width = `${QR_SIZE}px`
      canvas.style.height = `${QR_SIZE}px`
      if (cancelled) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const cx = phys / 2, cy = phys / 2
      const lgW = QR_LOGO_W * QR_SCALE
      const lgH = QR_LOGO_H * QR_SCALE
      const pad = 3 * QR_SCALE, bR = 6 * QR_SCALE

      ctx.fillStyle = 'white'
      rrect(ctx, cx - lgW / 2 - pad, cy - lgH / 2 - pad, lgW + pad * 2, lgH + pad * 2, bR + pad)
      ctx.fill()

      ctx.fillStyle = BRAND
      rrect(ctx, cx - lgW / 2, cy - lgH / 2, lgW, lgH, bR)
      ctx.fill()

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
  }, [open, fullUrl])

  async function downloadCard() {
    const node = cardRef.current
    if (!node || downloading) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(node, { scale: 3, backgroundColor: null, useCORS: true })
      await saveOrShareFile(canvas.toDataURL('image/png'), 'memorabilius-carte-collectionneur.png')
    } finally {
      setDownloading(false)
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(fullUrl)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function nativeShare() {
    if (isNative) {
      try {
        const { Share } = await import('@capacitor/share')
        await Share.share({ title: displayName, text: t('gallery_share_subtitle'), url: fullUrl, dialogTitle: t('gallery_share') })
        return
      } catch {}
    }
    downloadCard()
  }

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div onClick={() => onOpenChange(false)} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => onOpenChange(false)} style={{
            position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%',
            background: 'white', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 1,
          }}>×</button>

          {/* Carte capturée pour le téléchargement */}
          <div ref={cardRef} style={{
            width: CARD_W, borderRadius: 24, overflow: 'hidden',
            background: `linear-gradient(160deg, ${accent}, ${dark})`,
            boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            <div style={{ padding: '30px 26px 22px', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', marginBottom: 16 }}>
                {t('collectorcard_eyebrow')}
              </div>
              <img src={avatarUrl} alt={displayName} crossOrigin="anonymous" style={{
                width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
                border: '3px solid rgba(255,255,255,0.9)', boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                display: 'block', margin: '0 auto 14px',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 21, fontWeight: 900, color: 'white' }}>{displayName}</div>
                {isDonor && <span style={{ fontSize: 14 }}>✨</span>}
              </div>
              {level != null && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
                  {t('word_level')} {level}
                </div>
              )}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.97)', padding: '20px 26px 26px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>{totalCards.toLocaleString()}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('collectorcard_cards_label')}</div>
                </div>
              </div>

              <div style={{ background: '#f4f6fb', borderRadius: 14, padding: 12, display: 'inline-block', marginBottom: 12 }}>
                <canvas ref={qrCanvasRef} style={{ display: 'block', borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 10.5, color: '#999', fontWeight: 600, marginBottom: 4 }}>{t('collectorcard_scan_hint')}</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: accent, letterSpacing: 0.5 }}>MEMORABILIUS.FR</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={isNative ? nativeShare : downloadCard} disabled={downloading} style={{
            background: 'white', color: '#111', border: 'none', borderRadius: 10,
            padding: '10px 18px', fontWeight: 700, cursor: downloading ? 'default' : 'pointer', fontSize: 13,
            opacity: downloading ? 0.6 : 1, boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          }}>
            {downloading ? '…' : isNative ? `📤 ${t('gallery_share')}` : `⬇ ${t('collectorcard_download')}`}
          </button>
          <button onClick={copy} style={{
            background: copied ? '#2ecc71' : 'rgba(255,255,255,0.15)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '10px 18px',
            fontWeight: 700, cursor: 'pointer', fontSize: 13, transition: 'background 0.2s',
          }}>
            {copied ? `✓ ${t('collectorcard_copied')}` : t('collectorcard_copy_link')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(displayName)}&url=${encodeURIComponent(fullUrl)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ background: '#f0f0f0', color: '#333', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            𝕏 Twitter
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ background: '#e8f0fe', color: '#1877F2', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            Facebook
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(displayName + ' ' + fullUrl)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ background: '#e8f5e9', color: '#25D366', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            WhatsApp
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}
