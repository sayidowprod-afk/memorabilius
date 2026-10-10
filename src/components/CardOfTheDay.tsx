'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, localeFor } from '@/lib/LangContext'

type Pick = { day: { y: number; m: number; d: number }; card: { image: string; nom: string; annee?: string; marque?: string; collection?: string; variation?: string; num?: string; rc: boolean; auto: boolean; patch: boolean; owner: { id: string; slug: string | null; name: string | null; avatar: string | null; total: number } } }

const TXT: Record<string, { eyebrow: string; by: string; cta: string; gal: string; cards: string }> = {
  fr: { eyebrow: 'Carte du jour', by: 'Dans la collection de', cta: 'Voir la carte', gal: 'Sa galerie', cards: 'cartes' },
  en: { eyebrow: 'Card of the day', by: 'In the collection of', cta: 'View the card', gal: 'Their gallery', cards: 'cards' },
  de: { eyebrow: 'Karte des Tages', by: 'In der Sammlung von', cta: 'Karte ansehen', gal: 'Seine Galerie', cards: 'Karten' },
  es: { eyebrow: 'Carta del día', by: 'En la colección de', cta: 'Ver la carta', gal: 'Su galería', cards: 'cartas' },
  it: { eyebrow: 'Carta del giorno', by: 'Nella collezione di', cta: 'Vedi la carta', gal: 'La sua galleria', cards: 'carte' },
}

// Carte du jour (voir /api/card-of-the-day) : meme carte pour tous, toute la journee. Placee sur l'accueil, juste avant les pepites.
export default function CardOfTheDay() {
  const { lang } = useLang()
  const [pick, setPick] = useState<Pick | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/card-of-the-day').then(r => r.json()).then(d => { if (!cancelled && d?.card) setPick(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [])
  if (!pick) return null
  const { card, day } = pick
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
      <Link href={href} className="cdj-img" aria-label={card.nom}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.image} alt={[card.annee, card.marque, card.collection, card.variation, card.nom].filter(Boolean).join(' ')} loading="lazy" />
      </Link>
      <div className="cdj-info">
        <span className="cdj-eyebrow">{T.eyebrow}</span>
        <h3 className="da-display">{card.nom}</h3>
        {meta && <p className="cdj-meta">{meta}</p>}
        {chips.length > 0 && <div className="cdj-chips">{chips.map(c => <span key={c}>{c}</span>)}</div>}
        {card.owner.name && (
          <Link href={gal} className="cdj-owner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.owner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.owner.name)}&background=003DA6&color=fff&size=96`} alt="" width={44} height={44} />
            <span><small>{T.by}</small><b>{card.owner.name}</b>{card.owner.total > 0 && <i>{card.owner.total} {T.cards}</i>}</span>
          </Link>
        )}
        <div className="cdj-actions">
          <Link href={href} className="cdj-btn">{T.cta}</Link>
          <Link href={gal} className="cdj-btn alt">{T.gal} →</Link>
        </div>
      </div>
    </section>
  )
}
