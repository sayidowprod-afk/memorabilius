'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CardTagBadges from '@/components/CardTagBadges'
import FranchiseChecklist, { type FranchisePlayer } from '@/components/FranchiseChecklist'
import PlayerCardPopup from '@/components/PlayerCardPopup'
import { cleanFranchise } from '@/lib/franchiseExclude'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import { teamSlug, normalizeName } from '@/lib/playerSlug'

// PC "equipe" -> franchise connue (nom complet, ou dernier mot : "76ers" -> Philadelphia 76ers)
function findFranchiseTeam(name: string) {
  const n = normalizeName(name)
  if (!n) return null
  const exact = SPORTS_TEAMS.find(t => normalizeName(t.name) === n)
  if (exact) return exact
  const last = SPORTS_TEAMS.filter(t => normalizeName(t.name).split(' ').slice(-1)[0] === n.split(' ').slice(-1)[0])
  return last.length === 1 ? last[0] : null
}

interface Card {
  f: string; b: string; n: string; t: string; s: string; y: string
  br: string; v: string; num: string; auto: boolean; rc: boolean; patch: boolean
}

type PCType = 'player' | 'team' | 'collection'

interface PCEntry {
  id: string; type: PCType; name: string
  manualChecks?: Record<string, boolean>   // PC equipe : joueurs coches / decoches a la main dans la liste de la franchise
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

  // Franchise complete des PC "equipe" (liste de tous les joueurs de la franchise, chargee a la demande)
  const [franchise, setFranchise] = useState<Record<string, FranchisePlayer[]>>({})
  const [frOpen, setFrOpen] = useState<PCEntry | null>(null)
  // Popup checklist complete d'un joueur (pastille bleue, voir PlayerCardPopup.tsx) --
  // meme mecanisme que frOpen ci-dessus pour les equipes.
  const [playerPopupOpen, setPlayerPopupOpen] = useState<PCEntry | null>(null)
  const ownedNames = useMemo(() => cards.map(c => c.n).filter(Boolean), [cards])
  // ce que j'ai de chaque joueur dans ma galerie : au moins une carte RC / auto / patch / numerotee
  const ownedFlags = useMemo(() => {
    const m: Record<string, { rc: boolean; auto: boolean; patch: boolean; num: boolean }> = {}
    for (const c of cards) {
      if (!c.n) continue
      const k = normalizeName(c.n)
      const f = m[k] || (m[k] = { rc: false, auto: false, patch: false, num: false })
      if (c.rc) f.rc = true
      if (c.auto) f.auto = true
      if (c.patch) f.patch = true
      if (c.num && String(c.num).trim()) f.num = true
    }
    return m
  }, [cards])
  const ownedKeys = useMemo(() => new Set(ownedNames.map(n => normalizeName(n))), [ownedNames])
  useEffect(() => {
    for (const pc of pcs) {
      if (pc.type !== 'team') continue
      const team = findFranchiseTeam(pc.name)
      if (!team) continue
      const slug = teamSlug(team.name)
      if (franchise[slug]) continue
      import(`@/data/franchise/${slug}.json`).then(m => setFranchise(prev => ({ ...prev, [slug]: cleanFranchise(slug, m.default as FranchisePlayer[]) }))).catch(() => {})
    }
  }, [pcs, franchise])

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
                    <CardTagBadges rc={card.rc} auto={card.auto} patch={card.patch} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Grid view ────────────────────────────────────────────────────────────────
  const frTeam = frOpen ? findFranchiseTeam(frOpen.name) : null
  const frList = frTeam ? franchise[teamSlug(frTeam.name)] : undefined
  return (
    <div style={{ padding: '16px 0' }}>
      {frOpen && frTeam && frList && (
        <div onClick={() => setFrOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 980, background: dark ? '#10162b' : '#ffffff', border: `3px solid ${dark ? '#ffffff55' : '#111'}`, padding: '22px 20px 26px' }}>
            <button onClick={() => setFrOpen(null)} aria-label="Fermer" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: muted, lineHeight: 1 }}>×</button>
            <FranchiseChecklist team={frTeam.name} players={frList} color={frTeam.color} ownedNames={ownedNames} ownedFlags={ownedFlags} sport={frTeam.sport}
              overrides={frOpen.manualChecks || {}}
              onToggle={isOwner ? (key, value) => {
                const cur = { ...(frOpen.manualChecks || {}) }
                if (value === undefined) delete cur[key]
                else cur[key] = value
                const updated = { ...frOpen, manualChecks: cur }
                savePCs(pcs.map(p => (p.id === frOpen.id ? updated : p)))
                setFrOpen(updated)
              } : undefined} />
          </div>
        </div>
      )}
      {playerPopupOpen && (
        <div onClick={() => setPlayerPopupOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 980, background: dark ? '#10162b' : '#ffffff', border: `3px solid ${dark ? '#ffffff55' : '#111'}`, padding: '22px 20px 26px' }}>
            <button onClick={() => setPlayerPopupOpen(null)} aria-label="Fermer" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: muted, lineHeight: 1 }}>×</button>
            <PlayerCardPopup playerName={playerPopupOpen.name} userId={userId} color={TYPE_COLOR.player} />
          </div>
        </div>
      )}
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
                    {pc.type === 'team' && (() => {
                      const team = findFranchiseTeam(pc.name)
                      const list = team ? franchise[teamSlug(team.name)] : undefined
                      if (!team || !list) return null
                      // meme calcul que la liste de la franchise : cases cochees / decochees a la main par-dessus la detection automatique
                      const have = list.filter(p => { const k = normalizeName(p[0]); return pc.manualChecks && k in pc.manualChecks ? pc.manualChecks[k] : ownedKeys.has(k) }).length
                      return (
                        <button onClick={e => { e.stopPropagation(); setFrOpen(pc) }} title="Tous les joueurs de la franchise" style={{
                          alignSelf: 'flex-start', padding: '2px 8px', background: `${TYPE_COLOR.team}1f`, color: TYPE_COLOR.team,
                          border: `1px solid ${TYPE_COLOR.team}66`, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11,
                        }}>🏛 {have} / {list.length} joueurs ›</button>
                      )
                    })()}
                    {pc.type === 'player' && s && !s.loading && s.total > 0 && (
                      <button onClick={e => { e.stopPropagation(); setPlayerPopupOpen(pc) }} title="Checklist complète du joueur" style={{
                        alignSelf: 'flex-start', padding: '2px 8px', background: `${TYPE_COLOR.player}1f`, color: TYPE_COLOR.player,
                        border: `1px solid ${TYPE_COLOR.player}66`, borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 11,
                      }}>✓ {count} / {s.total} cartes ›</button>
                    )}
                    {pc.type !== 'player' && (
                      <button onClick={() => setSelected(pc)} style={{
                        width: '100%', padding: '7px 0', background: 'transparent',
                        color: accent, border: `1.5px solid ${accent}`, borderRadius: 8,
                        cursor: 'pointer', fontWeight: 800, fontSize: 12, marginTop: 'auto',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}18` }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                      >Voir →</button>
                    )}
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
