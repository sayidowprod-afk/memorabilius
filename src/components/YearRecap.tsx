'use client'
// « Mon année en cartes » : une vidéo verticale (1080×1920, ~16 s) et une image à partager, calculées sur l'appareil à partir de la galerie.
// Même moteur que l'export vidéo des cartes : canvas + MediaRecorder, police Surfquest, rien n'est envoyé. Les cartes gardent toujours leurs bords nets.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { saveOrShareFile } from '@/lib/saveOrShare'

type RC = { f: string; n: string; y?: string; s?: string; t?: string; created_at?: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; thumb?: string }
const W = 1080, H = 1920, FPS = 30
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const GOLD = '#ffd84d', BLUE = '#2f6bff', SOFT = '#b8c4ff'

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const easeBack = (t: number) => { const c = 1.70158, x = clamp(t) - 1; return 1 + (c + 1) * x * x * x + c * x * x }
const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

async function bmp(url: string): Promise<ImageBitmap | null> {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? await createImageBitmap(await r.blob()) : null } catch { return null }
}
function pickMime(): { mime: string; ext: string } {
  const cands: [string, string][] = [['video/mp4;codecs=avc1.42E01E', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']]
  for (const [m, e] of cands) { try { if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext: e } } catch { /* pas de MediaRecorder */ } }
  return { mime: '', ext: 'webm' }
}
async function loadLogo(): Promise<HTMLCanvasElement | null> {
  try {
    const b = await bmp('/memorabilius-logo-white-sm.png'); if (!b) return null
    const c = document.createElement('canvas'); c.width = b.width; c.height = b.height
    c.getContext('2d')!.drawImage(b, 0, 0); b.close?.()
    return c
  } catch { return null }
}

// texte : les gros titres (graisse ≥ 800) en Surfquest majuscules, comme les autres exports du site
function T(x: CanvasRenderingContext2D, s: string, px: number, py: number, size: number, color = '#fff', weight = 800, align: CanvasTextAlign = 'center', maxW = W - 120) {
  if (weight >= 800) { x.font = `400 ${Math.round(size * 1.12)}px Surfquest, Impact, 'Arial Narrow', ${FONT}`; s = s.toUpperCase() }
  else x.font = `${weight} ${size}px ${FONT}`
  x.fillStyle = color; x.textAlign = align; x.textBaseline = 'alphabetic'
  let o = s; while (x.measureText(o).width > maxW && o.length > 4) o = o.slice(0, -2)
  x.fillText(o === s ? s : o.trimEnd() + '…', px, py)
}
function background(x: CanvasRenderingContext2D, t: number) {
  const g = x.createLinearGradient(0, 0, W * 0.4, H); g.addColorStop(0, '#08102b'); g.addColorStop(1, '#1b2f78')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  // lueurs qui dérivent lentement
  for (let i = 0; i < 3; i++) {
    const cx = W * (0.2 + 0.6 * ((Math.sin(t * 0.25 + i * 2.1) + 1) / 2)), cy = H * (0.2 + 0.25 * i + 0.05 * Math.sin(t * 0.4 + i))
    const r = x.createRadialGradient(cx, cy, 0, cx, cy, 620)
    r.addColorStop(0, i === 1 ? 'rgba(255,216,77,.13)' : 'rgba(80,130,255,.18)'); r.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = r; x.fillRect(0, 0, W, H)
  }
  // poussières dorées
  for (let i = 0; i < 28; i++) {
    const px = rnd(i) * W, py = ((rnd(i + 50) * H - t * (20 + rnd(i + 9) * 40)) % H + H) % H
    x.fillStyle = `rgba(255,216,77,${0.10 + 0.25 * rnd(i + 3)})`; x.fillRect(px, py, 3 + rnd(i + 7) * 4, 3 + rnd(i + 7) * 4)
  }
}
function logoAt(x: CanvasRenderingContext2D, logo: HTMLCanvasElement | null, cx: number, y: number, w: number) {
  if (!logo) { T(x, 'MEMORABILIUS', cx, y + w * 0.12, w * 0.12, '#fff', 900, 'center', w * 2); return }
  x.drawImage(logo, cx - w / 2, y, w, (logo.height / logo.width) * w)
}
// carte : ombre douce, bords nets (jamais arrondis)
function card(x: CanvasRenderingContext2D, b: ImageBitmap, cx: number, cy: number, maxW: number, maxH: number, scaleX = 1, zoom = 1) {
  const k = Math.min(maxW / b.width, maxH / b.height) * zoom, w = b.width * k, h = b.height * k
  x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 70; x.shadowOffsetY = 26
  x.drawImage(b, cx - (w * scaleX) / 2, cy - h / 2, w * scaleX, h); x.restore()
  return { w, h }
}
function ribbon(x: CanvasRenderingContext2D, label: string, cx: number, cy: number, alpha = 1) {
  x.save(); x.globalAlpha *= alpha; x.font = `800 30px ${FONT}`
  const w = x.measureText(label.toUpperCase()).width + 60
  x.fillStyle = GOLD; x.beginPath(); x.roundRect(cx - w / 2, cy - 31, w, 62, 31); x.fill()
  x.fillStyle = '#0b1230'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label.toUpperCase(), cx, cy + 2); x.restore()
}

