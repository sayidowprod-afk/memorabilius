// Outil admin (/admin/pub) : PUB Memorabilius au format TikTok (17 s, 9:16) : accroche, écrans réels de l'appli, carte 3D, cuts sur le beat, appel à l'action.
const W = 1080, H = 1920
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const DISPLAY = `Surfquest, Impact, 'Arial Narrow', ${FONT}`
const ACCENT = '#ffd84d'
// Habillages : chaque vidéo en tire un au hasard (couleurs du fond, des halos, des pastilles de texte), pour qu'elles ne se ressemblent pas toutes
export type SkinId = 'bleu' | 'nuit' | 'rouge' | 'emeraude' | 'violet' | 'orange'
export type Skin = { id: SkinId; label: string; g: [string, string, string]; halo: string; halo2: string; accent: string; pill: string; light: string; btn: string }
export const SKINS: Record<SkinId, Skin> = {
  bleu: { id: 'bleu', label: 'Bleu Memorabilius', g: ['#0d3190', '#0a1f66', '#050d33'], halo: '80,140,255', halo2: '255,216,77', accent: '#ffd84d', pill: '#0a1030', light: '#c9d6ff', btn: '#0a1f66' },
  nuit: { id: 'nuit', label: 'Nuit et or', g: ['#1a1a1f', '#0e0e12', '#050507'], halo: '255,200,90', halo2: '255,255,255', accent: '#f5c451', pill: '#17130a', light: '#e8dcc0', btn: '#17130a' },
  rouge: { id: 'rouge', label: 'Rouge', g: ['#a3122a', '#6b0c1c', '#2b050b'], halo: '255,120,120', halo2: '255,235,160', accent: '#ffffff', pill: '#6b0c1c', light: '#ffd9dd', btn: '#6b0c1c' },
  emeraude: { id: 'emeraude', label: 'Émeraude', g: ['#0a7a5a', '#065040', '#03221b'], halo: '90,255,200', halo2: '255,240,150', accent: '#c6ff5c', pill: '#06352a', light: '#c9f5e6', btn: '#065040' },
  violet: { id: 'violet', label: 'Violet', g: ['#4b1fa8', '#2d1270', '#100630'], halo: '190,130,255', halo2: '255,150,220', accent: '#ff9be2', pill: '#2a0f66', light: '#e4d6ff', btn: '#2d1270' },
  orange: { id: 'orange', label: 'Orange', g: ['#e0561a', '#9c3410', '#3d1405'], halo: '255,190,110', halo2: '255,255,255', accent: '#fff2c4', pill: '#7a2a0b', light: '#ffe3cf', btn: '#9c3410' },
}
let TH: Skin = SKINS.bleu   // habillage de la vidéo en cours de dessin
// Formats : des montages différents, pas seulement d'autres textes
export type AdFormat = 'classique' | 'mur' | 'avant-apres' | 'focus' | 'rapide'
export const FORMATS: Record<AdFormat, string> = { classique: 'Classique (accroche, écrans, carte 3D)', mur: 'Mur de cartes', 'avant-apres': 'Avant / après (chaos puis rangé)', focus: 'Focus carte + écrans côte à côte', rapide: 'Rapide (cuts courts)' }
export type Trans = 'flash' | 'wipe' | 'zoom'
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const eio = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t) }
const eb = (t: number) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type Prep = { bmp: ImageBitmap; small: HTMLCanvasElement }
type Tall = { c: HTMLCanvasElement; nav: HTMLCanvasElement; k: number; head?: number; navH?: number }
export type AdAssets = {
  gal: Tall; trd: Tall; ven: Tall; set: Tall; ob: Tall; hm: Tall; vbg: HTMLImageElement
  shell: HTMLCanvasElement; shadow: HTMLCanvasElement; logo: HTMLCanvasElement | null
  cards: Prep[]; hook: string; cta: string; partner: HTMLCanvasElement | null; gui: Tall; tx: AdTx; scenes: Scene[]; fallback: boolean
  intro?: IntroStyle
  format: AdFormat; skin: Skin; trans: Trans; dur: number; lang: Lang
}
// Début de la vidéo (les 1,5 premières secondes décident de tout : un fond bleu avec du texte ne retient personne) :
//  texte = l'accroche seule (l'ancien début) · carte = la première carte, nette et en grand, dès la première image · question = une question + la carte
//  zoom = un gros plan de la carte qui se dézoome
export type IntroStyle = 'texte' | 'carte' | 'question' | 'zoom'

