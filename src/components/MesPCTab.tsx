'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Card {
  f: string; b: string; n: string; t: string; s: string; y: string
  br: string; v: string; num: string; auto: boolean; rc: boolean; patch: boolean
}

interface EntryWithSet {
  id: number; set_id: number; card_number: string | null; variation: string | null; is_rc: boolean
  card_sets: { id: number; name: string; year: number | null; brand: string | null; sport: string } | null
}

interface CompletionRow { id: string; manually_checked: boolean }

type PCType = 'player' | 'team' | 'collection'
type Filter = 'all' | 'owned' | 'missing'

interface PCEntry {
  id: string; type: PCType; name: string
  firstName?: string; lastName?: string; addedAt: number
}

interface PlayerStats { total: number; owned: number; loading: boolean }

const TYPE_LABEL: Record<PCType, string> = { player: 'Joueur', team: 'Équipe', collection: 'Collection' }
const TYPE_COLOR: Record<PCType, string> = { player: '#3b82f6', team: '#10b981', collection: '#f59e0b' }

function getBestCard(pool: Card[]): Card | undefined {
  const withImg = pool.filter(c => c.f)
  if (!withImg.length) return pool[0]
  const score = (c: Card) => {
    let s = 0
    if (c.auto) s += 100000
    const n = c.num ? parseInt(c.num) : null
    if (n && n > 0) s += 10000 - Math.min(n, 9999)
    return s
  }
  return [...withImg].sort((a, b) => score(b) - score(a))[0]
}

