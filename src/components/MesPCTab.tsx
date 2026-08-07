'use client'
import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Card { n: string }

interface EntryWithSet {
  id: number
  set_id: number
  card_number: string | null
  variation: string | null
  is_rc: boolean
  card_sets: { id: number; name: string; year: number | null; brand: string | null; sport: string } | null
}

interface CompletionRow { id: string; manually_checked: boolean }

type Filter = 'all' | 'owned' | 'missing'

export default function MesPCTab({ cards, userId, accent, dark }: {
  cards: Card[]
  userId: string
  accent: string
  dark: boolean
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [entries, setEntries] = useState<EntryWithSet[]>([])
  const [completions, setCompletions] = useState<Map<number, CompletionRow>>(new Map())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [openSets, setOpenSets] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<Filter>('all')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const surface = dark ? '#1a1a2e' : '#ffffff'
  const surface2 = dark ? '#252540' : '#f8f9fc'
  const border = dark ? '#2a2a4a' : '#e8eaf0'
  const text = dark ? '#f0f2f8' : '#111111'
  const muted = dark ? '#666e88' : '#888888'

  const playerNames = useMemo(() => {
    const names = new Set<string>()
    for (const c of cards) { const n = c.n?.trim(); if (n && n.length > 2) names.add(n) }
    return [...names].sort()
  }, [cards])

  const suggestions = useMemo(() => {
    if (!search) return playerNames.slice(0, 12)
    const q = search.toLowerCase()
    return playerNames.filter(n => n.toLowerCase().includes(q)).slice(0, 12)
  }, [playerNames, search])

  const loadChecklist = useCallback(async (name: string) => {
    setLoading(true)
    setEntries([])
    setCompletions(new Map())
    setOpenSets(new Set())
    const parts = name.trim().split(' ')
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    try {
      const res = await fetch(`/api/player-checklist?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`)
      if (!res.ok) throw new Error('fetch failed')
      const { entries: allEntries } = await res.json() as { entries: EntryWithSet[] }
      setEntries(allEntries)
      if (allEntries[0]?.set_id) setOpenSets(new Set([allEntries[0].set_id]))
      if (allEntries.length > 0) {
        const ids = allEntries.map(e => e.id)
        const CHUNK = 500
        const all: { id: string; entry_id: number; manually_checked: boolean }[] = []
        for (let i = 0; i < ids.length; i += CHUNK) {
          const { data } = await supabase.from('user_set_completion')
            .select('id, entry_id, manually_checked').eq('user_id', userId).in('entry_id', ids.slice(i, i + CHUNK))
          if (data) all.push(...data)
        }
        const map = new Map<number, CompletionRow>()
        for (const c of all) map.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked })
        setCompletions(map)
      }
    } catch { } finally { setLoading(false) }
  }, [userId])

  async function toggleEntry(entryId: number) {
    const existing = completions.get(entryId)
    setSaving(entryId)
    try {
      if (existing) {
        await supabase.from('user_set_completion').delete().eq('id', existing.id)
        setCompletions(prev => { const n = new Map(prev); n.delete(entryId); return n })
      } else {
        const { data } = await supabase.from('user_set_completion')
          .upsert({ user_id: userId, entry_id: entryId, manually_checked: true }, { onConflict: 'user_id,entry_id' })
          .select('id, manually_checked').single()
        if (data) setCompletions(prev => new Map(prev).set(entryId, { id: data.id, manually_checked: data.manually_checked }))
      }
    } finally { setSaving(null) }
  }

  function toggleSet(setId: number) {
    setOpenSets(prev => { const n = new Set(prev); if (n.has(setId)) n.delete(setId); else n.add(setId); return n })
  }

  const setGroups = useMemo(() => {
    const groups: { setId: number; setName: string; setYear: number | null; setBrand: string | null; entries: EntryWithSet[] }[] = []
    const seen = new Map<number, typeof groups[0]>()
    for (const e of entries) {
      const cs = e.card_sets; if (!cs) continue
      if (!seen.has(e.set_id)) {
        const g = { setId: e.set_id, setName: cs.name, setYear: cs.year, setBrand: cs.brand, entries: [] as EntryWithSet[] }
        seen.set(e.set_id, g); groups.push(g)
      }
      seen.get(e.set_id)!.entries.push(e)
    }
    return groups.sort((a, b) => (b.setYear || 0) - (a.setYear || 0))
  }, [entries])

  const totalOwned = completions.size
  const totalCards = entries.length

  function selectPlayer(name: string) {
    setSelected(name)
    setSearch(name)
    setShowSuggestions(false)
    loadChecklist(name)
  }

  return (
    <div style={{ padding: '20px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 4px' }}>Mes PC</h2>
        <p style={{ fontSize: 13, color: muted, margin: 0 }}>Suis ta complétion TCDB pour un joueur de ta collection</p>
      </div>

      {/* Player picker */}
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); if (selected) setSelected(null) }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Nom du joueur..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 10,
              border: `2px solid ${selected ? accent : border}`,
              fontSize: 14, fontWeight: 600, outline: 'none',
              background: surface, color: text,
              boxSizing: 'border-box',
            }}
          />
          {(search || selected) && (
            <button
              onClick={() => { setSelected(null); setSearch(''); setEntries([]); setCompletions(new Map()); setShowSuggestions(false) }}
              style={{ padding: '0 14px', borderRadius: 10, border: `1.5px solid ${border}`, background: surface2, color: muted, cursor: 'pointer', fontSize: 18, fontWeight: 400, lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && !selected && suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: surface, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, marginTop: 4, maxHeight: 280, overflowY: 'auto' }}>
            {suggestions.map(name => (
              <button
                key={name}
                onClick={() => selectPlayer(name)}
                style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: text, borderBottom: `1px solid ${border}` }}
              >
                {name}
              </button>
            ))}
            {/* Allow searching outside of collection */}
            {search && !playerNames.some(n => n.toLowerCase() === search.toLowerCase()) && (
              <button
                onClick={() => selectPlayer(search.trim())}
                style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent, borderBottom: `1px solid ${border}` }}
              >
                Rechercher « {search.trim()} »
              </button>
            )}
          </div>
        )}
      </div>

      {/* Checklist */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: muted, fontSize: 14 }}>Chargement…</div>
      )}

      {!loading && selected && totalCards === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: muted, fontSize: 14, background: surface, borderRadius: 12, border: `1.5px solid ${border}` }}>
          Aucune entrée TCDB trouvée pour ce joueur.
        </div>
      )}

      {!loading && totalCards > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: muted }}>
              {totalOwned} / {totalCards} carte{totalCards > 1 ? 's' : ''} cochée{totalOwned > 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'owned', 'missing'] as Filter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? accent : surface2,
                  color: filter === f ? 'white' : muted,
                  border: `1.5px solid ${filter === f ? accent : border}`,
                  borderRadius: 6, padding: '4px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  {f === 'all' ? 'Tout' : f === 'owned' ? 'Possédé' : 'Manquant'}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 6, background: border, borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(totalOwned / totalCards) * 100}%`, background: accent, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>

          {setGroups.length > 8 && (
            <p style={{ fontSize: 11, color: muted, margin: '0 0 8px' }}>{setGroups.length} sets · cliquer pour développer</p>
          )}

          <div style={{ maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
            {setGroups.map(group => {
              const ownedInSet = group.entries.filter(e => completions.has(e.id)).length
              const isOpen = openSets.has(group.setId)
              const visibleEntries = group.entries.filter(e => {
                const owned = completions.has(e.id)
                if (filter === 'owned') return owned
                if (filter === 'missing') return !owned
                return true
              })
              if (filter !== 'all' && visibleEntries.length === 0) return null
              return (
                <div key={group.setId} style={{ background: surface, borderRadius: 8, border: `1.5px solid ${border}`, overflow: 'hidden' }}>
                  <button onClick={() => toggleSet(group.setId)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: text }}>
                      {group.setYear ? `${group.setYear} ` : ''}{group.setName}
                      {group.setBrand && <span style={{ fontSize: 10, color: accent, fontWeight: 700, marginLeft: 6 }}>{group.setBrand}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: ownedInSet === group.entries.length ? '#27ae60' : muted, background: ownedInSet === group.entries.length ? 'rgba(39,174,96,0.12)' : surface2, padding: '2px 8px', borderRadius: 10 }}>
                        {ownedInSet}/{group.entries.length}
                      </span>
                      <Link href={`/setlist/${group.setId}`} onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: accent, fontWeight: 700, textDecoration: 'none' }}>Voir →</Link>
                      <span style={{ color: muted, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${border}` }}>
                      {visibleEntries.map(entry => {
                        const owned = completions.has(entry.id)
                        const isSaving = saving === entry.id
                        return (
                          <div key={entry.id} onClick={() => toggleEntry(entry.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderBottom: `1px solid ${border}`, cursor: 'pointer', background: owned ? 'rgba(39,174,96,0.06)' : 'transparent' }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: owned ? '2px solid #27ae60' : `2px solid ${border}`, background: owned ? '#27ae60' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isSaving ? 0.5 : 1 }}>
                              {owned && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                            </div>
                            {entry.card_number && <span style={{ fontSize: 11, fontWeight: 800, color: muted, minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>#{entry.card_number}</span>}
                            <span style={{ fontSize: 12, color: owned ? text : muted, flex: 1, fontWeight: owned ? 700 : 400 }}>{entry.variation || 'Base'}</span>
                            {entry.is_rc && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800 }}>RC</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {!selected && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: muted }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Suis tes PC</div>
          <div style={{ fontSize: 13 }}>Choisis un joueur pour voir tous ses sets TCDB et cocher les cartes que tu possèdes.</div>
        </div>
      )}
    </div>
  )
}
