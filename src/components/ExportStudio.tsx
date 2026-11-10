'use client'
// Studio d'export : à partir de plusieurs cartes, crée (1) une vidéo qui les enchaîne, (2) une planche de contact, (3) un carrousel d'images.
// Format (9:16, 4:5, 1:1, 16:9) et modèle (Sobre, Néon, Vitrine) au choix. Tout est calculé sur l'appareil (canvas + MediaRecorder), rien n'est envoyé.
// Les cartes sont toujours dessinées avec leurs bords nets (jamais arrondis).
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ReelCard = { f: string; n: string; y?: string; s?: string; t?: string; thumb?: string; prix?: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string | null; g?: string }
export type ReelPool = { key: string; label: string; cards: ReelCard[] }

type Mode = 'video' | 'sheet' | 'carousel'
type FormatKey = '9:16' | '4:5' | '1:1' | '16:9'
type TrKey = 'slide' | 'fade' | 'flip' | 'cut'
type TplKey = 'sobre' | 'neon' | 'vitrine'

const FORMATS: Record<FormatKey, { w: number; h: number; label: string }> = {
  '9:16': { w: 1080, h: 1920, label: '9:16 · story, reel' },
  '4:5': { w: 1080, h: 1350, label: '4:5 · feed Instagram' },
  '1:1': { w: 1080, h: 1080, label: '1:1 · carré' },
  '16:9': { w: 1920, h: 1080, label: '16:9 · YouTube, Discord' },
}
type Tpl = { label: string; bg: [string, string]; accent: string; text: string; sub: string; glow: boolean; shadow: string }
const TEMPLATES: Record<TplKey, Tpl> = {
  sobre: { label: 'Sobre', bg: ['#0b1230', '#1b2f78'], accent: '#ffd84d', text: '#ffffff', sub: '#b8c4ff', glow: false, shadow: 'rgba(0,0,0,.55)' },
  neon: { label: 'Néon', bg: ['#07040f', '#240a45'], accent: '#ff3df2', text: '#ffffff', sub: '#5cf2ff', glow: true, shadow: 'rgba(255,61,242,.7)' },
  vitrine: { label: 'Vitrine', bg: ['#f7f0e0', '#decfa8'], accent: '#8a6a14', text: '#2a2110', sub: '#6b5a33', glow: false, shadow: 'rgba(60,40,0,.4)' },
}
const FPS = 30, INTRO_S = 1.2, OUTRO_S = 1.6, MAX_CARDS = 20
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function pickMime(): { mime: string; ext: string } {
  const cands: [string, string][] = [['video/mp4;codecs=avc1.42E01E', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']]
  for (const [m, e] of cands) { try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: e } } catch { /* pas de MediaRecorder */ } }
  return { mime: '', ext: 'webm' }
}
async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? await createImageBitmap(await r.blob()) : null } catch { return null }
}
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function bg(ctx: CanvasRenderingContext2D, W: number, H: number, tpl: Tpl, t = 0) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H)
  g.addColorStop(0, tpl.bg[0]); g.addColorStop(1, tpl.bg[1])
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  void t
}
// logo Memorabilius (version blanche) teinté de la couleur du texte du modèle
type Logo = HTMLCanvasElement | null
async function loadLogo(color: string): Promise<Logo> {
  try {
    const b = await loadBitmap('/memorabilius-logo-white-sm.png')
    if (!b) return null
    const c = document.createElement('canvas'); c.width = b.width; c.height = b.height
    const x = c.getContext('2d')!
    x.drawImage(b, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height)
    b.close?.()
    return c
  } catch { return null }
}
function drawLogo(ctx: CanvasRenderingContext2D, logo: Logo, cx: number, y: number, w: number, fallbackColor: string) {
  if (!logo) { text(ctx, 'MEMORABILIUS', cx, y + w * 0.12, w * 0.12, fallbackColor, 900, w * 2); return }
  const h = (logo.height / logo.width) * w
  ctx.drawImage(logo, cx - w / 2, y, w, h)
}
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, weight = 800, maxW = 900, align: CanvasTextAlign = 'center') {
  // gros titres : police Surfquest du site, en capitales (comme l'export photo et l'export vidéo d'une carte)
  if (weight >= 800) { ctx.font = `400 ${Math.round(size * 1.12)}px Surfquest, Impact, 'Arial Narrow', ${FONT}`; s = s.toUpperCase() }
  else ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color; ctx.textAlign = align
  let o = s
  while (ctx.measureText(o).width > maxW && o.length > 4) o = o.slice(0, -2)
  ctx.fillText(o === s ? s : o.trimEnd() + '…', x, y)
}
function drawCard(ctx: CanvasRenderingContext2D, b: ImageBitmap, cx: number, cy: number, maxW: number, maxH: number, tpl: Tpl, zoom = 1, scaleX = 1): { w: number; h: number } {
  const k = Math.min(maxW / b.width, maxH / b.height) * zoom
  const w = b.width * k, h = b.height * k
  ctx.save()
  ctx.shadowColor = tpl.shadow; ctx.shadowBlur = tpl.glow ? 90 : 60; ctx.shadowOffsetY = tpl.glow ? 0 : 24
  ctx.drawImage(b, cx - (w * scaleX) / 2, cy - h / 2, w * scaleX, h) // bords nets : jamais de découpe arrondie
  ctx.restore()
  return { w, h }
}
// pastilles RC / AUTO / PATCH / numérotée sous la carte
function pills(ctx: CanvasRenderingContext2D, c: ReelCard, cx: number, y: number, _width: number, h: number) {
  // mêmes pastilles que l'export photo d'une carte : fond léger, fin contour et texte de la couleur de l'atout
  const tags: { label: string; color: string }[] = []
  if (c.rc) tags.push({ label: '★ RC', color: '#e67e22' })
  if (c.auto) tags.push({ label: 'AUTO', color: '#2ea043' })
  if (c.num) {
    const m = c.num.trim().match(/\/(\d+)$/), n = m ? parseInt(m[1]) : null
    tags.push({ label: c.num, color: n === 1 ? '#d4a017' : n !== null && n <= 10 ? '#9aa0a6' : n !== null && n <= 25 ? '#c77d3e' : '#b05cd6' })
  }
  if (c.patch) tags.push({ label: 'PATCH', color: '#3b8cf0' })
  if (c.g && c.g !== 'Raw') tags.push({ label: c.g, color: '#ffd84d' })
  if (!tags.length) return
  const fs = Math.round(h * 0.55), pad = h * 0.55, gap = h * 0.3
  ctx.save()
  ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const widths = tags.map(t => ctx.measureText(t.label).width + pad * 2)
  let x = cx - (widths.reduce((p, q) => p + q, 0) + gap * (tags.length - 1)) / 2
  tags.forEach((t, i) => {
    ctx.fillStyle = 'rgba(8,12,30,.72)'
    ctx.beginPath(); ctx.roundRect(x, y, widths[i], h, h / 2); ctx.fill()
    ctx.strokeStyle = t.color; ctx.lineWidth = Math.max(1.5, h * 0.05); ctx.stroke()
    ctx.fillStyle = t.color; ctx.fillText(t.label, x + widths[i] / 2, y + h / 2 + 1)
    x += widths[i] + gap
  })
  ctx.restore()
}
// une carte « diapo » : carte + nom + détails, selon le format
function drawSlide(ctx: CanvasRenderingContext2D, W: number, H: number, tpl: Tpl, logo: Logo, c: ReelCard, b: ImageBitmap, o: { dx?: number; alpha?: number; scaleX?: number; zoom?: number; top?: number } = {}) {
  const land = W > H
  const sub = [c.y, c.s, c.t].filter(Boolean).join(' · ')
  const u = Math.min(W, H)
  ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha ?? 1))
  if (land) {
    const d = drawCard(ctx, b, W * 0.3 + (o.dx || 0), H * 0.47, W * 0.36, H * 0.74, tpl, o.zoom, o.scaleX)
    pills(ctx, c, W * 0.3 + (o.dx || 0), H * 0.47 + d.h / 2 + u * 0.03, d.w, u * 0.05)
    drawLogo(ctx, logo, W * 0.68, H * 0.86, W * 0.2, tpl.text)
    text(ctx, c.n || 'Carte', W * 0.68, H * 0.46, u * 0.075, tpl.text, 800, W * 0.46)
    if (sub) text(ctx, sub, W * 0.68, H * 0.46 + u * 0.08, u * 0.04, tpl.sub, 500, W * 0.46)
    if (c.prix) text(ctx, c.prix, W * 0.68, H * 0.46 + u * 0.17, u * 0.07, tpl.accent, 900, W * 0.46)
  } else {
    // pile verticale (carte, pastilles, nom, détails, prix) centrée entre le haut et le logo : espaces réguliers, rien ne se touche
    const top = o.top ?? u * 0.045 // la vidéo passe 90 pour laisser la place de sa barre de progression
    const logoW = u * 0.17, logoH = logo ? (logo.height / logo.width) * logoW : logoW * 0.22
    const logoTop = H - u * 0.04 - logoH
    const hasTags = !!(c.rc || c.auto || c.patch || c.num || (c.g && c.g !== 'Raw'))
    const pillH = u * 0.042, gapPills = hasTags ? u * 0.03 : 0
    const nameS = u * 0.048, subS = u * 0.029, prixS = u * 0.045
    const textH = nameS * 1.25 + (sub ? subS * 1.7 : 0) + (c.prix ? prixS * 1.8 : 0)
    const gapText = u * 0.035
    const availH = logoTop - u * 0.03 - top
    const maxW = W * (W / H > 0.9 ? 0.7 : 0.8)
    const maxH = Math.max(u * 0.3, availH - (hasTags ? gapPills + pillH : 0) - gapText - textH)
    const k = Math.min(maxW / b.width, maxH / b.height) * (o.zoom ?? 1)
    const ch = b.height * k
    const stack = ch + (hasTags ? gapPills + pillH : 0) + gapText + textH
    const y0 = top + Math.max(0, (availH - stack) / 2)
    const cx = W / 2 + (o.dx || 0)
    drawCard(ctx, b, cx, y0 + ch / 2, maxW, maxH, tpl, o.zoom, o.scaleX)
    if (hasTags) pills(ctx, c, cx, y0 + ch + gapPills, 0, pillH)
    let ty = y0 + ch + (hasTags ? gapPills + pillH : 0) + gapText + nameS
    text(ctx, c.n || 'Carte', W / 2, ty, nameS, tpl.text, 800, W - 140)
    if (sub) { ty += subS * 1.7; text(ctx, sub, W / 2, ty, subS, tpl.sub, 500, W - 140) }
    if (c.prix) { ty += prixS * 1.8; text(ctx, c.prix, W / 2, ty, prixS, tpl.accent, 900, W - 140) }
    drawLogo(ctx, logo, W / 2, logoTop, logoW, tpl.text)
  }
  ctx.globalAlpha = 1
}
function drawTitle(ctx: CanvasRenderingContext2D, W: number, H: number, tpl: Tpl, logo: Logo, big: string | null, l1: string, l2?: string) {
  const u = Math.min(W, H)
  if (big) text(ctx, big, W / 2, H / 2 - u * 0.03, u * 0.1, tpl.accent, 900, W - 120)
  else drawLogo(ctx, logo, W / 2, H / 2 - u * 0.17, Math.min(W * 0.6, u * 0.5), tpl.text)
  text(ctx, l1, W / 2, H / 2 + u * 0.06, u * 0.048, tpl.text, 600, W - 120)
  if (l2) text(ctx, l2, W / 2, H / 2 + u * 0.12, u * 0.036, tpl.sub, 500, W - 120)
}
const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>(res => c.toBlob(b => res(b), 'image/png'))

