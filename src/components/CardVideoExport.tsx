'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Capacitor } from '@capacitor/core'
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

// Couleurs proposées pour l'accent de la vidéo -- indépendant de la couleur de
// bordure du profil (déjà passée en `accent`), pour permettre un choix ponctuel
// sans aller changer un réglage de profil.
const ACCENT_PRESETS = ['#003DA6', '#E67E22', '#2E7D32', '#C0392B', '#7B1FA2', '#16A085', '#B8860B', '#E91E8C']

// Réutilise les derniers réglages choisis (format/thème/codec) d'un export à
// l'autre -- exporter plusieurs cartes à la suite repartait sinon à chaque
// fois des valeurs par défaut. Pas la couleur d'accent : elle reste liée à la
// carte du moment (valeur par défaut = sa propre couleur de bordure).
const PREFS_KEY = 'memorabilius:video-export-prefs'
type VideoPrefs = { vfmt: VideoFormat; theme: 'dark' | 'light'; codec: 'webm' | 'mp4' }
function loadPrefs(): Partial<VideoPrefs> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') } catch { return {} }
}
function savePrefs(prefs: VideoPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch {}
}

// Mémorise la dernière couleur d'accent choisie, par carte (clé = son image
// recto, déjà utilisée comme identifiant stable ailleurs dans ce fichier) --
// utile pour réexporter plus tard la même carte avec le même réglage, sans
// affecter la couleur par défaut des autres cartes (qui reste leur couleur de
// bordure de profil). Capé à 60 entrées pour ne pas grossir indéfiniment.
const ACCENT_MEMORY_KEY = 'memorabilius:video-export-accents'
function loadCardAccent(cardKey: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const map = JSON.parse(localStorage.getItem(ACCENT_MEMORY_KEY) || '{}')
    return map[cardKey] ?? null
  } catch { return null }
}
function saveCardAccent(cardKey: string, color: string) {
  try {
    const map = JSON.parse(localStorage.getItem(ACCENT_MEMORY_KEY) || '{}')
    map[cardKey] = color
    const keys = Object.keys(map)
    if (keys.length > 60) delete map[keys[0]]
    localStorage.setItem(ACCENT_MEMORY_KEY, JSON.stringify(map))
  } catch {}
}