export default function YearRecap({ cards, grails, ownerName, onClose }: { cards: RC[]; grails: string[]; ownerName: string; onClose: () => void }) {
  const years = useMemo(() => [...new Set(cards.map(c => (c.created_at || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse(), [cards])
  const [year, setYear] = useState(years[0] || String(new Date().getFullYear()))
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [ext, setExt] = useState('webm')
  const [busy, setBusy] = useState<'' | 'image' | 'video'>('')
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const alive = useRef(true)
  const urls = useRef<string[]>([])
  useEffect(() => { alive.current = true; return () => { alive.current = false; urls.current.forEach(u => URL.revokeObjectURL(u)) } }, [])
  const keep = (b: Blob) => { const u = URL.createObjectURL(b); urls.current.push(u); return u }

  const stats = useMemo(() => {
    const ofYear = cards.filter(c => (c.created_at || '').startsWith(year))
    const perMonth = new Array(12).fill(0)
    for (const c of ofYear) { const m = parseInt((c.created_at || '').slice(5, 7), 10) - 1; if (m >= 0 && m < 12) perMonth[m]++ }
    const bestM = perMonth.indexOf(Math.max(...perMonth))
    const count = (k: 'rc' | 'auto' | 'patch') => ofYear.filter(c => c[k]).length
    const brands = new Map<string, number>()
    for (const c of ofYear) if (c.s) brands.set(c.s, (brands.get(c.s) || 0) + 1)
    const topBrand = [...brands.entries()].sort((a, b) => b[1] - a[1])[0]
    const ok = (c: RC) => /^https?:/.test(c.f)
    // d'abord les cartes de ton Grail Wall ajoutées cette année (dans l'ordre du mur), puis les plus rares (1/1, /5, /10…), puis autos et patchs, puis les plus récentes : jamais de prix
    const grail = grails.map(k => ofYear.find(c => c.f === k)).filter((c): c is RC => !!c && ok(c))
    const tirage = (c: RC) => { const m = (c.num || '').trim().match(/\/(\d+)$/); return m ? parseInt(m[1]) : Infinity }
    const rare = [...ofYear].filter(ok).sort((a, b) => (tirage(a) - tirage(b)) || ((b.auto ? 2 : 0) + (b.patch ? 1 : 0) - (a.auto ? 2 : 0) - (a.patch ? 1 : 0)) || (b.created_at || '').localeCompare(a.created_at || ''))
    const top = [...grail, ...rare.filter(c => !grail.includes(c))].slice(0, 3)
    return { added: ofYear.length, total: cards.length, perMonth, bestM, rc: count('rc'), auto: count('auto'), patch: count('patch'), topBrand, top }
  }, [cards, grails, year])

  const loadFont = async () => { try { await document.fonts.load('400 40px Surfquest') } catch { /* police de repli */ } }

  // ── La vidéo ───────────────────────────────────────────────────────────────
  const makeVideo = async () => {
    if (typeof MediaRecorder === 'undefined') { setErr('Ce navigateur ne sait pas enregistrer de vidéo : utilise l’image.'); return }
    setBusy('video'); setErr(''); setProgress(0); setVideoUrl(null)
    try {
      await loadFont()
      const [logo, ...bms] = await Promise.all([loadLogo(), ...stats.top.map(t => bmp(t.f))])
      const tops = stats.top.map((c, i) => ({ c, b: bms[i] as ImageBitmap | null })).filter(o => o.b) as { c: RC; b: ImageBitmap }[]
      // du n°3 au n°1 : la plus belle carte arrive en dernier
      const reveal = [...tops].reverse()
      const perCard = 1.9
      const S = { intro: 2.6, count: 3.4, months: 3.8, tiles: 3.2, cards: reveal.length ? 0.5 + reveal.length * perCard : 0, outro: 2.4 }
      const start = { intro: 0, count: S.intro, months: S.intro + S.count, tiles: S.intro + S.count + S.months, cards: S.intro + S.count + S.months + S.tiles, outro: S.intro + S.count + S.months + S.tiles + S.cards }
      const dur = start.outro + S.outro

      const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
      const x = canvas.getContext('2d')!
      const { mime, ext: e } = pickMime()
      const rec = new MediaRecorder(canvas.captureStream(FPS), { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 8_000_000 })
      const chunks: Blob[] = []
      rec.ondataavailable = ev => { if (ev.data.size) chunks.push(ev.data) }
      const finished = new Promise<void>(res => { rec.onstop = () => res() })

      const scene = (t: number, key: keyof typeof S, fn: (l: number, d: number) => void) => {
        const l = t - start[key], d = S[key]
        if (l < 0 || l > d) return
        x.save(); x.globalAlpha = Math.min(ease(l / 0.4), 1 - ease((l - (d - 0.35)) / 0.35) * (key === 'outro' ? 0 : 1)); fn(l, d); x.restore()
      }
      const header = (small: string) => { T(x, small, W / 2, 190, 40, SOFT, 700); T(x, year, W / 2, 292, 90, GOLD, 900) }

      const draw = (t: number) => {
        background(x, t)
        // 1. Intro
        scene(t, 'intro', l => {
          const k = easeBack(l / 0.9)
          x.save(); x.translate(W / 2, 800); x.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k)
          T(x, 'Mon année en cartes', 0, -330, 56, SOFT, 700)
          T(x, year, 0, 0, 340, GOLD, 900, 'center', W)
          x.restore()
          if (l > 0.7) { x.save(); x.globalAlpha *= ease((l - 0.7) / 0.6); T(x, ownerName, W / 2, 1040, 60, '#fff', 600); x.restore() }
          logoAt(x, logo, W / 2, 1560, 420)
        })
        // 2. Compteur
        scene(t, 'count', l => {
          header('Cartes ajoutées')
          const v = Math.round(stats.added * ease(l / 1.8))
          const pop = 1 + 0.06 * Math.max(0, 1 - Math.abs(l - 1.8) * 5)
          x.save(); x.translate(W / 2, 860); x.scale(pop, pop); T(x, String(v), 0, 0, 400, '#fff', 900, 'center', W); x.restore()
          T(x, stats.added > 1 ? 'cartes ajoutées' : 'carte ajoutée', W / 2, 990, 66, SOFT, 600)
          if (l > 1.6) { x.save(); x.globalAlpha *= ease((l - 1.6) / 0.6); T(x, `${stats.total} cartes en tout aujourd’hui`, W / 2, 1160, 48, '#fff', 500); x.restore() }
        })
        // 3. Mois par mois
        scene(t, 'months', l => {
          header('Mois par mois')
          const mx = Math.max(1, ...stats.perMonth), bw = 58, gap = 22, left = (W - (12 * bw + 11 * gap)) / 2, base = 1240
          stats.perMonth.forEach((n, i) => {
            const p = ease((l - 0.2 - i * 0.1) / 0.7), bh = Math.max(8, (n / mx) * 560) * p
            const best = i === stats.bestM && n > 0
            x.fillStyle = best ? GOLD : BLUE; x.fillRect(left + i * (bw + gap), base - bh, bw, bh)
            if (best && p > 0.95) T(x, String(n), left + i * (bw + gap) + bw / 2, base - bh - 22, 40, GOLD, 800, 'center', 120)
            T(x, MONTHS[i].slice(0, 1), left + i * (bw + gap) + bw / 2, base + 52, 34, SOFT, 700, 'center', 60)
          })
          if (stats.added > 0 && l > 1.7) { x.save(); x.globalAlpha *= ease((l - 1.7) / 0.5); ribbon(x, 'Mois le plus actif', W / 2, 1450); T(x, `${MONTHS[stats.bestM]} · ${stats.perMonth[stats.bestM]} cartes`, W / 2, 1570, 64, '#fff', 800); x.restore() }
        })
        // 4. Atouts + marque n°1
        scene(t, 'tiles', l => {
          header('Tes atouts')
          ;([['RC', stats.rc], ['AUTO', stats.auto], ['PATCH', stats.patch]] as [string, number][]).forEach(([label, n], i) => {
            const p = easeBack((l - 0.15 - i * 0.2) / 0.6), cx = 190 + i * 350, cy = 700
            x.save(); x.translate(cx, cy); x.scale(p, p)
            x.fillStyle = 'rgba(255,255,255,.09)'; x.fillRect(-150, -150, 300, 340)
            x.fillStyle = GOLD; x.fillRect(-150, -150, 300, 8)
            T(x, String(Math.round(n * ease((l - 0.35 - i * 0.2) / 1.0))), 0, 70, 170, GOLD, 900, 'center', 280)
            T(x, label, 0, 150, 44, SOFT, 800, 'center', 280)
            x.restore()
          })
          if (stats.topBrand && l > 1.4) { x.save(); x.globalAlpha *= ease((l - 1.4) / 0.5); ribbon(x, 'Marque n° 1', W / 2, 1130); T(x, stats.topBrand[0], W / 2, 1290, 110, '#fff', 900); T(x, `${stats.topBrand[1]} cartes`, W / 2, 1370, 50, SOFT, 600); x.restore() }
        })
        // 5. Les plus belles cartes (n°3, n°2, puis n°1)
        if (reveal.length) scene(t, 'cards', l => {
          const t0 = 0.5
          header('Tes plus belles cartes')
          reveal.forEach(({ c, b }, i) => {
            const li = l - t0 - i * perCard
            if (li < 0 || li > perCard + 0.05) return
            const rank = reveal.length - i, last = i === reveal.length - 1
            const a = i === reveal.length - 1 ? 1 : 1 - ease((li - (perCard - 0.3)) / 0.3)
            const inE = ease(li / 0.5)
            x.save(); x.globalAlpha *= a
            const flip = Math.max(0.03, Math.abs(Math.cos((1 - inE) * Math.PI / 2)))
            const { h } = card(x, b, W / 2, 1010, 640, 900, flip, 1 + 0.05 * clamp(li / perCard))
            ribbon(x, `N° ${rank}`, W / 2, 1010 - h / 2 - 50, ease((li - 0.3) / 0.3))
            x.globalAlpha *= ease((li - 0.5) / 0.4)
            T(x, c.n, W / 2, 1010 + h / 2 + 92, 64, '#fff', 800)
            T(x, [c.y, c.s].filter(Boolean).join(' · '), W / 2, 1010 + h / 2 + 150, 38, SOFT, 600)
            if (last) { /* la n°1 reste jusqu'à la fin de la scène */ }
            x.restore()
          })
        })
        // 6. Fin
        scene(t, 'outro', l => {
          const k = easeBack(l / 0.8)
          x.save(); x.translate(W / 2, 760); x.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k)
          T(x, `${stats.added} cartes`, 0, 0, 200, GOLD, 900, 'center', W - 80)
          T(x, `en ${year}`, 0, 140, 110, '#fff', 900)
          x.restore()
          T(x, ownerName, W / 2, 1030, 54, SOFT, 600)
          logoAt(x, logo, W / 2, 1300, 520)
          T(x, 'memorabilius.fr', W / 2, 1580, 50, '#fff', 600)
        })
        // barre de progression
        x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(70, 64, W - 140, 8)
        x.fillStyle = GOLD; x.fillRect(70, 64, (W - 140) * clamp(t / dur), 8)
      }

      rec.start(250)
      const t0 = performance.now()
      await new Promise<void>(resolve => {
        const tick = () => {
          if (!alive.current) return resolve()
          const t = (performance.now() - t0) / 1000
          draw(Math.min(t, dur)); setProgress(Math.min(1, t / dur))
          if (t >= dur) return resolve()
          requestAnimationFrame(tick)
        }
        tick()
      })
      rec.stop(); await finished
      if (!alive.current) return
      setVideoUrl(keep(new Blob(chunks, { type: mime || 'video/webm' }))); setExt(e)
    } catch (e) { setErr(e instanceof Error ? e.message : 'La vidéo n’a pas pu être créée.') }
    setBusy('')
  }

  // ── L'image ────────────────────────────────────────────────────────────────
  const makeImage = async () => {
    setBusy('image'); setErr(''); setImgUrl(null)
    try {
      await loadFont()
      const [logo, ...bms] = await Promise.all([loadLogo(), ...stats.top.map(t => bmp(t.f))])
      const c = document.createElement('canvas'); c.width = W; c.height = H
      const x = c.getContext('2d')!
      background(x, 3)
      T(x, 'Mon année en cartes', W / 2, 140, 44, SOFT, 700)
      T(x, year, W / 2, 330, 230, GOLD, 900)
      T(x, ownerName, W / 2, 400, 46, '#fff', 600)
      T(x, String(stats.added), W / 2, 640, 210, '#fff', 900)
      T(x, stats.added > 1 ? 'cartes ajoutées' : 'carte ajoutée', W / 2, 705, 52, SOFT, 600)
      T(x, `${stats.total} cartes en tout aujourd’hui`, W / 2, 775, 40, '#fff', 500)
      ;([['RC', stats.rc], ['AUTO', stats.auto], ['PATCH', stats.patch]] as [string, number][]).forEach(([l, n], i) => {
        const px = 150 + i * 390
        x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(px - 130, 850, 260, 150)
        T(x, String(n), px, 940, 80, GOLD, 900, 'center', 240); T(x, l, px, 985, 32, SOFT, 700, 'center', 240)
      })
      const mx = Math.max(1, ...stats.perMonth)
      stats.perMonth.forEach((n, i) => {
        const bw = 60, gap = 24, left = (W - (12 * bw + 11 * gap)) / 2, bh = Math.max(6, (n / mx) * 220)
        x.fillStyle = i === stats.bestM && n > 0 ? GOLD : BLUE; x.fillRect(left + i * (bw + gap), 1230 - bh, bw, bh)
        T(x, MONTHS[i].slice(0, 1), left + i * (bw + gap) + bw / 2, 1270, 28, SOFT, 700, 'center', 60)
      })
      if (stats.added > 0) T(x, `Mois le plus actif : ${MONTHS[stats.bestM]} (${stats.perMonth[stats.bestM]})`, W / 2, 1345, 40, '#fff', 600)
      if (stats.topBrand) T(x, `Marque n° 1 : ${stats.topBrand[0]} (${stats.topBrand[1]})`, W / 2, 1405, 40, '#fff', 600)
      T(x, 'Mes plus belles cartes', W / 2, 1490, 36, GOLD, 800)
      const bw = 280, bhMax = 330, gap = 40, imgs = (bms as (ImageBitmap | null)[]).filter(Boolean) as ImageBitmap[]
      imgs.forEach((b, i) => {
        const k = Math.min(bw / b.width, bhMax / b.height), w = b.width * k, h = b.height * k
        const left = (W - (imgs.length * bw + (imgs.length - 1) * gap)) / 2 + i * (bw + gap) + (bw - w) / 2
        x.save(); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 36; x.shadowOffsetY = 14
        x.drawImage(b, left, 1530 + (bhMax - h) / 2, w, h); x.restore() // bords nets
      })
      logoAt(x, logo, W / 2, 1860, 230)
      const bl: Blob | null = await new Promise(res => c.toBlob(res, 'image/png'))
      if (bl && alive.current) setImgUrl(keep(bl))
    } catch (e) { setErr(e instanceof Error ? e.message : 'L’image n’a pas pu être créée.') }
    setBusy('')
  }

  const save = async (blob: Blob, name: string) => { try { await saveOrShareFile(blob, name, { timeoutMs: 45000 }) } catch { setErr('L’enregistrement a échoué, réessaie.') } }
  const fetchBlob = async (u: string) => (await fetch(u)).blob()

  if (typeof document === 'undefined') return null
  const btn: React.CSSProperties = { background: GOLD, color: '#0b1230', border: 'none', padding: '11px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }
  const btn2: React.CSSProperties = { background: 'transparent', color: '#fff', border: '2px solid #3a4a8a', padding: '9px 16px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Mon année en cartes" onClick={() => { if (!busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 600000, background: 'rgba(5,8,25,.88)', display: 'grid', placeItems: 'center', padding: 16, overflow: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(460px, 100%)', background: '#0e1530', color: '#fff', border: '3px solid #243063', padding: 18 }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 20 }}>📅 Mon année en cartes</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#aab3d1', lineHeight: 1.5 }}>Une vidéo de 16 secondes (et une image) à partager : cartes ajoutées, mois le plus actif, atouts, marque n° 1 et tes plus belles cartes. Tout est calculé sur ton appareil.</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <select value={year} disabled={!!busy} onChange={e => { setYear(e.target.value); setImgUrl(null); setVideoUrl(null) }} style={{ padding: 8, background: '#17214a', color: '#fff', border: '2px solid #243063', fontWeight: 700 }}>
            {(years.length ? years : [year]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#aab3d1' }}>{stats.added} cartes ajoutées en {year}</span>
        </div>
        {stats.added === 0 && <p style={{ fontSize: 13, color: '#ffb4b4' }}>Aucune carte ajoutée en {year} : choisis une autre année.</p>}
        {busy === 'video' && <div style={{ marginBottom: 12 }}><div style={{ height: 8, background: '#17214a' }}><i style={{ display: 'block', height: '100%', width: `${Math.round(progress * 100)}%`, background: GOLD }} /></div><p style={{ margin: '6px 0 0', fontSize: 12, color: '#aab3d1' }}>Création de la vidéo… garde cet écran ouvert ({Math.round(progress * 100)} %)</p></div>}
        {videoUrl && <video src={videoUrl} controls playsInline style={{ width: '100%', maxHeight: '58vh', display: 'block', marginBottom: 12, background: '#000' }} />}
        {imgUrl && !videoUrl && <img src={imgUrl} alt="Aperçu du bilan" style={{ width: '100%', maxHeight: '58vh', objectFit: 'contain', display: 'block', marginBottom: 12, background: '#000' }} />}
        {err && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#ffb4b4' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...btn, opacity: busy || !stats.added ? 0.55 : 1 }} disabled={!!busy || !stats.added} onClick={makeVideo}>{busy === 'video' ? 'Création…' : videoUrl ? '🎬 Refaire la vidéo' : '🎬 Créer la vidéo'}</button>
          <button type="button" style={{ ...btn2, opacity: busy || !stats.added ? 0.55 : 1 }} disabled={!!busy || !stats.added} onClick={makeImage}>{busy === 'image' ? 'Création…' : '🖼️ Créer l’image'}</button>
        </div>
        {(videoUrl || imgUrl) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
            {videoUrl && <button type="button" style={btn} onClick={async () => save(await fetchBlob(videoUrl), `mon-annee-${year}.${ext}`)}>⬇ Enregistrer la vidéo</button>}
            {imgUrl && <>
              {videoUrl && <img src={imgUrl} alt="" style={{ width: 54, height: 96, objectFit: 'cover', border: '2px solid #3a4a8a' }} />}
              <button type="button" style={btn2} onClick={async () => save(await fetchBlob(imgUrl), `mon-annee-${year}.png`)}>⬇ Enregistrer l’image</button>
            </>}
          </div>
        )}
        <div style={{ marginTop: 14 }}><button type="button" style={btn2} disabled={!!busy} onClick={onClose}>Fermer</button></div>
      </div>
    </div>,
    document.body,
  )
}