export default function ExportStudio({ pools, all, ownerName, onClose, onSingle }: { pools: ReelPool[]; all: ReelCard[]; ownerName: string; onClose: () => void; onSingle?: () => void }) {
  const usable = pools.filter(p => p.cards.length > 0)
  const [mode, setMode] = useState<Mode>('video')
  const [fmt, setFmt] = useState<FormatKey>('9:16')
  const [tplKey, setTplKey] = useState<TplKey>('sobre')
  const [tr, setTr] = useState<TrKey>('slide')
  const [per, setPer] = useState(2)
  const [cols, setCols] = useState(3)
  const [sel, setSel] = useState<ReelCard[]>(() => (usable[0]?.cards || []).slice(0, 6))
  const [q, setQ] = useState('')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'recording' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [imgs, setImgs] = useState<{ url: string; name: string }[]>([])
  const [ext, setExt] = useState('webm')
  const [err, setErr] = useState('')
  const stopRef = useRef(false)
  const urls = useRef<string[]>([])

  useEffect(() => () => { stopRef.current = true; urls.current.forEach(u => URL.revokeObjectURL(u)) }, [])
  const resetOut = () => { urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current = []; setVideoUrl(null); setImgs([]); setPhase('idle') }

  const hits = useMemo(() => {
    const w = q.toLowerCase().split(/\s+/).filter(Boolean)
    if (!w.length) return []
    const have = new Set(sel.map(c => c.f))
    return all.filter(c => !have.has(c.f) && /^https?:\/\//.test(c.f) && w.every(x => (c.n + ' ' + (c.s || '') + ' ' + (c.y || '')).toLowerCase().includes(x))).slice(0, 6)
  }, [q, all, sel])

  const limit = mode === 'sheet' ? 16 : MAX_CARDS
  const move = (i: number, d: number) => setSel(s => { const a = [...s]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a })
  const tpl = TEMPLATES[tplKey]
  const { w: W, h: H } = FORMATS[fmt]
  const total = INTRO_S + sel.length * per + OUTRO_S

  const keep = (blob: Blob) => { const u = URL.createObjectURL(blob); urls.current.push(u); return u }

  const loadAll = async (useThumb: boolean) => {
    const out: { c: ReelCard; b: ImageBitmap }[] = []
    for (let i = 0; i < sel.length; i++) {
      const c = sel[i]
      const b = await loadBitmap(useThumb ? (c.thumb || c.f) : c.f)
      if (stopRef.current) return null
      if (b) out.push({ c, b })
      setProgress((i + 1) / sel.length)
    }
    return out
  }

  const makeVideo = async (items: { c: ReelCard; b: ImageBitmap }[], logo: Logo) => {
    if (typeof MediaRecorder === 'undefined') throw new Error('Ce navigateur ne sait pas enregistrer de vidéo.')
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    const { mime, ext: e } = pickMime()
    const rec = new MediaRecorder(canvas.captureStream(FPS), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 6_000_000 })
    const chunks: Blob[] = []
    rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data) }
    const finished = new Promise<void>(res => { rec.onstop = () => res() })
    const dur = INTRO_S + items.length * per + OUTRO_S
    const draw = (t: number) => {
      bg(ctx, W, H, tpl, t)
      if (t < INTRO_S) { ctx.globalAlpha = ease(t / 0.6); drawTitle(ctx, W, H, tpl, logo, 'MA COLLECTION', ownerName, `${items.length} cartes`); ctx.globalAlpha = 1; return }
      if (t >= dur - OUTRO_S) { ctx.globalAlpha = ease((t - (dur - OUTRO_S)) / 0.5); drawTitle(ctx, W, H, tpl, logo, null, 'Ma collection de cartes'); ctx.globalAlpha = 1; return }
      const local = t - INTRO_S
      const i = Math.min(items.length - 1, Math.floor(local / per))
      const lt = (local - i * per) / per
      const inE = ease(Math.min(1, (local - i * per) / 0.45))
      const out = 1 - Math.max(0, (lt - 0.92) * 12.5)
      const { c, b } = items[i]
      const o = { zoom: 1 + 0.04 * lt, alpha: Math.min(inE, out), dx: 0, scaleX: 1, top: 90 }
      if (tr === 'slide') o.dx = (1 - inE) * W * 0.25
      if (tr === 'flip') o.scaleX = Math.max(0.02, Math.abs(Math.cos((1 - inE) * Math.PI / 2)))
      if (tr === 'cut') o.alpha = 1
      drawSlide(ctx, W, H, tpl, logo, c, b, o)
      ctx.fillStyle = 'rgba(128,128,128,.3)'; ctx.fillRect(70, 60, W - 140, 8)
      ctx.fillStyle = tpl.accent; ctx.fillRect(70, 60, (W - 140) * ((i + lt) / items.length), 8)
    }
    setPhase('recording')
    rec.start(250)
    const t0 = performance.now()
    await new Promise<void>(resolve => {
      const tick = () => {
        if (stopRef.current) return resolve()
        const t = (performance.now() - t0) / 1000
        draw(Math.min(t, dur)); setProgress(Math.min(1, t / dur))
        if (t >= dur) return resolve()
        requestAnimationFrame(tick)
      }
      tick()
    })
    rec.stop(); await finished
    if (stopRef.current) return
    setVideoUrl(keep(new Blob(chunks, { type: mime || 'video/webm' }))); setExt(e)
  }

  const makeSheet = async (items: { c: ReelCard; b: ImageBitmap }[], logo: Logo) => {
    const rows = Math.ceil(items.length / cols)
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    bg(ctx, W, H, tpl)
    const u = Math.min(W, H)
    const top = u * 0.13
    text(ctx, ownerName ? `Collection de ${ownerName}` : 'Ma collection', W / 2, top * 0.68, u * 0.045, tpl.accent, 900, W - 120)
    // grille serrée et centrée : la taille des cases vient de la forme d'une carte (≈ 5:7) + la ligne de pastilles, pas de la page entière
    const pad = u * 0.04, gap = u * 0.025, logoH = u * 0.07
    const availW = W - pad * 2, availH = H - top - logoH - u * 0.05 - pad
    const CH = 1.42, PR = 0.14 // hauteur d'une carte / largeur, + place des pastilles
    const cellW = Math.max(40, Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows / (CH + PR), u * 0.5))
    const cellH = cellW * (CH + PR)
    const gridH = rows * cellH + (rows - 1) * gap
    const y0 = top + (availH - gridH) / 2
    items.forEach(({ c, b }, i) => {
      const r = Math.floor(i / cols), cc = i % cols
      const inRow = r === rows - 1 ? items.length - r * cols : cols // dernière ligne incomplète : centrée
      const rowW = inRow * cellW + (inRow - 1) * gap
      const x = (W - rowW) / 2 + cc * (cellW + gap)
      const cx = x + cellW / 2, cy = y0 + r * (cellH + gap) + (cellW * CH) / 2
      const d = drawCard(ctx, b, cx, cy, cellW, cellW * CH, tpl)
      if (cellW > 150) pills(ctx, c, cx, cy + d.h / 2 + cellW * 0.025, d.w, Math.max(18, cellW * 0.085))
    })
    drawLogo(ctx, logo, W / 2, H - logoH - u * 0.03, u * 0.24, tpl.text)
    const bl = await toBlob(canvas)
    if (bl) setImgs([{ url: keep(bl), name: 'planche-collection.png' }])
  }

  const makeCarousel = async (items: { c: ReelCard; b: ImageBitmap }[], logo: Logo) => {
    const res: { url: string; name: string }[] = []
    const one = async (name: string, paint: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')!
      bg(ctx, W, H, tpl); paint(ctx)
      const bl = await toBlob(canvas); if (bl) res.push({ url: keep(bl), name })
    }
    await one('carrousel-01-couverture.png', ctx => drawTitle(ctx, W, H, tpl, logo, 'MA COLLECTION', ownerName, `${items.length} cartes · fais défiler`))
    for (let i = 0; i < items.length; i++) await one(`carrousel-${String(i + 2).padStart(2, '0')}.png`, ctx => drawSlide(ctx, W, H, tpl, logo, items[i].c, items[i].b))
    await one(`carrousel-${String(items.length + 2).padStart(2, '0')}-fin.png`, ctx => drawTitle(ctx, W, H, tpl, logo, null, ownerName || 'Ma collection de cartes'))
    setImgs(res)
  }

  const run = async () => {
    if (!sel.length) return
    stopRef.current = false; resetOut(); setErr(''); setPhase('loading'); setProgress(0)
    let items: { c: ReelCard; b: ImageBitmap }[] | null = null
    try {
      items = await loadAll(mode === 'sheet')
      if (!items) return
      if (!items.length) throw new Error('Aucune photo n’a pu être lue.')
      try { await document.fonts.load('400 40px Surfquest') } catch { /* police de repli */ }
      const logo = await loadLogo(tpl.text)
      if (mode === 'video') await makeVideo(items, logo)
      else if (mode === 'sheet') await makeSheet(items, logo)
      else await makeCarousel(items, logo)
      if (!stopRef.current) setPhase('done')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Échec de l’export.'); setPhase('error') }
    finally { items?.forEach(x => x.b.close?.()) }
  }

  const saveAll = async () => {
    const files: { url: string; name: string }[] = mode === 'video' && videoUrl ? [{ url: videoUrl, name: `video-collection.${ext}` }] : imgs
    // partage natif d'abord (téléphone : Instagram, Messages…), sinon téléchargement direct de chaque fichier
    try {
      const fs = await Promise.all(files.map(async f => { const b = await (await fetch(f.url)).blob(); return new File([b], f.name, { type: b.type }) }))
      if (navigator.canShare?.({ files: fs })) { await navigator.share({ files: fs, title: 'Ma collection' }); return }
    } catch (e) { if (e instanceof DOMException && e.name === 'AbortError') return }
    for (const f of files) { const a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 350)) }
  }
  const downloadAll = async () => {
    const files: { url: string; name: string }[] = mode === 'video' && videoUrl ? [{ url: videoUrl, name: `video-collection.${ext}` }] : imgs
    for (const f of files) { const a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 350)) }
  }

  if (typeof document === 'undefined') return null
  const busy = phase === 'loading' || phase === 'recording'
  const chip = (on: boolean): React.CSSProperties => ({ border: `2px solid ${on ? '#fff' : 'rgba(255,255,255,.4)'}`, background: on ? '#fff' : 'transparent', color: on ? '#06122e' : '#fff', padding: '5px 10px', fontSize: 12, fontWeight: 800, cursor: busy ? 'default' : 'pointer' })
  const lab: React.CSSProperties = { fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: '#aab3d1', fontWeight: 700, margin: '10px 0 4px' }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Exports image et vidéo" onClick={() => { if (!busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 600000, background: 'rgba(5,8,25,.85)', display: 'grid', placeItems: 'start center', padding: 16, overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 100%)', background: '#0e1530', color: '#fff', border: '3px solid #243063', padding: 18, margin: 'auto' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>🎬 Exports image et vidéo</h3>
        <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5, color: '#aab3d1' }}>Plusieurs cartes dans un même export. Tout est créé sur ton appareil, rien n’est envoyé.</p>

        <div style={lab}>Type d’export</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([['video', '🎬 Vidéo'], ['sheet', '🖼️ Planche de contact'], ['carousel', '🎠 Carrousel']] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" disabled={busy} onClick={() => { setMode(k); resetOut() }} style={chip(mode === k)}>{l}</button>)}
        </div>

        <div style={lab}>Format</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(FORMATS) as FormatKey[]).map(k => <button key={k} type="button" disabled={busy} onClick={() => { setFmt(k); resetOut() }} style={chip(fmt === k)} title={FORMATS[k].label}>{k}</button>)}
          <span style={{ fontSize: 12, color: '#aab3d1', alignSelf: 'center' }}>{FORMATS[fmt].label}</span>
        </div>

        <div style={lab}>Modèle</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(Object.keys(TEMPLATES) as TplKey[]).map(k => (
            <button key={k} type="button" disabled={busy} onClick={() => { setTplKey(k); resetOut() }} style={{ ...chip(tplKey === k), display: 'flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 14, height: 14, background: `linear-gradient(135deg, ${TEMPLATES[k].bg[0]}, ${TEMPLATES[k].bg[1]})`, border: `2px solid ${TEMPLATES[k].accent}`, display: 'inline-block' }} />{TEMPLATES[k].label}
            </button>))}
        </div>

        {mode === 'video' && (<>
          <div style={lab}>Transition · durée par carte : {per.toLocaleString('fr-FR')} s</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {([['slide', 'Glisser'], ['fade', 'Fondu'], ['flip', 'Flip'], ['cut', 'Coupe']] as [TrKey, string][]).map(([k, l]) => <button key={k} type="button" disabled={busy} onClick={() => { setTr(k); resetOut() }} style={chip(tr === k)}>{l}</button>)}
            <input type="range" min={1} max={4} step={0.5} value={per} disabled={busy} onChange={e => { setPer(Number(e.target.value)); resetOut() }} style={{ flex: 1, minWidth: 100 }} />
          </div>
        </>)}
        {mode === 'sheet' && (<>
          <div style={lab}>Colonnes</div>
          <div style={{ display: 'flex', gap: 6 }}>{[2, 3, 4].map(n => <button key={n} type="button" disabled={busy} onClick={() => { setCols(n); resetOut() }} style={chip(cols === n)}>{n}</button>)}</div>
        </>)}

        <div style={lab}>Cartes ({sel.length}/{limit}){mode === 'video' ? ` · durée totale ≈ ${Math.round(total)} s` : ''}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {usable.map(p => <button key={p.key} type="button" disabled={busy} onClick={() => { setSel(p.cards.slice(0, Math.min(limit, 8))); resetOut() }} style={{ ...chip(false), fontSize: 11 }}>{p.label}</button>)}
          {sel.length > 0 && <button type="button" disabled={busy} onClick={() => { setSel([]); resetOut() }} style={{ ...chip(false), fontSize: 11 }}>Vider</button>}
        </div>
        <div style={{ display: 'grid', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
          {sel.map((c, i) => (
            <div key={c.f + i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#17214a', padding: 4 }}>
              <img src={c.thumb || c.f} alt="" style={{ width: 28, aspectRatio: '5/7', objectFit: 'cover' }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i + 1}. {c.n}</span>
              <button type="button" disabled={busy || i === 0} onClick={() => { move(i, -1); resetOut() }} style={{ ...chip(false), padding: '2px 8px' }} aria-label="Monter">↑</button>
              <button type="button" disabled={busy || i === sel.length - 1} onClick={() => { move(i, 1); resetOut() }} style={{ ...chip(false), padding: '2px 8px' }} aria-label="Descendre">↓</button>
              <button type="button" disabled={busy} onClick={() => { setSel(s => s.filter((_, j) => j !== i)); resetOut() }} style={{ ...chip(false), padding: '2px 8px' }} aria-label="Retirer">✕</button>
            </div>))}
        </div>
        {sel.length < limit && (
          <div style={{ marginTop: 8 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ajouter une carte (joueur, marque, année…)" disabled={busy}
              style={{ width: '100%', padding: '8px 10px', background: '#17214a', border: '2px solid #243063', color: '#fff', fontSize: 13 }} />
            {hits.map(c => (
              <button key={c.f} type="button" onClick={() => { setSel(s => [...s, c]); setQ(''); resetOut() }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', background: 'none', border: 0, borderBottom: '1px solid #243063', color: '#fff', padding: 4, cursor: 'pointer', textAlign: 'left' }}>
                <img src={c.thumb || c.f} alt="" style={{ width: 24, aspectRatio: '5/7', objectFit: 'cover' }} /><span style={{ fontSize: 12 }}>＋ {c.n} <span style={{ color: '#aab3d1' }}>{[c.y, c.s].filter(Boolean).join(' · ')}</span></span>
              </button>))}
          </div>)}

        {phase === 'loading' && <p style={{ fontSize: 13, color: '#aab3d1' }}>Lecture des photos… {Math.round(progress * 100)} %</p>}
        {phase === 'recording' && (<>
          <div style={{ height: 10, background: '#17214a', marginTop: 10 }}><i style={{ display: 'block', height: '100%', width: `${progress * 100}%`, background: tpl.accent }} /></div>
          <p style={{ fontSize: 12, color: '#aab3d1' }}>Enregistrement… garde cette page ouverte et visible ({Math.ceil(total * (1 - progress))} s).</p>
        </>)}
        {phase === 'error' && <p style={{ color: '#ffd84d', fontSize: 13 }}>{err}</p>}
        {phase === 'done' && mode === 'video' && videoUrl && <video src={videoUrl} controls playsInline loop autoPlay muted style={{ width: '100%', maxHeight: '55vh', background: '#000', display: 'block', marginTop: 12 }} />}
        {phase === 'done' && mode !== 'video' && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginTop: 12 }}>
            {imgs.map(i => <img key={i.url} src={i.url} alt="" style={{ height: 160, flex: 'none', border: '2px solid #243063' }} />)}
          </div>)}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {!busy && <button type="button" className="btn-main btn-primary" disabled={!sel.length} onClick={run}>{phase === 'done' ? 'Refaire' : mode === 'video' ? 'Créer la vidéo' : mode === 'sheet' ? 'Créer la planche' : 'Créer le carrousel'}</button>}
          {phase === 'done' && <button type="button" className="btn-main btn-primary" onClick={saveAll}>Partager</button>}
          {phase === 'done' && <button type="button" className="da-confirm-btn" onClick={downloadAll}>Télécharger{mode === 'carousel' ? ` (${imgs.length} images)` : ''}</button>}
          {busy ? <button type="button" className="da-confirm-btn" onClick={() => { stopRef.current = true; setPhase('idle') }}>Annuler</button> : <button type="button" className="da-confirm-btn" onClick={onClose}>Fermer</button>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
