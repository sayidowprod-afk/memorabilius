'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang, localeFor } from '@/lib/LangContext'

type Pick = { day: { y: number; m: number; d: number }; card: { image: string; nom: string; annee?: string; marque?: string; collection?: string; variation?: string; num?: string; rc: boolean; auto: boolean; patch: boolean; owner: { id: string; slug: string | null; name: string | null } } }

const TXT: Record<string, { eyebrow: string; by: string; cta: string }> = {
  fr: { eyebrow: 'Carte du jour', by: 'Dans la collection de', cta: 'Voir la carte' },
  en: { eyebrow: 'Card of the day', by: 'In the collection of', cta: 'View the card' },
  de: { eyebrow: 'Karte des Tages', by: 'In der Sammlung von', cta: 'Karte ansehen' },
  es: { eyebrow: 'Carta del día', by: 'En la colección de', cta: 'Ver la carta' },
  it: { eyebrow: 'Carta del giorno', by: 'Nella collezione di', cta: 'Vedi la carta' },
}

// Carte du jour (voir /api/card-of-the-day) : meme carte pour tous, toute la journee.
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
  const href = `/galerie/${card.owner.slug || card.owner.id}?card=${encodeURIComponent(card.image)}`
  const meta = [card.annee, card.marque, card.collection, card.variation].filter(Boolean).join(' · ')
  const flags = [card.rc && 'RC', card.auto && 'AUTO', card.patch && 'PATCH', card.num && card.num].filter(Boolean).join(' · ')
  return (
    <section className="cdj" aria-label={T.eyebrow}>
      <div className="cdj-day"><b className="da-display">{day.d}</b><small>{month} {day.y}</small></div>
      <Link href={href} className="cdj-img" aria-label={card.nom}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.image} alt={[card.annee, card.marque, card.collection, card.variation, card.nom].filter(Boolean).join(' ')} loading="lazy" />
      </Link>
      <div>
        <span className="cdj-eyebrow">{T.eyebrow}</span>
        <h3 className="da-display">{card.nom}</h3>
        <p>{[meta, flags].filter(Boolean).join(' · ')}{card.owner.name ? ` — ${T.by} ${card.owner.name}` : ''}</p>
        <Link href={href} className="cdj-btn">{T.cta}</Link>
      </div>
    </section>
  )
}
