'use client'
// Outil admin (/admin/pub) : générateur de vidéos verticales façon TikTok (cuts sur le beat, zoom « punch », flash, sous-titres mot par mot).
// Tu ajoutes tes photos de cartes + une légende par photo, tu choisis le rythme et la musique, et la vidéo (MP4 1080×1920, 60 i/s) est créée sur ton appareil : rien n'est envoyé.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { encodeMp4 } from './encode'
import { saveOrShareFile } from '@/lib/saveOrShare'
import { scheduleMusic, scheduleHits, decodeAudioFile, type MusicKind } from './audio'
import { AD_DUR, AD_TX, LANG_NAMES, drawAd, loadAdAssets, type AdAssets, type Lang } from './tiktokAd'

const W = 1080, H = 1920, FPS = 60
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const DISPLAY = `Surfquest, Impact, 'Arial Narrow', ${FONT}`
const ACCENT = '#ffd84d'
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const eb = (t: number) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) } // rebond
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const OWNER = 'eb730dee-414e-4fcb-89d8-4a7b3448c218' // galerie GKNNN_Cards
type Row = { nom: string | null; equipe: string | null; annee: string | null; image_recto: string | null; rc: boolean | null; auto: boolean | null; patch: boolean | null; num: string | null; item_type: string | null; vendue: boolean | null; booklet: boolean | null; grade?: string | null }
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
// légende automatique : nom + étiquettes (RC, AUTO, PATCH, numérotation) ; jamais de prix
function capOf(r: Row): string {
  const tags: string[] = []
  if (r.rc) tags.push('RC'); if (r.auto) tags.push('AUTO'); if (r.patch) tags.push('PATCH')
  const n = (r.num || '').trim(); if (n) tags.push(n.includes('/') ? '/' + n.split('/').pop() : /^[0-9]+$/.test(n) ? '/' + n : n)
  return [(r.nom || '').trim(), ...tags].join(' ').slice(0, 40)
}
const CTAS = ['Ajoute les tiennes gratuitement', 'Crée ta galerie gratuitement', 'Rejoins les collectionneurs', 'Ta collection mérite le même écrin']

type Item = { id: number; src: File | string; label: string; cap: string }
type Prep = { bmp: ImageBitmap; small: HTMLCanvasElement }
type Cfg = { hook: string; cta: string; seg: number; items: Item[] }

const P = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const EXAMPLE: { f: string; cap: string }[] = [
  { f: '1791570341106_recto.jpg', cap: 'Maxey RC' }, { f: '1792107402402_recto.jpg', cap: 'Springer auto' }, { f: '1793202403128_recto.jpg', cap: 'Embiid Noir /20' },
  { f: '1792105652824_recto.jpg', cap: 'Fultz Rated Rookie' }, { f: '1792105709218_recto.jpg', cap: 'McCain rouge' }, { f: '1792107456778_recto.jpg', cap: 'Edgecombe SSP' },
]

async function prepare(src: File | string, strict = false): Promise<Prep | null> {
  try {
    const blob = typeof src === 'string' ? await (await fetch(src, { mode: 'cors' })).blob() : src
    const raw = await createImageBitmap(blob)
    // mode strict (pub) : photo assez nette et carte au format portrait standard, sinon on l'écarte
    if (strict && (raw.height < 700 || raw.width / raw.height < 0.6 || raw.width / raw.height > 0.8)) { raw.close?.(); return null }
    const bmp = raw.height > 1500 ? await createImageBitmap(raw, { resizeHeight: 1500, resizeQuality: 'high' }) : raw
    const small = document.createElement('canvas'); small.width = 36; small.height = 64
    const x = small.getContext('2d')!, k = Math.max(36 / bmp.width, 64 / bmp.height)
    x.drawImage(bmp, (36 - bmp.width * k) / 2, (64 - bmp.height * k) / 2, bmp.width * k, bmp.height * k)
    return { bmp, small }
  } catch { return null }
}

function wrap(ctx: CanvasRenderingContext2D, words: string[], maxW: number): string[][] {
  const lines: string[][] = []; let cur: string[] = []
  for (const w of words) {
    const test = [...cur, w].join(' ')
    if (cur.length && ctx.measureText(test).width > maxW) { lines.push(cur); cur = [w] } else cur.push(w)
  }
  if (cur.length) lines.push(cur)
  return lines
}