export type Lang = 'fr' | 'en' | 'de' | 'es' | 'it'
export type AdTx = { hooks: string[]; ctas: string[]; free: string; partner: string; caps: Record<string, string> }
export const AD_TX: Record<Lang, AdTx> = {
  fr: { hooks: ['Tu collectionnes des cartes ?', 'Ta collection mérite mieux qu’un classeur', 'POV : ta collection enfin bien rangée', 'Les collectionneurs vont adorer ça'], ctas: ['Crée ta galerie gratuitement', 'Rejoins les collectionneurs'], free: 'GRATUIT · SUR LE WEB ET ANDROID', partner: 'En partenariat avec :',
    caps: { gal: 'Toute ta collection au même endroit', v3d: 'Tes cartes en 3D', trd: 'Vends et échange avec les collectionneurs', ven: 'Offres, ventes, colis : tout est suivi', gui: 'Guides et conseils', set: 'Checklists', ob: 'Tes PC en boîtes de figurines', hm: 'Carte du jour, packs, pronos', mon: '100 % gratuit' } },
  en: { hooks: ['Do you collect cards?', 'Your collection deserves better than a binder', 'POV: your collection, finally organized', 'Collectors are going to love this'], ctas: ['Create your free gallery', 'Join the collectors'], free: 'FREE · ON THE WEB AND ANDROID', partner: 'In partnership with:',
    caps: { gal: 'Your whole collection in one place', v3d: 'Your cards in 3D', trd: 'Sell and trade with collectors', ven: 'Offers, sales, parcels: all tracked', gui: 'Guides and tips', set: 'Checklists', ob: 'Your PCs as collectible figure boxes', hm: 'Daily card, packs, predictions', mon: '100% free' } },
  de: { hooks: ['Sammelst du Karten?', 'Deine Sammlung verdient mehr als ein Album', 'POV: deine Sammlung endlich geordnet', 'Sammler werden das lieben'], ctas: ['Erstelle deine kostenlose Galerie', 'Werde Teil der Sammler'], free: 'KOSTENLOS · IM WEB UND AUF ANDROID', partner: 'In Partnerschaft mit:',
    caps: { gal: 'Deine ganze Sammlung an einem Ort', v3d: 'Deine Karten in 3D', trd: 'Verkaufe und tausche mit Sammlern', ven: 'Angebote, Verkäufe, Pakete: alles im Blick', gui: 'Guides und Tipps', set: 'Checklisten', ob: 'Deine PCs als Figuren-Boxen', hm: 'Tageskarte, Packs, Tipps', mon: '100 % kostenlos' } },
  es: { hooks: ['¿Coleccionas cartas?', 'Tu colección merece más que un archivador', 'POV: tu colección por fin ordenada', 'A los coleccionistas les va a encantar'], ctas: ['Crea tu galería gratis', 'Únete a los coleccionistas'], free: 'GRATIS · EN LA WEB Y EN ANDROID', partner: 'En colaboración con:',
    caps: { gal: 'Toda tu colección en un solo lugar', v3d: 'Tus cartas en 3D', trd: 'Vende e intercambia con coleccionistas', ven: 'Ofertas, ventas, envíos: todo controlado', gui: 'Guías y consejos', set: 'Checklists', ob: 'Tus PC en cajas de figuras', hm: 'Carta del día, sobres, pronósticos', mon: '100 % gratis' } },
  it: { hooks: ['Collezioni carte?', 'La tua collezione merita più di un raccoglitore', 'POV: la tua collezione, finalmente in ordine', 'I collezionisti lo adoreranno'], ctas: ['Crea la tua galleria gratis', 'Unisciti ai collezionisti'], free: 'GRATIS · SUL WEB E SU ANDROID', partner: 'In collaborazione con:',
    caps: { gal: 'Tutta la tua collezione in un posto', v3d: 'Le tue carte in 3D', trd: 'Vendi e scambia con i collezionisti', ven: 'Offerte, vendite, spedizioni: tutto sotto controllo', gui: 'Guide e consigli', set: 'Checklist', ob: 'I tuoi PC in scatole di figurine', hm: 'Carta del giorno, pack, pronostici', mon: '100 % gratis' } },
}
export const LANG_NAMES: Record<Lang, string> = { fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español', it: 'Italiano' }

// ── écrans de l'appli : captures recollées (barre du haut et menu du bas fixes)
const HEAD = 40, NAV = 83, NAVX = 26
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src + (src.startsWith('/ad/') ? '?v=20261119b' : '') })
function stitch(frames: { img: HTMLImageElement; y: number }[], o: { head?: number; nav?: number; navx?: number } = {}): Tall {
  // o : hauteur (px css) de la barre du haut et du menu du bas de ces captures. Les captures récentes du site n'ont plus de menu en bas (nav = 0) et une barre du haut de 60 px.
  const K = 2, VH = 1040, HD = o.head ?? HEAD, NV = o.nav ?? NAV, NX = o.navx ?? NAVX
  const last = frames[frames.length - 1]
  const c = document.createElement('canvas'); c.width = 480 * K; c.height = Math.ceil((last.y + VH) * K)
  const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'
  frames.forEach((f, i) => {
    const s = f.img.width / 480 // 1 (capture normale) ou 2 (capture haute définition)
    if (i === 0) x.drawImage(f.img, 0, 0, f.img.width, f.img.height, 0, f.y * K, 480 * K, VH * K)
    else x.drawImage(f.img, 0, HD * s, f.img.width, (VH - HD - NV) * s, 0, (f.y + HD) * K, 480 * K, (VH - HD - NV) * K)
  })
  if (NV + NX === 0) { const nav = document.createElement('canvas'); nav.width = 1; nav.height = 1; return { c, nav, k: K, head: HD, navH: 0 } }
  const f0 = frames[0].img, s0 = f0.width / 480, NH = (NV + NX) * K
  const nav = document.createElement('canvas'); nav.width = 480 * K; nav.height = NH
  const nx = nav.getContext('2d')!; nx.imageSmoothingQuality = 'high'; nx.drawImage(f0, 0, (VH - NV - NX) * s0, f0.width, (NV + NX) * s0, 0, 0, 480 * K, NH)
  // au-dessus du menu, on ne garde que le bouton central (le reste de cette bande est du contenu de page qui change)
  const tmp = document.createElement('canvas'); tmp.width = nav.width; tmp.height = NH; tmp.getContext('2d')!.drawImage(nav, 0, 0)
  nx.clearRect(0, 0, nav.width, NX * K); nx.save(); nx.beginPath(); nx.ellipse(240 * K, NX * K, 40 * K, NX * K, 0, 0, Math.PI * 2); nx.clip(); nx.drawImage(tmp, 0, 0); nx.restore()
  return { c, nav, k: K, head: HD, navH: NV + NX }
}
function screen(ctx: CanvasRenderingContext2D, T: Tall, scroll: number, x: number, y: number, w: number, h: number) {
  ctx.save(); ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(T.c, 0, scroll * T.k, 480 * T.k, 1040 * T.k, x, y, w, h)
  const hd = T.head ?? HEAD, nh = T.navH ?? (NAV + NAVX)
  ctx.drawImage(T.c, 0, 0, 480 * T.k, hd * T.k, x, y, w, (hd / 1040) * h)
  if (nh > 0) ctx.drawImage(T.nav, 0, 0, T.nav.width, T.nav.height, x, y + h - (nh / 1040) * h, w, (nh / 1040) * h)
  ctx.restore()
}

