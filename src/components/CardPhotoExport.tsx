'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/lib/LangContext'
import { saveOrShareFile } from '@/lib/saveOrShare'

interface Card {
  f: string; b?: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}
interface Props { card: Card; accent: string; onClose: () => void }

// Résolution haute qualité pour l'impression / le partage grand format --
// une photo statique n'a pas le budget temps-réel de la vidéo (33ms/frame),
// donc on peut se permettre une résolution nettement plus élevée.
const PHOTO_FORMATS = {
  portrait: { w: 1600, h: 2312, label: 'Portrait', ratio: '10:14.4' },
  square:   { w: 1600, h: 1600, label: 'Carré',    ratio: '1:1' },
  story:    { w: 1600, h: 2844, label: 'Story',    ratio: '9:16' },
} as const
type PhotoFormat = keyof typeof PHOTO_FORMATS

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text || ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

// La carte est déjà affichée ailleurs sur la page via un <img> sans crossOrigin
// -- si on redemande la même URL en mode CORS, le navigateur peut resservir
// l'entrée de cache non-CORS existante, ce qui "tainted" le canvas et fait
// échouer toBlob() au moment du download. Un paramètre cache-buster force une
// requête réseau fraîche, correctement négociée en CORS cette fois.
const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise(resolve => {
    const bustedSrc = src + (src.includes('?') ? '&' : '?') + '_cors=1'
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => { const i2 = new Image(); i2.onload = () => resolve(i2); i2.onerror = () => resolve(i2); i2.src = src }
    img.src = bustedSrc
  })

