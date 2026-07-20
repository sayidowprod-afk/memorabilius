'use client'
import { useRef, useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}
interface Props { card: Card; accent: string; onClose: () => void }

const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth < 768
const VIDEO_FORMATS = {
  default: { w: 900,  h: 1300, label: 'Défaut',  ratio: '9:13' },
  reel:    { w: 1080, h: 1920, label: 'Reel',    ratio: '9:16' },
  square:  { w: 1080, h: 1080, label: 'Carré',   ratio: '1:1'  },
} as const
type VideoFormat = keyof typeof VIDEO_FORMATS

const PARTICLE_COUNT = IS_MOBILE ? 20 : 50
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (i * 137.508) % 1,
  y: (i * 97.3) % 1,
  r: 0.8 + (i % 4) * 0.7,
  speed: 0.05 + (i % 6) * 0.02,
  phase: i * 0.73,
}))


function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text || ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export default function CardVideoExport({ card, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [codec, setCodec] = useState<'webm' | 'mp4'>('webm')
  const [vfmt, setVfmt] = useState<VideoFormat>('default')
  const { lang } = useLang()

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const DURATION = 6000
  const FPS = isMobile ? 30 : 60
  const themeRef = useRef(theme)
  const vfmtRef = useRef(vfmt)
  themeRef.current = theme
  vfmtRef.current = vfmt

  const previewImgs = useRef<{ f?: HTMLImageElement; b?: HTMLImageElement }>({})
  const logoImgs = useRef<{ dark?: HTMLImageElement; light?: HTMLImageElement }>({})
  const bgCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)

  useEffect(() => {
    const load = (src: string) => new Promise<HTMLImageElement>(r => {
      const i = new Image(); i.onload = () => r(i); i.onerror = () => r(i); i.src = src
    })
    Promise.all([load('/memorabilius-logo-white.png'), load('/memorabilius-logo.png')]).then(([dark, light]) => {
      logoImgs.current = { dark, light }
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = VIDEO_FORMATS[vfmt]
    canvas.width = w; canvas.height = h
    if (recording) return
    let cancelled = false
    const paint = (fImg: HTMLImageElement, bImg: HTMLImageElement) => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
      drawFrame(ctx, fImg, bImg, 0.1)
    }
    const cached = previewImgs.current
    if (cached.f && cached.b) { paint(cached.f, cached.b) }
    else {
      Promise.all([loadImage(card.f), loadImage(card.b || card.f)]).then(([f, b]) => {
        previewImgs.current = { f, b }
        paint(f, b)
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vfmt, theme, recording])

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => { const i2 = new Image(); i2.onload = () => resolve(i2); i2.onerror = () => resolve(i2); i2.src = src }
      img.src = src
    })

  const drawFrame = (ctx: CanvasRenderingContext2D, frontImg: HTMLImageElement, backImg: HTMLImageElement, p: number) => {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const isDark = themeRef.current === 'dark'
    const ar = parseInt(accent.slice(1, 3), 16)
    const ag = parseInt(accent.slice(3, 5), 16)
    const ab = parseInt(accent.slice(5, 7), 16)

    const bgBase   = isDark ? '#06060f' : '#f5f0e8'
    const bgBot    = isDark ? '#0d0d22' : '#e8dfd0'
    const infoBg   = isDark ? '#08081a' : '#fdfaf6'
    const textMain = isDark ? '#ffffff' : '#111111'
    const textSub  = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)'

    // ── Fond statique mis en cache ────────────────────────────────────────────
    const bgKey = `${W}x${H}-${isDark}-${accent}`
    if (!bgCache.current || bgCache.current.key !== bgKey) {
      const oc = document.createElement('canvas')
      oc.width = W; oc.height = H
      const octx = oc.getContext('2d')!

      octx.fillStyle = bgBase; octx.fillRect(0, 0, W, H)

      // Halo principal — haut-droite, couleur accent
      const halo = octx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 1.1)
      halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.32 : 0.16})`)
      halo.addColorStop(0.4, `rgba(${ar},${ag},${ab},${isDark ? 0.08 : 0.05})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      octx.fillStyle = halo; octx.fillRect(0, 0, W, H)

      // Halo secondaire — bas-gauche, teinte complémentaire pour la profondeur
      const cr = Math.min(255, 255 - ar + 40)
      const cg = Math.min(255, 255 - ag + 40)
      const cb = Math.min(255, ab + 60)
      const halo2 = octx.createRadialGradient(W * 0.1, H * 0.92, 0, W * 0.1, H * 0.92, W * 0.75)
      halo2.addColorStop(0, `rgba(${cr},${cg},${cb},${isDark ? 0.14 : 0.07})`)
      halo2.addColorStop(1, 'rgba(0,0,0,0)')
      octx.fillStyle = halo2; octx.fillRect(0, 0, W, H)

      // Dégradé vertical vers le bas
      const bgGrad = octx.createLinearGradient(0, 0, 0, H)
      bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '99')
      octx.fillStyle = bgGrad; octx.fillRect(0, 0, W, H)

      // Vignette — assombrit les coins pour la profondeur premium
      const vig = octx.createRadialGradient(W / 2, H * 0.44, H * 0.30, W / 2, H * 0.44, H * 0.82)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, isDark ? 'rgba(0,0,0,0.52)' : 'rgba(80,60,30,0.16)')
      octx.fillStyle = vig; octx.fillRect(0, 0, W, H)

      bgCache.current = { key: bgKey, canvas: oc }
    }
    ctx.drawImage(bgCache.current.canvas, 0, 0)

    // ── Particules montantes ──────────────────────────────────────────────────
    PARTICLES.forEach(({ x, y, r, speed, phase }) => {
      const py = ((y * H - p * speed * H * 3) % H + H) % H
      const a = (isDark ? 0.06 : 0.10) + 0.04 * Math.sin(p * Math.PI * 5 + phase)
      ctx.beginPath(); ctx.arc(x * W, py, r, 0, Math.PI * 2)
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab + 60},${a})` : `rgba(80,80,220,${a})`
      ctx.fill()
    })

    // ── Layout ────────────────────────────────────────────────────────────────
    const INFO_H     = Math.round(H * 0.19)
    const CARD_ZONE_H = H - INFO_H
    const CARD_MAX_W  = W * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    const CARD_RATIO  = 3.5 / 2.5
    const BASE_W = Math.min(CARD_MAX_W, CARD_MAX_H / CARD_RATIO)
    const BASE_H = BASE_W * CARD_RATIO
    const CARD_CY = CARD_ZONE_H / 2

    // ── Animation de la carte ─────────────────────────────────────────────────
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))
    let rot: number
    if (p < 0.32)      rot = 0
    else if (p < 0.48) rot = Math.PI * easeInOut(seg(p, 0.32, 0.48))
    else if (p < 0.78) rot = Math.PI
    else if (p < 0.92) rot = Math.PI + Math.PI * easeInOut(seg(p, 0.78, 0.92))
    else               rot = 0

    const scaleX   = Math.cos(rot)
    const absScale = Math.abs(scaleX)
    const showBack = scaleX < 0
    const face     = showBack ? backImg : frontImg
    const bob      = Math.sin(p * Math.PI * 2) * H * 0.006
    const zoom     = 1 + 0.03 * Math.sin(p * Math.PI * 2)
    const cardW    = BASE_W * absScale * zoom
    const cardH    = BASE_H * zoom
    const cardCY   = CARD_CY + bob
    const cardX    = W / 2 - cardW / 2
    const cardTop  = cardCY - cardH / 2
    // ── Spotlight animé — suit la carte pendant le flip ───────────────────────
    const pulse  = 1 + 0.08 * Math.sin(p * Math.PI * 3)
    const spotR  = BASE_W * 1.15 * pulse
    const spotX  = W / 2 + Math.sin(rot) * BASE_W * 0.18
    const spotA0 = isDark ? 0.24 : 0.13
    const spot   = ctx.createRadialGradient(spotX, CARD_CY, 0, spotX, CARD_CY, spotR)
    spot.addColorStop(0, `rgba(${ar},${ag},${ab},${spotA0})`)
    spot.addColorStop(0.45, `rgba(${ar},${ag},${ab},${spotA0 * 0.25})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spot
    ctx.fillRect(spotX - spotR, CARD_CY - spotR, spotR * 2, spotR * 2)

    if (cardW > 2) {
      const floorY = cardCY + cardH / 2

      // ── Reflet sol ────────────────────────────────────────────────────────
      ctx.save()
      ctx.beginPath()
      ctx.rect(cardX, floorY, cardW, cardH * 0.52)
      ctx.clip()
      ctx.translate(W / 2, floorY)
      ctx.scale(1, -1)
      ctx.globalAlpha = 0.20 * absScale
      ctx.drawImage(face, -cardW / 2, 0, cardW, cardH)
      ctx.restore()
      // Fondu du reflet
      const reflFade = ctx.createLinearGradient(0, floorY, 0, floorY + cardH * 0.52)
      reflFade.addColorStop(0, isDark ? 'rgba(0,0,0,0)' : 'rgba(240,244,255,0)')
      reflFade.addColorStop(0.65, bgBot)
      ctx.fillStyle = reflFade
      ctx.fillRect(cardX - 2, floorY, cardW + 4, cardH * 0.52)

      // ── Ombre portée ──────────────────────────────────────────────────────
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${isDark ? 0.80 : 0.45})`
      ctx.shadowBlur   = BASE_W * (IS_MOBILE ? 0.06 : 0.15)
      ctx.shadowOffsetY = BASE_H * 0.038
      ctx.fillStyle = `rgba(0,0,0,0.85)`
      ctx.fillRect(cardX, cardTop, cardW, cardH)
      ctx.restore()

      // ── Image de la carte ─────────────────────────────────────────────────
      ctx.drawImage(face, cardX, cardTop, cardW, cardH)

      // ── Gloss blanc diagonal ──────────────────────────────────────────────
      ctx.save()
      ctx.beginPath(); ctx.rect(cardX, cardTop, cardW, cardH); ctx.clip()
      const sweep  = ((p * 1.6) % 1) * 2 - 0.5
      const sw0    = cardX + sweep * cardW - cardW * 0.30
      const sw1    = cardX + sweep * cardW + cardW * 0.30
      const sweepA = 0.20 * absScale
      const gloss = ctx.createLinearGradient(sw0, cardTop, sw1, cardTop + cardH)
      gloss.addColorStop(0,   'rgba(255,255,255,0)')
      gloss.addColorStop(0.5, `rgba(255,255,255,${sweepA})`)
      gloss.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.fillStyle = gloss
      ctx.fillRect(cardX, cardTop, cardW, cardH)

      // ── Rim light — glow accent sur les bords de la carte ─────────────────
      const rimA = (isDark ? 0.22 : 0.15) * absScale
      const rimL = ctx.createLinearGradient(cardX, 0, cardX + cardW * 0.18, 0)
      rimL.addColorStop(0, `rgba(${ar},${ag},${ab},${rimA})`)
      rimL.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rimL; ctx.fillRect(cardX, cardTop, cardW * 0.18, cardH)
      const rimR = ctx.createLinearGradient(cardX + cardW, 0, cardX + cardW * 0.82, 0)
      rimR.addColorStop(0, `rgba(${ar},${ag},${ab},${rimA * 0.7})`)
      rimR.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = rimR; ctx.fillRect(cardX + cardW * 0.82, cardTop, cardW * 0.18, cardH)

      // ── Highlight du bord supérieur (lumière zénithale) ───────────────────
      const topH = ctx.createLinearGradient(0, cardTop, 0, cardTop + cardH * 0.13)
      topH.addColorStop(0, `rgba(255,255,255,${0.16 * absScale})`)
      topH.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = topH; ctx.fillRect(cardX, cardTop, cardW, cardH * 0.13)

      ctx.restore() // fin du clip gloss

      // ── Liseré lumineux (bord de la carte) ────────────────────────────────
      ctx.lineWidth = Math.max(1.5, W * 0.0025)
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.22 * (1 - absScale)})`
      ctx.strokeRect(cardX, cardTop, cardW, cardH)

      // ── Éclat de tranche avec aberration chromatique ──────────────────────
      if (absScale < 0.28) {
        const glint   = 1 - absScale / 0.28
        const edgeX   = W / 2
        const glintW  = Math.max(8, cardW * 2 + 16)
        const gg = ctx.createLinearGradient(edgeX - glintW / 2, 0, edgeX + glintW / 2, 0)
        gg.addColorStop(0,    'rgba(255,255,255,0)')
        // Frange chromatique RGB autour de l'éclat central
        gg.addColorStop(0.35, `rgba(${ar},${Math.min(255, ag + 40)},255,${0.30 * glint})`)
        gg.addColorStop(0.48, `rgba(255,255,255,${0.70 * glint})`)
        gg.addColorStop(0.52, `rgba(255,255,255,${0.70 * glint})`)
        gg.addColorStop(0.65, `rgba(255,${Math.min(255, ag + 40)},${ab},${0.30 * glint})`)
        gg.addColorStop(1,    'rgba(255,255,255,0)')
        ctx.fillStyle = gg
        ctx.fillRect(edgeX - glintW / 2, cardTop, glintW, cardH)
      }
    }

    // ── Zone infos ────────────────────────────────────────────────────────────
    const infoY = H - INFO_H
    const fadeGrad = ctx.createLinearGradient(0, infoY - INFO_H * 0.42, 0, infoY + 10)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)'); fadeGrad.addColorStop(1, infoBg)
    ctx.fillStyle = fadeGrad; ctx.fillRect(0, infoY - INFO_H * 0.42, W, INFO_H * 0.52)
    ctx.fillStyle = infoBg; ctx.fillRect(0, infoY + 10, W, INFO_H)

    // Ligne accent avec légère respiration
    const linePulse = 0.72 + 0.28 * Math.sin(p * Math.PI * 4)
    const lineGrad  = ctx.createLinearGradient(W * 0.08, 0, W * 0.92, 0)
    lineGrad.addColorStop(0,   'rgba(0,0,0,0)')
    lineGrad.addColorStop(0.2, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(0.5, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(0.8, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = lineGrad; ctx.fillRect(0, infoY, W, 2)

    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tx = W / 2
    let ty   = infoY + INFO_H * 0.09

    // ── Badges ─────────────────────────────────────────────────────────────
    const badgeFs  = Math.round(W * 0.026)
    const badgeH   = Math.round(W * 0.042)
    const badgePad = Math.round(W * 0.026)
    const badgeR   = badgeH / 2

    type BadgeEntry = { label: string; solid?: string; grad?: [string, string]; textColor: string }
    const tags: BadgeEntry[] = []
    if (card.rc) tags.push({ label: '★ RC', grad: ['#e67e22', '#f39c12'], textColor: '#fff' })
    if (card.auto) tags.push({ label: 'AUTO', solid: '#2e7d32', textColor: '#fff' })
    if (card.num) {
      const m = card.num.trim().match(/\/(\d+)$/)
      const n = m ? parseInt(m[1]) : null
      if (n === 1)                    tags.push({ label: card.num, grad: ['#b8860b', '#ffd700'], textColor: '#3d2800' })
      else if (n !== null && n <= 10) tags.push({ label: card.num, grad: ['#555', '#c0c0c0'], textColor: '#111' })
      else if (n !== null && n <= 25) tags.push({ label: card.num, grad: ['#6d3a00', '#cd7f32'], textColor: '#fff' })
      else                            tags.push({ label: card.num, solid: '#7b1fa2', textColor: '#fff' })
    }
    if (card.patch) tags.push({ label: 'PATCH', solid: '#1565c0', textColor: '#fff' })

    if (tags.length > 0) {
      ctx.font = `800 ${badgeFs}px Inter, sans-serif`
      const widths  = tags.map(t => ctx.measureText(t.label).width + badgePad * 2)
      const gap     = Math.round(W * 0.014)
      const totalW  = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
      let bx = tx - totalW / 2

      tags.forEach((tag, i) => {
        const bw  = widths[i]
        const bcy = ty + badgeH / 2

        if (tag.grad) {
          const g = ctx.createLinearGradient(bx, ty, bx + bw, ty + badgeH)
          g.addColorStop(0, tag.grad[0]); g.addColorStop(1, tag.grad[1])
          ctx.fillStyle = g
        } else {
          ctx.fillStyle = tag.solid!
        }
        ctx.shadowColor = tag.solid || tag.grad![0]
        ctx.shadowBlur  = Math.round(W * 0.018)
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH, badgeR); ctx.fill()
        ctx.shadowBlur  = 0

        // Reflet interne
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

    // ── Nom du joueur ─────────────────────────────────────────────────────────
    const nameFs = Math.round(W * 0.054)
    ctx.fillStyle = textMain
    ctx.font = `900 ${nameFs}px Inter, sans-serif`
    ctx.fillText(truncate(ctx, card.n, W * 0.88), tx, ty)
    ty += nameFs * 1.15

    // ── Variation ─────────────────────────────────────────────────────────────
    if (card.v) {
      const varFs = Math.round(W * 0.030)
      ctx.fillStyle = accent
      ctx.font = `600 italic ${varFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.v, W * 0.84), tx, ty)
      ty += varFs * 1.3
    }

    // ── Équipe ────────────────────────────────────────────────────────────────
    if (card.t) {
      const teamFs = Math.round(W * 0.026)
      ctx.fillStyle = textSub
      ctx.font = `700 ${teamFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.t, W * 0.80), tx, ty)
      ty += teamFs * 1.35
    }

    // ── Année · Marque · Collection ───────────────────────────────────────────
    const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    if (meta2) {
      const metaFs = Math.round(W * 0.022)
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
      ctx.font = `400 ${metaFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, meta2, W * 0.80), tx, ty)
    }

    // ── Logo watermark ────────────────────────────────────────────────────────
    const logoImg = isDark ? logoImgs.current.dark : logoImgs.current.light
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoW = W * 0.19
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
      ctx.globalAlpha = isDark ? 0.50 : 0.65
      ctx.drawImage(logoImg, W - logoW - W * 0.03, H - logoH - H * 0.014, logoW, logoH)
      ctx.globalAlpha = 1
    } else {
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.55)` : `rgba(${ar},${ag},${ab},0.7)`
      ctx.font = `600 ${Math.round(W * 0.026)}px Inter, sans-serif`
      ctx.fillText('memorabilius.fr', W - Math.round(W * 0.03), H - Math.round(H * 0.012))
    }
  }

  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = VIDEO_FORMATS[vfmtRef.current]
    canvas.width = w; canvas.height = h

    setRecording(true); setProgress(0); setDone(false); setVideoUrl(null)
    const ctx = canvas.getContext('2d')!
    const [frontImg, backImg] = await Promise.all([loadImage(card.f), loadImage(card.b || card.f)])

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    const mimeType =
      codec === 'mp4' && MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : 'video/webm'
    const HOLD = 700
    const totalSecs = (DURATION + HOLD + 300) / 1000
    const sizeCap = Math.floor((14.9 * 8_000_000) / totalSecs / 1.5)
    const pixels = w * h
    const qualityBitrate = Math.round(pixels * (isMobile ? 9 : 14))
    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.min(sizeCap, Math.max(3_000_000, qualityBitrate)),
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })))
      setDone(true); setRecording(false)
    }
    recorder.start()

    const frameInterval = 1000 / FPS
    const start = performance.now()
    let lastDraw = -1
    await new Promise<void>(resolve => {
      const tick = (now: number) => {
        if (lastDraw < 0 || now - lastDraw >= frameInterval - 1) {
          lastDraw = now
          const elapsed = now - start
          const p = Math.min(elapsed / DURATION, 1)
          drawFrame(ctx, frontImg, backImg, p >= 1 ? 0.999 : p)
          setProgress(Math.round(Math.min(elapsed / (DURATION + HOLD), 1) * 100))
          if (elapsed >= DURATION + HOLD) { resolve(); return }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await new Promise(r => setTimeout(r, 200))
    recorder.stop()
  }

  const download = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${card.n.replace(/\s+/g, '_')}_memorabilius.${codec}`
    a.click()
  }

  const chip = (active: boolean) => ({
    padding: '7px 16px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? accent : 'rgba(255,255,255,0.09)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    transition: '0.15s',
  })

  const { w, h } = VIDEO_FORMATS[vfmt]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d22', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', textAlign: 'center', border: `1px solid ${accent}44` }}>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 17, margin: '0 0 4px' }}>
          🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export video'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: '0 0 16px' }}>
          {card.n}{card.v ? ` · ${card.v}` : ''}
        </p>

        <canvas ref={canvasRef} width={w} height={h}
          style={{ width: '100%', maxWidth: 240, height: 'auto', borderRadius: 10, display: 'block', margin: '0 auto 18px', border: `1px solid ${accent}33`, background: '#080818' }} />

        {!recording && (
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Format</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(Object.entries(VIDEO_FORMATS) as [VideoFormat, typeof VIDEO_FORMATS[VideoFormat]][]).map(([key, f]) => (
                  <button key={key} style={chip(vfmt === key)} onClick={() => setVfmt(key)}>
                    {f.label} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.ratio}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>{lang === 'fr' ? 'Thème' : 'Theme'}</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={chip(theme === 'dark')} onClick={() => setTheme('dark')}>🌙 {lang === 'fr' ? 'Sombre' : 'Dark'}</button>
                <button style={chip(theme === 'light')} onClick={() => setTheme('light')}>☀️ {lang === 'fr' ? 'Clair' : 'Light'}</button>
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Codec</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={chip(codec === 'webm')} onClick={() => setCodec('webm')}>WebM</button>
                <button style={chip(codec === 'mp4')} onClick={() => setCodec('mp4')}>MP4</button>
              </div>
            </div>
          </div>
        )}

        {recording && (
          <div style={{ margin: '0 0 16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
              <div style={{ background: accent, height: '100%', width: `${progress}%`, transition: '0.1s', borderRadius: 8 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{progress}%</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
              ▶ {lang === 'fr' ? 'Générer' : 'Generate'}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                ⬇ {lang === 'fr' ? `Télécharger (.${codec})` : `Download (.${codec})`}
              </button>
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                🔄 {lang === 'fr' ? 'Refaire' : 'Redo'}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {lang === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>

        {done && codec === 'webm' && (
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
            💡 {lang === 'fr' ? 'Convertir en MP4 sur cloudconvert.com' : 'Convert to MP4 at cloudconvert.com'}
          </p>
        )}
      </div>
    </div>
  )
}
