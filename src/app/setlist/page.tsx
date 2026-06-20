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

const BRANDS = ['Panini', 'Topps', 'Upper Deck', 'Fleer', 'Donruss', 'SkyBox', 'Hoops', 'Score']
const DECADES = [
  { label: 'Années 50-80', min: 1950, max: 1989 },
  { label: 'Années 90', min: 1990, max: 1999 },
  { label: 'Années 2000', min: 2000, max: 2009 },
  { label: 'Années 2010', min: 2010, max: 2019 },
  { label: 'Années 2020+', min: 2020, max: 2099 },
]

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#2ecc71' : pct >= 40 ? '#f39c12' : pct > 0 ? '#3498db' : '#e0e0e0'
  return (
    <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

export default function SetlistPage() {
  const [sets, setSets] = useState<CardSet[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterDecade, setFilterDecade] = useState('')
  const [sortBy, setSortBy] = useState<'year' | 'name' | 'pct'>('year')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
    })
  }, [])

  const loadSets = useCallback(async () => {
    setLoading(true)

    // Récupérer tous les sets NBA
    const { data: setsData, error } = await supabase
      .from('card_sets')
      .select('id, tcdb_id, name, year, brand, sport, total_cards')
      .eq('sport', 'nba')
      .order('year', { ascending: false })

    if (error || !setsData) { setLoading(false); return }

    if (!userId) {
      setSets(setsData.map(s => ({ ...s, owned: 0, pct: 0 })))
      setLoading(false)
      return
    }

    // Récupérer les completions de l'utilisateur
    const { data: completions } = await supabase
      .from('user_set_completion')
      .select('entry_id, card_set_entries(set_id)')
      .eq('user_id', userId)

    // Compter par set
    const countBySet = new Map<number, number>()
    completions?.forEach((c: any) => {
      const setId = c.card_set_entries?.set_id
      if (setId) countBySet.set(setId, (countBySet.get(setId) || 0) + 1)
    })

    setSets(setsData.map(s => {
      const owned = countBySet.get(s.id) || 0
      const pct = s.total_cards > 0 ? Math.round((owned / s.total_cards) * 100) : 0
      return { ...s, owned, pct }
    }))
    setLoading(false)
  }, [userId])

  useEffect(() => { loadSets() }, [loadSets])

  // Filtrage + tri
  const filtered = sets
    .filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterBrand && s.brand !== filterBrand) return false
      if (filterDecade) {
        const dec = DECADES.find(d => d.label === filterDecade)
        if (dec && s.year !== null && (s.year < dec.min || s.year > dec.max)) return false
      }
      return true
    })
    .sort((a, b) => {
      let diff = 0
      if (sortBy === 'year') diff = (a.year || 0) - (b.year || 0)
      else if (sortBy === 'name') diff = a.name.localeCompare(b.name)
      else if (sortBy === 'pct') diff = (a.pct || 0) - (b.pct || 0)
      return sortDir === 'desc' ? -diff : diff
    })

  const stats = {
    total: sets.length,
    withCards: sets.filter(s => (s.owned || 0) > 0).length,
    complete: sets.filter(s => (s.pct || 0) === 100).length,
  }

  function toggleSort(col: 'year' | 'name' | 'pct') {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 6 }}>Setlist NBA</h1>
        <p style={{ color: '#888', fontSize: 15 }}>
          {loading ? '...' : `${stats.total} sets · ${stats.withCards} en cours · ${stats.complete} complétés`}
        </p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un set..."
          style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, background: 'white', cursor: 'pointer' }}>
          <option value="">Toutes marques</option>
          {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterDecade} onChange={e => setFilterDecade(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, background: 'white', cursor: 'pointer' }}>
          <option value="">Toutes époques</option>
          {DECADES.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['year', 'name', 'pct'] as const).map(col => (
            <button key={col} onClick={() => toggleSort(col)}
              style={{ padding: '10px 14px', border: '1.5px solid', borderColor: sortBy === col ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: sortBy === col ? '#003DA6' : 'white', color: sortBy === col ? 'white' : '#333' }}>
              {col === 'year' ? 'Année' : col === 'name' ? 'Nom' : 'Complétion'}
              {sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          {sets.length === 0
            ? <>Aucun set importé.<br /><span style={{ fontSize: 13 }}>Lance d'abord <code>node scripts/scrape-tcdb-nba.js</code></span></>
            : 'Aucun set ne correspond aux filtres.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(set => (
            <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'white', borderRadius: 12, padding: '16px 18px',
                border: '1.5px solid #f0f0f0', cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#003DA6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#111', lineHeight: 1.3, flex: 1, marginRight: 8 }}>
                    {set.name}
                  </div>
                  {set.pct !== undefined && set.pct > 0 && (
                    <div style={{ fontSize: 13, fontWeight: 900, color: set.pct === 100 ? '#2ecc71' : '#003DA6', whiteSpace: 'nowrap' }}>
                      {set.pct}%
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {set.year && <span style={{ fontSize: 11, color: '#888', fontWeight: 700 }}>{set.year}</span>}
                  {set.brand && <span style={{ fontSize: 11, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 4, padding: '1px 6px' }}>{set.brand}</span>}
                  <span style={{ fontSize: 11, color: '#aaa' }}>{set.total_cards} cartes</span>
                </div>
                {userId && set.owned !== undefined && (
                  <>
                    <CompletionBar pct={set.pct || 0} />
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {set.owned}/{set.total_cards} cartes possédées
                    </div>
                  </>
                )}
                {!userId && (
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
                    Connectez-vous pour voir votre complétion
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