// texte avec contour épais, mot par mot (le mot du moment est en jaune)
function caption(ctx: CanvasRenderingContext2D, text: string, k: number, y: number, size: number) {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean); if (!words.length) return
  ctx.save(); ctx.font = `400 ${size}px ${DISPLAY}`; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  const lines = wrap(ctx, words, 900), lh = size * 1.12, y0 = y - ((lines.length - 1) * lh) / 2
  const shown = Math.floor(k / 0.11) + 1
  let n = 0
  lines.forEach((line, li) => {
    const sp = ctx.measureText(' ').width, ws = line.map(w => ctx.measureText(w).width)
    let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1)) / 2
    line.forEach((w, wi) => {
      n++
      if (n <= shown) {
        const pop = eb(seg(k, (n - 1) * 0.11, (n - 1) * 0.11 + 0.18)), cx = x + ws[wi] / 2, cy = y0 + li * lh
        ctx.save(); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.globalAlpha = clamp(pop * 2)
        ctx.strokeStyle = '#000'; ctx.lineWidth = size * 0.17; ctx.strokeText(w, -ws[wi] / 2, 0)
        ctx.fillStyle = n === shown && shown < words.length + 3 && k < words.length * 0.11 + 0.5 ? ACCENT : '#fff'; ctx.textAlign = 'left'; ctx.fillText(w, -ws[wi] / 2, 0)
        ctx.restore()
      }
      x += ws[wi] + sp
    })
  })
  ctx.restore()
}

function drawBg(ctx: CanvasRenderingContext2D, p: Prep | undefined, t: number) {
  ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, W, H)
  if (p) { const s = 1.15 + 0.03 * Math.sin(t * 0.6); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(p.small, -W / 2, -H / 2, W, H); ctx.restore() }
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(0.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,.65)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}

export function timeline(cfg: Cfg) {
  const intro = 1.0, outro = 2.0, n = Math.max(1, cfg.items.length)
  return { intro, outro, n, total: intro + n * cfg.seg + outro }
}