// téléphone : l'écran fait SWP × SHP, il dépasse volontairement en bas du cadre (style « phone peeking » des pubs TikTok)
const SWP = 840, SHP = Math.round(SWP * 1040 / 480), PHONE_TOP = 430
function makeShell(): HTMLCanvasElement {
  const pad = 120, bw = SWP + 34, bh = SHP + 34
  const c = document.createElement('canvas'); c.width = bw + pad * 2; c.height = bh + pad * 2
  const x = c.getContext('2d')!
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 80; x.shadowOffsetY = 36
  x.fillStyle = '#07080d'; x.beginPath(); x.roundRect(pad, pad, bw, bh, 84); x.fill()
  x.shadowColor = 'transparent'; x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 2.5; x.stroke()
  return c
}
function makeShadow(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 700; c.height = 200
  const x = c.getContext('2d')!; x.filter = 'blur(40px)'; x.fillStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.ellipse(350, 100, 250, 34, 0, 0, Math.PI * 2); x.fill()
  return c
}

// logo du partenaire (/ad/partner.webp, fond transparent) : recadré sur la partie visible pour qu'il se place précisément
export async function loadPartnerLogo(): Promise<HTMLCanvasElement | null> {
  try {
    const img = await loadImg('/ad/partner.webp')
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const x = c.getContext('2d')!; x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 16) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y }
    if (x1 <= x0 || y1 <= y0) return null
    const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1
    out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
    return out
  } catch { return null }
}

export async function loadAdAssets(cards: Prep[], hook: string, cta: string, lang: Lang = 'fr', opts: { format?: AdFormat; skin?: SkinId; trans?: Trans } = {}): Promise<AdAssets> {
  const format = opts.format ?? 'classique', skin = SKINS[opts.skin ?? 'bleu'], trans = opts.trans ?? 'flash'
  const scenes = scenesFor(lang, format)
  const names = ['g0', 'g1', 'g2', 'g3', 'tr0', 'tr1', 'tr2', 'tr3', 'vt0', 'vt1', 'vt2', 'gd0', 'gd1', 'gd2', 'sl0', 'sl1', 'sl2', 'ob0', 'ob1', 'hm0', 'hm1', 'vbg']
  const dir = lang === 'fr' ? '/ad/app_' : `/ad/${lang}/app_`
  let fallback = false
  // captures de la langue si elles existent, sinon celles en français (les textes de la pub restent traduits)
  const im = Object.fromEntries(await Promise.all(names.map(async n => [n, await loadImg(`${dir}${n}.jpg`).catch(() => { if (!n.startsWith('vt') || lang === 'fr') fallback = true; return loadImg(`/ad/app_${n}.jpg`) })]))) as Record<string, HTMLImageElement>
  let logo: HTMLCanvasElement | null = null
  try {
    const r = await fetch('/memorabilius-logo-white-sm.png'); const b = await createImageBitmap(await r.blob())
    logo = document.createElement('canvas'); logo.width = b.width; logo.height = b.height
    const x = logo.getContext('2d')!; x.drawImage(b, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, logo.width, logo.height)
  } catch { /* sans logo */ }
  return {
    gal: stitch([{ img: im.g0, y: 0 }, { img: im.g1, y: 700 }, { img: im.g2, y: 1400 }, { img: im.g3, y: 2100 }], { head: 60, nav: 0, navx: 0 }),
    trd: stitch([{ img: im.tr0, y: 0 }, { img: im.tr1, y: 700 }, { img: im.tr2, y: 1400 }, { img: im.tr3, y: 2100 }], { head: 60, nav: 0, navx: 0 }),
    ven: stitch([{ img: im.vt0, y: 0 }, { img: im.vt1, y: 700 }, { img: im.vt2, y: 1125 }]),
    set: stitch([{ img: im.sl0, y: 0 }, { img: im.sl1, y: 700 }, { img: im.sl2, y: 1400 }], { head: 60, nav: 0, navx: 0 }),
    ob: stitch([{ img: im.ob0, y: 0 }, { img: im.ob1, y: 350 }], { head: 60, nav: 0, navx: 0 }),
    hm: stitch([{ img: im.hm0, y: 0 }, { img: im.hm1, y: 710 }], { head: 60, nav: 0, navx: 0 }),
    gui: stitch([{ img: im.gd0, y: 0 }, { img: im.gd1, y: 700 }, { img: im.gd2, y: 1400 }]),
    vbg: im.vbg, shell: makeShell(), shadow: makeShadow(), logo, cards, hook, cta, partner: await loadPartnerLogo(), tx: AD_TX[lang], scenes, fallback, format, skin, trans, dur: scenes[scenes.length - 1].b, lang,
    intro: format === 'focus' ? 'zoom' : format === 'rapide' ? 'carte' : undefined,
  }
}

