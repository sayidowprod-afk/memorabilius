'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

type SetRow = { id: number; name: string; year: number | null; brand: string | null; sport: string }

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

// Pagine via /api/team-sets (defilement) -- generer tous les sets d'une
// franchise d'un coup cote serveur pouvait peser plusieurs Mo de HTML.
export default function TeamSetsSection({ slug, initialSets, totalCount }: {
  slug: string; initialSets: SetRow[]; totalCount: number
}) {
  const [sets, setSets] = useState<SetRow[]>(initialSets)
  const [hasMore, setHasMore] = useState(totalCount > initialSets.length)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = async () => {
    setLoading(true)
    const params = new URLSearchParams({ slug, offset: String(sets.length), limit: '40' })
    try {
      const r = await fetch(`/api/team-sets?${params.toString()}`)
      if (r.ok) {
        const j = await r.json()
        setSets(prev => [...prev, ...j.sets])
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
  }, [hasMore, loading, sets.length])

  if (sets.length === 0) return null

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 14, color: 'var(--text, #111)' }}>Sets ({totalCount})</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
        {sets.map((set) => (
          <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border, #eee)' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text, #111)', marginBottom: 3 }}>{set.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3, #999)' }}>
                {set.year ? seasonLabel(set.year, set.sport) : ''}{set.brand ? ` · ${set.brand}` : ''} · {(set.sport || '').toUpperCase()}
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
