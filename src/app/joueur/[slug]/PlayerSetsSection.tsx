'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import TagIcon from '@/components/TagIcon'

type SetRow = {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  isRc: boolean
  variations: string[]
}

function seasonLabelSingle(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

// Pagine via /api/player-sets (defilement) plutot que de rendre TOUS les
// sets d'un coup cote serveur -- pour un joueur avec des centaines/milliers
// de sets, generer+serialiser tout le HTML d'un coup (meme avec peu de
// cartes communaute, ex: Aaron Brooks avec "seulement" 60 sets pour la
// seule annee 2002) etait le vrai goulot de la page joueur, pas les requetes
// reseau. Meme principe que CommunityCardsSection.
export default function PlayerSetsSection({ playerName, initialSets, totalCount, primarySport }: {
  playerName: string; initialSets: SetRow[]; totalCount: number; primarySport: string
}) {
  const [sets, setSets] = useState<SetRow[]>(initialSets)
  const [hasMore, setHasMore] = useState(totalCount > initialSets.length)
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = async () => {
    setLoading(true)
    const params = new URLSearchParams({ name: playerName, offset: String(sets.length), limit: '40' })
    try {
      const r = await fetch(`/api/player-sets?${params.toString()}`)
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

  const byYear = useMemo(() => {
    const map = new Map<number, SetRow[]>()
    for (const s of sets) {
      const y = s.year || 0
      if (!map.has(y)) map.set(y, [])
      map.get(y)!.push(s)
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0])
  }, [sets])

  if (sets.length === 0) return null

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
          Sets ({totalCount})
        </h2>
        <Link href={`/setlist?q=${encodeURIComponent(playerName)}`} style={{ fontSize: 13, color: 'var(--jp-accent)', fontWeight: 700, textDecoration: 'none' }}>
          Voir dans le Setlist →
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {byYear.map(([year, yearSets]) => {
          const sport = yearSets[0]?.sport || primarySport
          return (
            <div key={year}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--jp-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{year > 0 ? seasonLabelSingle(year, sport) : 'Année inconnue'}</span>
                <span style={{ color: 'var(--jp-border)', fontSize: 10 }}>— {yearSets.length} set{yearSets.length > 1 ? 's' : ''}</span>
              </div>
              <div className="jp-sets-grid" style={{ display: 'grid', gap: 8 }}>
                {yearSets.map((set) => (
                  <Link key={set.id} href={set.id > 0 ? `/setlist/${set.id}` : `/setlist?q=${encodeURIComponent(set.name)}`} style={{ textDecoration: 'none' }}>
                    <div className="jp-set-hover" style={{ background: 'var(--jp-surface)', borderRadius: 10, padding: '12px 16px', border: '1.5px solid var(--jp-border)', transition: '0.15s', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--jp-text)', lineHeight: 1.3, flex: 1 }}>{set.name}</div>
                        {set.isRc && (
                          <TagIcon kind="rc" h={22} />
                        )}
                      </div>
                      {set.brand && (
                        <div style={{ fontSize: 10, color: 'var(--jp-accent)', fontWeight: 700, marginTop: 4 }}>{set.brand}</div>
                      )}
                      {set.variations.filter((v) => v !== 'Base').length > 0 && (
                        <div style={{ marginTop: 7, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {set.variations.filter((v) => v !== 'Base').slice(0, 4).map((v) => (
                            <span key={v} style={{ fontSize: 9, background: 'rgba(0,61,166,0.07)', color: 'var(--jp-accent)', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>{v}</span>
                          ))}
                          {set.variations.filter((v) => v !== 'Base').length > 4 && (
                            <span style={{ fontSize: 9, color: 'var(--jp-muted)', padding: '2px 4px' }}>+{set.variations.filter((v) => v !== 'Base').length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div ref={sentinelRef} style={{ height: 40, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--jp-muted)' }}>
          {loading ? 'Chargement…' : ''}
        </div>
      )}
    </section>
  )
}