// ── texte façon TikTok : gros, contour épais, mot par mot
function wrap(ctx: CanvasRenderingContext2D, words: string[], maxW: number): string[][] {
  const lines: string[][] = []; let cur: string[] = []
  for (const w of words) { if (cur.length && ctx.measureText([...cur, w].join(' ')).width > maxW) { lines.push(cur); cur = [w] } else cur.push(w) }
  if (cur.length) lines.push(cur)
  return lines
}
function caption(ctx: CanvasRenderingContext2D, text: string, k: number, y: number, size: number) {
  const words: string[] = []
  for (const tk of text.toUpperCase().split(/\s+/).filter(Boolean)) { if (words.length && /^[?!.:]+$/.test(tk)) words[words.length - 1] += tk; else words.push(tk) } // la ponctuation seule reste collée au mot précédent
  if (!words.length) return
  ctx.save(); ctx.font = `400 ${size}px ${DISPLAY}`; ctx.textBaseline = 'middle'
  const padX = size * 0.28, lines = wrap(ctx, words, 900 - padX * 2), lh = size * 1.22, y0 = y - ((lines.length - 1) * lh) / 2
  const shown = Math.floor(k / 0.09) + 1
  let n = 0
  lines.forEach((line, li) => {
    const sp = ctx.measureText(' ').width * 1.1
    const ws = line.map((w, wi) => ctx.measureText(w).width + (li === lines.length - 1 && wi === line.length - 1 ? padX * 2 : 0))
    let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1)) / 2
    line.forEach((w, wi) => {
      n++
      if (n <= shown) {
        const last = n === words.length, pop = eb(seg(k, (n - 1) * 0.09, (n - 1) * 0.09 + 0.16)), cx = x + ws[wi] / 2, cy = y0 + li * lh
        ctx.save(); ctx.translate(cx, cy); ctx.scale(0.65 + 0.35 * pop, 0.65 + 0.35 * pop); ctx.globalAlpha = clamp(pop * 2)
        if (last) { // dernier mot : pastille jaune, texte sombre (mise en avant façon TikTok)
          ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.roundRect(-ws[wi] / 2, -size * 0.58, ws[wi], size * 1.16, size * 0.2); ctx.fill()
          ctx.fillStyle = TH.pill; ctx.textAlign = 'center'; ctx.fillText(w, 0, size * 0.02)
        } else {
          ctx.shadowColor = 'rgba(0,10,50,.55)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.07
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(w, 0, size * 0.02)
        }
        ctx.restore()
      }
      x += ws[wi] + sp
    })
  })
  ctx.restore()
}
// fond aux couleurs de la marque : dégradé bleu profond, halos qui bougent doucement, filets de lumière, vignette
function bg(ctx: CanvasRenderingContext2D, _p: Prep | undefined, t: number, hue = 0) {
  const g = ctx.createLinearGradient(0, 0, W * 0.5, H); g.addColorStop(0, TH.g[0]); g.addColorStop(0.5, TH.g[1]); g.addColorStop(1, TH.g[2])
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const gx = W * (0.5 + 0.28 * Math.sin(t * 0.45 + hue)), gy = H * (0.36 + 0.06 * Math.cos(t * 0.5 + hue))
  const r1 = ctx.createRadialGradient(gx, gy, 0, gx, gy, 950); r1.addColorStop(0, `rgba(${TH.halo},.42)`); r1.addColorStop(1, `rgba(${TH.halo},0)`)
  ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H)
  const r2 = ctx.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, 800); r2.addColorStop(0, `rgba(${TH.halo2},.16)`); r2.addColorStop(1, `rgba(${TH.halo2},0)`)
  ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.42)
  for (let i = 0; i < 3; i++) {
    const off = ((t * 60 + i * 520) % 1560) - 780, lg = ctx.createLinearGradient(off - 120, 0, off + 120, 0)
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.055)'); lg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = lg; ctx.fillRect(off - 120, -H, 240, H * 2)
  }
  ctx.restore()
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,10,.5)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
}

