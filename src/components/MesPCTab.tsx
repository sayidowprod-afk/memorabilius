'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import PlayerChecklistSection from '@/app/joueur/[slug]/PlayerChecklistSection'

interface Card { n: string }

interface PCEntry {
  id: string
  name: string
  firstName: string
  lastName: string
  addedAt: number
}

interface PCStats {
  total: number
  owned: number
  loading: boolean
}

export default function MesPCTab({ cards, userId, accent, dark }: {
  cards: Card[]
  userId: string
  accent: string
  dark: boolean
}) {
  const storageKey = `memorabilius_pcs_${userId}`
  const [pcs, setPCs] = useState<PCEntry[]>([])
  const [stats, setStats] = useState<Map<string, PCStats>>(new Map())
  const [selected, setSelected] = useState<PCEntry | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bg   = dark ? '#1a1a2e' : '#ffffff'
  const bg2  = dark ? '#252540' : '#f8f9fc'
  const border = dark ? '#2a2a4a' : '#e8eaf0'
  const text = dark ? '#f0f2f8' : '#111111'
  const muted = dark ? '#666e88' : '#888888'

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) setPCs(JSON.parse(stored))
    } catch {}
  }, [storageKey])

  function savePCs(next: PCEntry[]) {
    setPCs(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  const fetchStatsForPC = useCallback(async (pc: PCEntry) => {
    setStats(prev => new Map(prev).set(pc.id, { total: 0, owned: 0, loading: true }))
    try {
      const res = await fetch(
        `/api/player-checklist?firstName=${encodeURIComponent(pc.firstName)}&lastName=${encodeURIComponent(pc.lastName)}`
      )
      if (!res.ok) throw new Error()
      const { entries } = await res.json() as { entries: { id: number }[] }
      const total = entries.length
      let owned = 0
      if (total > 0) {
        const ids = entries.map(e => e.id)
        const CHUNK = 500
        for (let i = 0; i < ids.length; i += CHUNK) {
          const { data } = await supabase
            .from('user_set_completion')
            .select('id')
            .eq('user_id', userId)
            .in('entry_id', ids.slice(i, i + CHUNK))
          owned += data?.length ?? 0
        }
      }
      setStats(prev => new Map(prev).set(pc.id, { total, owned, loading: false }))
    } catch {
      setStats(prev => new Map(prev).set(pc.id, { total: 0, owned: 0, loading: false }))
    }
  }, [userId])

  useEffect(() => {
    for (const pc of pcs) {
      if (!stats.has(pc.id)) fetchStatsForPC(pc)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcs])

  function addPC(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (pcs.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setShowAdd(false); setAddSearch(''); return
    }
    const parts = trimmed.split(' ')
    const firstName = parts[0]
    const lastName = parts[parts.length - 1]
    const entry: PCEntry = { id: `${firstName}_${lastName}_${Date.now()}`, name: trimmed, firstName, lastName, addedAt: Date.now() }
    const next = [...pcs, entry]
    savePCs(next)
    fetchStatsForPC(entry)
    setShowAdd(false)
    setAddSearch('')
  }

  function removePC(id: string) {
    savePCs(pcs.filter(p => p.id !== id))
    setStats(prev => { const n = new Map(prev); n.delete(id); return n })
  }

  const playerNames = useMemo(() => {
    const names = new Set<string>()
    for (const c of cards) { const n = c.n?.trim(); if (n && n.length > 2) names.add(n) }
    return [...names].sort()
  }, [cards])

  const suggestions = useMemo(() => {
    if (!addSearch) return playerNames.slice(0, 14)
    const q = addSearch.toLowerCase()
    return playerNames.filter(n => n.toLowerCase().includes(q)).slice(0, 14)
  }, [playerNames, addSearch])

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ padding: '12px 0' }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            background: bg2, border: `1.5px solid ${border}`,
            color: muted, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            marginBottom: 4,
          }}
        >
          ← Retour aux PC
        </button>
        <PlayerChecklistSection playerName={selected.name} />
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
            {pcs.length === 0
              ? 'Ajoute les joueurs que tu collectionnes'
              : `${pcs.length} joueur${pcs.length > 1 ? 's' : ''} suivi${pcs.length > 1 ? 's' : ''}`}
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
            transition: 'all 0.15s',
          }}
        >
          {showAdd ? '✕ Annuler' : '+ Ajouter'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{
          marginBottom: 20, background: bg2, borderRadius: 12,
          padding: '14px 16px', border: `1.5px solid ${border}`,
          position: 'relative',
        }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: muted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Nom du joueur
          </p>
          <input
            autoFocus
            value={addSearch}
            onChange={e => { setAddSearch(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => { blurTimer.current = setTimeout(() => setShowSuggestions(false), 150) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && addSearch.trim()) addPC(addSearch)
              if (e.key === 'Escape') { setShowAdd(false); setAddSearch('') }
            }}
            placeholder="Ex: Joel Embiid, Luka Doncic…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: `2px solid ${accent}`, fontSize: 14, fontWeight: 600,
              background: bg, color: text, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {showSuggestions && (suggestions.length > 0 || addSearch.trim()) && (
            <div style={{
              position: 'absolute', top: 'calc(100% - 4px)', left: 16, right: 16,
              background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.14)', zIndex: 60,
              maxHeight: 260, overflowY: 'auto',
            }}>
              {suggestions.map(name => (
                <button
                  key={name}
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(name)}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    textAlign: 'left', background: 'none', border: 'none',
                    borderBottom: `1px solid ${border}`,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, color: text,
                  }}
                >
                  {name}
                </button>
              ))}
              {addSearch.trim() && !playerNames.some(n => n.toLowerCase() === addSearch.toLowerCase()) && (
                <button
                  onMouseDown={e => { e.preventDefault(); if (blurTimer.current) clearTimeout(blurTimer.current) }}
                  onClick={() => addPC(addSearch.trim())}
                  style={{
                    display: 'block', width: '100%', padding: '10px 14px',
                    textAlign: 'left', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent,
                  }}
                >
                  Ajouter « {addSearch.trim()} »
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {pcs.length === 0 && !showAdd && (
        <div style={{
          textAlign: 'center', padding: '52px 24px',
          background: bg2, borderRadius: 16, border: `2px dashed ${border}`,
        }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: text, marginBottom: 6 }}>
            Aucun PC suivi
          </div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
            Ajoute un joueur pour suivre toutes ses cartes
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              padding: '10px 22px', background: accent, color: 'white',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontWeight: 800, fontSize: 13,
            }}
          >
            + Ajouter un joueur
          </button>
        </div>
      )}

      {/* PC Tiles grid */}
      {pcs.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 14,
        }}>
          {pcs.map(pc => {
            const s = stats.get(pc.id) ?? { total: 0, owned: 0, loading: true }
            const pct = s.total > 0 ? (s.owned / s.total) * 100 : 0
            const initials = pc.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            const done = !s.loading && s.total > 0 && s.owned === s.total

            return (
              <div
                key={pc.id}
                style={{
                  background: bg,
                  border: `1.5px solid ${border}`,
                  borderRadius: 14,
                  padding: '16px 14px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  position: 'relative',
                  boxShadow: dark ? 'none' : '0 1px 6px rgba(0,0,0,0.05)',
                }}
              >
                {/* Remove button */}
                <button
                  onClick={() => removePC(pc.id)}
                  title="Retirer ce PC"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 22, height: 22, borderRadius: '50%',
                    background: bg2, border: `1px solid ${border}`,
                    cursor: 'pointer', color: muted, fontSize: 13, lineHeight: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >×</button>

                {/* Avatar + Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 20 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: done ? '#27ae60' : accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 900, fontSize: 14,
                    transition: 'background 0.3s',
                  }}>
                    {done ? '✓' : initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 800, color: text,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {pc.name}
                    </div>
                    <div style={{ fontSize: 10, color: muted, marginTop: 1, fontWeight: 600 }}>
                      Joueur
                    </div>
                  </div>
                </div>

                {/* Stats */}
                {s.loading ? (
                  <div style={{ fontSize: 11, color: muted, fontStyle: 'italic', paddingBottom: 2 }}>
                    Calcul en cours…
                  </div>
                ) : s.total === 0 ? (
                  <div style={{ fontSize: 11, color: muted, paddingBottom: 2 }}>
                    Aucune carte répertoriée
                  </div>
                ) : (
                  <>
                    {/* Progress bar */}
                    <div>
                      <div style={{ height: 5, background: border, borderRadius: 3, overflow: 'hidden', marginBottom: 5 }}>
                        <div style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: done ? '#27ae60' : accent,
                          borderRadius: 3,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: text }}>
                          {s.owned} <span style={{ fontWeight: 400, color: muted }}>/ {s.total}</span>
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 800,
                          color: done ? '#27ae60' : muted,
                        }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => setSelected(pc)}
                      style={{
                        width: '100%', padding: '8px 0',
                        background: 'transparent',
                        color: accent,
                        border: `1.5px solid ${accent}`,
                        borderRadius: 8, cursor: 'pointer',
                        fontWeight: 800, fontSize: 12,
                        transition: 'background 0.12s',
                        marginTop: 2,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}18` }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      Voir la checklist →
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
