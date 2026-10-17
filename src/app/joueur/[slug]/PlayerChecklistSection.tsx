'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import TagIcon from '@/components/TagIcon'

interface EntryWithSet {
  id: number
  set_id: number
  card_number: string | null
  variation: string | null
  is_rc: boolean
  is_auto: boolean
  image_url: string | null
  card_sets: { id: number; name: string; year: number | null; brand: string | null; sport: string } | null
}

interface CompletionRow {
  id: string
  manually_checked: boolean
  wishlist: boolean
}

interface SetGroup {
  setId: number
  setName: string
  setYear: number | null
  setBrand: string | null
  setSport: string
  entries: EntryWithSet[]
}

type Filter = 'all' | 'owned' | 'missing' | 'wishlist'

export default function PlayerChecklistSection({ playerName }: { playerName: string }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<EntryWithSet[]>([])
  const [communityImages, setCommunityImages] = useState<Map<number, string>>(new Map())
  const [completions, setCompletions] = useState<Map<number, CompletionRow>>(new Map())
  const [saving, setSaving] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [autosOnly, setAutosOnly] = useState(false)
  const [openSets, setOpenSets] = useState<Set<number>>(new Set())
  const [imageQueriedSets, setImageQueriedSets] = useState<Set<number>>(new Set())

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
        const allCompletions: { id: string; entry_id: number; manually_checked: boolean; wishlist: boolean }[] = []
        for (let i = 0; i < entryIds.length; i += CHUNK) {
          const { data: chunk } = await supabase
            .from('user_set_completion')
            .select('id, entry_id, manually_checked, wishlist')
            .eq('user_id', uid)
            .in('entry_id', entryIds.slice(i, i + CHUNK))
          if (chunk) allCompletions.push(...chunk)
        }
        const map = new Map<number, CompletionRow>()
        for (const c of allCompletions) map.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked, wishlist: c.wishlist })
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

  // Statut d'une entree : 'owned' prime sur 'wishlist' (on ne liste pas en
  // wishlist ce qu'on a deja -- set-sync insere aussi des lignes auto-matchees
  // avec wishlist=false par defaut, jamais en conflit).
  function statusOf(entryId: number): 'owned' | 'wishlist' | 'none' {
    const c = completions.get(entryId)
    if (!c) return 'none'
    if (c.wishlist) return 'wishlist'
    return 'owned'
  }

  async function setEntryStatus(entryId: number, next: 'owned' | 'wishlist' | 'none') {
    if (!userId) return
    const existing = completions.get(entryId)
    setSaving(entryId)
    try {
      if (next === 'none') {
        if (existing) {
          await supabase.from('user_set_completion').delete().eq('id', existing.id)
          setCompletions(prev => { const n = new Map(prev); n.delete(entryId); return n })
        }
      } else {
        const wishlist = next === 'wishlist'
        const { data } = await supabase
          .from('user_set_completion')
          .upsert({ user_id: userId, entry_id: entryId, manually_checked: !wishlist, wishlist }, { onConflict: 'user_id,entry_id' })
          .select('id, manually_checked, wishlist')
          .single()
        if (data) setCompletions(prev => new Map(prev).set(entryId, { id: data.id, manually_checked: data.manually_checked, wishlist: data.wishlist }))
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

  // Photos communaute (table card_set_entries.image_url ou fuzzy-match via
  // /api/setlist-images, meme mecanisme que la page setlist d'un set) --
  // chargees uniquement pour le set ouvert, aux entrees sans image deja
  // en cache, pour ne pas interroger tous les sets d'un coup pour un joueur
  // avec une longue carriere.
  useEffect(() => {
    if (!userId) return
    for (const group of setGroups) {
      if (!openSets.has(group.setId) || imageQueriedSets.has(group.setId)) continue
      const missing = group.entries.filter(e => !e.image_url && !communityImages.has(e.id))
      setImageQueriedSets(prev => new Set(prev).add(group.setId))
      if (missing.length === 0) continue
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return
        fetch('/api/setlist-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            setId: group.setId, setYear: group.setYear, setBrand: group.setBrand, setName: group.setName,
            entryIds: missing.map(e => e.id),
          }),
        })
          .then(r => r.ok ? r.json() : [])
          .then((rows: { entry_id: number; image_url: string }[]) => {
            if (rows.length > 0) setCommunityImages(prev => { const n = new Map(prev); for (const r of rows) n.set(r.entry_id, r.image_url); return n })
          })
          .catch(() => {})
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSets, entries, userId])

  const totalOwned = [...completions.values()].filter(c => !c.wishlist).length
  const totalWishlist = [...completions.values()].filter(c => c.wishlist).length
  const totalCards = entries.length
  const totalAutos = entries.filter(e => e.is_auto).length

  if (userId === undefined) return null

  return (
    <section id="checklist-joueur" style={{ marginTop: 48, scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--jp-text)', margin: 0 }}>
            Checklist
          </h2>
          {!loading && totalCards > 0 && (
            <p style={{ fontSize: 13, color: 'var(--jp-muted)', margin: '4px 0 0', fontWeight: 600 }}>
              {userId
                ? `${totalOwned} / ${totalCards} carte${totalCards > 1 ? 's' : ''} dans ta collection${totalWishlist ? ` · ${totalWishlist} en wishlist` : ''}`
                : `${totalCards} carte${totalCards > 1 ? 's' : ''} répertoriées`}
            </p>
          )}
        </div>
        {!loading && totalCards > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'owned', 'missing', 'wishlist'] as Filter[]).map(f => (
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
                  {f === 'all' ? 'Tout' : f === 'owned' ? 'Possédé' : f === 'missing' ? 'Manquant' : 'Wishlist'}
                </button>
              ))}
            </div>
            {totalAutos > 0 && (
              <button
                onClick={() => setAutosOnly(v => !v)}
                title="N'afficher que les autographes"
                style={{
                  background: autosOnly ? '#3B82F6' : 'var(--jp-surface)',
                  color: autosOnly ? 'white' : 'var(--jp-text2)',
                  border: '1.5px solid ' + (autosOnly ? '#3B82F6' : 'var(--jp-border)'),
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                ✒️ Autos ({totalAutos})
              </button>
            )}
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
          <span style={{ color: 'var(--jp-muted)', fontSize: 13 }}>Connecte-toi pour cocher tes cartes et gérer ta wishlist.</span>
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
          <div style={{ maxHeight: 640, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
            {setGroups.map(group => {
              const ownedInSet = group.entries.filter(e => statusOf(e.id) === 'owned').length
              const isOpen = openSets.has(group.setId)
              const visibleEntries = group.entries.filter(e => {
                if (autosOnly && !e.is_auto) return false
                const st = statusOf(e.id)
                if (filter === 'owned') return st === 'owned'
                if (filter === 'missing') return st === 'none'
                if (filter === 'wishlist') return st === 'wishlist'
                return true
              })
              if ((filter !== 'all' || autosOnly) && visibleEntries.length === 0) return null
              return (
                <div key={group.setId} style={{ background: 'var(--jp-surface)', borderRadius: 8, border: '1.5px solid var(--jp-border)', overflow: 'hidden', flexShrink: 0 }}>
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
                    <div style={{ borderTop: '1px solid var(--jp-border)', padding: 10 }}>
                      <div className="pc-grid">
                        {visibleEntries.map(entry => {
                          const status = statusOf(entry.id)
                          const isSaving = saving === entry.id
                          const photo = entry.image_url || communityImages.get(entry.id) || null
                          return (
                            <div key={entry.id} className={`pc-cell${status === 'owned' ? ' owned' : status === 'wishlist' ? ' wishlist' : ''}`}>
                              <div className="pc-photo">
                                {photo
                                  // eslint-disable-next-line @next/next/no-img-element
                                  ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                                  : <b>{entry.card_number ? `#${entry.card_number}` : (entry.variation || 'Base')}</b>}
                              </div>
                              {(entry.is_rc || entry.is_auto) && (
                                <div className="pc-badges">
                                  {entry.is_rc && <TagIcon kind="rc" h={18} />}
                                  {entry.is_auto && <span className="pc-badge" style={{ background: '#3B82F6' }}>AUTO</span>}
                                </div>
                              )}
                              {userId && (
                                <div className="pc-toggles">
                                  <button
                                    type="button"
                                    className={`pc-tbtn own${status === 'owned' ? ' on' : ''}`}
                                    title={status === 'owned' ? "Retirer de ma collection" : "Je l'ai"}
                                    disabled={isSaving}
                                    onClick={() => setEntryStatus(entry.id, status === 'owned' ? 'none' : 'owned')}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className={`pc-tbtn wish${status === 'wishlist' ? ' on' : ''}`}
                                    title={status === 'wishlist' ? 'Retirer de la wishlist' : 'Ajouter à ma wishlist'}
                                    disabled={isSaving}
                                    onClick={() => setEntryStatus(entry.id, status === 'wishlist' ? 'none' : 'wishlist')}
                                  >
                                    ★
                                  </button>
                                </div>
                              )}
                              <div className="pc-info">
                                {entry.card_number && <span className="pc-num">#{entry.card_number} </span>}
                                <span className="pc-var">{entry.variation || 'Base'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {visibleEntries.length === 0 && (
                        <div style={{ padding: '10px 14px', color: 'var(--jp-muted)', fontSize: 12, textAlign: 'center' }}>
                          Aucune carte {filter === 'owned' ? 'possédée' : filter === 'wishlist' ? 'en wishlist' : autosOnly ? 'auto' : 'manquante'} dans ce set.
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
