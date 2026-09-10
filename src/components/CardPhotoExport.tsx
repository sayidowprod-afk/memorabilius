'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/lib/LangContext'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { toast } from '@/lib/toast'

interface Card {
  f: string; b?: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  is_horizontal?: boolean
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

  // Même identité visuelle que l'export vidéo (CardVideoExport) : fond épuré
  // à un seul halo + grain, logo en watermark permanent haut-gauche, carte
  // sans effet de lumière plaqué dessus (ni glow accent sur les bords, ni
  // ombre/reflet -- retirés là-bas après retour utilisateur, jamais
  // réintroduits ici), panneau infos flottant avec badges sobres et équipe
  // entre les badges et le nom.
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

    const logoImg = isDark ? logoImgs.current.dark : logoImgs.current.light

    // ── Fond ── un seul halo doux couleur accent + grain subtil, comme la vidéo
    // (au lieu des deux halos concurrents + vignette de l'ancienne version).
    ctx.fillStyle = bgBase; ctx.fillRect(0, 0, w, h)

    const aspect = h / w
    const haloT = Math.min(1, Math.max(0, (aspect - 1) / 0.6))
    const haloX = w * (0.62 + 0.20 * haloT)
    const haloY = h * (0.10 - 0.04 * haloT)
    const halo = ctx.createRadialGradient(haloX, haloY, 0, haloX, haloY, w * 1.3)
    halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.26 : 0.13})`)
    halo.addColorStop(0.5, `rgba(${ar},${ag},${ab},${isDark ? 0.06 : 0.04})`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h)

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
    bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '80')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, w, h)

    const noise = document.createElement('canvas')
    noise.width = 96; noise.height = 96
    const nctx = noise.getContext('2d')!
    const imgData = nctx.createImageData(96, 96)
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255
      imgData.data[i] = v; imgData.data[i + 1] = v; imgData.data[i + 2] = v
      imgData.data[i + 3] = isDark ? 10 : 14
    }
    nctx.putImageData(imgData, 0, 0)
    const grainPattern = ctx.createPattern(noise, 'repeat')
    if (grainPattern) { ctx.fillStyle = grainPattern; ctx.fillRect(0, 0, w, h) }

    // ── Logo Memorabilius (watermark permanent, haut-gauche) ──
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoW = w * 0.24
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
      ctx.globalAlpha = isDark ? 0.62 : 0.75
      ctx.drawImage(logoImg, w * 0.055, h * 0.032, logoW, logoH)
      ctx.globalAlpha = 1
    } else {
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.7)` : `rgba(${ar},${ag},${ab},0.8)`
      ctx.font = `700 ${Math.round(w * 0.03)}px Inter, sans-serif`
      ctx.fillText('memorabilius.fr', w * 0.055, h * 0.032)
    }

    // ── Layout ────────────────────────────────────────────────────────────────
    const INFO_H      = Math.round(h * 0.19)
    const CARD_ZONE_H = h - INFO_H
    const CARD_MAX_W  = w * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    const CARD_RATIO  = card.is_horizontal ? 2.5 / 3.5 : 3.5 / 2.5
    const cardW = Math.min(CARD_MAX_W, CARD_MAX_H / CARD_RATIO)
    const cardH = cardW * CARD_RATIO
    const cardCY = CARD_ZONE_H / 2
    const cardX = w / 2 - cardW / 2
    const cardTop = cardCY - cardH / 2

    // ── Spotlight (derrière la carte, ne touche jamais son image) ─────────────
    const spotR = cardW * 1.15
    const spot = ctx.createRadialGradient(w / 2, cardCY, 0, w / 2, cardCY, spotR)
    spot.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.24 : 0.13})`)
    spot.addColorStop(0.45, `rgba(${ar},${ag},${ab},${(isDark ? 0.24 : 0.13) * 0.25})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spot
    ctx.fillRect(w / 2 - spotR, cardCY - spotR, spotR * 2, spotR * 2)

    // Ni reflet au sol ni ombre portée : retirés de la vidéo (rendu peu
    // flatteur, rectangle plein visible sous la carte), jamais réintroduits
    // ici pour garder les deux exports cohérents. La carte flotte simplement
    // sur le fond.

    // ── Image de la carte ─────────────────────────────────────────────────────
    ctx.drawImage(img, cardX, cardTop, cardW, cardH)

    // ── Highlight du bord supérieur (lumière zénithale) -- seul effet de
    // lumière laissé directement sur l'image, discret et non coloré ──────────
    ctx.save()
    ctx.beginPath(); ctx.rect(cardX, cardTop, cardW, cardH); ctx.clip()
    const topH = ctx.createLinearGradient(0, cardTop, 0, cardTop + cardH * 0.13)
    topH.addColorStop(0, 'rgba(255,255,255,0.16)')
    topH.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = topH; ctx.fillRect(cardX, cardTop, cardW, cardH * 0.13)
    ctx.restore()

    // Liseré -- épaisseur minimum en px absolus, comme la vidéo (reste net
    // sur les formats haute résolution).
    ctx.lineWidth = Math.max(2, w * 0.0028)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.strokeRect(cardX, cardTop, cardW, cardH)

    // ── Panneau infos flottant ── carte arrondie avec marge + ombre portée,
    // même traitement que la vidéo (au lieu de la bande plaquée aux bords de
    // l'ancienne version).
    const PM = w * 0.045
    const PB = h * 0.022
    const panelW = w - PM * 2
    const panelRadius = Math.round(w * 0.055)
    const panelTop = h - INFO_H
    const panelH = (h - PB) - panelTop

    ctx.save()
    ctx.shadowColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(60,50,30,0.18)'
    ctx.shadowBlur = w * 0.028
    ctx.shadowOffsetY = h * 0.006
    ctx.beginPath(); ctx.roundRect(PM, panelTop, panelW, panelH, panelRadius)
    ctx.fillStyle = infoBg
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath(); ctx.roundRect(PM, panelTop, panelW, panelH, panelRadius); ctx.clip()
    // Fin liseré accent en haut du panneau -- discret.
    ctx.fillStyle = `rgba(${ar},${ag},${ab},${isDark ? 0.55 : 0.4})`
    ctx.fillRect(PM, panelTop, panelW, Math.max(2, w * 0.0035))

    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tx = w / 2
    let ty = panelTop + panelH * 0.10

    // ── Badges ── style sobre : fond translucide neutre + texte/pastille
    // colorés, pas de dégradé saturé avec lueur.
    const badgeFs  = Math.round(w * 0.024)
    const badgeH   = Math.round(w * 0.040)
    const badgePad = Math.round(w * 0.022)
    const badgeR   = badgeH / 2

    type BadgeEntry = { label: string; color: string }
    const tags: BadgeEntry[] = []
    if (card.rc) tags.push({ label: '★ RC', color: '#e67e22' })
    if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
    if (card.num) {
      const m = card.num.trim().match(/\/(\d+)$/)
      const n = m ? parseInt(m[1]) : null
      const c = n === 1 ? '#b8860b' : n !== null && n <= 10 ? '#777' : n !== null && n <= 25 ? '#a0622e' : '#7b1fa2'
      tags.push({ label: card.num, color: c })
    }
    if (card.patch) tags.push({ label: 'PATCH', color: '#1565c0' })
    if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: accent })

    if (tags.length > 0) {
      ctx.font = `800 ${badgeFs}px Inter, sans-serif`
      const widths = tags.map(tg => ctx.measureText(tg.label).width + badgePad * 2)
      const gap = Math.round(w * 0.012)
      const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
      let bx = tx - totalW / 2

      tags.forEach((tag, i) => {
        const bw = widths[i]
        const bcy = ty + badgeH / 2

        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH, badgeR); ctx.fill()
        ctx.strokeStyle = `${tag.color}55`
        ctx.lineWidth = 1
        ctx.stroke()

        ctx.fillStyle = tag.color
        ctx.textBaseline = 'middle'
        ctx.fillText(tag.label, bx + bw / 2, bcy + 0.5)
        ctx.textBaseline = 'top'
        bx += bw + gap
      })
      ty += badgeH + Math.round(panelH * 0.07)
    }

    // ── Équipe en eyebrow ── entre les badges et le nom.
    if (card.t) {
      const teamFs = Math.round(w * 0.020)
      ctx.fillStyle = accent
      ctx.font = `800 ${teamFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.t.toUpperCase(), panelW * 0.85), tx, ty)
      ty += teamFs * 1.6
    }

    // ── Nom ───────────────────────────────────────────────────────────────────
    const nameFs = Math.round(w * 0.052)
    ctx.fillStyle = textMain
    ctx.font = `800 ${nameFs}px Inter, sans-serif`
    ctx.fillText(truncate(ctx, card.n, panelW * 0.92), tx, ty)
    ty += nameFs * 1.15

    if (card.v) {
      const varFs = Math.round(w * 0.028)
      ctx.fillStyle = accent
      ctx.font = `600 italic ${varFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, card.v, panelW * 0.88), tx, ty)
      ty += varFs * 1.3
    }

    const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    if (meta2) {
      const metaFs = Math.round(w * 0.021)
      ctx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
      ctx.font = `400 ${metaFs}px Inter, sans-serif`
      ctx.fillText(truncate(ctx, meta2, panelW * 0.85), tx, ty)
    }

    ctx.restore() // fin du clip panneau
  }

  useEffect(() => { draw() }, [pfmt, theme, side]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setGenerating(true)
    try {
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95))
      // canvas.toBlob() renvoie silencieusement null si le canvas est "tainted"
      // (image chargée sans CORS correctement négocié) -- ce cas passait
      // jusqu'ici totalement inaperçu : ni erreur, ni message, le bouton
      // revenait juste à son état normal comme si de rien n'était.
      if (!blob) throw new Error('canvas-empty')
      await saveOrShareFile(blob, `${card.n.replace(/\s+/g, '_')}_memorabilius.jpg`)
    } catch (e) {
      // Detail technique ajoute au message (ex: "Timeout (partage)") -- seul
      // moyen de savoir a quelle etape ca echoue sans acces a Crashlytics.
      const detail = e instanceof Error ? e.message : String(e)
      toast.error(`${t('video_download_error')} (${detail})`)
    } finally { setGenerating(false) }
  }

  // ── Style iOS, identique à l'export vidéo : contrôles segmentés, fond
  // flouté "frosted glass", coins très arrondis -- au lieu de l'ancien
  // panneau sombre uni avec des chips isolées.
  const groupLabel: React.CSSProperties = {
    color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 7px',
  }
  const segWrap: React.CSSProperties = {
    display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 3, gap: 2,
  }
  const segBtn = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 6px', borderRadius: 9, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap',
    background: active ? 'rgba(255,255,255,0.16)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
    transition: 'background 0.15s, color 0.15s',
  })

  const { w, h } = PHOTO_FORMATS[pfmt]

  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(26,26,38,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderRadius: 28, padding: '26px 22px', maxWidth: 400, width: '100%', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: '0 0 3px', letterSpacing: -0.2 }}>
          {t('photo_export_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 18px' }}>
          {card.n}{card.v ? ` · ${card.v}` : ''}
        </p>

        <canvas ref={canvasRef} width={w} height={h}
          style={{ width: '100%', maxWidth: 210, height: 'auto', borderRadius: 18, display: 'block', margin: '0 auto 20px', background: '#080818', boxShadow: '0 10px 34px rgba(0,0,0,0.4)' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, textAlign: 'left' }}>
          <div>
            <p style={groupLabel}>Format</p>
            <div style={segWrap}>
              {(Object.entries(PHOTO_FORMATS) as [PhotoFormat, typeof PHOTO_FORMATS[PhotoFormat]][]).map(([key, f]) => (
                <button key={key} style={segBtn(pfmt === key)} onClick={() => setPfmt(key)}>
                  {f.label} <span style={{ opacity: 0.6 }}>{f.ratio}</span>
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={groupLabel}>{t('video_theme')}</p>
              <div style={segWrap}>
                <button style={segBtn(theme === 'dark')} onClick={() => setTheme('dark')}>🌙 {t('video_dark')}</button>
                <button style={segBtn(theme === 'light')} onClick={() => setTheme('light')}>☀️ {t('video_light')}</button>
              </div>
            </div>
            {hasVerso && (
              <div style={{ flex: 1 }}>
                <p style={groupLabel}>{t('photo_export_side_recto')} / {t('photo_export_side_verso')}</p>
                <div style={segWrap}>
                  <button style={segBtn(side === 'recto')} onClick={() => setSide('recto')}>{t('photo_export_side_recto')}</button>
                  <button style={segBtn(side === 'verso')} onClick={() => setSide('verso')}>{t('photo_export_side_verso')}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={download} disabled={generating} style={{ background: generating ? 'rgba(46,125,50,0.5)' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 700, cursor: generating ? 'default' : 'pointer', fontSize: 15, width: '100%' }}>
            {generating ? t('photo_export_generating') : `⬇ ${t('photo_export_download')}`}
          </button>
          <button onClick={onClose} style={{ background: 'none', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '10px', fontWeight: 600, cursor: 'pointer', fontSize: 14, width: '100%' }}>
            {t('gallery_close')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
