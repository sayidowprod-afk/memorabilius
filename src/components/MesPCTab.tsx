'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerChecklistSection from '@/app/joueur/[slug]/PlayerChecklistSection'

interface Card {
  f: string; b: string; n: string; t: string; s: string; y: string
  br: string; v: string; auto: boolean; rc: boolean; patch: boolean
}

type PCType = 'player' | 'team' | 'collection'

interface PCEntry {
  id: string
  type: PCType
  name: string
  firstName?: string
  lastName?: string
  addedAt: number
}

interface PlayerStats { total: number; owned: number; loading: boolean }

const TYPE_LABEL: Record<PCType, string> = { player: 'Joueur', team: 'Équipe', collection: 'Collection' }
const TYPE_COLOR: Record<PCType, string> = { player: '#3b82f6', team: '#10b981', collection: '#f59e0b' }

export default function MesPCTab({ cards, userId, accent, dark }: {
  cards: Card[]
  userId: string
  accent: string
  dark: boolean
}) {
  const storageKey = `memorabilius_pcs_${userId}`
  const [pcs, setPCs]   = useState<PCEntry[]>([])
  const [pStats, setPStats] = useState<Map<string, PlayerStats>>(new Map())
  const [selected, setSelected] = useState<PCEntry | null>(null)
  const [showAdd, setShowAdd]   = useState(false)
  const [addType, setAddType]   = useState<PCType>('player')
  const [addSearch, setAddSearch] = useState('')
  const [showSug, setShowSug]   = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bg     = dark ? '#1a1a2e' : '#ffffff'
  const bg2    = dark ? '#252540' : '#f8f9fc'
  const border = dark ? '#2a2a4a' : '#e8eaf0'
  const text   = dark ? '#f0f2f8' : '#111111'
  const muted  = dark ? '#666e88' : '#888888'

  // Inject CSS vars for PlayerChecklistSection (which relies on --jp-* variables)
  const jpVars = {
    '--jp-text':     dark ? '#f0f2f8' : '#111111',
    '--jp-text2':    dark ? '#9ba3c0' : '#555555',
    '--jp-muted':    dark ? '#666e88' : '#888888',
    '--jp-surface':  dark ? '#1e1e2e' : '#ffffff',
    '--jp-surface2': dark ? '#252540' : '#f8f9fc',
    '--jp-border':   dark ? '#2a2a4a' : '#e8eaf0',
    '--jp-accent':   accent,
  } as React.CSSProperties

  // ── Persistence ──────────────────────────────────────────────────────────────
  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setPCs(JSON.parse(s)) } catch {}
  }, [storageKey])

  function savePCs(next: PCEntry[]) {
    setPCs(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  // ── Fetch player stats (async, TCDB) ─────────────────────────────────────────
  const fetchPlayerStats = useCallback(async (pc: PCEntry) => {
    setPStats(prev => new Map(prev).set(pc.id, { total: 0, owned: 0, loading: true }))
    try {
      const res = await fetch(
        `/api/player-checklist?firstName=${encodeURIComponent(pc.firstName || '')}&lastName=${encodeURIComponent(pc.lastName || '')}`
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

  // ── Autocomplete sources ─────────────────────────────────────────────────────
  const playerNames     = useMemo(() => [...new Set(cards.map(c => c.n?.trim()).filter(Boolean))].sort(), [cards])
  const teamNames       = useMemo(() => [...new Set(cards.map(c => c.t?.trim()).filter(Boolean))].sort(), [cards])
  const collectionNames = useMemo(() => [...new Set(cards.map(c => c.s?.trim()).filter(Boolean))].sort(), [cards])

  const sourceNames = addType === 'player' ? playerNames : addType === 'team' ? teamNames : collectionNames
  const suggestions = useMemo(() => {
    if (!addSearch) return sourceNames.slice(0, 14)
    const q = addSearch.toLowerCase()
    return sourceNames.filter(n => n.toLowerCase().includes(q)).slice(0, 14)
  }, [sourceNames, addSearch])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function getPhoto(pc: PCEntry): string | undefined {
    const card = pc.type === 'player' ? cards.find(c => c.n?.trim() === pc.name)
      : pc.type === 'team' ? cards.find(c => c.t?.trim() === pc.name)
      : cards.find(c => c.s?.trim() === pc.name)
    return card?.f || undefined
  }

  function getTeamCollStats(pc: PCEntry) {
    const filtered = pc.type === 'team'
      ? cards.filter(c => c.t?.trim() === pc.name)
      : cards.filter(c => c.s?.trim() === pc.name)
    const sets = new Set(filtered.map(c => c.s)).size
    const years = [...new Set(filtered.map(c => c.y).filter(Boolean))].map(Number).filter(n => !isNaN(n))
    const yearStr = years.length === 0 ? '' : years.length === 1 ? `${years[0]}` : `${Math.min(...years)}–${Math.max(...years)}`
    return { count: filtered.length, sets, yearStr, filtered }
  }

  function addPC(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
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
    savePCs(pcs.filter(p => p.id !== id))
    setPStats(prev => { const n = new Map(prev); n.delete(id); return n })
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const { filtered, count } = getTeamCollStats(selected)
    return (
      <div style={{ padding: '12px 0' }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8, background: bg2,
            border: `1.5px solid ${border}`, color: muted,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
          }}
        >← Retour aux PC</button>

        {selected.type === 'player' ? (
          <div style={jpVars}>
            <PlayerChecklistSection playerName={selected.name} />
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: TYPE_COLOR[selected.type],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 900, fontSize: 14,
              }}>
                {selected.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 2px' }}>{selected.name}</h2>
                <p style={{ fontSize: 12, color: muted, margin: 0 }}>
                  {count} carte{count > 1 ? 's' : ''} dans ta collection
                </p>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, background: bg2, borderRadius: 12, border: `1.5px solid ${border}`, color: muted, fontSize: 14 }}>
                Aucune carte dans ta collection
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {filtered.map((card, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 12px', background: bg, borderRadius: 8,
                    border: `1px solid ${border}`,
                  }}>
                    {card.f && (
                      <img src={card.f} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {card.n}
                      </div>
                      <div style={{ fontSize: 11, color: muted }}>
                        {card.y && `${card.y} `}{card.s}{card.v ? ` · ${card.v}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      {card.rc && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 5px', borderRadius: 3, fontWeight: 800 }}>RC</span>}
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

  // ── Grid view ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px 0' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 2px' }}>Mes PC</h2>
          <p style={{ fontSize: 12, color: muted, margin: 0 }}>
            {pcs.length === 0 ? 'Ajoute ce que tu collectionnes' : `${pcs.length} PC suivi${pcs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setAddSearch('') }}
          style={{
            padding: '9px 16px',
            background: showAdd ? bg2 : accent,
            color: showAdd ? muted : 'white',
            border: `1.5px solid ${showAdd ? border : accent}`,
            borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13,
          }}
        >{showAdd ? '✕ Annuler' : '+ Ajouter'}</button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ marginBottom: 20, background: bg2, borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${border}`, position: 'relative' }}>

          {/* Type pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['player', 'team', 'collection'] as PCType[]).map(t => (
              <button key={t} onClick={() => { setAddType(t); setAddSearch('') }} style={{
                padding: '5px 14px', borderRadius: 20, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                background: addType === t ? TYPE_COLOR[t] : bg,
                color: addType === t ? 'white' : muted,
                border: `1.5px solid ${addType === t ? TYPE_COLOR[t] : border}`,
                transition: 'all 0.15s',
              }}>{TYPE_LABEL[t]}</button>
            ))}
          </div>

          <input
            autoFocus
            value={addSearch}
            onChange={e => { setAddSearch(e.target.value); setShowSug(true) }}
            onFocus={() => setShowSug(true)}
            onBlur={() => { blurTimer.current = setTimeout(() => setShowSug(false), 150) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && addSearch.trim()) addPC(addSearch)
              if (e.key === 'Escape') { setShowAdd(false); setAddSearch('') }
            }}
            placeholder={
              addType === 'player' ? 'Ex: Joel Embiid, Luka Doncic…'
              : addType === 'team' ? 'Ex: Philadelphia 76ers…'
              : 'Ex: Prizm 2023-24…'
            }
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: `2px solid ${accent}`, fontSize: 14, fontWeight: 600,
              background: bg, color: text, outline: 'none', boxSizing: 'border-box',
            }}
          />

          {showSug && (suggestions.length > 0 || addSearch.trim()) && (
            <div style={{
              position: 'absolute', top: 'calc(100% - 6px)', left: 16, right: 16,
              background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.14)', zIndex: 60, maxHeight: 260, overflowY: 'auto',
            }}>
              {suggestions.map(name => (
                <button key={name}
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(name)}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left',
                    background: 'none', border: 'none', borderBottom: `1px solid ${border}`,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, color: text,
                  }}
                >{name}</button>
              ))}
              {addSearch.trim() && !sourceNames.some(n => n.toLowerCase() === addSearch.toLowerCase()) && (
                <button
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(addSearch.trim())}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent,
                  }}
                >Ajouter « {addSearch.trim()} »</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {pcs.length === 0 && !showAdd && (
        <div style={{ textAlign: 'center', padding: '52px 24px', background: bg2, borderRadius: 16, border: `2px dashed ${border}` }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: 6 }}>Aucun PC suivi</div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
            Joueur, équipe ou collection — suis tes cartes
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            padding: '10px 22px', background: accent, color: 'white',
            border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 13,
          }}>+ Ajouter</button>
        </div>
      )}

      {/* Tiles */}
      {pcs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
          {pcs.map(pc => {
            const photo = getPhoto(pc)
            const initials = pc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            const badgeColor = TYPE_COLOR[pc.type]
            const s = pStats.get(pc.id)
            const { count, sets, yearStr } = getTeamCollStats(pc)

            let countLabel = '', subLabel = '', pct = 0, done = false
            if (pc.type === 'player') {
              if (s?.loading) countLabel = '…'
              else if (s && s.total > 0) {
                pct = (s.owned / s.total) * 100; done = s.owned === s.total
                countLabel = `${s.owned} / ${s.total}`
                subLabel = `${Math.round(pct)}%`
              } else if (s) countLabel = 'Non répertorié'
            } else if (pc.type === 'team') {
              countLabel = `${count} carte${count > 1 ? 's' : ''}`
              subLabel = `${sets} set${sets > 1 ? 's' : ''}`
            } else {
              countLabel = `${count} carte${count > 1 ? 's' : ''}`
              subLabel = yearStr
            }

            return (
              <div key={pc.id} style={{
                background: bg, border: `1.5px solid ${border}`, borderRadius: 14,
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                position: 'relative', boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,0.07)',
              }}>
                {/* Remove */}
                <button onClick={() => removePC(pc.id)} title="Retirer" style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 2,
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', border: 'none', cursor: 'pointer',
                  color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }}>×</button>

                {/* Cover photo */}
                <div style={{ height: 110, background: bg2, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                  {photo ? (
                    <img src={photo} alt={pc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${badgeColor}20` }}>
                      <span style={{ fontSize: 38, fontWeight: 900, color: badgeColor, opacity: 0.6 }}>{initials}</span>
                    </div>
                  )}
                  <span style={{
                    position: 'absolute', bottom: 6, left: 8,
                    background: badgeColor, color: 'white',
                    fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 10,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>{TYPE_LABEL[pc.type]}</span>
                </div>

                {/* Body */}
                <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pc.name}
                    </div>
                    <div style={{ fontSize: 11, color: text, fontWeight: 700, marginTop: 1 }}>
                      {countLabel}
                      {subLabel && <span style={{ color: muted, fontWeight: 400, marginLeft: 5 }}>{subLabel}</span>}
                    </div>
                  </div>

                  {/* Progress bar (player only) */}
                  {pc.type === 'player' && s && !s.loading && s.total > 0 && (
                    <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: done ? '#27ae60' : accent,
                        borderRadius: 2, transition: 'width 0.6s',
                      }} />
                    </div>
                  )}
                  {pc.type === 'player' && s?.loading && (
                    <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '40%', background: `${accent}55`, borderRadius: 2 }} />
                    </div>
                  )}

                  <button
                    onClick={() => setSelected(pc)}
                    style={{
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
      )}
    </div>
  )
}
