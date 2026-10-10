'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useLang, localeFor } from '@/lib/LangContext'

type Pick = { day: { y: number; m: number; d: number }; card: { image: string; nom: string; annee?: string; marque?: string; collection?: string; variation?: string; num?: string; rc: boolean; auto: boolean; patch: boolean; owner: { id: string; slug: string | null; name: string | null; avatar: string | null; total: number } } }

const TXT: Record<string, { eyebrow: string; by: string; cta: string; gal: string; cards: string; scratch: string; hint: string; skip: string; week: string }> = {
  fr: { eyebrow: 'Carte du jour', by: 'Dans la collection de', cta: 'Voir la carte', gal: 'Sa galerie', cards: 'cartes', scratch: 'GRATTE', hint: 'Touche la carte pour la gratter', skip: 'Révéler', week: 'Cartes de la semaine' },
  en: { eyebrow: 'Card of the day', by: 'In the collection of', cta: 'View the card', gal: 'Their gallery', cards: 'cards', scratch: 'SCRATCH', hint: 'Tap the card to scratch it', skip: 'Reveal', week: 'This week' },
  de: { eyebrow: 'Karte des Tages', by: 'In der Sammlung von', cta: 'Karte ansehen', gal: 'Seine Galerie', cards: 'Karten', scratch: 'RUBBELN', hint: 'Tippe die Karte an und rubbele sie frei', skip: 'Aufdecken', week: 'Diese Woche' },
  es: { eyebrow: 'Carta del día', by: 'En la colección de', cta: 'Ver la carta', gal: 'Su galería', cards: 'cartas', scratch: 'RASCA', hint: 'Toca la carta para rascarla', skip: 'Revelar', week: 'Esta semana' },
  it: { eyebrow: 'Carta del giorno', by: 'Nella collezione di', cta: 'Vedi la carta', gal: 'La sua galleria', cards: 'carte', scratch: 'GRATTA', hint: 'Tocca la carta per grattarla', skip: 'Rivela', week: 'Questa settimana' },
}

// Pellicule a gratter. `still` : simple apercu (sur l'accueil, aucune interaction). Sinon on gratte au doigt / a la souris :
// trait continu (pas de trous entre deux mouvements), gros pinceau, et il faut degager ~65 % de la carte pour la devoiler.
const REVEAL_AT = 0.65
function paintFoil(c: HTMLCanvasElement, label: string) {
  const g = c.getContext('2d')!
  const W = c.width, H = c.height
  const grad = g.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, '#8e9bb5'); grad.addColorStop(.28, '#e8edf7'); grad.addColorStop(.5, '#aab6cf'); grad.addColorStop(.74, '#f4f7fd'); grad.addColorStop(1, '#7f8ca7')
  g.fillStyle = grad; g.fillRect(0, 0, W, H)
  // fines rayures diagonales + grain, comme un vrai ticket
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(1, W * 0.006)
  for (let x = -H; x < W; x += W * 0.045) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke() }
  for (let i = 0; i < W * 1.2; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.18)' : 'rgba(6,18,46,.08)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2) }
  g.strokeStyle = 'rgba(6,18,46,.5)'; g.lineWidth = Math.max(2, W * 0.012); g.strokeRect(W * 0.05, W * 0.05, W * 0.9, H - W * 0.1)
  g.fillStyle = 'rgba(6,18,46,.62)'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.font = `${Math.round(W * 0.2)}px Surfquest, Impact, sans-serif`; g.fillText(label, W / 2, H / 2)
}
function ScratchFoil({ label, still, onReveal, onProgress }: { label: string; still?: boolean; onReveal?: () => void; onProgress?: (f: number) => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const last = useRef<{ x: number; y: number } | null>(null)
  const moves = useRef(0)
  const done = useRef(false)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    const c = cv.current; if (!c) return
    const r = c.getBoundingClientRect()
    const k = still ? 1.5 : 2
    c.width = Math.max(2, Math.round(r.width * k)); c.height = Math.max(2, Math.round(r.height * k))
    paintFoil(c, label)
  }, [label, still])
  const cleared = useCallback(() => {
    const c = cv.current; if (!c) return 0
    const w = 50, h = 70
    const t = document.createElement('canvas'); t.width = w; t.height = h
    const tg = t.getContext('2d')!; tg.drawImage(c, 0, 0, w, h)
    const d = tg.getImageData(0, 0, w, h).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] < 128) n++
    return n / (w * h)
  }, [])
  const check = useCallback(() => {
    if (done.current) return
    const f = cleared()
    onProgress?.(Math.min(1, f / REVEAL_AT))
    if (f >= REVEAL_AT) { done.current = true; setGone(true); onReveal?.() }
  }, [cleared, onProgress, onReveal])
  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (still || !last.current || done.current) return
    const c = cv.current!; const r = c.getBoundingClientRect(); const g = c.getContext('2d')!
    const px = (e.clientX - r.left) * (c.width / r.width), py = (e.clientY - r.top) * (c.height / r.height)
    g.globalCompositeOperation = 'destination-out'
    g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = c.width * 0.17
    g.beginPath(); g.moveTo(last.current.x, last.current.y); g.lineTo(px, py); g.stroke()
    last.current = { x: px, y: py }
    if (++moves.current % 4 === 0) check()
  }
  if (still) return <canvas ref={cv} className="cdj-foil" style={{ pointerEvents: 'none' }} aria-hidden />
  return (
    <canvas ref={cv} className={`cdj-foil${gone ? ' gone' : ''}`} aria-label={label}
      onPointerDown={e => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId)
        const c = cv.current!; const r = c.getBoundingClientRect()
        last.current = { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }
        scratch(e)
      }}
      onPointerMove={scratch}
      onPointerUp={() => { last.current = null; check() }}
      onPointerCancel={() => { last.current = null }} />
  )
}