export default function CardPhotoExport({ card, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [pfmt, setPfmt] = useState<PhotoFormat>('portrait')
  const [side, setSide] = useState<'recto' | 'verso'>('recto')
  const [generating, setGenerating] = useState(false)
  const { t } = useLang()

  const hasVerso = !!card.b && card.b !== card.f
  const logoImgs = useRef<{ dark?: HTMLImageElement; light?: HTMLImageElement }>({})
  const imgCache = useRef<{ f?: HTMLImageElement; b?: HTMLImageElement }>({})

  useEffect(() => {
    Promise.all([loadImage('/memorabilius-logo-white.png'), loadImage('/memorabilius-logo.png')]).then(([dark, light]) => {
      logoImgs.current = { dark, light }
      draw()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = PHOTO_FORMATS[pfmt]
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'

    const cache = imgCache.current
    let img: HTMLImageElement
    if (side === 'verso' && card.b) {
      if (!cache.b) cache.b = await loadImage(card.b)
      img = cache.b
    } else {
      if (!cache.f) cache.f = await loadImage(card.f)
      img = cache.f
    }

    const isDark = theme === 'dark'
    const ar = parseInt(accent.slice(1, 3), 16)
    const ag = parseInt(accent.slice(3, 5), 16)
    const ab = parseInt(accent.slice(5, 7), 16)

    const bgBase   = isDark ? '#06060f' : '#f5f0e8'
    const bgBot    = isDark ? '#0d0d22' : '#e8dfd0'
    const infoBg   = isDark ? '#08081a' : '#fdfaf6'
    const textMain = isDark ? '#ffffff' : '#111111'
    const textSub  = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)'

    // ── Fond ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = bgBase; ctx.fillRect(0, 0, w, h)

    const halo = ctx.createRadialGradient(w * 0.85, h * 0.08, 0, w * 0.85, h * 0.08, w * 1.1)
    halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.32 : 0.16})`)
    halo.addColorStop(0.4, `rgba(${ar},${ag},${ab},${isDark ? 0.08 : 0.05})`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h)

    const cr = Math.min(255, 255 - ar + 40)
    const cg = Math.min(255, 255 - ag + 40)
    const cb = Math.min(255, ab + 60)
    const halo2 = ctx.createRadialGradient(w * 0.1, h * 0.92, 0, w * 0.1, h * 0.92, w * 0.75)
    halo2.addColorStop(0, `rgba(${cr},${cg},${cb},${isDark ? 0.14 : 0.07})`)
    halo2.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo2; ctx.fillRect(0, 0, w, h)

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
    bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '99')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h)

    const vig = ctx.createRadialGradient(w / 2, h * 0.44, h * 0.30, w / 2, h * 0.44, h * 0.82)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, isDark ? 'rgba(0,0,0,0.52)' : 'rgba(80,60,30,0.16)')
    ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h)

    // ── Layout ────────────────────────────────────────────────────────────────
    const INFO_H     = Math.round(h * 0.19)
    const CARD_ZONE_H = h - INFO_H
    const CARD_MAX_W  = w * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    const CARD_RATIO  = 3.5 / 2.5
    const cardW = Math.min(CARD_MAX_W, CARD_MAX_H / CARD_RATIO)
    const cardH = cardW * CARD_RATIO
    const cardCY = CARD_ZONE_H / 2
    const cardX = w / 2 - cardW / 2
    const cardTop = cardCY - cardH / 2
    const floorY = cardCY + cardH / 2

    // ── Spotlight ─────────────────────────────────────────────────────────────
    const spotR = cardW * 1.15
    const spot = ctx.createRadialGradient(w / 2, cardCY, 0, w / 2, cardCY, spotR)
    spot.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.24 : 0.13})`)
    spot.addColorStop(0.45, `rgba(${ar},${ag},${ab},${(isDark ? 0.24 : 0.13) * 0.25})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spot
    ctx.fillRect(w / 2 - spotR, cardCY - spotR, spotR * 2, spotR * 2)

    // ── Reflet sol ────────────────────────────────────────────────────────────
    ctx.save()
    ctx.beginPath(); ctx.rect(cardX, floorY, cardW, cardH * 0.52); ctx.clip()
    ctx.translate(w / 2, floorY); ctx.scale(1, -1)
    ctx.globalAlpha = 0.20
    ctx.drawImage(img, -cardW / 2, 0, cardW, cardH)
    ctx.restore()
    const reflFade = ctx.createLinearGradient(0, floorY, 0, floorY + cardH * 0.52)
    reflFade.addColorStop(0, isDark ? 'rgba(0,0,0,0)' : 'rgba(240,244,255,0)')
    reflFade.addColorStop(0.65, bgBot)
    ctx.fillStyle = reflFade
    ctx.fillRect(cardX - 2, floorY, cardW + 4, cardH * 0.52)

    // ── Ombre portée ──────────────────────────────────────────────────────────
    ctx.save()
    ctx.shadowColor = `rgba(0,0,0,${isDark ? 0.80 : 0.45})`
    ctx.shadowBlur = cardW * 0.15
    ctx.shadowOffsetY = cardH * 0.038
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(cardX, cardTop, cardW, cardH)
    ctx.restore()

    // ── Image de la carte ─────────────────────────────────────────────────────
    ctx.drawImage(img, cardX, cardTop, cardW, cardH)

    // ── Gloss diagonal statique + rim light ──────────────────────────────────
    ctx.save()
    ctx.beginPath(); ctx.rect(cardX, cardTop, cardW, cardH); ctx.clip()
    const gloss = ctx.createLinearGradient(cardX, cardTop, cardX + cardW * 0.5, cardTop + cardH)
    gloss.addColorStop(0, 'rgba(255,255,255,0)')
    gloss.addColorStop(0.5, 'rgba(255,255,255,0.16)')
    gloss.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gloss
    ctx.fillRect(cardX, cardTop, cardW, cardH)

    const rimA = isDark ? 0.22 : 0.15
    const rimL = ctx.createLinearGradient(cardX, 0, cardX + cardW * 0.18, 0)
    rimL.addColorStop(0, `rgba(${ar},${ag},${ab},${rimA})`)
    rimL.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rimL; ctx.fillRect(cardX, cardTop, cardW * 0.18, cardH)
    const rimR = ctx.createLinearGradient(cardX + cardW, 0, cardX + cardW * 0.82, 0)
    rimR.addColorStop(0, `rgba(${ar},${ag},${ab},${rimA * 0.7})`)
    rimR.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rimR; ctx.fillRect(cardX + cardW * 0.82, cardTop, cardW * 0.18, cardH)

    const topH = ctx.createLinearGradient(0, cardTop, 0, cardTop + cardH * 0.13)
    topH.addColorStop(0, 'rgba(255,255,255,0.16)')
    topH.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = topH; ctx.fillRect(cardX, cardTop, cardW, cardH * 0.13)
    ctx.restore()

    ctx.lineWidth = Math.max(1.5, w * 0.0025)
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.strokeRect(cardX, cardTop, cardW, cardH)

    // ── Zone infos ────────────────────────────────────────────────────────────
    const infoY = h - INFO_H
    const fadeGrad = ctx.createLinearGradient(0, infoY - INFO_H * 0.42, 0, infoY + 10)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)'); fadeGrad.addColorStop(1, infoBg)
    ctx.fillStyle = fadeGrad; ctx.fillRect(0, infoY - INFO_H * 0.42, w, INFO_H * 0.52)
    ctx.fillStyle = infoBg; ctx.fillRect(0, infoY + 10, w, INFO_H)

    const lineGrad = ctx.createLinearGradient(w * 0.08, 0, w * 0.92, 0)
    lineGrad.addColorStop(0, 'rgba(0,0,0,0)')
    lineGrad.addColorStop(0.2, `rgba(${ar},${ag},${ab},1)`)
    lineGrad.addColorStop(0.5, `rgba(${ar},${ag},${ab},1)`)
    lineGrad.addColorStop(0.8, `rgba(${ar},${ag},${ab},1)`)
    lineGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lineGrad; ctx.fillRect(0, infoY, w, 2)

    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tx = w / 2
    let ty = infoY + INFO_H * 0.09

    // ── Badges ────────────────────────────────────────────────────────────────
    const badgeFs  = Math.round(w * 0.026)
    const badgeH   = Math.round(w * 0.042)
    const badgePad = Math.round(w * 0.026)
    const badgeR   = badgeH / 2

    type BadgeEntry = { label: string; solid?: string; grad?: [string, string]; textColor: string }
    const tags: BadgeEntry[] = []
    if (card.rc) tags.push({ label: '★ RC', grad: ['#e67e22', '#f39c12'], textColor: '#fff' })
    if (card.auto) tags.push({ label: 'AUTO', solid: '#2e7d32', textColor: '#fff' })
    if (card.num) {
      const m = card.num.trim().match(/\/(\d+)$/)
      const n = m ? parseInt(m[1]) : null
      if (n === 1) tags.push({ label: card.num, grad: ['#b8860b', '#ffd700'], textColor: '#3d2800' })
      else if (n !== null && n <= 10) tags.push({ label: card.num, grad: ['#555', '#c0c0c0'], textColor: '#111' })
      else if (n !== null && n <= 25) tags.push({ label: card.num, grad: ['#6d3a00', '#cd7f32'], textColor: '#fff' })
      else tags.push({ label: card.num, solid: '#7b1fa2', textColor: '#fff' })
    }
    if (card.patch) tags.push({ label: 'PATCH', solid: '#1565c0', textColor: '#fff' })
    if (card.g && card.g !== 'Raw') tags.push({ label: card.g, solid: accent, textColor: '#fff' })

    if (tags.length > 0) {
      ctx.font = `800 ${badgeFs}px Inter, sans-serif`
      const widths = tags.map(tg => ctx.measureText(tg.label).width + badgePad * 2)
      const gap = Math.round(w * 0.014)
      const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
      let bx = tx - totalW / 2

      tags.forEach((tag, i) => {
        const bw = widths[i]
        const bcy = ty + badgeH / 2
        if (tag.grad) {
          const g = ctx.createLinearGradient(bx, ty, bx + bw, ty + badgeH)
          g.addColorStop(0, tag.grad[0]); g.addColorStop(1, tag.grad[1])
          ctx.fillStyle = g
        } else {
          ctx.fillStyle = tag.solid!
        }
        ctx.shadowColor = tag.solid || tag.grad![0]
        ctx.shadowBlur = Math.round(w * 0.018)
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH, badgeR); ctx.fill()
        ctx.shadowBlur = 0

        const shine = ctx.createLinearGradient(bx, ty, bx, ty + badgeH * 0.5)
        shine.addColorStop(0, 'rgba(255,255,255,0.28)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = shine
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH * 0.55, [badgeR, badgeR, 0, 0]); ctx.fill()

        ctx.fillStyle = tag.textColor
        ctx.textBaseline = 'middle'
        ctx.fillText(tag.label, bx + bw / 2, bcy)
        ctx.textBaseline = 'top'
        bx += bw + gap
      })
      ty += badgeH + Math.round(INFO_H * 0.07)
    }

    // ── Nom ───────────────────────────────────────────────────────────────────
    const nameFs = Math.round(w * 0.054)
    ctx.fillStyle = textMain
    ctx.font = `900 ${nameFs}px Inter, sans-serif`
    ctx.fillText(truncate(ctx, card.n, w * 0.88), tx, ty)
    ty += nameFs * 1.15

    if (card.v) {
      const varFs = Math.round(w * 0.030)
      ctx.fillStyle = accent
      ctx.font = `600 italic ${varFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.v, w * 0.84), tx, ty)
      ty += varFs * 1.3
    }
    if (card.t) {
      const teamFs = Math.round(w * 0.026)
      ctx.fillStyle = textSub
      ctx.font = `700 ${teamFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.t, w * 0.80), tx, ty)
      ty += teamFs * 1.35
    }
    const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    if (meta2) {
      const metaFs = Math.round(w * 0.022)
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
      ctx.font = `400 ${metaFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, meta2, w * 0.80), tx, ty)
    }

    // ── Logo watermark ────────────────────────────────────────────────────────
    const logoImg = isDark ? logoImgs.current.dark : logoImgs.current.light
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoW = w * 0.19
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
      ctx.globalAlpha = isDark ? 0.50 : 0.65
      ctx.drawImage(logoImg, w - logoW - w * 0.03, h - logoH - h * 0.014, logoW, logoH)
      ctx.globalAlpha = 1
    } else {
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.55)` : `rgba(${ar},${ag},${ab},0.7)`
      ctx.font = `600 ${Math.round(w * 0.026)}px Inter, sans-serif`
      ctx.fillText('memorabilius.fr', w - Math.round(w * 0.03), h - Math.round(h * 0.012))
    }
  }

  useEffect(() => { draw() }, [pfmt, theme, side]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setGenerating(true)
    try {
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95))
      if (blob) await saveOrShareFile(blob, `${card.n.replace(/\s+/g, '_')}_memorabilius.jpg`)
    } finally { setGenerating(false) }
  }

  const chip = (active: boolean) => ({
    padding: '7px 16px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? accent : 'rgba(255,255,255,0.09)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    transition: '0.15s',
  })

  const { w, h } = PHOTO_FORMATS[pfmt]

  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d22', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', textAlign: 'center', border: `1px solid ${accent}44` }}>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 17, margin: '0 0 4px' }}>
          📸 {t('photo_export_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: '0 0 16px' }}>
          {card.n}{card.v ? ` · ${card.v}` : ''}
        </p>

        <canvas ref={canvasRef} width={w} height={h}
          style={{ width: '100%', maxWidth: 240, height: 'auto', borderRadius: 10, display: 'block', margin: '0 auto 18px', border: `1px solid ${accent}33`, background: '#080818' }} />

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Format</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {(Object.entries(PHOTO_FORMATS) as [PhotoFormat, typeof PHOTO_FORMATS[PhotoFormat]][]).map(([key, f]) => (
                <button key={key} style={chip(pfmt === key)} onClick={() => setPfmt(key)}>
                  {f.label} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.ratio}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>{t('video_theme')}</p>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              <button style={chip(theme === 'dark')} onClick={() => setTheme('dark')}>🌙 {t('video_dark')}</button>
              <button style={chip(theme === 'light')} onClick={() => setTheme('light')}>☀️ {t('video_light')}</button>
            </div>
          </div>
          {hasVerso && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>{t('photo_export_side_recto')} / {t('photo_export_side_verso')}</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={chip(side === 'recto')} onClick={() => setSide('recto')}>{t('photo_export_side_recto')}</button>
                <button style={chip(side === 'verso')} onClick={() => setSide('verso')}>{t('photo_export_side_verso')}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={download} disabled={generating} style={{ background: generating ? 'rgba(46,125,50,0.5)' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: generating ? 'default' : 'pointer', fontSize: 14 }}>
            {generating ? t('photo_export_generating') : `⬇ ${t('photo_export_download')}`}
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {t('gallery_close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