// carte en perspective réelle (bandes verticales), bords nets, reflet qui balaye
function card3d(ctx: CanvasRenderingContext2D, shadow: HTMLCanvasElement, b: ImageBitmap, cx: number, cy: number, h: number, rotY: number, rotX: number, shine: number) {
  const w = (b.width / b.height) * h, f = 2400, N = 64, sy = Math.cos(rotX)
  ctx.save()
  const sw = w * 0.95; ctx.drawImage(shadow, cx - sw / 2, cy + h / 2 + 20, sw, sw * 0.29)
  const px: number[] = [], tp: number[] = [], bt: number[] = []
  for (let i = 0; i <= N; i++) { const x3 = (i / N - 0.5) * w, z = x3 * Math.sin(rotY), sc = f / (f - z); px.push(cx + x3 * Math.cos(rotY) * sc); tp.push(cy - (h / 2) * sy * sc); bt.push(cy + (h / 2) * sy * sc) }
  for (let i = 0; i < N; i++) ctx.drawImage(b, (i / N) * b.width, 0, b.width / N + 1, b.height, Math.min(px[i], px[i + 1]), (tp[i] + tp[i + 1]) / 2, Math.abs(px[i + 1] - px[i]) + 0.8, ((bt[i] - tp[i]) + (bt[i + 1] - tp[i + 1])) / 2)
  ctx.save(); ctx.beginPath(); ctx.moveTo(px[0], tp[0]); for (let i = 1; i <= N; i++) ctx.lineTo(px[i], tp[i]); for (let i = N; i >= 0; i--) ctx.lineTo(px[i], bt[i]); ctx.closePath(); ctx.clip()
  const xs = px[0] + (px[N] - px[0]) * lerp(-0.3, 1.3, shine)
  const g = ctx.createLinearGradient(xs - 160, cy - h / 2, xs + 160, cy + h / 2)
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.38)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(Math.min(px[0], px[N]) - 10, cy - h, Math.abs(px[N] - px[0]) + 20, h * 2)
  ctx.restore(); ctx.restore()
}

// ── montage : chaque scène démarre sur un temps du beat (120 bpm = 0,5 s)
export const AD_DUR = 17
type SceneId = 'hook' | 'gal' | 'v3d' | 'trd' | 'ven' | 'gui' | 'set' | 'ob' | 'hm' | 'mon' | 'cta' | 'wall' | 'pile' | 'order' | 'big' | 'duo'
type Key = 'gal' | 'trd' | 'ven' | 'gui' | 'set' | 'ob' | 'hm'
type Scene = { id: SceneId; a: number; b: number; key?: Key; from?: number; to?: number; key2?: Key; off?: number }
// textes des nouvelles scènes (les autres sont dans AD_TX.caps)
const NEWCAPS: Record<Lang, Record<string, string>> = {
  fr: { wall: 'Toutes tes cartes, enfin rangées', pile: 'Avant : le chaos', order: 'Après : tout est à sa place', big: 'Chaque carte mérite mieux qu’un tiroir', duo: 'Galerie, échanges, setlists : tout y est' },
  en: { wall: 'All your cards, finally organized', pile: 'Before: chaos', order: 'After: everything in its place', big: 'Every card deserves better than a drawer', duo: 'Gallery, trades, setlists: it’s all there' },
  de: { wall: 'Alle deine Karten, endlich geordnet', pile: 'Vorher: Chaos', order: 'Nachher: alles an seinem Platz', big: 'Jede Karte verdient mehr als eine Schublade', duo: 'Galerie, Tausch, Setlisten: alles da' },
  es: { wall: 'Todas tus cartas, por fin ordenadas', pile: 'Antes: caos', order: 'Después: todo en su sitio', big: 'Cada carta merece más que un cajón', duo: 'Galería, intercambios, setlists: todo está' },
  it: { wall: 'Tutte le tue carte, finalmente in ordine', pile: 'Prima: caos', order: 'Dopo: tutto al suo posto', big: 'Ogni carta merita più di un cassetto', duo: 'Galleria, scambi, setlist: c’è tutto' },
}
export function scenesFor(lang: Lang, format: AdFormat = 'classique'): Scene[] {
  const fr = lang === 'fr'
  if (format === 'mur') return [
    { id: 'hook', a: 0, b: 1.5 },
    { id: 'wall', a: 1.5, b: 4.5 },
    { id: 'v3d', a: 4.5, b: 6.5 },
    { id: 'gal', a: 6.5, b: 8.5, key: 'gal', from: 0, to: 1500 },
    { id: 'hm', a: 8.5, b: 10.5, key: 'hm', from: 0, to: 710 },
    { id: 'cta', a: 10.5, b: 13 },
  ]
  if (format === 'avant-apres') return [
    { id: 'hook', a: 0, b: 1.5 },
    { id: 'pile', a: 1.5, b: 3.5 },
    { id: 'order', a: 3.5, b: 6 },
    { id: 'gal', a: 6, b: 8, key: 'gal', from: 0, to: 1500 },
    { id: 'set', a: 8, b: 10, key: 'set', from: 0, to: 350 },
    { id: 'trd', a: 10, b: 11.5, key: 'trd', from: 0, to: 1300 },
    { id: 'cta', a: 11.5, b: 14 },
  ]
  if (format === 'focus') return [
    { id: 'hook', a: 0, b: 2 },
    { id: 'big', a: 2, b: 4.5 },
    { id: 'v3d', a: 4.5, b: 6.5 },
    { id: 'duo', a: 6.5, b: 9, key: 'gal', key2: 'trd', from: 0, to: 1300 },
    { id: 'hm', a: 9, b: 11, key: 'hm', from: 0, to: 710 },
    { id: 'cta', a: 11, b: 13.5 },
  ]
  if (format === 'rapide') return [
    { id: 'hook', a: 0, b: 1 },
    { id: 'mon', a: 1, b: 3, off: 0 },
    { id: 'duo', a: 3, b: 5, key: 'set', key2: 'ob', from: 0, to: 350 },
    { id: 'mon', a: 5, b: 7, off: 4 },
    { id: 'wall', a: 7, b: 9 },
    { id: 'cta', a: 9, b: 11 },
  ]
  return [
    { id: 'hook', a: 0, b: 1.5 },
    { id: 'gal', a: 1.5, b: 3.5, key: 'gal', from: 0, to: 1500 },
    { id: 'v3d', a: 3.5, b: 5.5 },
    { id: 'trd', a: 5.5, b: 7, key: 'trd', from: 0, to: 1300 },
    fr ? { id: 'ven', a: 7, b: 8.5, key: 'ven', from: 0, to: 950 } : { id: 'gui', a: 7, b: 8.5, key: 'gui', from: 0, to: 1100 },
    { id: 'set', a: 8.5, b: 10, key: 'set', from: 0, to: 350 },
    { id: 'ob', a: 10, b: 11.5, key: 'ob', from: 0, to: 350 },
    { id: 'hm', a: 11.5, b: 13.5, key: 'hm', from: 0, to: 710 },
    { id: 'mon', a: 13.5, b: 14.5 },
    { id: 'cta', a: 14.5, b: 17 },
  ]
}