function drawTT(ctx: CanvasRenderingContext2D, t: number, cfg: Cfg, prep: (Prep | undefined)[], logo: HTMLCanvasElement | null) {
  const { intro, n, total } = timeline(cfg), outroAt = intro + n * cfg.seg
  const first = prep.find(Boolean)
  if (t < intro) {
    drawBg(ctx, prep[0] ?? first, t)
    const k = t / intro, pop = eb(seg(k, 0, 0.4))
    ctx.save(); ctx.translate(W / 2, 880); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop); ctx.globalAlpha = clamp(k * 5) * (1 - seg(k, 0.88, 1))
    ctx.font = `400 150px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
    const lines = wrap(ctx, cfg.hook.toUpperCase().split(/\s+/).filter(Boolean), 900)
    lines.forEach((l, i) => { const s = l.join(' '), yy = (i - (lines.length - 1) / 2) * 165; ctx.strokeStyle = '#000'; ctx.lineWidth = 28; ctx.strokeText(s, 0, yy); ctx.fillStyle = i === lines.length - 1 && lines.length > 1 ? ACCENT : '#fff'; ctx.fillText(s, 0, yy) })
    ctx.restore()
  } else if (t < outroAt) {
    const i = Math.min(n - 1, Math.floor((t - intro) / cfg.seg)), k = t - intro - i * cfg.seg, p = prep[i]
    drawBg(ctx, p, t)
    if (p) {
      const pu = eo(seg(k, 0, 0.22)), sc = lerp(1.24, 1, pu) * (1 + 0.04 * (k / cfg.seg)), rot = (i % 2 ? 1 : -1) * lerp(0.04, 0, pu) + Math.sin(t * 0.9) * 0.004
      const sh = k < 0.2 ? 1 - k / 0.2 : 0, dx = Math.sin(k * 170) * 16 * sh, dy = Math.cos(k * 140) * 11 * sh
      const f = Math.min(880 / p.bmp.width, 1080 / p.bmp.height), cw = p.bmp.width * f, ch = p.bmp.height * f
      ctx.save(); ctx.translate(W / 2 + dx, 730 + dy); ctx.rotate(rot); ctx.scale(sc, sc)
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(-cw / 2 + 16, -ch / 2 + 26, cw, ch) // ombre franche, coins nets : jamais d'arrondi sur la carte
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(p.bmp, -cw / 2, -ch / 2, cw, ch)
      ctx.restore()
    }
    const fl = (1 - seg(k, 0, 0.14)) * 0.5; if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${fl})`; ctx.fillRect(0, 0, W, H) }
    // pastille de numéro (zone sûre : sous le haut de l'écran TikTok)
    const pp = eb(seg(k, 0.05, 0.3)); ctx.save(); ctx.translate(120, 250); ctx.scale(pp, pp); ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.roundRect(-70, -45, 140, 90, 45); ctx.fill()
    ctx.fillStyle = '#000'; ctx.font = `400 62px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`#${i + 1}`, 0, 4); ctx.restore()
    caption(ctx, cfg.items[i]?.cap || '', k, 1395, 124)
  } else {
    drawBg(ctx, prep[prep.length - 1] ?? first, t)
    const k = t - outroAt, p1 = eb(seg(k, 0, 0.5)), p2 = eo(seg(k, 0.35, 0.8))
    if (logo) { const lw = 760, lh = (logo.height / logo.width) * lw; ctx.save(); ctx.translate(W / 2, 760); ctx.scale(0.6 + 0.4 * p1, 0.6 + 0.4 * p1); ctx.globalAlpha = clamp(p1 * 2); ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh); ctx.restore() }
    ctx.save(); ctx.globalAlpha = p2; ctx.font = `400 104px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
    const lines = wrap(ctx, cfg.cta.toUpperCase().split(/\s+/).filter(Boolean), 900)
    lines.forEach((l, i) => { const s = l.join(' '), yy = 1000 + i * 118 + (1 - p2) * 30; ctx.strokeStyle = '#000'; ctx.lineWidth = 20; ctx.strokeText(s, W / 2, yy); ctx.fillStyle = '#fff'; ctx.fillText(s, W / 2, yy) })
    ctx.font = `700 54px ${FONT}`; ctx.fillStyle = ACCENT; ctx.fillText('memorabilius.fr', W / 2, 1000 + lines.length * 118 + 50)
    ctx.restore()
  }
  // barre de progression en haut
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(60, 70, W - 120, 8); ctx.fillStyle = '#fff'; ctx.fillRect(60, 70, (W - 120) * clamp(t / total), 8)
}

export default function TikTokMaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const prepRef = useRef<(Prep | undefined)[]>([])
  const logoRef = useRef<HTMLCanvasElement | null>(null)
  const idRef = useRef(1)
  const [items, setItems] = useState<Item[]>([])
  const [hook, setHook] = useState('Ma collection de cartes')
  const [cta, setCta] = useState('Rejoins les collectionneurs')
  const [rhythm, setRhythm] = useState<'fast' | 'normal' | 'slow'>('normal')
  const [music, setMusic] = useState<MusicKind>('beat')
  const [fileName, setFileName] = useState('')
  const [adMode, setAdMode] = useState(true)
  const [lang, setLang] = useState<Lang>('fr')
  const [status, setStatus] = useState('Ajoute des photos de cartes pour commencer.')
  const [busy, setBusy] = useState(false)
  const [video, setVideo] = useState<string | null>(null)
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const saveVideo = async (blob: Blob | null, name: string) => {
    if (!blob) return
    setSaveMsg('Enregistrement en cours… (une vidéo de plusieurs Mo peut prendre un moment sur téléphone)')
    try { await saveOrShareFile(blob, name, { timeoutMs: 180000 }); setSaveMsg('') }
    catch (e) { setSaveMsg('Échec de l’enregistrement : ' + (e instanceof Error ? e.message : 'erreur') + '. Réessaie, ou télécharge depuis un ordinateur.') }
  }

  const [pos, setPos] = useState(0)
  const rowsRef = useRef<Row[] | null>(null)
  const musicRef = useRef<MusicKind>('beat')
  const fileBufRef = useRef<AudioBuffer | null>(null)
  const adRef = useRef<AdAssets | null>(null)
  const adModeRef = useRef(true)
  const busyRef = useRef(false)

  const cfg: Cfg = { hook, cta, seg: rhythm === 'fast' ? 1 : rhythm === 'normal' ? 1.5 : 2, items }
  const cfgRef = useRef(cfg); cfgRef.current = cfg
  musicRef.current = music
  adModeRef.current = adMode
  busyRef.current = busy
  const total = adMode ? AD_DUR : timeline(cfg).total

  useEffect(() => {
    let dead = false
    ;(async () => {
      try { await document.fonts.load('400 40px Surfquest') } catch { /* repli */ }
      try {
        const r = await fetch('/memorabilius-logo-white-sm.png'); const b = await createImageBitmap(await r.blob())
        const c = document.createElement('canvas'); c.width = b.width; c.height = b.height; const x = c.getContext('2d')!; x.drawImage(b, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); logoRef.current = c
      } catch { /* sans logo */ }
      if (!dead) draw(0)
    })()
    return () => { dead = true; cancelAnimationFrame(raf.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // décode les photos dès qu'elles changent
  useEffect(() => {
    let dead = false
    ;(async () => {
      const arr = await Promise.all(items.map(it => prepare(it.src)))
      if (dead) return
      prepRef.current = arr.map(a => a ?? undefined)
      const bad = arr.filter(a => !a).length
      if (busyRef.current) return
      setStatus(items.length ? `${items.length} photo(s) prête(s)${bad ? ` · ${bad} illisible(s)` : ''} · durée ${timeline(cfgRef.current).total.toFixed(1)} s` : 'Ajoute des photos de cartes pour commencer.')
      draw(Math.min(pos, 0.0) || 1.2)
    })()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const draw = (t: number) => { const c = canvasRef.current; if (!c) return; const x = c.getContext('2d')!; if (adModeRef.current && adRef.current) drawAd(x, t, adRef.current); else drawTT(x, t, cfgRef.current, prepRef.current, logoRef.current) }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const add: Item[] = Array.from(files).filter(f => f.type.startsWith('image/')).map(f => ({ id: idRef.current++, src: f, label: f.name, cap: '' }))
    setItems(v => [...v, ...add].slice(0, 12))
  }
  const loadExample = () => setItems(EXAMPLE.map(e => ({ id: idRef.current++, src: P + e.f, label: e.cap, cap: e.cap })))

  const preview = async () => {
    if (!(adModeRef.current ? adRef.current : items.length)) return
    cancelAnimationFrame(raf.current); setBusy(true)
    const t0 = performance.now()
    await new Promise<void>(res => {
      const tick = () => { const t = (performance.now() - t0) / 1000; draw(Math.min(t, total)); setPos(t / total); if (t >= total) return res(); raf.current = requestAnimationFrame(tick) }
      tick()
    })
    setBusy(false)
  }

  const create = async () => {
    const c = canvasRef.current; if (!c || !(adModeRef.current ? adRef.current : cfgRef.current.items.length)) return
    cancelAnimationFrame(raf.current); busyRef.current = true; setBusy(true); setVideo(null)
    const ad = adModeRef.current, dur = ad ? AD_DUR : timeline(cfgRef.current).total, ctx = c.getContext('2d')!
    const res = await encodeMp4({
      canvas: c, fps: FPS, dur, draw: t => { if (ad && adRef.current) drawAd(ctx, t, adRef.current); else drawTT(ctx, t, cfgRef.current, prepRef.current, logoRef.current) },
      audio: ac => { scheduleMusic(ac, ac.destination, 0, dur, musicRef.current, fileBufRef.current); if (ad) scheduleHits(ac, ac.destination, 0, (adRef.current?.scenes ?? []).map(s => s.a).slice(1)) },
      onProgress: (m, r) => { setStatus(m); setPos(r) },
    })
    if (!res) setStatus('Ce navigateur ne sait pas créer le MP4 (utilise Chrome ou Edge récent).')
    else if ('error' in res) setStatus('Échec de l’encodage : ' + res.error)
    else { setVideoBlob(res.blob); setVideo(URL.createObjectURL(res.blob)); setStatus(`Vidéo prête · ${dur.toFixed(1)} s · MP4 60 images/s`) }
    setBusy(false)
  }

  // Tout automatique : je choisis le thème, les cartes de ta galerie, l'accroche, les légendes et la musique, puis je crée la vidéo
  const autoShowcase = async () => {
    adModeRef.current = false; setAdMode(false)
    cancelAnimationFrame(raf.current); busyRef.current = true; setBusy(true); setVideo(null)
    try {
      setStatus('Je choisis les cartes dans ta galerie…')
      if (!rowsRef.current) {
        const { data, error } = await supabase.from('cartes_manuelles').select('nom,equipe,annee,image_recto,rc,auto,patch,num,item_type,vendue,booklet,grade').eq('user_id', OWNER).limit(1500)
        if (error || !data) throw new Error(error?.message || 'galerie illisible')
        rowsRef.current = (data as Row[]).filter(r => r.nom && r.image_recto && r.image_recto.includes('supabase.co') && !r.image_recto.includes('placehold') && (r.item_type || 'card') === 'card' && !r.vendue && !r.booklet)
      }
      const rows = rowsRef.current
      const teamCount = new Map<string, number>(); rows.forEach(r => { if (r.equipe) teamCount.set(r.equipe, (teamCount.get(r.equipe) || 0) + 1) })
      const topTeam = [...teamCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      const themes: { hooks: string[]; ok: (r: Row) => boolean }[] = [
        { hooks: ['Les pépites de ma collection', 'Mes plus belles cartes', 'Ma collection de rêve'], ok: (r: Row) => !!(r.num || r.auto || r.patch) },
        { hooks: ['Mes rookies préférés', 'Les RC de ma collection'], ok: (r: Row) => !!r.rc },
        { hooks: ['Mes cartes signées', 'Mes autographes'], ok: (r: Row) => !!r.auto },
        ...(topTeam ? [{ hooks: [`Mes cartes ${topTeam.split(' ').pop()}`, `Ma collection ${topTeam.split(' ').pop()}`], ok: (r: Row) => r.equipe === topTeam }] : []),
      ].filter(t => rows.filter(t.ok).length >= 6)
      const theme = themes.length ? pick(themes) : { hooks: ['Ma collection de cartes'], ok: () => true }
      const chosen = shuffle(rows.filter(theme.ok)).slice(0, 8)
      if (chosen.length < 3) throw new Error('pas assez de cartes avec photo')
      const its: Item[] = chosen.map(r => ({ id: idRef.current++, src: r.image_recto as string, label: r.nom || '', cap: capOf(r) }))
      setStatus('Je prépare les photos…')
      const arr = await Promise.all(its.map(it => prepare(it.src)))
      const okItems = its.filter((_, i) => arr[i]); const okPrep = arr.filter((a): a is Prep => !!a)
      if (okItems.length < 3) throw new Error('photos illisibles')
      const hookT = pick(theme.hooks), ctaT = pick(CTAS)
      cfgRef.current = { hook: hookT, cta: ctaT, seg: 1, items: okItems }; prepRef.current = okPrep
      musicRef.current = 'beat'
      setHook(hookT); setCta(ctaT); setRhythm('fast'); setMusic('beat'); setItems(okItems)
      await create()
    } catch (e) {
      setStatus('Je n’ai pas pu générer la vidéo : ' + (e instanceof Error ? e.message : 'erreur'))
      busyRef.current = false; setBusy(false)
    }
  }

  // PUB : je choisis les cartes, l'accroche et l'appel à l'action ; les écrans de l'appli sont les vraies captures
  const autoAd = async () => {
    cancelAnimationFrame(raf.current); busyRef.current = true; setBusy(true); setVideo(null)
    try {
      setStatus('Je choisis des cartes dans ta galerie…')
      if (!rowsRef.current) {
        const { data, error } = await supabase.from('cartes_manuelles').select('nom,equipe,annee,image_recto,rc,auto,patch,num,item_type,vendue,booklet,grade').eq('user_id', OWNER).limit(1500)
        if (error || !data) throw new Error(error?.message || 'galerie illisible')
        rowsRef.current = (data as Row[]).filter(r => r.nom && r.image_recto && r.image_recto.includes('supabase.co') && !r.image_recto.includes('placehold') && (r.item_type || 'card') === 'card' && !r.vendue && !r.booklet)
      }
      const rows = rowsRef.current
      // les plus belles : cartes du Grail Wall, autos, patchs, petites numérotations (/1, /10, /25…), cartes gradées, rookies
      let grail = new Set<string>()
      try { const { data: g } = await supabase.from('grail_cards').select('card_key').eq('user_id', OWNER); grail = new Set((g || []).map((x: { card_key: string }) => x.card_key)) } catch { /* sans Grail Wall */ }
      const numN = (r: Row) => { const m = (r.num || '').match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0 }
      const score = (r: Row) => {
        let sc = 0; if (grail.has(r.image_recto as string)) sc += 10
        if (r.auto) sc += 4; if (r.patch) sc += 4; if (r.rc) sc += 1.5
        const n = numN(r); if (n) sc += n <= 1 ? 9 : n <= 10 ? 7 : n <= 25 ? 6 : n <= 49 ? 5 : n <= 99 ? 4 : n <= 199 ? 3 : n <= 299 ? 2 : 1
        if (r.grade && r.grade !== 'Raw') sc += 2
        return sc + Math.random() * 1.5
      }
      const ranked = [...rows].map(r => ({ r, sc: score(r) })).sort((a, b) => b.sc - a.sc).slice(0, 28)
      setStatus('Je prépare les plus belles cartes…')
      const prepped = await Promise.all(ranked.map(x => prepare(x.r.image_recto as string, true)))
      const good = prepped.filter((a): a is Prep => !!a).slice(0, 8)
      if (good.length < 4) throw new Error('pas assez de belles photos lisibles')
      // la meilleure carte passe en 3D (4e position), les autres alimentent le montage
      const arr = good.length >= 4 ? [good[1], good[2], good[3], good[0], ...good.slice(4)] : good
      adRef.current = await loadAdAssets(arr, pick(AD_TX[lang].hooks), pick(AD_TX[lang].ctas), lang)
      adModeRef.current = true; setAdMode(true)
      if (musicRef.current === 'none') { /* son coupé par choix */ }
      await create()
      if (adRef.current?.fallback) setStatus('Pub ' + LANG_NAMES[lang] + ' prête · textes traduits, écrans en français (captures ' + LANG_NAMES[lang] + ' absentes)')
    } catch (e) {
      setStatus('Je n’ai pas pu générer la pub : ' + (e instanceof Error ? e.message : 'erreur'))
      busyRef.current = false; setBusy(false)
    }
  }

  const box = { background: '#10183a', border: '2px solid #243063', color: '#fff', padding: 8, fontFamily: FONT, fontSize: 14 } as const
  return (
    <section style={{ marginTop: 40, paddingTop: 28, borderTop: '2px solid #243063', display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ width: 360 }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: 360, height: 640, background: '#000', display: 'block', border: '3px solid #243063' }} />
        <input type="range" min={0} max={total} step={0.05} value={pos * total} disabled={busy || !items.length} onChange={e => { const t = Number(e.target.value); setPos(t / total); draw(t) }} style={{ width: '100%', marginTop: 8 }} aria-label="Se déplacer dans la vidéo" />
        <div style={{ fontSize: 11, color: '#aab3d1' }}>{(pos * total).toFixed(1)} s / {total.toFixed(1)} s</div>
      </div>
      <div style={{ width: 'min(480px, 100%)' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 24 }}>Pub TikTok · générateur</h2>
        <p style={{ color: '#aab3d1', fontSize: 14, lineHeight: 1.5, margin: '0 0 10px' }}>Une vraie pub Memorabilius au format TikTok : accroche, écrans de l’appli, carte en 3D, cuts sur le beat, sous-titres mot par mot, appel à l’action. 9:16, 60 i/s, créée sur ton appareil.</p>
        <button type="button" disabled={busy} onClick={autoAd} style={{ width: '100%', padding: '16px 18px', fontWeight: 900, fontSize: 18, background: '#ff3b6b', color: '#fff', border: 0, cursor: busy ? 'default' : 'pointer', margin: '4px 0 10px' }}>🎬 Générer la pub TikTok pour moi</button>
        <label style={{ fontSize: 13, display: 'block', margin: '0 0 8px' }}>Langue de la pub <select value={lang} onChange={e => setLang(e.target.value as Lang)} disabled={busy} style={box}>{(Object.keys(LANG_NAMES) as Lang[]).map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '0 0 10px' }}>
          <label style={{ fontSize: 13 }}>Musique <select value={music} onChange={e => setMusic(e.target.value as MusicKind)} style={box}><option value="beat">Beat dynamique</option><option value="lounge">Ambiance douce</option><option value="file">Mon propre morceau…</option><option value="none">Aucune</option></select></label>
          {music === 'file' && <label style={{ ...box, cursor: 'pointer', fontSize: 13 }}>{fileName || 'Choisir un fichier audio'}<input type="file" accept="audio/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { fileBufRef.current = await decodeAudioFile(f); setFileName(f.name.slice(0, 28)) } catch { fileBufRef.current = null; setFileName('Fichier illisible') } e.target.value = '' }} /></label>}
        </div>
        <p style={{ fontSize: 13, color: ACCENT, minHeight: 18 }}>{status}</p>
        <p style={{ fontSize: 12, color: '#aab3d1', margin: '0 0 10px' }}>Un clic : je choisis les cartes, l’accroche et l’appel à l’action, je monte la pub et je la crée. Reclique pour en obtenir une autre. Pour une musique plus pro, choisis « Mon propre morceau » (libre de droits).</p>
        <details style={{ margin: '8px 0' }}><summary style={{ cursor: 'pointer', fontSize: 14, color: '#aab3d1' }}>Autre format : montage de mes cartes (facultatif)</summary>
        <button type="button" disabled={busy} onClick={autoShowcase} style={{ ...box, cursor: 'pointer', fontWeight: 800, margin: '8px 0', width: '100%' }}>✨ Générer un montage de mes plus belles cartes</button>
        <label style={{ display: 'block', fontSize: 13, margin: '8px 0 4px' }}>Accroche (premier écran)</label>
        <input value={hook} onChange={e => setHook(e.target.value)} maxLength={40} style={{ ...box, width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
          <label style={{ ...box, cursor: 'pointer', fontWeight: 800 }}>+ Ajouter des photos<input type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }} /></label>
          <button type="button" onClick={loadExample} style={{ ...box, cursor: 'pointer', fontWeight: 800 }}>Essayer avec des cartes de GKNNN_Cards</button>
          {items.length > 0 && <button type="button" onClick={() => setItems([])} style={{ ...box, cursor: 'pointer' }}>Tout retirer</button>}
        </div>
        <div style={{ display: 'grid', gap: 6, maxHeight: 300, overflow: 'auto' }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 26, textAlign: 'right', color: '#aab3d1', fontSize: 13 }}>#{i + 1}</span>
              <input value={it.cap} placeholder={`Légende (${it.label.slice(0, 18)})`} maxLength={40} onChange={e => setItems(v => v.map(x => x.id === it.id ? { ...x, cap: e.target.value } : x))} style={{ ...box, flex: 1 }} />
              <button type="button" aria-label="Retirer" onClick={() => setItems(v => v.filter(x => x.id !== it.id))} style={{ ...box, cursor: 'pointer', padding: '8px 10px' }}>✕</button>
            </div>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: 13, margin: '12px 0 4px' }}>Dernier écran (appel à l’action)</label>
        <input value={cta} onChange={e => setCta(e.target.value)} maxLength={50} style={{ ...box, width: '100%' }} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '12px 0' }}>
          <label style={{ fontSize: 13 }}>Rythme <select value={rhythm} onChange={e => setRhythm(e.target.value as typeof rhythm)} style={box}><option value="fast">Rapide (1 s par carte)</option><option value="normal">Normal (1,5 s)</option><option value="slow">Posé (2 s)</option></select></label>
          <label style={{ fontSize: 13 }}>Musique <select value={music} onChange={e => setMusic(e.target.value as typeof music)} style={box}><option value="beat">Beat dynamique</option><option value="lounge">Ambiance douce</option><option value="none">Aucune</option></select></label>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy || !items.length} onClick={preview} style={{ padding: '10px 16px', fontWeight: 800, background: '#17214a', color: '#fff', border: '2px solid #243063', cursor: 'pointer' }}>▶ Aperçu</button>
          <button type="button" disabled={busy || !items.length} onClick={create} style={{ padding: '10px 16px', fontWeight: 800, background: '#7a2bff', color: '#fff', border: 0, cursor: 'pointer' }}>⏺ Créer la vidéo (60 fps)</button>
        </div>
        </details>
        {video && (
          <div style={{ marginTop: 14 }}>
            <video src={video} controls playsInline style={{ width: '100%', maxHeight: 520, background: '#000' }} />
            <button type="button" onClick={() => saveVideo(videoBlob, 'memorabilius-tiktok.mp4')} style={{ ...{ display: 'inline-block', marginTop: 10, padding: '10px 16px', background: '#1e9e57', color: '#fff', fontWeight: 800, textDecoration: 'none' }, border: 0, cursor: 'pointer' }}>⬇ Télécharger la vidéo</button>
            {saveMsg && <p style={{ fontSize: 13, color: '#ffd84d', margin: '8px 0 0' }}>{saveMsg}</p>}
            <p style={{ fontSize: 12, color: '#aab3d1', margin: '8px 0 0' }}>Si rien ne se télécharge : clic droit sur la vidéo → « Enregistrer la vidéo sous… ».</p>
          </div>)}
      </div>
    </section>
  )
}
