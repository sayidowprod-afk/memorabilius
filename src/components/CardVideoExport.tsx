'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/lib/LangContext'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { toast } from '@/lib/toast'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  is_horizontal?: boolean
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
  const [recordError, setRecordError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [codec, setCodec] = useState<'webm' | 'mp4'>('webm')
  const [vfmt, setVfmt] = useState<VideoFormat>('default')
  const { t, lang } = useLang()
  const fmtLabel = (key: VideoFormat) =>
    key === 'default' ? t('video_format_default') : key === 'square' ? t('video_format_square') : VIDEO_FORMATS[key].label

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const DURATION = 6000
  const FPS = isMobile ? 30 : 60
  // Le rendu par frame (dégradés, shadowBlur, reflet) est du travail CPU pur sur canvas 2D,
  // pas accéléré GPU sur la plupart des mobiles — à pleine résolution (jusqu'à 1080x1920) ça
  // ne tient pas le budget de 33ms/frame et produit une vidéo saccadée (frames dupliquées par
  // captureStream pendant que le dessin traîne). Réduire la résolution interne sur mobile
  // réduit le coût de la plupart des opérations proportionnellement à la surface.
  const MOBILE_RES_SCALE = 0.62
  const scaledDims = (fmt: VideoFormat) => {
    const { w, h } = VIDEO_FORMATS[fmt]
    if (!isMobile) return { w, h }
    return { w: Math.round(w * MOBILE_RES_SCALE), h: Math.round(h * MOBILE_RES_SCALE) }
  }
  const themeRef = useRef(theme)
  const vfmtRef = useRef(vfmt)
  themeRef.current = theme
  vfmtRef.current = vfmt

  const previewImgs = useRef<{ f?: HTMLImageElement; b?: HTMLImageElement }>({})
  const logoImgs = useRef<{ dark?: HTMLImageElement; light?: HTMLImageElement }>({})
  const bgCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)
  // Zone infos (badges, nom, variation, équipe, logo) + ombre de carte : rien
  // dedans ne dépend de `p` (progression d'animation) sauf la ligne accent en
  // pointillé -- tout le reste était pourtant redessiné (dégradés, shadowBlur,
  // texte) à chaque frame en pure perte. Pré-rendu une fois par export/thème/
  // format, puis simplement collé (drawImage) à chaque frame.
  const infoCache = useRef<{ key: string; canvas: HTMLCanvasElement; top: number } | null>(null)
  const shadowCache = useRef<{ key: string; canvas: HTMLCanvasElement; pad: number } | null>(null)
  const particleSprites = useRef<Map<string, HTMLCanvasElement>>(new Map())

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
    const { w, h } = scaledDims(vfmt)
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

  const drawFrame = (ctx: CanvasRenderingContext2D, frontImg: HTMLImageElement, backImg: HTMLImageElement, p: number, holdT = 0) => {
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
    // Sprite pré-rendu par rayon (4 valeurs distinctes) au lieu de reconstruire un
    // chemin d'arc + remplissage pour chacune des 20-50 particules à chaque frame --
    // la couleur ne varie qu'en alpha (globalAlpha), pas besoin d'un sprite par
    // particule, juste par rayon.
    const getParticleSprite = (r: number) => {
      const key = `${r}-${isDark}-${accent}`
      let sprite = particleSprites.current.get(key)
      if (!sprite) {
        const size = Math.ceil(r * 2) + 2
        sprite = document.createElement('canvas')
        sprite.width = size; sprite.height = size
        const sctx = sprite.getContext('2d')!
        sctx.beginPath(); sctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
        sctx.fillStyle = isDark ? `rgb(${ar},${ag},${Math.min(255, ab + 60)})` : 'rgb(80,80,220)'
        sctx.fill()
        particleSprites.current.set(key, sprite)
      }
      return sprite
    }
    PARTICLES.forEach(({ x, y, r, speed, phase }) => {
      const py = ((y * H - p * speed * H * 3) % H + H) % H
      const a = (isDark ? 0.06 : 0.10) + 0.04 * Math.sin(p * Math.PI * 5 + phase)
      const sprite = getParticleSprite(r)
      ctx.globalAlpha = a
      ctx.drawImage(sprite, x * W - sprite.width / 2, py - sprite.height / 2)
      ctx.globalAlpha = 1
    })

    // ── Layout ────────────────────────────────────────────────────────────────
    const INFO_H     = Math.round(H * 0.19)
    const CARD_ZONE_H = H - INFO_H
    const CARD_MAX_W  = W * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    // Ratio hauteur/largeur -- inversé pour une carte à l'horizontale (plus large que
    // haute). Jusqu'ici toujours calculé en portrait quelle que soit l'orientation
    // réelle de la carte, ce qui écrasait/rétrécissait les cartes horizontales dans
    // leur cadre au lieu de les afficher pleine largeur (signalé : "mauvais format").
    const CARD_RATIO  = card.is_horizontal ? 2.5 / 3.5 : 3.5 / 2.5
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
    // ── Entrée en fondu/zoom — la carte apparaissait déjà en place dès la 1ère
    // frame, maintenant un léger zoom-in + fondu sur les ~350 premières ms.
    const introT     = Math.min(1, p / 0.06)
    const introEase  = easeInOut(introT)
    const introScale = 0.85 + 0.15 * introEase
    const introAlpha = introEase
    const cardW    = BASE_W * absScale * zoom * introScale
    const cardH    = BASE_H * zoom * introScale
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
      ctx.globalAlpha = introAlpha
      const floorY = cardCY + cardH / 2

      // ── Reflet sol (coûteux : drawImage + clip supplémentaires, sauté sur mobile) ──
      if (!IS_MOBILE) {
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
      }

      // ── Ombre portée ── pré-rendue une fois (shadowBlur = opération Canvas2D la
      // plus coûteuse qui existe) puis simplement redimensionnée chaque frame au
      // lieu d'un flou recalculé à chaque fois. Rayon de flou fixe (comme avant),
      // donc l'ombre reste correcte au repos et se déforme très légèrement pendant
      // le flip (~0.3 de la durée) -- imperceptible sur une transition aussi rapide.
      const shadowKeyW = Math.round(BASE_W), shadowKeyH = Math.round(BASE_H)
      const shadowKey = `${shadowKeyW}x${shadowKeyH}-${isDark}`
      if (!shadowCache.current || shadowCache.current.key !== shadowKey) {
        const blurR = BASE_W * (IS_MOBILE ? 0.06 : 0.15)
        const offY = BASE_H * 0.038
        const pad = Math.ceil(blurR * 2.5)
        const sc = document.createElement('canvas')
        sc.width = shadowKeyW + pad * 2
        sc.height = shadowKeyH + pad * 2 + Math.ceil(offY)
        const sctx = sc.getContext('2d')!
        sctx.shadowColor = `rgba(0,0,0,${isDark ? 0.80 : 0.45})`
        sctx.shadowBlur = blurR
        sctx.shadowOffsetY = offY
        sctx.fillStyle = 'rgba(0,0,0,0.85)'
        sctx.fillRect(pad, pad, shadowKeyW, shadowKeyH)
        shadowCache.current = { key: shadowKey, canvas: sc, pad }
      }
      {
        const { canvas: shCanvas, pad } = shadowCache.current
        const sx = cardW / BASE_W, sy = cardH / BASE_H
        ctx.drawImage(shCanvas, cardX - pad * sx, cardTop - pad * sy, cardW + pad * 2 * sx, cardH + pad * 2 * sy)
      }

      // ── Image de la carte ─────────────────────────────────────────────────
      ctx.drawImage(face, cardX, cardTop, cardW, cardH)

      // ── Gloss blanc diagonal — détail fin, sauté sur mobile (perf) ────────
      ctx.save()
      ctx.beginPath(); ctx.rect(cardX, cardTop, cardW, cardH); ctx.clip()
      if (!IS_MOBILE) {
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
      }

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

      // ── Éclat de tranche avec aberration chromatique — sauté sur mobile (perf) ──
      if (absScale < 0.28 && !IS_MOBILE) {
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
      ctx.globalAlpha = 1
    }

    // ── Zone infos ── pré-rendue une fois (fond, badges, nom, variation, équipe,
    // meta, logo) : rien dedans ne dépend de `p` sauf la ligne accent, qui reste
    // dessinée en direct chaque frame juste après. Le reste (dégradés, shadowBlur
    // des badges, plusieurs fillText avec changement de police) était pourtant
    // refait identique à chaque frame en pure perte.
    const infoY = H - INFO_H
    const infoTop = infoY - INFO_H * 0.42
    const logoImg = isDark ? logoImgs.current.dark : logoImgs.current.light
    const infoCacheKey = `${W}x${H}-${isDark}-${accent}-${!!logoImg}`
    if (!infoCache.current || infoCache.current.key !== infoCacheKey) {
      const ic = document.createElement('canvas')
      ic.width = W
      ic.height = Math.ceil(H - infoTop)
      const ictx = ic.getContext('2d')!
      const oy = infoTop

      const fadeGrad = ictx.createLinearGradient(0, 0, 0, (infoY + 10) - oy)
      fadeGrad.addColorStop(0, 'rgba(0,0,0,0)'); fadeGrad.addColorStop(1, infoBg)
      ictx.fillStyle = fadeGrad; ictx.fillRect(0, 0, W, INFO_H * 0.52)
      ictx.fillStyle = infoBg; ictx.fillRect(0, (infoY + 10) - oy, W, INFO_H)

      ictx.textAlign = 'center'; ictx.textBaseline = 'top'
      const tx = W / 2
      let ty = (infoY + INFO_H * 0.09) - oy

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
        ictx.font = `800 ${badgeFs}px Inter, sans-serif`
        const widths  = tags.map(t => ictx.measureText(t.label).width + badgePad * 2)
        const gap     = Math.round(W * 0.014)
        const totalW  = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
        let bx = tx - totalW / 2

        tags.forEach((tag, i) => {
          const bw  = widths[i]
          const bcy = ty + badgeH / 2

          if (tag.grad) {
            const g = ictx.createLinearGradient(bx, ty, bx + bw, ty + badgeH)
            g.addColorStop(0, tag.grad[0]); g.addColorStop(1, tag.grad[1])
            ictx.fillStyle = g
          } else {
            ictx.fillStyle = tag.solid!
          }
          if (!IS_MOBILE) {
            ictx.shadowColor = tag.solid || tag.grad![0]
            ictx.shadowBlur  = Math.round(W * 0.018)
          }
          ictx.beginPath(); ictx.roundRect(bx, ty, bw, badgeH, badgeR); ictx.fill()
          ictx.shadowBlur  = 0

          // Reflet interne
          const shine = ictx.createLinearGradient(bx, ty, bx, ty + badgeH * 0.5)
          shine.addColorStop(0, 'rgba(255,255,255,0.28)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
          ictx.fillStyle = shine
          ictx.beginPath(); ictx.roundRect(bx, ty, bw, badgeH * 0.55, [badgeR, badgeR, 0, 0]); ictx.fill()

          ictx.fillStyle = tag.textColor
          ictx.textBaseline = 'middle'
          ictx.fillText(tag.label, bx + bw / 2, bcy)
          ictx.textBaseline = 'top'
          bx += bw + gap
        })
        ty += badgeH + Math.round(INFO_H * 0.07)
      }

      // ── Nom du joueur ─────────────────────────────────────────────────────────
      const nameFs = Math.round(W * 0.054)
      ictx.fillStyle = textMain
      ictx.font = `900 ${nameFs}px Inter, sans-serif`
      ictx.fillText(truncate(ictx, card.n, W * 0.88), tx, ty)
      ty += nameFs * 1.15

      // ── Variation ─────────────────────────────────────────────────────────────
      if (card.v) {
        const varFs = Math.round(W * 0.030)
        ictx.fillStyle = accent
        ictx.font = `600 italic ${varFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, card.v, W * 0.84), tx, ty)
        ty += varFs * 1.3
      }

      // ── Équipe ────────────────────────────────────────────────────────────────
      if (card.t) {
        const teamFs = Math.round(W * 0.026)
        ictx.fillStyle = textSub
        ictx.font = `700 ${teamFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, card.t, W * 0.80), tx, ty)
        ty += teamFs * 1.35
      }

      // ── Année · Marque · Collection ───────────────────────────────────────────
      const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
      if (meta2) {
        const metaFs = Math.round(W * 0.022)
        ictx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
        ictx.font = `400 ${metaFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, meta2, W * 0.80), tx, ty)
      }

      // ── Logo watermark ────────────────────────────────────────────────────────
      if (logoImg && logoImg.naturalWidth > 0) {
        const logoW = W * 0.19
        const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
        ictx.globalAlpha = isDark ? 0.50 : 0.65
        ictx.drawImage(logoImg, W - logoW - W * 0.03, (H - logoH - H * 0.014) - oy, logoW, logoH)
        ictx.globalAlpha = 1
      } else {
        ictx.textAlign = 'right'; ictx.textBaseline = 'bottom'
        ictx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.55)` : `rgba(${ar},${ag},${ab},0.7)`
        ictx.font = `600 ${Math.round(W * 0.026)}px Inter, sans-serif`
        ictx.fillText('memorabilius.fr', W - Math.round(W * 0.03), (H - Math.round(H * 0.012)) - oy)
      }

      infoCache.current = { key: infoCacheKey, canvas: ic, top: infoTop }
    }
    ctx.drawImage(infoCache.current.canvas, 0, infoCache.current.top)

    // Ligne accent avec légère respiration -- seul élément animé de la zone infos,
    // dessiné à part par-dessus le panneau mis en cache.
    const linePulse = 0.72 + 0.28 * Math.sin(p * Math.PI * 4)
    const lineGrad  = ctx.createLinearGradient(W * 0.08, 0, W * 0.92, 0)
    lineGrad.addColorStop(0,   'rgba(0,0,0,0)')
    lineGrad.addColorStop(0.2, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(0.5, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(0.8, `rgba(${ar},${ag},${ab},${linePulse})`)
    lineGrad.addColorStop(1,   'rgba(0,0,0,0)')
    ctx.fillStyle = lineGrad; ctx.fillRect(0, infoY, W, 2)

    // ── Petit "pop" du logo à l'entrée du palier final (HOLD) ── la fin de vidéo
    // était jusqu'ici juste figée sur la dernière frame pendant 700ms sans aucune
    // transition. Un bref flash/zoom du logo au tout début du palier rend la sortie
    // moins abrupte, sans retoucher le panneau (mis en cache) en dessous.
    if (holdT > 0 && holdT < 1 && logoImg && logoImg.naturalWidth > 0) {
      const logoW = W * 0.19
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
      const lx = W - logoW - W * 0.03
      const ly = H - logoH - H * 0.014
      const pop = 1 + 0.15 * (1 - easeInOut(holdT))
      ctx.save()
      ctx.globalAlpha = Math.min(1, holdT * 3) * (isDark ? 0.5 : 0.65)
      ctx.translate(lx + logoW / 2, ly + logoH / 2)
      ctx.scale(pop, pop)
      ctx.drawImage(logoImg, -logoW / 2, -logoH / 2, logoW, logoH)
      ctx.restore()
    }
  }

  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = scaledDims(vfmtRef.current)
    canvas.width = w; canvas.height = h

    setRecording(true); setProgress(0); setDone(false); setVideoUrl(null); setRecordError(null)
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
    // Historique (voir commits 45b466e5/0809fbbf/7d147b6b, 30 aout) : un remplacement de
    // requestAnimationFrame par setTimeout (pour contourner rAF mis en pause quand l'app passe
    // en arrière-plan) avait cassé le dessin lui-même (vidéo figée sur sa 1ère image) et a été
    // révert le jour même. Une tentative ulterieure de suspendre l'enregistrement via
    // MediaRecorder.pause()/resume() a elle aussi échoué en pratique (échecs reproduits même
    // sans mise en arrière-plan visible) -- combo pause/resume + canvas.captureStream() visiblement
    // pas assez fiable sur ce pipeline. On revient donc à rAF seul, identique à la version qui a
    // fonctionné des mois, et on se contente de DETECTER un enregistrement rate (voir plus bas)
    // au lieu d'essayer de le faire reprendre.
    let recorderErrored = false
    recorder.onerror = (e: any) => {
      recorderErrored = true
      console.error('[CardVideoExport] MediaRecorder error', e?.error || e)
    }

    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    const stopped = new Promise<void>(resolve => {
      recorder.onstop = () => {
        const totalBytes = chunks.reduce((sum, c) => sum + c.size, 0)
        // Un enregistrement qui n'a capté aucune frame (ex: app passee en arriere-plan) produit
        // un blob quasi vide -- seuil bas (2 Ko) pour ne rejeter que ce cas-la, pas une video
        // reelle mais fortement compressee (contenu peu changeant peut legitimement descendre
        // a quelques Ko/s selon l'encodeur).
        if (totalBytes < 2_000 || recorderErrored) {
          setRecording(false)
          setRecordError(t('video_record_error'))
          resolve(); return
        }
        setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })))
        setDone(true); setRecording(false)
        resolve()
      }
    })
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
          const holdT = Math.min(1, Math.max(0, elapsed - DURATION) / 300)
          drawFrame(ctx, frontImg, backImg, p >= 1 ? 0.999 : p, holdT)
          setProgress(Math.round(Math.min(elapsed / (DURATION + HOLD), 1) * 100))
          if (elapsed >= DURATION + HOLD) { resolve(); return }
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    await new Promise(r => setTimeout(r, 200))
    recorder.stop()
    await stopped
  }

  const download = async () => {
    if (!videoUrl || downloading) return
    setDownloading(true)
    try {
      const blob = await (await fetch(videoUrl)).blob()
      if (blob.size < 2_000) throw new Error('empty-blob')
      // Timeout d'écriture natif plus large que le défaut (15s, calibré pour de petits
      // PDF/images) -- une vidéo de plusieurs Mo peut légitimement prendre plus longtemps
      // à écrire sur un appareil bas de gamme, un timeout trop court la faisait échouer
      // silencieusement avant que l'écriture n'ait fini.
      await saveOrShareFile(blob, `${card.n.replace(/\s+/g, '_')}_memorabilius.${codec}`, { timeoutMs: 45000 })
    } catch (e) {
      toast.error(t('video_download_error'))
    } finally {
      setDownloading(false)
    }
  }

  const chip = (active: boolean) => ({
    padding: '7px 16px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? accent : 'rgba(255,255,255,0.09)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    transition: '0.15s',
  })

  const { w, h } = scaledDims(vfmt)

  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d22', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', textAlign: 'center', border: `1px solid ${accent}44` }}>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 17, margin: '0 0 4px' }}>
          🎬 {t('video_export_title')}
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
                    {fmtLabel(key)} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.ratio}</span>
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
              <div style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 60%, white))`, height: '100%', width: `${progress}%`, transition: 'width 0.1s linear', borderRadius: 8 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{progress}%</p>
          </div>
        )}

        {recordError && (
          <p style={{ color: '#f39c12', fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>
            ⚠️ {recordError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
              {recordError ? `🔄 ${t('video_redo')}` : `▶ ${t('video_generate')}`}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} disabled={downloading} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 800, cursor: downloading ? 'default' : 'pointer', fontSize: 14, opacity: downloading ? 0.6 : 1 }}>
                {downloading ? `⏳ ${t('video_downloading')}` : `⬇ ${t('video_download')} (.${codec})`}
              </button>
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                🔄 {t('video_redo')}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {t('gallery_close')}
          </button>
        </div>

        {done && codec === 'webm' && (
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
            💡 {t('video_convert_hint')}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}