// carte à plat (coins nets, jamais arrondis) dans une boîte w × h
function flatCard(ctx: CanvasRenderingContext2D, p: Prep, cx: number, cy: number, bw: number, bh: number, rot: number, sc: number) {
  const f = Math.min(bw / p.bmp.width, bh / p.bmp.height), cw = p.bmp.width * f, ch = p.bmp.height * f
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(sc, sc)
  ctx.fillStyle = 'rgba(0,0,30,.42)'; ctx.fillRect(-cw / 2 + 10, -ch / 2 + 16, cw, ch)
  ctx.drawImage(p.bmp, -cw / 2, -ch / 2, cw, ch); ctx.restore()
}
// grille de cartes (3 colonnes) et tas désordonné : positions fixes, donc la même chose à chaque image
const GRID = Array.from({ length: 9 }, (_, i) => ({ x: W / 2 + ((i % 3) - 1) * 324, y: 650 + Math.floor(i / 3) * 444 }))
const PILE = [[250, 800, -0.5], [640, 720, 0.35], [850, 1000, -0.25], [330, 1180, 0.6], [700, 1330, -0.45], [520, 960, 0.15], [180, 1450, 0.3], [880, 1560, 0.5], [500, 1560, -0.2]].map(([x, y, r]) => ({ x, y, r }))
// téléphone avec un écran de l'appli (taille et position libres)
function phoneAt(ctx: CanvasRenderingContext2D, A: AdAssets, key: Key, scroll: number, cx: number, cy: number, scale: number, rot: number) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale)
  ctx.drawImage(A.shell, -A.shell.width / 2, -A.shell.height / 2)
  ctx.save(); ctx.beginPath(); ctx.roundRect(-SWP / 2, -SHP / 2, SWP, SHP, 64); ctx.clip()
  screen(ctx, A[key], scroll, -SWP / 2, -SHP / 2, SWP, SHP)
  ctx.restore(); ctx.restore()
}

