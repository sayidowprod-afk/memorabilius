'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface EntryWithSet {
  id: number
  set_id: number
  card_number: string | null
  variation: string | null
  is_rc: boolean
  card_sets: { id: number; name: string; year: number | null; brand: string | null; sport: string } | null
}

interface CompletionRow {
  id: string
  manually_checked: boolean
}

interface SetGroup {
  setId: number
  setName: string
  setYear: number | null
  setBrand: string | null
  setSport: string
  entries: EntryWithSet[]
}

type Filter = 'all' | 'owned' | 'missing'

export default function PlayerChecklistSection({ playerName }: { playerName: string }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<EntryWithSet[]>([])
  const [completions, setCompletions] = useState<Map<number, CompletionRow>>(new Map())
  const [saving, setSaving] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openSets, setOpenSets] = useState<Set<number>>(new Set())

  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  const loadData = useCallback(async (uid: string | null) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/player-checklist?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`)
      if (!res.ok) throw new Error('fetch failed')
      const { entries: allEntries } = await res.json() as { entries: EntryWithSet[] }
      setEntries(allEntries)
      const firstSetId = allEntries[0]?.set_id
      if (firstSetId) setOpenSets(new Set([firstSetId]))
      if (uid && allEntries.length > 0) {
        const entryIds = allEntries.map(e => e.id)
        const CHUNK = 500
        const allCompletions: { id: string; entry_id: number; manually_checked: boolean }[] = []
        for (let i = 0; i < entryIds.length; i += CHUNK) {
          const { data: chunk } = await supabase
            .from('user_set_completion')
            .select('id, entry_id, manually_checked')
            .eq('user_id', uid)
            .in('entry_id', entryIds.slice(i, i + CHUNK))
          if (chunk) allCompletions.push(...chunk)
        }
        const map = new Map<number, CompletionRow>()
        for (const c of allCompletions) map.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked })
        setCompletions(map)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [firstName, lastName])

  useEffect(() => {
    if (userId === undefined) return
    loadData(userId)
  }, [userId, loadData])

  async function toggleEntry(entryId: number) {
    if (!userId) return
    const existing = completions.get(entryId)
    setSaving(entryId)
    try {
      if (existing) {
        await supabase.from('user_set_completion').delete().eq('id', existing.id)
        setCompletions(prev => { const n = new Map(prev); n.delete(entryId); return n })
      } else {
        const { data } = await supabase
          .from('user_set_completion')
          .upsert({ user_id: userId, entry_id: entryId, manually_checked: true }, { onConflict: 'user_id,entry_id' })
          .select('id, manually_checked')
          .single()
        if (data) setCompletions(prev => new Map(prev).set(entryId, { id: data.id, manually_checked: data.manually_checked }))
      }
    } finally {
      setSaving(null)
    }
  }

  function toggleSet(setId: number) {
    setOpenSets(prev => {
      const n = new Set(prev)
      if (n.has(setId)) n.delete(setId)
      else n.add(setId)
      return n
    })
  }

  const setGroups: SetGroup[] = []
  const seenSets = new Map<number, SetGroup>()
  for (const entry of entries) {
    const cs = entry.card_sets
    if (!cs) continue
    if (!seenSets.has(entry.set_id)) {
      const g: SetGroup = { setId: entry.set_id, setName: cs.name, setYear: cs.year, setBrand: cs.brand, setSport: cs.sport, entries: [] }
      seenSets.set(entry.set_id, g)
      setGroups.push(g)
    }
    seenSets.get(entry.set_id)!.entries.push(entry)
  }
  setGroups.sort((a, b) => (b.setYear || 0) - (a.setYear || 0))

  const totalOwned = completions.size
  const totalCards = entries.length

  if (userId === undefined) return null

  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
            Checklist
          </h2>
          {!loading && totalCards > 0 && (
            <p style={{ fontSize: 13, color: 'var(--jp-muted)', margin: '4px 0 0', fontWeight: 600 }}>
              {userId
                ? `${totalOwned} / ${totalCards} carte${totalCards > 1 ? 's' : ''} dans ta collection`
                : `${totalCards} carte${totalCards > 1 ? 's' : ''} répertoriées`}
            </p>
          )}
        </div>
        {!loading && totalCards > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'var(--jp-accent)' : 'var(--jp-surface)',
                  color: filter === f ? 'white' : 'var(--jp-text2)',
                  border: '1.5px solid ' + (filter === f ? 'var(--jp-accent)' : 'var(--jp-border)'),
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'Tout' : f === 'owned' ? 'Possédé' : 'Manquant'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--jp-muted)', fontSize: 14 }}>
          Chargement de la checklist…
        </div>
      )}

      {!loading && totalCards === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--jp-muted)', fontSize: 14, background: 'var(--jp-surface)', borderRadius: 12, border: '1.5px solid var(--jp-border)' }}>
          Aucune carte répertoriée pour ce joueur.
        </div>
      )}

      {!loading && !userId && totalCards > 0 && (
        <div style={{ marginBottom: 12, padding: '10px 16px', background: 'var(--jp-surface)', borderRadius: 10, border: '1.5px solid var(--jp-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--jp-muted)', fontSize: 13 }}>Connecte-toi pour cocher tes cartes.</span>
          <Link href="/connexion" style={{ color: 'var(--jp-accent)', fontWeight: 800, fontSize: 13, textDecoration: 'none' }}>Se connecter →</Link>
        </div>
      )}

      {!loading && totalCards > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {userId && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 6, background: 'var(--jp-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(totalOwned / totalCards) * 100}%`,
                  background: 'var(--jp-accent)',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
          {setGroups.length > 8 && (
            <p style={{ fontSize: 11, color: 'var(--jp-muted)', margin: '0 0 4px' }}>
              {setGroups.length} sets · cliquer pour développer
            </p>
          )}
          <div style={{ maxHeight: 520, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
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
                <div key={group.setId} style={{ background: 'var(--jp-surface)', borderRadius: 8, border: '1.5px solid var(--jp-border)', overflow: 'hidden' }}>
                  <button
                    onClick={() => toggleSet(group.setId)}
                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}
                  >
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 12, color: 'var(--jp-text)', lineHeight: 1.3 }}>
                      {group.setYear ? `${group.setYear} ` : ''}{group.setName}
                      {group.setBrand && (
                        <span style={{ fontSize: 10, color: 'var(--jp-accent)', fontWeight: 700, marginLeft: 6 }}>{group.setBrand}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {userId && (
                        <span style={{
                          fontSize: 11, fontWeight: 800,
                          color: ownedInSet === group.entries.length ? '#27ae60' : 'var(--jp-muted)',
                          background: ownedInSet === group.entries.length ? 'rgba(39,174,96,0.12)' : 'var(--jp-surface2)',
                          padding: '2px 8px', borderRadius: 10,
                        }}>
                          {ownedInSet}/{group.entries.length}
                        </span>
                      )}
                      <Link
                        href={`/setlist/${group.setId}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: 'var(--jp-accent)', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        Voir →
                      </Link>
                      <span style={{ color: 'var(--jp-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--jp-border)' }}>
                      {visibleEntries.map(entry => {
                        const owned = completions.has(entry.id)
                        const isSaving = saving === entry.id
                        return (
                          <div
                            key={entry.id}
                            onClick={() => userId && toggleEntry(entry.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '5px 12px', borderBottom: '1px solid var(--jp-border)',
                              cursor: userId ? 'pointer' : 'default',
                              background: owned ? 'rgba(39,174,96,0.06)' : 'transparent',
                            }}
                          >
                            {userId && (
                              <div style={{
                                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                border: owned ? '2px solid #27ae60' : '2px solid var(--jp-border)',
                                background: owned ? '#27ae60' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: isSaving ? 0.5 : 1,
                              }}>
                                {owned && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                              </div>
                            )}
                            {entry.card_number && (
                              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--jp-muted)', minWidth: 32, fontVariantNumeric: 'tabular-nums' }}>
                                #{entry.card_number}
                              </span>
                            )}
                            <span style={{ fontSize: 12, color: owned ? 'var(--jp-text)' : 'var(--jp-text2)', flex: 1, fontWeight: owned ? 700 : 400 }}>
                              {entry.variation || 'Base'}
                            </span>
                            {entry.is_rc && (
                              <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800, flexShrink: 0 }}>RC</span>
                            )}
                          </div>
                        )
                      })}
                      {visibleEntries.length === 0 && (
                        <div style={{ padding: '10px 14px', color: 'var(--jp-muted)', fontSize: 12, textAlign: 'center' }}>
                          Aucune carte {filter === 'owned' ? 'possédée' : 'manquante'} dans ce set.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
