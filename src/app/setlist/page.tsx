'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface CardSet {
  id: number
  tcdb_id: number | null
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
  owned?: number
  pct?: number
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#2ecc71' : pct >= 40 ? '#f39c12' : pct > 0 ? '#3498db' : '#e0e0e0'
  return (
    <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function seasonLabel(year: number) {
  return `${year}-${String(year + 1).slice(2)}`
}

export default function SetlistPage() {
  const [sets, setSets] = useState<CardSet[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeSeason, setActiveSeason] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  const loadSets = useCallback(async () => {
    setLoading(true)
    const { data: setsData } = await supabase
      .from('card_sets')
      .select('id, tcdb_id, name, year, brand, sport, total_cards')
      .eq('sport', 'nba')
      .order('year', { ascending: false })

    if (!setsData) { setLoading(false); return }

    if (!userId) {
      setSets(setsData.map(s => ({ ...s, owned: 0, pct: 0 })))
      // Sélectionner la saison la plus récente par défaut
      const mostRecent = setsData[0]?.year
      if (mostRecent) setActiveSeason(mostRecent)
      setLoading(false)
      return
    }

    const { data: completions } = await supabase
      .from('user_set_completion')
      .select('entry_id, card_set_entries(set_id)')
      .eq('user_id', userId)

    const countBySet = new Map<number, number>()
    completions?.forEach((c: any) => {
      const setId = c.card_set_entries?.set_id
      if (setId) countBySet.set(setId, (countBySet.get(setId) || 0) + 1)
    })

    const enriched = setsData.map(s => {
      const owned = countBySet.get(s.id) || 0
      const pct = s.total_cards > 0 ? Math.round((owned / s.total_cards) * 100) : 0
      return { ...s, owned, pct }
    })
    setSets(enriched)
    const mostRecent = setsData[0]?.year
    if (mostRecent) setActiveSeason(mostRecent)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadSets() }, [loadSets])

  // Saisons disponibles (triées desc)
  const seasons = Array.from(new Set(sets.map(s => s.year).filter(Boolean) as number[])).sort((a, b) => b - a)
  const seasonSets = sets.filter(s => s.year === activeSeason).sort((a, b) => a.name.localeCompare(b.name))

  const totalOwned = seasonSets.reduce((acc, s) => acc + (s.owned || 0), 0)
  const totalCards = seasonSets.reduce((acc, s) => acc + s.total_cards, 0)
  const seasonPct = totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 4 }}>Setlist NBA</h1>
        <p style={{ color: '#888', fontSize: 15 }}>{loading ? '...' : `${sets.length} collections disponibles`}</p>
      </div>

      {/* Boutons de saison */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          {seasons.map(year => {
            const isActive = activeSeason === year
            const ssets = sets.filter(s => s.year === year)
            const sOwned = ssets.reduce((a, s) => a + (s.owned || 0), 0)
            const sTotal = ssets.reduce((a, s) => a + s.total_cards, 0)
            const sPct = sTotal > 0 ? Math.round((sOwned / sTotal) * 100) : 0
            return (
              <button key={year} onClick={() => setActiveSeason(year)} style={{
                padding: '14px 22px', borderRadius: 14, border: '2.5px solid',
                borderColor: isActive ? '#003DA6' : '#e0e0e0',
                background: isActive ? '#003DA6' : 'white',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                minWidth: 90,
              }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: isActive ? 'white' : '#111' }}>
                  {seasonLabel(year)}
                </span>
                <span style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.75)' : '#aaa', fontWeight: 600 }}>
                  {ssets.length} sets
                </span>
                {userId && sPct > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#7eb8ff' : '#003DA6' }}>
                    {sPct}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Header de la saison active */}
      {activeSeason && !loading && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 900, fontSize: 20, color: '#111' }}>Saison {seasonLabel(activeSeason)}</span>
            <span style={{ color: '#aaa', fontSize: 14, marginLeft: 10 }}>{seasonSets.length} collections · {totalCards.toLocaleString()} cartes</span>
          </div>
          {userId && totalCards > 0 && (
            <span style={{ fontWeight: 900, fontSize: 16, color: seasonPct === 100 ? '#2ecc71' : '#003DA6' }}>{seasonPct}% complété</span>
          )}
        </div>
      )}

      {/* Grille des sets */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
      ) : seasonSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Aucune collection pour cette saison.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {seasonSets.map(set => (
            <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ background: 'white', borderRadius: 14, padding: '18px 20px', border: '1.5px solid #f0f0f0', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s', height: '100%', boxSizing: 'border-box' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#003DA6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#111', lineHeight: 1.3, flex: 1, marginRight: 8 }}>
                    {set.name}
                  </div>
                  {set.pct !== undefined && set.pct > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 900, color: set.pct === 100 ? '#2ecc71' : '#003DA6', whiteSpace: 'nowrap' }}>
                      {set.pct}%
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {set.brand && (
                    <span style={{ fontSize: 11, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 4, padding: '2px 7px' }}>
                      {set.brand}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#aaa' }}>{set.total_cards.toLocaleString()} cartes</span>
                </div>
                {userId && (
                  <>
                    <CompletionBar pct={set.pct || 0} />
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {(set.owned || 0).toLocaleString()} / {set.total_cards.toLocaleString()} possédées
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