export function drawAd(ctx: CanvasRenderingContext2D, t: number, A: AdAssets) {
  TH = A.skin || SKINS.bleu
  const SC = A.scenes, sc = SC.find(s => t >= s.a && t < s.b) ?? SC[SC.length - 1]
  const idx = SC.indexOf(sc), k = t - sc.a, dur = sc.b - sc.a, cards = A.cards
  const pu = eo(seg(k, 0, 0.22)) // « punch » à chaque cut
  const sh = k < 0.18 ? 1 - k / 0.18 : 0, dx = Math.sin(k * 170) * 14 * sh, dy = Math.cos(k * 140) * 10 * sh

  if (sc.id === 'hook') {
    const st = A.intro || 'texte', p0 = cards[0]
    bg(ctx, p0, t)
    if (st === 'texte' || !p0) {
      caption(ctx, A.hook, k, 900, 150)
    } else {
      const f = Math.min(860 / p0.bmp.width, 1080 / p0.bmp.height), cw = p0.bmp.width * f, ch = p0.bmp.height * f
      const drawCard = (cx: number, cy: number, s: number, rot: number) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s)
        ctx.fillStyle = 'rgba(0,0,30,.45)'; ctx.fillRect(-cw / 2 + 18, -ch / 2 + 28, cw, ch) // coins nets : jamais d'arrondi sur la carte
        ctx.drawImage(p0.bmp, -cw / 2, -ch / 2, cw, ch); ctx.restore()
      }
      if (st === 'carte') {
        // la carte, nette et en grand, dès la première image, avec le « punch » du cut
        drawCard(W / 2 + dx, 760 + dy, lerp(1.28, 1, eo(seg(k, 0, 0.3))), lerp(0.05, -0.012, eo(seg(k, 0, 0.3))))
        caption(ctx, A.hook, Math.max(0, k - 0.25), 1500, 112)
      } else if (st === 'question') {
        drawCard(W / 2 + dx, 640 + dy, lerp(0.74, 0.64, eio(seg(k, 0, 1.4))), -0.02)
        caption(ctx, A.tx.hooks[0] || A.hook, k, 1300, 132)
      } else {
        // gros plan sur le haut de la carte, qui se dézoome jusqu'à la carte entière
        const s2 = lerp(2.9, 1, eio(seg(k, 0, 1.15)))
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip()
        drawCard(W / 2, 760 + (s2 - 1) * ch * 0.2, s2, 0)
        ctx.restore()
        caption(ctx, A.hook, Math.max(0, k - 0.5), 1500, 112)
      }
    }
  } else if (sc.key) {
    bg(ctx, cards[idx % Math.max(1, cards.length)], t, idx)
    const scale = lerp(1.1, 1, pu), rot = (idx % 2 ? 1 : -1) * lerp(0.035, 0.012, pu) + Math.sin(t * 0.8) * 0.004
    const scroll = lerp(sc.from!, sc.to!, eio(seg(k, 0.25, dur - 0.1)))
    ctx.save(); ctx.translate(W / 2 + dx, PHONE_TOP + SHP / 2 + dy + (1 - pu) * 140); ctx.rotate(rot); ctx.scale(scale, scale)
    ctx.drawImage(A.shell, -A.shell.width / 2, -A.shell.height / 2)
    ctx.save(); ctx.beginPath(); ctx.roundRect(-SWP / 2, -SHP / 2, SWP, SHP, 64); ctx.clip()
    screen(ctx, A[sc.key], scroll, -SWP / 2, -SHP / 2, SWP, SHP)
    ctx.restore(); ctx.restore()
    caption(ctx, A.tx.caps[sc.id] || '', k, 300, 112)
  } else if (sc.id === 'wall') {
    bg(ctx, undefined, t, 1)
    const n = Math.max(1, cards.length)
    GRID.forEach((g, i) => {
      const p = cards[i % n], pop = eb(seg(k, i * 0.07, i * 0.07 + 0.4)); if (pop <= 0.01) return
      flatCard(ctx, p, g.x + dx, g.y - k * 14 + dy, 300, 420, (i % 2 ? 1 : -1) * 0.012 * (1 - pop), 0.7 + 0.3 * pop)
    })
    caption(ctx, NEWCAPS[A.lang].wall, k, 240, 108)
  } else if (sc.id === 'pile') {
    bg(ctx, undefined, t, 3)
    const n = Math.max(1, cards.length)
    PILE.forEach((g, i) => { const pop = eb(seg(k, i * 0.05, i * 0.05 + 0.35)); if (pop > 0.01) flatCard(ctx, cards[i % n], g.x, g.y + Math.sin(k * 2 + i) * 6, 300, 420, g.r + Math.sin(k * 1.5 + i) * 0.03, 0.75 + 0.25 * pop) })
    caption(ctx, NEWCAPS[A.lang].pile, k, 240, 112)
  } else if (sc.id === 'order') {
    bg(ctx, undefined, t, 2)
    const n = Math.max(1, cards.length)
    GRID.forEach((g, i) => {
      const pi = PILE[i], pr = eio(seg(k, 0.15 + i * 0.07, 0.15 + i * 0.07 + 0.8))
      flatCard(ctx, cards[i % n], lerp(pi.x, g.x, pr), lerp(pi.y, g.y, pr), 300, 420, lerp(pi.r, 0, pr), 1)
    })
    caption(ctx, NEWCAPS[A.lang].order, k, 240, 108)
  } else if (sc.id === 'big') {
    bg(ctx, undefined, t, 4)
    const c = cards[Math.min(1, cards.length - 1)]
    if (c) card3d(ctx, A.shadow, c.bmp, W / 2 + dx, 960 + dy, lerp(1120, 1260, eio(seg(k, 0, dur))), 0.22 * Math.sin(k * 1.8), 0.04 * Math.sin(k * 1.3), (k * 0.45) % 1)
    caption(ctx, NEWCAPS[A.lang].big, k, 250, 100)
  } else if (sc.id === 'duo') {
    bg(ctx, cards[idx % Math.max(1, cards.length)], t, idx)
    const e = eo(seg(k, 0, 0.35))
    const scr = lerp(sc.from!, sc.to!, eio(seg(k, 0.25, dur - 0.1)))
    phoneAt(ctx, A, sc.key!, scr, W / 2 - 250 + dx, 1050 + dy + (1 - e) * 220, 0.56, -0.05)
    phoneAt(ctx, A, sc.key2!, scr * 0.8, W / 2 + 250 + dx, 1100 + dy + (1 - e) * 320, 0.56, 0.05)
    caption(ctx, NEWCAPS[A.lang].duo, k, 300, 104)
  } else if (sc.id === 'v3d') {
    bg(ctx, undefined, t, 2)
    const hg = ctx.createRadialGradient(W / 2, 1030, 0, W / 2, 1030, 700); hg.addColorStop(0, 'rgba(255,255,255,.22)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H)
    const c3 = cards[Math.min(3, cards.length - 1)]
    if (c3) card3d(ctx, A.shadow, c3.bmp, W / 2 + dx, 1030 + dy, lerp(1000, 1180, pu), 0.72 * Math.sin(2.4 * (k - 0.1)) * eio(seg(k, 0, 0.5)), 0.05 * Math.sin(k * 1.6), (k * 0.5) % 1)
    caption(ctx, A.tx.caps[sc.id] || '', k, 300, 112)
  } else if (sc.id === 'mon') {
    const per = (dur) / 4, i = Math.min(3, Math.floor(k / per)), kk = k - i * per, p = cards[(i + 1 + (sc.off ?? 0)) % Math.max(1, cards.length)]
    bg(ctx, p, t, i)
    if (p) {
      const ppu = eo(seg(kk, 0, 0.2)), f = Math.min(860 / p.bmp.width, 1080 / p.bmp.height), cw = p.bmp.width * f, ch = p.bmp.height * f
      const s2 = lerp(1.22, 1, ppu) * (1 + 0.04 * (kk / per)), rot = (i % 2 ? 1 : -1) * lerp(0.04, 0, ppu), shk = kk < 0.16 ? 1 - kk / 0.16 : 0
      ctx.save(); ctx.translate(W / 2 + Math.sin(kk * 170) * 14 * shk, 800 + Math.cos(kk * 140) * 10 * shk); ctx.rotate(rot); ctx.scale(s2, s2)
      ctx.fillStyle = 'rgba(0,0,30,.45)'; ctx.fillRect(-cw / 2 + 18, -ch / 2 + 28, cw, ch) // coins nets : jamais d'arrondi sur la carte
      ctx.drawImage(p.bmp, -cw / 2, -ch / 2, cw, ch); ctx.restore()
    }
    caption(ctx, A.tx.caps[sc.id] || '', k, 1500, 130)
  } else {
    bg(ctx, cards[cards.length - 1], t)
    const p1 = eb(seg(k, 0, 0.45)), p3 = eo(seg(k, 0.9, 1.35))
    if (A.logo) { const lw = 800, lh = (A.logo.height / A.logo.width) * lw; ctx.save(); ctx.translate(W / 2, 520); ctx.scale(0.6 + 0.4 * p1, 0.6 + 0.4 * p1); ctx.globalAlpha = clamp(p1 * 2); ctx.drawImage(A.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore() }
    caption(ctx, A.cta, k - 0.25, 800, 112)
    ctx.save(); ctx.globalAlpha = p3; ctx.translate(W / 2, 1050 + (1 - p3) * 30)
    // bouton au style du site : angles droits, blanc plein, titre en Surfquest
    ctx.fillStyle = '#fff'; ctx.fillRect(-310, -62, 620, 124)
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 6; ctx.strokeRect(-322, -74, 644, 148)
    ctx.fillStyle = TH.btn; ctx.font = `400 78px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MEMORABILIUS.FR', 0, 6)
    ctx.restore()
    ctx.save(); ctx.globalAlpha = p3; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 36px ${FONT}`; ctx.fillStyle = TH.light; ctx.fillText(A.tx.free, W / 2, 1165); ctx.restore()
    if (A.partner) {
      const p4 = eo(seg(k, 1.2, 1.7)), pw = 600, ph = (A.partner.height / A.partner.width) * pw
      ctx.save(); ctx.globalAlpha = p4; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 32px ${FONT}`; ctx.fillStyle = TH.light; ctx.fillText(A.tx.partner, W / 2, 1330)
      ctx.drawImage(A.partner, W / 2 - pw / 2, 1385 + (1 - p4) * 20, pw, ph); ctx.restore()
    }
  }
  // transition à chaque cut : flash blanc, balayage de couleur ou coup de zoom (selon la vidéo)
  if (idx > 0) {
    if (A.trans === 'wipe') { const w = seg(k, 0, 0.3); if (w > 0 && w < 1) { ctx.fillStyle = TH.accent; ctx.fillRect(W * (eio(w) * 2 - 1), 0, W, H) } }
    else if (A.trans === 'zoom') { const z = 1 - seg(k, 0, 0.16); if (z > 0) { ctx.fillStyle = `rgba(0,0,0,${z * 0.55})`; ctx.fillRect(0, 0, W, H) } }
    else { const fl = (1 - seg(k, 0, 0.13)) * 0.45; if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H) } }
  }
  // barre de progression
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(60, 70, W - 120, 8); ctx.fillStyle = '#fff'; ctx.fillRect(60, 70, (W - 120) * clamp(t / (A.dur || AD_DUR)), 8)
}
