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

// Particules stables (déterministes) — moins sur mobile pour les perfs
const PARTICLE_COUNT = IS_MOBILE ? 20 : 50
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (i * 137.508) % 1,
  y: (i * 97.3) % 1,
  r: 0.8 + (i % 4) * 0.7,
  speed: 0.05 + (i % 6) * 0.02,
  phase: i * 0.73,
}))

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

  // Sync canvas size + dessine un aperçu statique du rendu
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

    const bgBase   = isDark ? '#06060f' : '#f0f4ff'
    const bgBot    = isDark ? '#0d0d22' : '#dde4ff'
    const infoBg   = isDark ? '#08081a' : '#ffffff'
    const textMain = isDark ? '#ffffff' : '#111111'
    const textSub  = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)'

    // ── Fond statique (mis en cache) : base + halo accent + dégradé vertical ─
    const bgKey = `${W}x${H}-${isDark}-${accent}`
    if (!bgCache.current || bgCache.current.key !== bgKey) {
      const oc = document.createElement('canvas')
      oc.width = W; oc.height = H
      const octx = oc.getContext('2d')!
      octx.fillStyle = bgBase; octx.fillRect(0, 0, W, H)
      const halo = octx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 1.1)
      halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.28 : 0.14})`)
      halo.addColorStop(0.5, `rgba(${ar},${ag},${ab},${isDark ? 0.07 : 0.04})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      octx.fillStyle = halo; octx.fillRect(0, 0, W, H)
      const bgGrad = octx.createLinearGradient(0, 0, 0, H)
      bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '99')
      octx.fillStyle = bgGrad; octx.fillRect(0, 0, W, H)
      bgCache.current = { key: bgKey, canvas: oc }
    }
    ctx.drawImage(bgCache.current.canvas, 0, 0)

    // ── Particules ─────────────────────────────────────────────────────────
    PARTICLES.forEach(({ x, y, r, speed, phase }) => {
      const py = ((y * H - p * speed * H * 3) % H + H) % H
      const a = (isDark ? 0.05 : 0.08) + 0.03 * Math.sin(p * Math.PI * 5 + phase)
      ctx.beginPath(); ctx.arc(x * W, py, r, 0, Math.PI * 2)
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab + 60},${a})` : `rgba(80,80,220,${a})`
      ctx.fill()
    })

    // ── Layout dynamique ───────────────────────────────────────────────────
    const INFO_H  = Math.round(H * 0.19)   // 19% pour les infos
    const CARD_ZONE_H = H - INFO_H
    const CARD_MAX_W  = W * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    const CARD_RATIO  = 3.5 / 2.5
    const BASE_W = Math.min(CARD_MAX_W, CARD_MAX_H / CARD_RATIO)
    const BASE_H = BASE_W * CARD_RATIO
    const CARD_CY = CARD_ZONE_H / 2

    // ── Spotlight ──────────────────────────────────────────────────────────
    const pulse = 1 + 0.07 * Math.sin(p * Math.PI * 3)
    const spotR = BASE_W * 0.9 * pulse
    const spot = ctx.createRadialGradient(W / 2, CARD_CY, 0, W / 2, CARD_CY, spotR)
    spot.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.18 : 0.10})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    // Remplissage borné au disque du spot (pas plein écran) → moins coûteux
    ctx.fillStyle = spot
    ctx.fillRect(W / 2 - spotR, CARD_CY - spotR, spotR * 2, spotR * 2)

    // ── Animation carte — présente le recto, retourne, présente le verso ────
    // Rotation avec paliers (dwell) + easing plutôt qu'une rotation continue :
    // rendu bien plus élégant qu'un simple spin.
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)))
    let rot: number
    if (p < 0.32)      rot = 0
    else if (p < 0.48) rot = Math.PI * easeInOut(seg(p, 0.32, 0.48))
    else if (p < 0.78) rot = Math.PI
    else if (p < 0.92) rot = Math.PI + Math.PI * easeInOut(seg(p, 0.78, 0.92))
    else               rot = 0   // palier recto en fin de vidéo → boucle parfaite avec le début

    const scaleX = Math.cos(rot)
    const showBack = scaleX < 0
    const face = showBack ? backImg : frontImg
    const bob  = Math.sin(p * Math.PI * 2) * H * 0.006   // léger flottement
    const zoom = 1 + 0.03 * Math.sin(p * Math.PI * 2)
    const cardW = BASE_W * Math.abs(scaleX) * zoom
    const cardH = BASE_H * zoom
    const cardCY = CARD_CY + bob
    const cardX = W / 2 - cardW / 2
    const cardTop = cardCY - cardH / 2

    if (cardW > 2) {
      // Reflet au sol (coins droits)
      const floorY = cardCY + cardH / 2
      ctx.save()
      ctx.beginPath()
      ctx.rect(cardX, floorY, cardW, cardH)
      ctx.clip()
      ctx.translate(W / 2, floorY)
      ctx.scale(1, -1)
      ctx.globalAlpha = 0.14 * Math.abs(scaleX)
      ctx.drawImage(face, -cardW / 2, 0, cardW, cardH)
      ctx.restore()
      const reflFade = ctx.createLinearGradient(0, floorY, 0, floorY + cardH * 0.5)
      reflFade.addColorStop(0, 'rgba(0,0,0,0)'); reflFade.addColorStop(1, bgBot)
      ctx.fillStyle = reflFade; ctx.fillRect(0, floorY, W, cardH * 0.5)

      // Ombre portée sous la carte — blur réduit sur mobile (shadowBlur est coûteux)
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${isDark ? 0.6 : 0.35})`
      ctx.shadowBlur = BASE_W * (IS_MOBILE ? 0.05 : 0.11)
      ctx.shadowOffsetY = BASE_H * 0.03
      ctx.fillStyle = '#000'
      ctx.fillRect(cardX, cardTop, cardW, cardH)
      ctx.restore()

      // Carte (image, coins droits)
      ctx.drawImage(face, cardX, cardTop, cardW, cardH)

      // Reflet glossy diagonal qui balaie la carte
      ctx.save()
      ctx.beginPath()
      ctx.rect(cardX, cardTop, cardW, cardH)
      ctx.clip()
      const sweep = ((p * 1.6) % 1) * 2 - 0.5
      const gloss = ctx.createLinearGradient(
        cardX + sweep * cardW - cardW * 0.25, cardTop,
        cardX + sweep * cardW + cardW * 0.25, cardCY + cardH / 2)
      gloss.addColorStop(0,   'rgba(255,255,255,0)')
      gloss.addColorStop(0.5, `rgba(255,255,255,${0.16 * Math.abs(scaleX)})`)
      gloss.addColorStop(1,   'rgba(255,255,255,0)')
      ctx.fillStyle = gloss
      ctx.fillRect(cardX, cardTop, cardW, cardH)
      ctx.restore()

      // Liseré lumineux sur le bord de la carte
      ctx.lineWidth = Math.max(1, W * 0.0022)
      ctx.strokeStyle = `rgba(255,255,255,${0.10 + 0.14 * (1 - Math.abs(scaleX))})`
      ctx.strokeRect(cardX, cardTop, cardW, cardH)

      // Éclat quand la carte est de profil (la lumière accroche le bord)
      if (Math.abs(scaleX) < 0.28) {
        const glint = 1 - Math.abs(scaleX) / 0.28
        const gg = ctx.createLinearGradient(W / 2 - 4, 0, W / 2 + 4, 0)
        gg.addColorStop(0, 'rgba(255,255,255,0)')
        gg.addColorStop(0.5, `rgba(255,255,255,${0.5 * glint})`)
        gg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = gg
        ctx.fillRect(W / 2 - Math.max(2, cardW), cardTop, Math.max(4, cardW * 2), cardH)
      }
    }

    // ── Zone infos ─────────────────────────────────────────────────────────
    const infoY = H - INFO_H
    // Fondu progressif
    const fadeGrad = ctx.createLinearGradient(0, infoY - INFO_H * 0.35, 0, infoY + 10)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)'); fadeGrad.addColorStop(1, infoBg)
    ctx.fillStyle = fadeGrad; ctx.fillRect(0, infoY - INFO_H * 0.35, W, INFO_H * 0.45)
    ctx.fillStyle = infoBg; ctx.fillRect(0, infoY + 10, W, INFO_H)

    // Ligne accent
    const lineGrad = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0)
    lineGrad.addColorStop(0, 'rgba(0,0,0,0)')
    lineGrad.addColorStop(0.3, accent); lineGrad.addColorStop(0.7, accent)
    lineGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lineGrad; ctx.fillRect(0, infoY, W, 2)

    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tx = W / 2
    let ty = infoY + INFO_H * 0.09

    // ── Badges ──────────────────────────────────────────────────────────────
    const badgeFs  = Math.round(W * 0.026)
    const badgeH   = Math.round(W * 0.042)
    const badgePad = Math.round(W * 0.026)
    const badgeR   = badgeH / 2  // pill complet

    type BadgeEntry = { label: string; solid?: string; grad?: [string, string]; textColor: string }
    const tags: BadgeEntry[] = []
    if (card.rc) tags.push({ label: '★ RC', grad: ['#e67e22', '#f39c12'], textColor: '#fff' })
    if (card.auto) tags.push({ label: 'AUTO', solid: '#2e7d32', textColor: '#fff' })
    if (card.num) {
      const m = card.num.trim().match(/\/(\d+)$/)
      const n = m ? parseInt(m[1]) : null
      if (n === 1)        tags.push({ label: card.num, grad: ['#b8860b', '#ffd700'], textColor: '#3d2800' })
      else if (n !== null && n <= 10)  tags.push({ label: card.num, grad: ['#555', '#c0c0c0'], textColor: '#111' })
      else if (n !== null && n <= 25)  tags.push({ label: card.num, grad: ['#6d3a00', '#cd7f32'], textColor: '#fff' })
      else                tags.push({ label: card.num, solid: '#7b1fa2', textColor: '#fff' })
    }
    if (card.patch) tags.push({ label: 'PATCH', solid: '#1565c0', textColor: '#fff' })

    if (tags.length > 0) {
      ctx.font = `800 ${badgeFs}px Inter, sans-serif`
      const widths = tags.map(t => ctx.measureText(t.label).width + badgePad * 2)
      const gap = Math.round(W * 0.014)
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
        // Glow
        ctx.shadowColor = tag.solid || tag.grad![0]
        ctx.shadowBlur  = Math.round(W * 0.018)
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH, badgeR); ctx.fill()
        ctx.shadowBlur = 0

        // Reflet interne (liseré haut)
        const shine = ctx.createLinearGradient(bx, ty, bx, ty + badgeH * 0.5)
        shine.addColorStop(0, 'rgba(255,255,255,0.25)'); shine.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = shine
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH * 0.55, [badgeR, badgeR, 0, 0]); ctx.fill()

        // Texte centré verticalement
        ctx.fillStyle = tag.textColor
        ctx.textBaseline = 'middle'
        ctx.fillText(tag.label, bx + bw / 2, bcy)
        ctx.textBaseline = 'top'
        bx += bw + gap
      })
      ty += badgeH + Math.round(INFO_H * 0.07)
    }

    // ── Nom joueur ───────────────────────────────────────────────────────────
    const nameFs = Math.round(W * 0.054)
    ctx.fillStyle = textMain
    ctx.font = `900 ${nameFs}px Inter, sans-serif`
    ctx.fillText(card.n, tx, ty)
    ty += nameFs * 1.15

    // ── Variation ────────────────────────────────────────────────────────────
    if (card.v) {
      const varFs = Math.round(W * 0.030)
      ctx.fillStyle = accent
      ctx.font = `600 italic ${varFs}px Inter, sans-serif`
      ctx.fillText(card.v, tx, ty)
      ty += varFs * 1.3
    }

    // ── Équipe (ligne 1) ─────────────────────────────────────────────────────
    if (card.t) {
      const teamFs = Math.round(W * 0.026)
      ctx.fillStyle = textSub
      ctx.font = `700 ${teamFs}px Inter, sans-serif`
      ctx.fillText(card.t, tx, ty)
      ty += teamFs * 1.35
    }

    // ── Année · Marque · Collection (ligne 2) ────────────────────────────────
    const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    if (meta2) {
      const metaFs = Math.round(W * 0.022)
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
      ctx.font = `400 ${metaFs}px Inter, sans-serif`
      ctx.fillText(meta2, tx, ty)
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

    // Meilleur rendu texte
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // ── Rendu direct pendant la capture (aucune compression JPEG, peu de
    //    mémoire → sûr sur mobile). On dessine chaque frame en temps réel et
    //    captureStream échantillonne le canvas à FPS.
    const mimeType =
      codec === 'mp4' && MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : 'video/webm'
    // Débit adapté à la résolution : ~beaucoup plus élevé qu'avant pour un
    // rendu net, plafonné plus bas sur mobile pour rester fluide.
    const pixels = w * h
    const bitrate = Math.round(pixels * (isMobile ? 9 : 14)) // ~ bits/pixel/s équivalent
    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.min(isMobile ? 12_000_000 : 24_000_000, Math.max(6_000_000, bitrate)),
    })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })))
      setDone(true); setRecording(false)
    }
    recorder.start()

    // Boucle rendu en temps réel basée sur l'horloge. On maintient la face
    // recto affichée HOLD ms après la fin de l'animation → la vidéo ne se coupe
    // plus trop tôt et la boucle recto↔recto reste parfaite.
    const HOLD = 700
    const frameInterval = 1000 / FPS
    const start = performance.now()
    let lastDraw = -1
    await new Promise<void>(resolve => {
      const tick = (now: number) => {
        // Throttle au FPS cible : évite de sur-dessiner (écrans 60/120 Hz) et
        // de saturer le CPU mobile, cause principale des saccades.
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
    // Laisse les derniers frames être capturés avant d'arrêter
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