// ── Inline checklist — explicit colors, no CSS vars ───────────────────────────
function PlayerChecklist({ pc, userId, bg, bg2, border, text, muted, accent }: {
  pc: PCEntry; userId: string; bg: string; bg2: string; border: string; text: string; muted: string; accent: string
}) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<EntryWithSet[]>([])
  const [completions, setCompletions] = useState<Map<number, CompletionRow>>(new Map())
  const [saving, setSaving] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openSets, setOpenSets] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setEntries([]); setCompletions(new Map()); setOpenSets(new Set())
      try {
        const res = await fetch(
          `/api/player-checklist?firstName=${encodeURIComponent(pc.firstName || '')}&lastName=${encodeURIComponent(pc.lastName || '')}`
        )
        if (!res.ok) throw new Error()
        const { entries: all } = await res.json() as { entries: EntryWithSet[] }
        if (cancelled) return
        setEntries(all)
        if (all[0]?.set_id) setOpenSets(new Set([all[0].set_id]))
        if (userId && all.length > 0) {
          const ids = all.map(e => e.id)
          const allComp: { id: string; entry_id: number; manually_checked: boolean }[] = []
          for (let i = 0; i < ids.length; i += 500) {
            const { data } = await supabase.from('user_set_completion')
              .select('id, entry_id, manually_checked')
              .eq('user_id', userId).in('entry_id', ids.slice(i, i + 500))
            if (data) allComp.push(...data)
          }
          if (cancelled) return
          const map = new Map<number, CompletionRow>()
          for (const c of allComp) map.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked })
          setCompletions(map)
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [pc.firstName, pc.lastName, userId])

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
  const pct = totalCards > 0 ? (totalOwned / totalCards) * 100 : 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: text, margin: 0 }}>Checklist — {pc.name}</h2>
          {!loading && totalCards > 0 && (
            <p style={{ fontSize: 13, color: muted, margin: '4px 0 0', fontWeight: 600 }}>
              {totalOwned} / {totalCards} cartes ({Math.round(pct)}%)
            </p>
          )}
        </div>
        {!loading && totalCards > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? accent : bg2, color: filter === f ? 'white' : muted,
                border: `1.5px solid ${filter === f ? accent : border}`,
                borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>
                {f === 'all' ? 'Tout' : f === 'owned' ? 'Possédé' : 'Manquant'}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: muted, fontSize: 14 }}>Chargement de la checklist…</div>}
      {!loading && totalCards === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: muted, background: bg2, borderRadius: 12, border: `1.5px solid ${border}`, fontSize: 14 }}>
          Aucune carte répertoriée pour ce joueur.
        </div>
      )}
      {!loading && totalCards > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 6, background: border, borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#27ae60' : accent, borderRadius: 3, transition: 'width 0.4s' }} />
          </div>
          {setGroups.length > 8 && (
            <p style={{ fontSize: 11, color: muted, margin: '0 0 4px' }}>{setGroups.length} sets · cliquer pour développer</p>
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
                <div key={group.setId} style={{ background: bg2, borderRadius: 8, border: `1.5px solid ${border}`, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => toggleSet(group.setId)} style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8,
                    color: text,
                  }}>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 12, color: text, lineHeight: 1.3 }}>
                      {group.setYear ? `${group.setYear} ` : ''}{group.setName}
                      {group.setBrand && <span style={{ fontSize: 10, color: accent, fontWeight: 700, marginLeft: 6 }}>{group.setBrand}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10,
                        color: ownedInSet === group.entries.length ? '#27ae60' : muted,
                        background: ownedInSet === group.entries.length ? 'rgba(39,174,96,0.12)' : bg,
                      }}>{ownedInSet}/{group.entries.length}</span>
                      <Link href={`/setlist/${group.setId}`} onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, color: accent, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Voir →
                      </Link>
                      <span style={{ color: muted, fontSize: 11 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ borderTop: `1px solid ${border}` }}>
                      {visibleEntries.map(entry => {
                        const owned = completions.has(entry.id)
                        return (
                          <div key={entry.id} onClick={() => toggleEntry(entry.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px',
                            borderBottom: `1px solid ${border}`, cursor: 'pointer',
                            background: owned ? 'rgba(39,174,96,0.08)' : 'transparent',
                          }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                              border: owned ? '2px solid #27ae60' : `2px solid ${border}`,
                              background: owned ? '#27ae60' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              opacity: saving === entry.id ? 0.5 : 1, transition: 'all 0.15s',
                            }}>
                              {owned && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
                            </div>
                            {entry.card_number && (
                              <span style={{ fontSize: 11, fontWeight: 800, color: muted, minWidth: 32 }}>#{entry.card_number}</span>
                            )}
                            <span style={{ fontSize: 12, color: owned ? text : muted, flex: 1, fontWeight: owned ? 700 : 400 }}>
                              {entry.variation || 'Base'}
                            </span>
                            {entry.is_rc && (
                              <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800, flexShrink: 0 }}>RC</span>
                            )}
                          </div>
                        )
                      })}
                      {visibleEntries.length === 0 && (
                        <div style={{ padding: '10px 14px', color: muted, fontSize: 12, textAlign: 'center' }}>
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
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MesPCTab({ cards, cardsLoaded = true, userId, accent, dark, isOwner, initialPCs }: {
  cards: Card[]; cardsLoaded?: boolean; userId: string; accent: string; dark: boolean; isOwner: boolean; initialPCs?: PCEntry[]
}) {
  const storageKey = `memorabilius_pcs_${userId}`
  const [pcs, setPCs]   = useState<PCEntry[]>([])
  const [pStats, setPStats] = useState<Map<string, PlayerStats>>(new Map())
  const [selected, setSelected] = useState<PCEntry | null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [addType, setAddType]   = useState<PCType>('player')
  const [addSearch, setAddSearch] = useState('')
  const [showSug, setShowSug]   = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bg     = dark ? '#1a1a2e' : '#ffffff'
  const bg2    = dark ? '#252540' : '#f8f9fc'
  const border = dark ? '#2a2a4a' : '#e8eaf0'
  const text   = dark ? '#f0f2f8' : '#111111'
  const muted  = dark ? '#666e88' : '#888888'

  useEffect(() => {
    if (initialPCs?.length) { setPCs(initialPCs); return }
    try { const s = localStorage.getItem(storageKey); if (s) setPCs(JSON.parse(s)) } catch {}
  }, [storageKey, initialPCs])

  async function savePCs(next: PCEntry[]) {
    setPCs(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
    if (isOwner) {
      supabase.from('profiles').update({ pcs: next } as any).eq('id', userId)
        .then(({ error }) => { if (error) console.warn('pcs sync:', error.message) })
    }
  }

  const fetchPlayerStats = useCallback(async (pc: PCEntry) => {
    setPStats(prev => new Map(prev).set(pc.id, { total: 0, owned: 0, loading: true }))
    try {
      // Fallback: extraire depuis pc.name si firstName/lastName absent (ancien PC sans ces champs)
      const parts = pc.name.trim().split(' ')
      const firstName = pc.firstName || parts[0] || ''
      const lastName  = pc.lastName  || parts[parts.length - 1] || ''
      const res = await fetch(
        `/api/player-checklist?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`
      )
      if (!res.ok) throw new Error()
      const { entries } = await res.json() as { entries: { id: number }[] }
      const total = entries.length
      let owned = 0
      if (total > 0) {
        const ids = entries.map(e => e.id)
        for (let i = 0; i < ids.length; i += 500) {
          const { data } = await supabase.from('user_set_completion')
            .select('id').eq('user_id', userId).in('entry_id', ids.slice(i, i + 500))
          owned += data?.length ?? 0
        }
      }
      setPStats(prev => new Map(prev).set(pc.id, { total, owned, loading: false }))
    } catch {
      setPStats(prev => new Map(prev).set(pc.id, { total: 0, owned: 0, loading: false }))
    }
  }, [userId])

  useEffect(() => {
    for (const pc of pcs) {
      if (pc.type === 'player' && !pStats.has(pc.id)) fetchPlayerStats(pc)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcs])

  const playerNames     = useMemo(() => [...new Set(cards.map(c => c.n?.trim()).filter(Boolean))].sort(), [cards])
  const teamNames       = useMemo(() => [...new Set(cards.map(c => c.t?.trim()).filter(Boolean))].sort(), [cards])
  const collectionNames = useMemo(() => [...new Set(cards.map(c => c.s?.trim()).filter(Boolean))].sort(), [cards])

  const sourceNames = addType === 'player' ? playerNames : addType === 'team' ? teamNames : collectionNames
  const suggestions = useMemo(() => {
    if (!addSearch) return sourceNames.slice(0, 14)
    const q = addSearch.toLowerCase()
    return sourceNames.filter(n => n.toLowerCase().includes(q)).slice(0, 14)
  }, [sourceNames, addSearch])

  function getPool(pc: PCEntry) {
    const name = pc.name.toLowerCase()
    if (pc.type === 'player') return cards.filter(c => c.n?.trim().toLowerCase() === name)
    if (pc.type === 'collection') return cards.filter(c => c.s?.trim().toLowerCase() === name)
    // Équipe : cartes directement taguées avec cette équipe + cartes SANS champ équipe
    // pour des joueurs connus de cette équipe (couvre les vieux sets sans team renseigné).
    // Ne jamais inclure une carte taguée avec une AUTRE équipe même si le joueur est connu.
    const directMatch = (c: Card) => c.t?.trim().toLowerCase() === name
    const teamPlayers = new Set(cards.filter(directMatch).map(c => c.n?.trim().toLowerCase()).filter(Boolean))
    return cards.filter(c => directMatch(c) || (!c.t?.trim() && c.n && teamPlayers.has(c.n.trim().toLowerCase())))
  }

  function getTeamCollStats(pc: PCEntry) {
    const pool = getPool(pc)
    const sets = new Set(pool.map(c => c.s)).size
    const years = [...new Set(pool.map(c => c.y).filter(Boolean))].map(Number).filter(n => !isNaN(n))
    const yearStr = years.length === 0 ? '' : years.length === 1 ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`
    return { count: pool.length, sets, yearStr, pool }
  }

  function addPC(name: string) {
    const trimmed = name.trim(); if (!trimmed) return
    if (pcs.some(p => p.type === addType && p.name.toLowerCase() === trimmed.toLowerCase())) {
      setShowAdd(false); setAddSearch(''); return
    }
    const parts = trimmed.split(' ')
    const entry: PCEntry = {
      id: `${addType}_${trimmed.replace(/\s+/g, '_')}_${Date.now()}`,
      type: addType, name: trimmed,
      firstName: addType === 'player' ? parts[0] : undefined,
      lastName:  addType === 'player' ? parts[parts.length - 1] : undefined,
      addedAt: Date.now(),
    }
    const next = [...pcs, entry]
    savePCs(next)
    if (addType === 'player') fetchPlayerStats(entry)
    setShowAdd(false); setAddSearch('')
  }

  function removePC(id: string) {
    if (selected?.id === id) setSelected(null)
    savePCs(pcs.filter(p => p.id !== id))
    setPStats(prev => { const n = new Map(prev); n.delete(id); return n })
  }

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx) }
  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return }
    const next = [...pcs]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(targetIdx, 0, moved)
    savePCs(next)
    setDragIdx(null); setDragOverIdx(null)
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null) }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const { pool, count } = getTeamCollStats(selected)
    return (
      <div style={{ padding: '12px 0' }}>
        <button onClick={() => setSelected(null)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, background: bg2,
          border: `1.5px solid ${border}`, color: muted,
          fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16,
        }}>← Retour aux PCs</button>

        {selected.type === 'player' ? (
          <PlayerChecklist pc={selected} userId={userId} accent={accent} bg={bg} bg2={bg2} border={border} text={text} muted={muted} />
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 2px' }}>{selected.name}</h2>
              <p style={{ fontSize: 12, color: muted, margin: 0 }}>{count} carte{count > 1 ? 's' : ''} dans ta collection</p>
            </div>
            {pool.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, background: bg2, borderRadius: 12, border: `1.5px solid ${border}`, color: muted, fontSize: 14 }}>
                Aucune carte dans ta collection
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 600, overflowY: 'auto' }}>
                {pool.map((card, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: bg, borderRadius: 8, border: `1px solid ${border}` }}>
                    {card.f && <img src={card.f} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.n}</div>
                      <div style={{ fontSize: 11, color: muted }}>{card.y && `${card.y} `}{card.s}{card.v ? ` · ${card.v}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {card.rc   && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800 }}>RC</span>}
                      {card.auto && <span style={{ fontSize: 9, background: '#3b82f6', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800 }}>AUTO</span>}
                      {card.patch && <span style={{ fontSize: 9, background: '#8b5cf6', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800 }}>PATCH</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Grid view ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 2px' }}>PCs</h2>
          <p style={{ fontSize: 12, color: muted, margin: 0 }}>
            {pcs.length === 0
              ? (isOwner ? 'Ajoute ce que tu collectionnes' : 'Aucun PC partagé')
              : `${pcs.length} PC${pcs.length > 1 ? 's' : ''} suivi${pcs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        {isOwner && (
          <button onClick={() => { setShowAdd(!showAdd); setAddSearch('') }} style={{
            padding: '9px 16px', background: showAdd ? bg2 : accent,
            color: showAdd ? muted : 'white', border: `1.5px solid ${showAdd ? border : accent}`,
            borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13,
          }}>{showAdd ? '✕ Annuler' : '+ Ajouter'}</button>
        )}
      </div>

      {showAdd && isOwner && (
        <div style={{ marginBottom: 20, background: bg2, borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${border}`, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['player', 'team', 'collection'] as PCType[]).map(t => (
              <button key={t} onClick={() => { setAddType(t); setAddSearch('') }} style={{
                padding: '5px 14px', borderRadius: 20, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                background: addType === t ? TYPE_COLOR[t] : bg,
                color: addType === t ? 'white' : muted,
                border: `1.5px solid ${addType === t ? TYPE_COLOR[t] : border}`,
              }}>{TYPE_LABEL[t]}</button>
            ))}
          </div>
          <input
            autoFocus value={addSearch}
            onChange={e => { setAddSearch(e.target.value); setShowSug(true) }}
            onFocus={() => setShowSug(true)}
            onBlur={() => { blurTimer.current = setTimeout(() => setShowSug(false), 150) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && addSearch.trim()) addPC(addSearch)
              if (e.key === 'Escape') { setShowAdd(false); setAddSearch('') }
            }}
            placeholder={addType === 'player' ? 'Ex: Joel Embiid, Luka Doncic…' : addType === 'team' ? 'Ex: Philadelphia 76ers…' : 'Ex: Prizm 2023-24…'}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `2px solid ${accent}`, fontSize: 14, fontWeight: 600, background: bg, color: text, outline: 'none', boxSizing: 'border-box' }}
          />
          {showSug && !cardsLoaded && cards.length === 0 && !addSearch.trim() && (
            <div style={{ position: 'absolute', top: 'calc(100% - 6px)', left: 16, right: 16, background: bg, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', zIndex: 60, padding: '12px 14px', fontSize: 13, color: muted, fontStyle: 'italic' }}>
              Chargement de la galerie…
            </div>
          )}
          {showSug && (cardsLoaded || addSearch.trim()) && (suggestions.length > 0 || addSearch.trim()) && (
            <div style={{ position: 'absolute', top: 'calc(100% - 6px)', left: 16, right: 16, background: bg, border: `1.5px solid ${border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,0.14)', zIndex: 60, maxHeight: 260, overflowY: 'auto' }}>
              {suggestions.map(name => (
                <button key={name}
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(name)}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${border}`, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: text }}
                >{name}</button>
              ))}
              {addSearch.trim() && !sourceNames.some(n => n.toLowerCase() === addSearch.toLowerCase()) && (
                <button
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(addSearch.trim())}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent }}
                >Ajouter « {addSearch.trim()} »</button>
              )}
            </div>
          )}
        </div>
      )}

      {pcs.length === 0 && !showAdd && isOwner && (
        <div style={{ textAlign: 'center', padding: '52px 24px', background: bg2, borderRadius: 16, border: `2px dashed ${border}` }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: 6 }}>Aucun PC suivi</div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>Joueur, équipe ou collection — suis tes cartes</div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 22px', background: accent, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>+ Ajouter</button>
        </div>
      )}

      {pcs.length === 0 && !isOwner && (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: muted, fontSize: 14 }}>
          Aucun PC partagé pour l&apos;instant.
        </div>
      )}

      {pcs.length > 0 && (
        <div>
          {isOwner && pcs.length > 1 && (
            <p style={{ fontSize: 11, color: muted, marginBottom: 10, marginTop: -8 }}>⠿ Glisser pour réordonner</p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
            {pcs.map((pc, idx) => {
              const pool = getPool(pc)
              const bestCard = getBestCard(pool)
              const photo = bestCard?.f
              const initials = pc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              const badgeColor = TYPE_COLOR[pc.type]
              const s = pStats.get(pc.id)
              const { count, sets, yearStr } = getTeamCollStats(pc)
              const isDragging = dragIdx === idx
              const isOver = dragOverIdx === idx && dragIdx !== idx

              let statLine = ''; let sub = ''; let pct = 0; let done = false
              if (pc.type === 'player') {
                if (s?.loading) { statLine = '…'; sub = 'Calcul en cours' }
                else if (s && s.total > 0) {
                  pct = (count / s.total) * 100; done = count >= s.total
                  statLine = `${count} / ${s.total}`
                  sub = `${Math.round(pct)}% complété`
                } else if (s) { statLine = '—'; sub = 'Non répertorié' }
              } else if (pc.type === 'team') {
                statLine = String(count); sub = `${sets} set${sets > 1 ? 's' : ''}`
              } else {
                statLine = String(count); sub = yearStr || 'Collection'
              }

              return (
                <div
                  key={pc.id}
                  draggable={isOwner}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background: bg, border: `1.5px solid ${isOver ? accent : border}`,
                    borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                    position: 'relative', cursor: isOwner ? 'grab' : 'default',
                    opacity: isDragging ? 0.4 : 1,
                    transform: isOver ? 'scale(1.02)' : 'none',
                    transition: 'transform 0.15s, opacity 0.15s, border-color 0.15s',
                    boxShadow: dark ? 'none' : '0 2px 10px rgba(0,0,0,0.07)',
                  }}
                >
                  {isOwner && (
                    <button onClick={() => removePC(pc.id)} title="Retirer" style={{
                      position: 'absolute', top: 8, right: 8, zIndex: 2,
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
                      color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>×</button>
                  )}
                  <div style={{ height: 120, background: bg2, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                    {photo ? (
                      <img src={photo} alt={pc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${badgeColor}18` }}>
                        <span style={{ fontSize: 40, fontWeight: 900, color: badgeColor, opacity: 0.5 }}>{initials}</span>
                      </div>
                    )}
                    <span style={{
                      position: 'absolute', bottom: 6, left: 8, background: badgeColor, color: 'white',
                      fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{TYPE_LABEL[pc.type]}</span>
                  </div>
                  <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pc.name}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: text, lineHeight: 1 }}>{statLine}</div>
                      <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{sub}</div>
                    </div>
                    {pc.type === 'player' && s && !s.loading && s.total > 0 && (
                      <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: done ? '#27ae60' : accent, borderRadius: 2, transition: 'width 0.6s' }} />
                      </div>
                    )}
                    {pc.type === 'player' && s?.loading && (
                      <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: '35%', background: `${accent}44`, borderRadius: 2 }} />
                      </div>
                    )}
                    <button onClick={() => setSelected(pc)} style={{
                      width: '100%', padding: '7px 0', background: 'transparent',
                      color: accent, border: `1.5px solid ${accent}`, borderRadius: 8,
                      cursor: 'pointer', fontWeight: 800, fontSize: 12, marginTop: 'auto',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}18` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >Voir →</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