function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (!text || ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export default function CardVideoExport({ card, accent: accentProp, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)
  // Partage direct dispo uniquement web/PWA (l'app native partage déjà via le
  // bouton Télécharger) et si le navigateur supporte le partage de fichiers.
  const [canShareFiles, setCanShareFiles] = useState(false)
  useEffect(() => {
    setCanShareFiles(!Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !!navigator.share)
  }, [])
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadPrefs().theme ?? 'dark')
  const [codec, setCodec] = useState<'webm' | 'mp4'>(() => loadPrefs().codec ?? 'webm')
  const [vfmt, setVfmt] = useState<VideoFormat>(() => loadPrefs().vfmt ?? 'default')
  // Couleur d'accent de la video, choisissable independamment de la couleur de
  // bordure du profil (accentProp) qui ne sert que de valeur par defaut --
  // sauf si cette carte precise a deja ete exportee avec une autre couleur,
  // auquel cas on repart de ce dernier choix.
  const [accent, setAccentState] = useState(() => loadCardAccent(card.f) ?? accentProp)
  const setAccent = (color: string) => { setAccentState(color); saveCardAccent(card.f, color) }
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

  useEffect(() => { savePrefs({ vfmt, theme, codec }) }, [vfmt, theme, codec])

  const previewImgs = useRef<{ f?: HTMLImageElement; b?: HTMLImageElement }>({})
  const logoImgs = useRef<{ dark?: HTMLImageElement; light?: HTMLImageElement }>({})
  const bgCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null)
  // Zone infos (badges, nom, variation, équipe, logo) + ombre de carte : rien
  // dedans ne dépend de `p` (progression d'animation) sauf la ligne accent en
  // pointillé -- tout le reste était pourtant redessiné (dégradés, shadowBlur,
  // texte) à chaque frame en pure perte. Pré-rendu une fois par export/thème/
  // format, puis simplement collé (drawImage) à chaque frame.
  const infoCache = useRef<{ key: string; canvas: HTMLCanvasElement; top: number } | null>(null)

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
  }, [vfmt, theme, recording, accent])

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

    const logoImg = isDark ? logoImgs.current.dark : logoImgs.current.light

    // ── Fond statique mis en cache ────────────────────────────────────────────
    const bgKey = `${W}x${H}-${isDark}-${accent}`
    if (!bgCache.current || bgCache.current.key !== bgKey) {
      const oc = document.createElement('canvas')
      oc.width = W; oc.height = H
      const octx = oc.getContext('2d')!

      octx.fillStyle = bgBase; octx.fillRect(0, 0, W, H)

      // Un seul halo doux, couleur accent -- fond épuré façon page produit, au
      // lieu de deux halos de teintes concurrentes + vignette qui chargeaient
      // visuellement la composition. Position adaptée au format : un halo calé
      // dans le coin haut-droit (pensé pour les formats hauts 9:13/9:16) cadrait
      // mal le carré 1:1, beaucoup moins haut -- se rapproche du centre-haut
      // quand le cadre s'aplatit.
      const aspect = H / W
      const haloT = Math.min(1, Math.max(0, (aspect - 1) / 0.6)) // 0 = carré, 1 = format haut
      const haloX = W * (0.62 + 0.20 * haloT)
      const haloY = H * (0.10 - 0.04 * haloT)
      const halo = octx.createRadialGradient(haloX, haloY, 0, haloX, haloY, W * 1.3)
      halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.26 : 0.13})`)
      halo.addColorStop(0.5, `rgba(${ar},${ag},${ab},${isDark ? 0.06 : 0.04})`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      octx.fillStyle = halo; octx.fillRect(0, 0, W, H)

      // Dégradé vertical vers le bas -- transition douce vers la zone infos
      const bgGrad = octx.createLinearGradient(0, 0, 0, H)
      bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '80')
      octx.fillStyle = bgGrad; octx.fillRect(0, 0, W, H)

      // Grain subtil -- un dégradé plat pouvait faire "généré numériquement",
      // un léger bruit (quelques % d'opacité, imperceptible individuellement)
      // donne un rendu plus proche d'un print premium. Tuile 96×96 générée une
      // fois puis répétée -- coût négligeable vu que tout ceci est déjà en cache.
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
      const grainPattern = octx.createPattern(noise, 'repeat')
      if (grainPattern) { octx.fillStyle = grainPattern; octx.fillRect(0, 0, W, H) }

      bgCache.current = { key: bgKey, canvas: oc }
    }
    ctx.drawImage(bgCache.current.canvas, 0, 0)

    // ── Zone de sécurité format Reel (9:16) ── les Reels/Stories s'affichent
    // sous l'UI native de l'appli (barre de progression, boutons de réaction)
    // qui recouvre le haut et le bas de l'écran -- une marge purement calquée
    // sur le format Défaut (moins extrême, 9:13) plaçait logo/panneau trop
    // près des bords sur ce format précis. Marge additionnelle seulement pour
    // les formats très hauts (aspect > 1.6, en pratique : Reel uniquement).
    const aspect0     = H / W
    const isReelish   = aspect0 > 1.6
    const safeTopExtra    = isReelish ? H * 0.035 : 0
    const safeBottomExtra = isReelish ? H * 0.045 : 0

    // ── Logo Memorabilius (watermark) ── en haut du cadre, léger souffle
    // (échelle) au même rythme que le zoom/rebond de la carte pour donner un
    // peu de vie au lieu d'un logo totalement figé pendant 6 secondes. Dessiné
    // hors du fond mis en cache (qui ne change pas frame à frame) pour pouvoir
    // varier son échelle à chaque image.
    const logoPulse = 1 + 0.035 * Math.sin(p * Math.PI * 2)
    if (logoImg && logoImg.naturalWidth > 0) {
      const logoW = W * 0.24 * logoPulse
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)
      const lx = W * 0.055, ly = H * 0.032 + safeTopExtra
      ctx.save()
      ctx.globalAlpha = isDark ? 0.62 : 0.75
      ctx.translate(lx, ly)
      ctx.drawImage(logoImg, 0, 0, logoW, logoH)
      ctx.restore()
    } else {
      ctx.save()
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.7)` : `rgba(${ar},${ag},${ab},0.8)`
      ctx.font = `700 ${Math.round(W * 0.03 * logoPulse)}px Inter, sans-serif`
      ctx.fillText('memorabilius.fr', W * 0.055, H * 0.032 + safeTopExtra)
      ctx.restore()
    }

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

    // ── Sortie vers un vrai écran de fin ── jusqu'ici la vidéo se contentait de
    // geler sur sa dernière frame pendant le palier (HOLD) avec juste un petit
    // pop de logo + CTA text superposés dessus. Maintenant carte et panneau
    // s'estompent progressivement et laissent place à un écran dédié (logo +
    // accroche), au lieu de rester figés à l'écran jusqu'à la coupe.
    const endFadeOut = holdT > 0 ? easeInOut(Math.min(1, Math.max(0, (holdT - 0.3) / 0.55))) : 0
    const endFadeIn  = holdT > 0 ? easeInOut(Math.min(1, Math.max(0, (holdT - 0.4) / 0.5))) : 0

    if (cardW > 2) {
      ctx.globalAlpha = introAlpha * (1 - endFadeOut)

      // Ni reflet au sol ni ombre portée sous la carte -- toutes les deux ont
      // produit un rendu peu flatteur (rectangle plein visible) : le reflet avait
      // un vrai bug (dégradé de fondu qui s'arrêtait sur une couleur opaque sans
      // jamais retomber à transparent), et l'ombre (deux tentatives, shadowBlur
      // recalculé chaque frame puis sprite pré-rendu redimensionné) n'a pas
      // convaincu non plus une fois corrigée. La carte flotte simplement sur le
      // fond, sans effet d'ancrage dédié.

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

      // Le rim light (glow accent plaqué sur les bords de la carte) a été
      // retiré : teinté directement sur les pixels de la carte, il en
      // dénaturait les couleurs réelles -- signalé comme gênant. Le spotlight
      // derrière la carte (plus bas, dessiné avant l'image) reste le seul
      // effet de lumière colorée, et ne touche jamais l'image elle-même.

      // ── Highlight du bord supérieur (lumière zénithale) ───────────────────
      const topH = ctx.createLinearGradient(0, cardTop, 0, cardTop + cardH * 0.13)
      topH.addColorStop(0, `rgba(255,255,255,${0.16 * absScale})`)
      topH.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = topH; ctx.fillRect(cardX, cardTop, cardW, cardH * 0.13)

      ctx.restore() // fin du clip gloss

      // ── Liseré lumineux (bord de la carte) ── épaisseur minimum en px absolus
      // (pas seulement proportionnelle à W) : sur les formats haute résolution
      // (Reel/Carré, 1080px) un trait purement proportionnel au format Défaut
      // (900px) paraissait plus fin à l'écran une fois affiché à taille réelle.
      ctx.lineWidth = Math.max(2, W * 0.0028)
      ctx.strokeStyle = `rgba(255,255,255,${0.16 + 0.24 * (1 - absScale)})`
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

    // ── Panneau infos flottant ── carte arrondie avec marge autour (pas une bande
    // collée aux bords) + ombre portée, façon widget iOS. Contenu (fond, badges,
    // nom, variation, équipe, meta, logo) pré-rendu une fois par export/thème/
    // format/couleur -- rien dedans ne dépend de `p`, ce serait sinon refait
    // identique à chaque frame (dégradés, shadowBlur des badges, plusieurs
    // fillText avec changement de police) en pure perte.
    const PM = W * 0.045          // marge horizontale du panneau
    const PB = H * 0.022 + safeBottomExtra // marge basse -- le panneau flotte, ne touche pas le bord
    const panelW = W - PM * 2
    const panelRadius = Math.round(W * 0.055)
    const panelTop = H - INFO_H
    const panelH = (H - PB) - panelTop
    const infoCacheKey = `${W}x${H}-${isDark}-${accent}`
    if (!infoCache.current || infoCache.current.key !== infoCacheKey) {
      const ic = document.createElement('canvas')
      ic.width = Math.ceil(panelW)
      ic.height = Math.ceil(panelH)
      const ictx = ic.getContext('2d')!

      ictx.beginPath(); ictx.roundRect(0, 0, panelW, panelH, panelRadius); ictx.clip()
      ictx.fillStyle = infoBg
      ictx.fillRect(0, 0, panelW, panelH)
      // Fin liseré accent en haut du panneau -- discret, pas de pulsation (plus
      // sobre qu'une ligne animée pleine largeur qui ne collait plus au concept
      // de carte flottante).
      ictx.fillStyle = `rgba(${ar},${ag},${ab},${isDark ? 0.55 : 0.4})`
      ictx.fillRect(0, 0, panelW, Math.max(2, W * 0.0035))

      ictx.textAlign = 'center'; ictx.textBaseline = 'top'
      const tx = panelW / 2
      let ty = panelH * 0.10

      // ── Badges ─────────────────────────────────────────────────────────────
      // Style plus sobre : fond translucide neutre + texte/pastille colorés,
      // au lieu de pilules en dégradé saturé avec lueur.
      const badgeFs  = Math.round(W * 0.024)
      const badgeH   = Math.round(W * 0.040)
      const badgePad = Math.round(W * 0.022)
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

      if (tags.length > 0) {
        ictx.font = `800 ${badgeFs}px Inter, sans-serif`
        const widths  = tags.map(t => ictx.measureText(t.label).width + badgePad * 2)
        const gap     = Math.round(W * 0.012)
        const totalW  = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
        let bx = tx - totalW / 2

        tags.forEach((tag, i) => {
          const bw  = widths[i]
          const bcy = ty + badgeH / 2

          ictx.fillStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'
          ictx.beginPath(); ictx.roundRect(bx, ty, bw, badgeH, badgeR); ictx.fill()
          ictx.strokeStyle = `${tag.color}55`
          ictx.lineWidth = 1
          ictx.stroke()

          ictx.fillStyle = tag.color
          ictx.textBaseline = 'middle'
          ictx.fillText(tag.label, bx + bw / 2, bcy + 0.5)
          ictx.textBaseline = 'top'
          bx += bw + gap
        })
        ty += badgeH + Math.round(panelH * 0.07)
      }

      // ── Équipe en eyebrow ── déplacé entre les badges et le nom du joueur
      // (au lieu d'ouvrir la section, tout en haut) : le nom reste le premier
      // élément de plus haute hiérarchie visuelle, l'équipe l'introduit juste
      // avant sans passer devant les badges.
      if (card.t) {
        const teamFs = Math.round(W * 0.020)
        ictx.fillStyle = accent
        ictx.font = `800 ${teamFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, card.t.toUpperCase(), panelW * 0.85), tx, ty)
        ty += teamFs * 1.6
      }

      // ── Nom du joueur ─────────────────────────────────────────────────────────
      const nameFs = Math.round(W * 0.052)
      ictx.fillStyle = textMain
      ictx.font = `800 ${nameFs}px Inter, sans-serif`
      ictx.fillText(truncate(ictx, card.n, panelW * 0.92), tx, ty)
      ty += nameFs * 1.15

      // ── Variation ─────────────────────────────────────────────────────────────
      if (card.v) {
        const varFs = Math.round(W * 0.028)
        ictx.fillStyle = accent
        ictx.font = `600 italic ${varFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, card.v, panelW * 0.88), tx, ty)
        ty += varFs * 1.3
      }

      // ── Année · Marque · Collection ───────────────────────────────────────────
      const meta2 = [card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
      if (meta2) {
        const metaFs = Math.round(W * 0.021)
        ictx.fillStyle = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)'
        ictx.font = `400 ${metaFs}px Inter, sans-serif`
        ictx.fillText(truncate(ictx, meta2, panelW * 0.85), tx, ty)
      }

      infoCache.current = { key: infoCacheKey, canvas: ic, top: panelTop }
    }

    // Entrée du panneau légèrement décalée après celle de la carte (qui finit
    // vers p=0.06) -- au lieu d'arriver d'un bloc en même temps, ça donne un
    // peu de rythme à l'ouverture (carte, puis badges/nom juste après).
    const panelIntroT = Math.min(1, Math.max(0, (p - 0.03) / 0.08))
    const panelIntroAlpha = easeInOut(panelIntroT) * (1 - endFadeOut)

    // ── Petit "settle" du panneau à la fin de chaque demi-tour de la carte ──
    // le panneau restait totalement immobile pendant que la carte se retourne
    // juste au-dessus ; un très léger rebond (squash vertical amorti) au moment
    // précis où la carte termine sa rotation (p≈0.48 : face → dos, p≈0.92 :
    // dos → face) renforce la sensation physique du flip sans toucher au reste
    // du panneau (image mise en cache, inchangée).
    let bounce = 0
    for (const fp of [0.48, 0.92]) {
      const d = p - fp
      if (d >= 0 && d < 0.12) {
        const lt = d / 0.12
        bounce += Math.sin(lt * Math.PI * 2.2) * (1 - lt) * 0.05
      }
    }

    ctx.save()
    ctx.globalAlpha = panelIntroAlpha
    ctx.shadowColor = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(60,50,30,0.18)'
    ctx.shadowBlur = W * 0.028
    ctx.shadowOffsetY = H * 0.006
    const panelY = panelTop + (1 - panelIntroAlpha) * H * 0.02
    if (Math.abs(bounce) > 0.001) {
      ctx.translate(PM + panelW / 2, panelY + panelH)
      ctx.scale(1, 1 - bounce)
      ctx.drawImage(infoCache.current.canvas, -panelW / 2, -panelH)
    } else {
      ctx.drawImage(infoCache.current.canvas, PM, panelY)
    }
    ctx.restore()

    // ── Écran de fin ── simple fondu du logo + accroche, superposés au fond
    // déjà en place, une fois carte et panneau estompés. Les versions
    // précédentes (fond assombri, halo pulsé, rebond du logo, séparateur)
    // ont été jugées pas belles / pas fluides -- revenu à quelque chose de
    // volontairement sobre : un seul fondu net, sans animation de plus.
    if (endFadeIn > 0 && logoImg && logoImg.naturalWidth > 0) {
      const cx = W / 2
      const cy = CARD_ZONE_H * 0.46
      const logoW = W * 0.30
      const logoH = logoW * (logoImg.naturalHeight / logoImg.naturalWidth)

      ctx.save()
      ctx.globalAlpha = endFadeIn
      ctx.drawImage(logoImg, cx - logoW / 2, cy - logoH / 2, logoW, logoH)

      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = accent
      ctx.font = `700 ${Math.round(W * 0.024)}px Inter, sans-serif`
      ctx.fillText(t('video_cta'), cx, cy + logoH / 2 + H * 0.028)
      ctx.restore()
    }
  }

  const startRecording = async () => {
    // Petit retour haptique au lancement (mobile uniquement, no-op ailleurs) --
    // cohérent avec le reste du design "app native" du composant.
    try { navigator.vibrate?.(15) } catch {}
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
    // 700ms ne laissait quasiment aucun temps réel à l'écran de fin (fondu de
    // sortie de la carte + apparition du logo se chevauchaient sur ~350-400ms
    // à peine avant la coupe) -- signalé comme brusque. Palier bien plus long
    // pour que chaque étape (carte qui s'estompe, logo qui rebondit, texte qui
    // suit) ait le temps de se voir, avec un vrai temps de pause à la fin.
    const HOLD = 2200
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
      // Le detail technique (ex: "Timeout (partage)") est ajoute au message --
      // sans acces a Crashlytics, c'est le seul moyen pour un utilisateur qui
      // signale le bug de nous dire A QUELLE ETAPE precise ca echoue.
      const detail = e instanceof Error ? e.message : String(e)
      toast.error(`${t('video_download_error')} (${detail})`)
    } finally {
      setDownloading(false)
    }
  }

  // Partage direct (Web Share API) -- sur le web/PWA, "Télécharger" ne fait
  // que déposer le fichier dans les téléchargements ; sur mobile, la plupart
  // des navigateurs supportent le partage de fichiers directement (Instagram,
  // Messages, etc.) sans repasser par la galerie. Sur l'app native, le bouton
  // Télécharger ouvre déjà la feuille de partage Capacitor -- ce bouton reste
  // donc réservé au web pour ne pas dupliquer la même action deux fois.
  const shareVideo = async () => {
    if (!videoUrl || sharing) return
    setSharing(true)
    try {
      const blob = await (await fetch(videoUrl)).blob()
      if (blob.size < 2_000) throw new Error('empty-blob')
      const file = new File([blob], `${card.n.replace(/\s+/g, '_')}_memorabilius.${codec}`, { type: blob.type })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: card.n })
      } else {
        await navigator.share({ title: card.n })
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') toast.error(t('video_download_error'))
    } finally {
      setSharing(false)
    }
  }

  // ── Style façon iOS : contrôles segmentés (une barre neutre, pas une pilule par
  // option), fond flouté "frosted glass", coins très arrondis, boutons pleine
  // largeur empilés. L'accent est réservé à l'action principale / la barre de
  // progression / le choix de couleur lui-même, pas aux contrôles segmentés
  // (plus sobre, plus proche d'un vrai contrôle système).
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

  const { w, h } = scaledDims(vfmt)

  if (typeof document === 'undefined') return null
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10000003, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'rgba(26,26,38,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderRadius: 28, padding: '26px 22px', maxWidth: 400, width: '100%', textAlign: 'center',
        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>

        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: '0 0 3px', letterSpacing: -0.2 }}>
          {t('video_export_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 18px' }}>
          {card.n}{card.v ? ` · ${card.v}` : ''}
        </p>

        <canvas ref={canvasRef} width={w} height={h}
          style={{ width: '100%', maxWidth: 210, height: 'auto', borderRadius: 18, display: 'block', margin: '0 auto 20px', background: '#080818', boxShadow: '0 10px 34px rgba(0,0,0,0.4)' }} />

        {!recording && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20, textAlign: 'left' }}>
            <div>
              <p style={groupLabel}>Format</p>
              <div style={segWrap}>
                {(Object.entries(VIDEO_FORMATS) as [VideoFormat, typeof VIDEO_FORMATS[VideoFormat]][]).map(([key, f]) => (
                  <button key={key} style={segBtn(vfmt === key)} onClick={() => setVfmt(key)}>
                    {fmtLabel(key)} <span style={{ opacity: 0.6 }}>{f.ratio}</span>
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
              <div style={{ flex: 1 }}>
                <p style={groupLabel}>Codec</p>
                <div style={segWrap}>
                  <button style={segBtn(codec === 'webm')} onClick={() => setCodec('webm')}>WebM</button>
                  <button style={segBtn(codec === 'mp4')} onClick={() => setCodec('mp4')}>MP4</button>
                </div>
              </div>
            </div>
            <div>
              <p style={groupLabel}>{t('video_accent')}</p>
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                {ACCENT_PRESETS.map(c => (
                  <button key={c} onClick={() => setAccent(c)} aria-label={c} title={c} style={{
                    width: 24, height: 24, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', padding: 0,
                    boxShadow: accent.toLowerCase() === c.toLowerCase() ? `0 0 0 2px rgba(26,26,38,0.9), 0 0 0 4px ${c}` : 'none',
                  }} />
                ))}
                <label title={t('video_accent_custom')} style={{
                  width: 24, height: 24, borderRadius: '50%', position: 'relative', cursor: 'pointer', display: 'block',
                  background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                  boxShadow: !ACCENT_PRESETS.some(c => c.toLowerCase() === accent.toLowerCase()) ? '0 0 0 2px rgba(26,26,38,0.9), 0 0 0 4px #fff' : 'none',
                }}>
                  <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', border: 'none', padding: 0, width: '100%', height: '100%' }} />
                </label>
              </div>
            </div>
          </div>
        )}

        {recording && (
          <div style={{ margin: '4px 0 20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(90deg, ${accent}, color-mix(in srgb, ${accent} 60%, white))`, height: '100%', width: `${progress}%`, transition: 'width 0.1s linear', borderRadius: 99 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 }}>{progress}%</p>
          </div>
        )}

        {recordError && (
          <p style={{ color: '#f39c12', fontSize: 12, margin: '0 0 14px', lineHeight: 1.5 }}>
            ⚠️ {recordError}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 700, cursor: 'pointer', fontSize: 15, width: '100%' }}>
              {recordError ? t('video_redo') : t('video_generate')}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} disabled={downloading} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontWeight: 700, cursor: downloading ? 'default' : 'pointer', fontSize: 15, width: '100%', opacity: downloading ? 0.6 : 1 }}>
                {downloading ? `⏳ ${t('video_downloading')}` : `${t('video_download')} (.${codec})`}
              </button>
              {canShareFiles && (
                <button onClick={shareVideo} disabled={sharing} style={{ background: 'rgba(255,255,255,0.09)', color: '#fff', border: 'none', borderRadius: 14, padding: '13px', fontWeight: 600, cursor: sharing ? 'default' : 'pointer', fontSize: 14, width: '100%', opacity: sharing ? 0.6 : 1 }}>
                  {sharing ? `⏳ ${t('video_downloading')}` : `↗ ${t('video_share')}`}
                </button>
              )}
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 14, padding: '13px', fontWeight: 600, cursor: 'pointer', fontSize: 14, width: '100%' }}>
                {t('video_redo')}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'none', color: 'rgba(255,255,255,0.5)', border: 'none', padding: '10px', fontWeight: 600, cursor: 'pointer', fontSize: 14, width: '100%' }}>
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
