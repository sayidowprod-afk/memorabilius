'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang, localeFor } from '@/lib/LangContext'

type Pick = { day: { y: number; m: number; d: number }; card: { image: string; nom: string; annee?: string; marque?: string; collection?: string; variation?: string; num?: string; rc: boolean; auto: boolean; patch: boolean; owner: { id: string; slug: string | null; name: string | null; avatar: string | null; total: number } } }

const TXT: Record<string, { eyebrow: string; by: string; cta: string; gal: string; cards: string; scratch: string; hint: string; skip: string; week: string }> = {
  fr: { eyebrow: 'Carte du jour', by: 'Dans la collection de', cta: 'Voir la carte', gal: 'Sa galerie', cards: 'cartes', scratch: 'GRATTE', hint: 'Gratte la carte pour la découvrir', skip: 'Révéler', week: 'Cartes de la semaine' },
  en: { eyebrow: 'Card of the day', by: 'In the collection of', cta: 'View the card', gal: 'Their gallery', cards: 'cards', scratch: 'SCRATCH', hint: 'Scratch the card to reveal it', skip: 'Reveal', week: 'This week' },
  de: { eyebrow: 'Karte des Tages', by: 'In der Sammlung von', cta: 'Karte ansehen', gal: 'Seine Galerie', cards: 'Karten', scratch: 'RUBBELN', hint: 'Rubbel die Karte frei', skip: 'Aufdecken', week: 'Diese Woche' },
  es: { eyebrow: 'Carta del día', by: 'En la colección de', cta: 'Ver la carta', gal: 'Su galería', cards: 'cartas', scratch: 'RASCA', hint: 'Rasca la carta para descubrirla', skip: 'Revelar', week: 'Esta semana' },
  it: { eyebrow: 'Carta del giorno', by: 'Nella collezione di', cta: 'Vedi la carta', gal: 'La sua galleria', cards: 'carte', scratch: 'GRATTA', hint: 'Gratta la carta per scoprirla', skip: 'Rivela', week: 'Questa settimana' },
}

// Pellicule a gratter : couvre la carte tant qu'elle n'a pas ete devoilee aujourd'hui. Passe a "devoilee" des qu'~40 % est gratte.
function ScratchFoil({ label, onReveal }: { label: string; onReveal: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const down = useRef(false)
  const moves = useRef(0)
  useEffect(() => {
    const c = cv.current; if (!c) return
    const r = c.getBoundingClientRect()
    c.width = Math.max(2, Math.round(r.width * 2)); c.height = Math.max(2, Math.round(r.height * 2))
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, c.width, c.height)
    grad.addColorStop(0, '#9aa6bd'); grad.addColorStop(.35, '#e8edf7'); grad.addColorStop(.5, '#b9c4da'); grad.addColorStop(.75, '#f4f7fd'); grad.addColorStop(1, '#8895ae')
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(6,18,46,.55)'; g.textAlign = 'center'
    g.font = `${Math.round(c.width * 0.17)}px Surfquest, Impact, sans-serif`; g.fillText(label, c.width / 2, c.height / 2 + 10)
  }, [label])
  const cleared = useCallback(() => {
    const c = cv.current; if (!c) return 0
    const g = c.getContext('2d')!
    const w = 40, h = 56
    const t = document.createElement('canvas'); t.width = w; t.height = h
    const tg = t.getContext('2d')!; tg.drawImage(c, 0, 0, w, h)
    const d = tg.getImageData(0, 0, w, h).data
    let n = 0
    for (let i = 3; i < d.length; i += 4) if (d[i] < 128) n++
    void g
    return n / (w * h)
  }, [])
  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!down.current) return
    const c = cv.current!; const r = c.getBoundingClientRect(); const g = c.getContext('2d')!
    g.globalCompositeOperation = 'destination-out'
    g.beginPath(); g.arc((e.clientX - r.left) * 2, (e.clientY - r.top) * 2, 36, 0, Math.PI * 2); g.fill()
    moves.current++
    if (moves.current % 10 === 0 && cleared() > 0.4) onReveal()
  }
  return (
    <canvas ref={cv} className="cdj-foil" aria-label={label}
      onPointerDown={e => { down.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); scratch(e) }}
      onPointerMove={scratch}
      onPointerUp={() => { down.current = false; if (cleared() > 0.4) onReveal() }} />
  )
}

// Carte du jour (voir /api/card-of-the-day) : meme carte pour tous, toute la journee. Placee sur l'accueil, juste avant les pepites.
export default function CardOfTheDay() {
  const { lang } = useLang()
  const [pick, setPick] = useState<Pick | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/card-of-the-day?d=${new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())}`).then(r => r.json()).then(d => {
      if (cancelled || !d?.card) return
      setPick(d)
      try {
        const k = `${d.day.y}-${d.day.m}-${d.day.d}`
        const was = localStorage.getItem(`cdj-revealed-${k}`) === '1'
        setRevealed(was)
        if (was && !localStorage.getItem(`cdj-card-${k}`)) {
          const o = d.card.owner
          localStorage.setItem(`cdj-card-${k}`, JSON.stringify({ image: d.card.image, nom: d.card.nom, href: `/galerie/${o.slug || o.id}?card=${encodeURIComponent(d.card.image)}` }))
        }
      } catch { /* stockage indisponible : on garde le grattage */ }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])
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
        <div className="cdj-img cdj-scratch">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.image} alt="" loading="lazy" />
          <ScratchFoil label={T.scratch} onReveal={reveal} />
        </div>
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
    </section>
  )
}