// Carte du jour (voir /api/card-of-the-day) : meme carte pour tous, toute la journee. Placee sur l'accueil, juste avant les pepites.
export default function CardOfTheDay() {
  const { lang } = useLang()
  const [pick, setPick] = useState<Pick | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [prog, setProg] = useState(0)
  const [, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/card-of-the-day?d=${new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())}`).then(r => r.json()).then(d => {
      if (cancelled || !d?.card) return
      setPick(d)
      try {
        const k = `${d.day.y}-${d.day.m}-${d.day.d}`
        let was = localStorage.getItem(`cdj-revealed-${k}`) === '1'
        // la carte du jour a change depuis le dernier grattage : on remet le ticket a gratter
        try { const sv = JSON.parse(localStorage.getItem(`cdj-card-${k}`) || 'null'); if (was && sv?.image && sv.image !== d.card.image) { was = false; localStorage.removeItem(`cdj-revealed-${k}`); localStorage.removeItem(`cdj-card-${k}`) } } catch { /* ignore */ }
        setRevealed(was)
        if (was && !localStorage.getItem(`cdj-card-${k}`)) {
          const o = d.card.owner
          localStorage.setItem(`cdj-card-${k}`, JSON.stringify({ image: d.card.image, nom: d.card.nom, href: `/galerie/${o.slug || o.id}?card=${encodeURIComponent(d.card.image)}` }))
        }
      } catch { /* stockage indisponible : on garde le grattage */ }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])
  if (!pick) return null
  const { card, day } = pick
  const reveal = () => {
    setRevealed(true)
    saveDay()
    setTick(t => t + 1)
  }
  // Memorise la carte du jour devoilee (pour la frise de la semaine) : l'API tire la carte du jour, mais le lot de candidats
  // evolue, donc on garde ce que le joueur a reellement vu.
  const saveDay = () => {
    try {
      localStorage.setItem(`cdj-revealed-${day.y}-${day.m}-${day.d}`, '1')
      localStorage.setItem(`cdj-card-${day.y}-${day.m}-${day.d}`, JSON.stringify({ image: card.image, nom: card.nom, href }))
    } catch { /* tant pis */ }
  }
  // 7 derniers jours (aujourd'hui en dernier) : carte memorisee si grattee ce jour-la, sinon case vide
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(day.y, day.m - 1, day.d - (6 - i)))
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
    let saved: { image: string; nom: string; href: string } | null = null
    try { const raw = localStorage.getItem(`cdj-card-${key}`); if (raw) saved = JSON.parse(raw) } catch { /* ignore */ }
    const label = new Intl.DateTimeFormat(localeFor(lang), { weekday: 'short', timeZone: 'UTC' }).format(d).replace('.', '')
    return { key, saved, label, today: i === 6 }
  })
  const T = TXT[lang] || TXT.en
  const month = new Intl.DateTimeFormat(localeFor(lang), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(day.y, day.m - 1, day.d)))
  const gal = `/galerie/${card.owner.slug || card.owner.id}`
  const href = `${gal}?card=${encodeURIComponent(card.image)}`
  const meta = [card.annee, card.marque, card.collection].filter(Boolean).join(' · ')
  const chips = [card.variation, card.rc && 'RC', card.auto && 'AUTO', card.patch && 'PATCH', card.num].filter(Boolean) as string[]
  return (
    <section className="cdj" aria-label={T.eyebrow}>
      <div className="cdj-wm da-display" aria-hidden="true">{day.d}</div>
      <div className="cdj-day"><b className="da-display">{day.d}</b><small>{month} {day.y}</small></div>
      {revealed ? (
        <Link href={href} className="cdj-img" aria-label={card.nom}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image} alt={[card.annee, card.marque, card.collection, card.variation, card.nom].filter(Boolean).join(' ')} loading="lazy" />
        </Link>
      ) : (
        <button type="button" className="cdj-img cdj-scratch" onClick={() => { setProg(0); setOpen(true) }} aria-label={T.hint}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image} alt="" loading="lazy" />
          <ScratchFoil label={T.scratch} still />
          <span className="cdj-sheen" aria-hidden />
        </button>
      )}
      <div className="cdj-info">
        <span className="cdj-eyebrow">{T.eyebrow}</span>
        {!revealed && (
          <>
            <h3 className="da-display">? ? ?</h3>
            <p className="cdj-meta">{T.hint}</p>
            <div className="cdj-actions"><button type="button" className="cdj-btn alt" onClick={reveal}>{T.skip}</button></div>
          </>
        )}
        {revealed && <h3 className="da-display">{card.nom}</h3>}
        {revealed && meta && <p className="cdj-meta">{meta}</p>}
        {revealed && chips.length > 0 && <div className="cdj-chips">{chips.map(c => <span key={c}>{c}</span>)}</div>}
        {revealed && card.owner.name && (
          <Link href={gal} className="cdj-owner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.owner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.owner.name)}&background=003DA6&color=fff&size=96`} alt="" width={44} height={44} />
            <span><small>{T.by}</small><b>{card.owner.name}</b>{card.owner.total > 0 && <i>{card.owner.total} {T.cards}</i>}</span>
          </Link>
        )}
        {revealed && (
          <div className="cdj-actions">
            <Link href={href} className="cdj-btn">{T.cta}</Link>
            <Link href={gal} className="cdj-btn alt">{T.gal} →</Link>
          </div>
        )}
      </div>
      <div className="cdj-week" aria-label={T.week}>
        {week.map(w => {
          const shown = w.today ? (revealed ? { image: card.image, nom: card.nom, href } : null) : w.saved
          const inner = shown
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={shown.image} alt={shown.nom} loading="lazy" />
            : <b className="da-display">?</b>
          return (
            <div key={w.key} className={`cdj-wd${shown ? '' : ' miss'}${w.today ? ' today' : ''}`}>
              {shown ? <Link href={shown.href} aria-label={shown.nom}>{inner}</Link> : inner}
              <small>{w.label}</small>
            </div>
          )
        })}
      </div>
      {open && createPortal(
        <div className="cdj-ov" role="dialog" aria-modal="true" aria-label={T.eyebrow} onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <button type="button" className="cdj-ov-x" onClick={() => setOpen(false)} aria-label="Fermer">✕</button>
          <div className="cdj-ov-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.image} alt="" />
            {!revealed && <ScratchFoil label={T.scratch} onReveal={reveal} onProgress={setProg} />}
          </div>
          {!revealed ? (
            <div className="cdj-ov-bar" aria-hidden><i style={{ width: `${Math.round(prog * 100)}%` }} /></div>
          ) : (
            <div className="cdj-ov-done">
              <b className="da-display">{card.nom}</b>
              {meta && <span>{meta}</span>}
              <Link href={href} className="cdj-btn">{T.cta}</Link>
            </div>
          )}
        </div>,
        document.body,
      )}
    </section>
  )
}
