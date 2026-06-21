'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Entry {
  id: number
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
  owned: boolean
  manually_checked: boolean
  completion_id: string | null
}

interface CardSet {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
}

export default function SetDetailPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params)
  const [set, setSet] = useState<CardSet | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all')
  const [saving, setSaving] = useState<number | null>(null)
  const [openVariations, setOpenVariations] = useState<Set<string>>(new Set(['Base']))

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  useEffect(() => { loadSet() }, [setId, userId])

  async function loadSet() {
    setLoading(true)
    const { data: setData } = await supabase.from('card_sets').select('*').eq('id', setId).single()
    if (!setData) { setLoading(false); return }
    setSet(setData)

    const { data: entriesData } = await supabase
      .from('card_set_entries').select('*').eq('set_id', setId)

    if (!entriesData) { setLoading(false); return }

    if (!userId) {
      setEntries(entriesData.map(e => ({ ...e, owned: false, manually_checked: false, completion_id: null })))
      setLoading(false)
      return
    }

    const entryIds = entriesData.map(e => e.id)
    const { data: completions } = await supabase
      .from('user_set_completion').select('id, entry_id, manually_checked')
      .eq('user_id', userId).in('entry_id', entryIds)

    const completionMap = new Map(completions?.map(c => [c.entry_id, c]) || [])

    const { data: galleryCards } = await supabase
      .from('cartes_manuelles').select('player_name, year, brand').eq('user_id', userId)

    const normalize = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''

    setEntries(entriesData.map(e => {
      const comp = completionMap.get(e.id)
      let autoMatch = false
      if (!comp && setData.year) {
        autoMatch = (galleryCards || []).some(gc => {
          const samePlayer = normalize(gc.player_name) === normalize(e.player_name)
          const sameYear = gc.year && (gc.year === String(setData.year) || gc.year === `${setData.year - 1}-${String(setData.year).slice(2)}` || gc.year === String(setData.year - 1))
          const sameBrand = !setData.brand || normalize(gc.brand || '') === normalize(setData.brand)
          return samePlayer && sameYear && sameBrand
        })
      }
      return { ...e, owned: !!comp || autoMatch, manually_checked: comp?.manually_checked || false, completion_id: comp?.id || null }
    }))
    setLoading(false)
  }

  async function toggleOwned(entry: Entry) {
    if (!userId) return
    setSaving(entry.id)
    if (entry.owned && entry.completion_id) {
      await supabase.from('user_set_completion').delete().eq('id', entry.completion_id)
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, owned: false, manually_checked: false, completion_id: null } : e))
    } else {
      const { data } = await supabase.from('user_set_completion').insert({ user_id: userId, entry_id: entry.id, manually_checked: true }).select('id').single()
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, owned: true, manually_checked: true, completion_id: data?.id || null } : e))
    }
    setSaving(null)
  }

  function toggleVariation(v: string) {
    setOpenVariations(prev => {
      const next = new Set(prev)
      next.has(v) ? next.delete(v) : next.add(v)
      return next
    })
  }

  // Grouper par variation, Base en premier puis tri alphabétique
  const variations = ['Base', ...Array.from(new Set(entries.filter(e => e.variation).map(e => e.variation!))).sort()]

  const owned = entries.filter(e => e.owned).length
  const pct = entries.length ? Math.round((owned / entries.length) * 100) : 0

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
  if (!set) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Set introuvable.</div>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← Setlist NBA</Link>
      </div>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: 16, padding: '24px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>{set.name}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: userId ? 16 : 0 }}>
          {set.year && <span style={{ fontSize: 13, color: '#888', fontWeight: 700 }}>{set.year}</span>}
          {set.brand && <span style={{ fontSize: 13, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 6, padding: '2px 8px' }}>{set.brand}</span>}
          <span style={{ fontSize: 13, color: '#aaa' }}>{entries.length} cartes · {variations.length} variations</span>
        </div>
        {userId && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{owned} / {entries.length} possédées</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: pct === 100 ? '#2ecc71' : '#003DA6' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </div>
        )}
        {!userId && <div style={{ fontSize: 13, color: '#888' }}><Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>Connectez-vous</Link> pour tracker votre complétion</div>}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur..."
          style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
        {userId && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '10px 16px', border: '1.5px solid', borderColor: filter === f ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: filter === f ? '#003DA6' : 'white', color: filter === f ? 'white' : '#333' }}>
                {f === 'all' ? 'Tout' : f === 'owned' ? '✓ Possédées' : '✗ Manquantes'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {variations.map(variation => {
          const varEntries = entries.filter(e => (e.variation || 'Base') === variation)
          const filtered = varEntries.filter(e => {
            if (search && !e.player_name.toLowerCase().includes(search.toLowerCase())) return false
            if (filter === 'owned' && !e.owned) return false
            if (filter === 'missing' && e.owned) return false
            return true
          })
          if (search && filtered.length === 0) return null
          if (filter !== 'all' && filtered.length === 0) return null

          const varOwned = varEntries.filter(e => e.owned).length
          const varPct = varEntries.length ? Math.round((varOwned / varEntries.length) * 100) : 0
          const isOpen = openVariations.has(variation)

          return (
            <div key={variation} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
              {/* Header variation */}
              <button onClick={() => toggleVariation(variation)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111', flex: 1 }}>{variation}</span>
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{varEntries.length} cartes</span>
                {userId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${varPct}%`, background: varPct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: varPct === 100 ? '#2ecc71' : '#003DA6', minWidth: 36, textAlign: 'right' }}>{varPct}%</span>
                  </div>
                )}
                <span style={{ fontSize: 12, color: '#bbb', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Cartes */}
              {isOpen && (
                <div style={{ borderTop: '1px solid #f5f5f5' }}>
                  {/* Header colonnes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 36px', gap: 0, padding: '8px 18px', background: '#fafafa', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#bbb', letterSpacing: '0.5px' }}>
                    <span>#</span><span>Joueur</span><span>Équipe</span><span></span>
                  </div>
                  {(search || filter !== 'all' ? filtered : varEntries)
                    .sort((a, b) => {
                      const na = parseInt(a.card_number || '9999')
                      const nb = parseInt(b.card_number || '9999')
                      return na - nb
                    })
                    .map((entry, i, arr) => (
                      <div key={entry.id}
                        style={{ display: 'grid', gridTemplateColumns: '52px 1fr 140px 36px', gap: 0, padding: '9px 18px', borderTop: '1px solid #f5f5f5', background: entry.owned ? '#f5fff7' : 'white', alignItems: 'center', transition: 'background 0.15s' }}>
                        <span style={{ fontSize: 12, color: '#bbb', fontWeight: 700 }}>{entry.card_number || '—'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span style={{ fontSize: 14, fontWeight: entry.owned ? 700 : 400, color: entry.owned ? '#111' : '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.player_name}</span>
                          {entry.is_rc && <span style={{ fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>RC</span>}
                          {entry.manually_checked && <span style={{ fontSize: 10, color: '#2ecc71', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.team || '—'}</span>
                        {userId ? (
                          <button onClick={() => toggleOwned(entry)} disabled={saving === entry.id}
                            style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid', borderColor: entry.owned ? '#2ecc71' : '#ddd', background: entry.owned ? '#2ecc71' : 'white', color: entry.owned ? 'white' : '#ccc', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', opacity: saving === entry.id ? 0.5 : 1 }}>
                            ✓
                          </button>
                        ) : <span />}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#aaa' }}>
        {entries.length} cartes · {variations.length} variations
      </div>
    </div>
  )
}
