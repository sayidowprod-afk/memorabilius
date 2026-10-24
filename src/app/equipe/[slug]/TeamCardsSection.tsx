'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type Card = {
  id: string | number; img: string; nom: string; annee: string; marque: string
  is_horizontal: boolean; user_id: string; display_name?: string; avatar_url?: string; accent: string
}

// Pagine via /api/team-cards (defilement) -- generer toutes les cartes
// communaute d'une franchise d'un coup cote serveur pouvait peser plusieurs
// Mo de HTML pour une franchise historique.
export default function TeamCardsSection({ slug, initialCards, totalCount }: {
  slug: string; initialCards: Card[]; totalCount: number
}) {
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [hasMore, setHasMore] = useState(totalCount > initialCards.length)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = async () => {
    setLoading(true)
    const params = new URLSearchParams({ slug, offset: String(cards.length), limit: '48' })
    try {
      const r = await fetch(`/api/team-cards?${params.toString()}`)
      if (r.ok) {
        const j = await r.json()
        setCards(prev => [...prev, ...j.cards])
        setHasMore(j.hasMore)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(e => { if (e[0].isIntersecting && hasMore && !loading) loadMore() }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, cards.length])

  if (cards.length === 0) return null

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: 'var(--text, #111)' }}>Dans les collections ({totalCount})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {cards.map((card) => (
          <Link key={card.id} href={`/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
            <div style={{ borderRadius: 10, overflow: 'hidden', background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)' }}>
              <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
                <img src={card.img} alt={card.nom} loading="lazy" style={card.is_horizontal ? {
                  position: 'absolute', width: '140%', height: '71.43%',
                  left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                <div style={{ fontSize: 10, color: 'var(--text3, #999)', marginTop: 2 }}>{card.display_name}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text3, #999)' }}>
          {loading ? 'Chargement…' : ''}
        </div>
      )}
    </section>
  )
}
