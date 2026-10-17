'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

interface CompletionRow { id: string; manually_checked: boolean; wishlist: boolean }

type Filter = 'all' | 'have' | 'miss' | 'wish'

// Popup checklist complete d'un joueur, ouvert depuis la pastille des PCs
// (MesPCTab.tsx) -- meme esprit que FranchiseChecklist (grille de cellules,
// recherche, filtres, tri) mais chaque cellule est une carte precise (set +
// variation), avec la photo de la carte si deja presente sur Memorabilius
// (reutilise card_set_entries.image_url + /api/setlist-images, meme
// mecanisme que la page setlist) plutot que la photo du joueur.
export default function PlayerCardPopup({ playerName, userId, color }: {
  playerName: string; userId: string; color: string
}) {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<EntryWithSet[]>([])
  const [completions, setCompletions] = useState<Map<number, CompletionRow>>(new Map())
  const [saving, setSaving] = useState<number | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [autosOnly, setAutosOnly] = useState(false)
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(120)
  const [order, setOrder] = useState<'alpha' | 'chrono'>('chrono')
  const [communityImages, setCommunityImages] = useState<Map<number, string>>(new Map())
  const askedRef = useRef<Set<number>>(new Set())

  const nameParts = playerName.trim().split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/player-checklist?firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`)
        if (!res.ok) throw new Error()
        const { entries: all } = await res.json() as { entries: EntryWithSet[] }
        if (cancelled) return
        setEntries(all)
        if (userId && all.length > 0) {
          const ids = all.map(e => e.id)
          const allComp: { id: string; entry_id: number; manually_checked: boolean; wishlist: boolean }[] = []
          for (let i = 0; i < ids.length; i += 500) {
            const { data } = await supabase.from('user_set_completion')
              .select('id, entry_id, manually_checked, wishlist')
              .eq('user_id', userId).in('entry_id', ids.slice(i, i + 500))
            if (data) allComp.push(...data)
          }
          if (cancelled) return
          const map = new Map<number, CompletionRow>()
          for (const c of allComp) map.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked, wishlist: c.wishlist })
          setCompletions(map)
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [firstName, lastName, userId])

  function statusOf(entryId: number): 'owned' | 'wishlist' | 'none' {
    const c = completions.get(entryId)
    if (!c) return 'none'
    return c.wishlist ? 'wishlist' : 'owned'
  }

  async function setEntryStatus(entryId: number, next: 'owned' | 'wishlist' | 'none') {
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

  const totalAutos = entries.filter(e => e.is_auto).length
  const haveCount = [...completions.values()].filter(c => !c.wishlist).length
  const pct = entries.length ? Math.round((haveCount / entries.length) * 100) : 0

  const rows = useMemo(() => {
    const r = entries.map(e => ({
      e,
      label: e.variation || 'Base',
      sub: `${e.card_sets?.year ? e.card_sets.year + ' ' : ''}${e.card_sets?.name || ''}`,
    }))
    if (order === 'alpha') r.sort((a, b) => a.label.localeCompare(b.label, 'fr'))
    else r.sort((a, b) => (b.e.card_sets?.year || 0) - (a.e.card_sets?.year || 0))
    return r
  }, [entries, order])

  const nq = q.trim().toLowerCase()
  const list = rows.filter(r => {
    if (autosOnly && !r.e.is_auto) return false
    const st = statusOf(r.e.id)
    if (filter === 'have' && st !== 'owned') return false
    if (filter === 'miss' && st !== 'none') return false
    if (filter === 'wish' && st !== 'wishlist') return false
    if (nq && !r.label.toLowerCase().includes(nq) && !r.sub.toLowerCase().includes(nq)) return false
    return true
  })

  // Photos communaute des cartes visibles, par lots groupes par set (l'API
  // /api/setlist-images a besoin du contexte du set -- annee/marque/nom --
  // pour son fuzzy-match). Seules les entrees sans image deja en cache
  // (card_set_entries.image_url) et actuellement affichees sont demandees.
  const visibleKey = list.slice(0, limit).map(r => r.e.id).join('|')
  useEffect(() => {
    if (!userId) return
    const visible = list.slice(0, limit)
    const bySet = new Map<number, { setId: number; setYear: number | null; setBrand: string | null; setName: string; ids: number[] }>()
    for (const { e } of visible) {
      if (e.image_url || communityImages.has(e.id) || askedRef.current.has(e.id)) continue
      if (!bySet.has(e.set_id)) bySet.set(e.set_id, { setId: e.set_id, setYear: e.card_sets?.year ?? null, setBrand: e.card_sets?.brand ?? null, setName: e.card_sets?.name ?? '', ids: [] })
      bySet.get(e.set_id)!.ids.push(e.id)
    }
    if (bySet.size === 0) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token || cancelled) return
      for (const grp of bySet.values()) {
        grp.ids.forEach(id => askedRef.current.add(id))
        try {
          const r = await fetch('/api/setlist-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ setId: grp.setId, setYear: grp.setYear, setBrand: grp.setBrand, setName: grp.setName, entryIds: grp.ids }),
          })
          if (!r.ok) continue
          const rows2 = await r.json() as { entry_id: number; image_url: string }[]
          if (!cancelled && rows2.length) setCommunityImages(prev => { const n = new Map(prev); for (const row of rows2) n.set(row.entry_id, row.image_url); return n })
        } catch { /* ignore */ }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, userId])

  return (
    <section className="fr" style={{ ['--fr-c' as string]: color }}>
      <h2 className="fr-title">Checklist complète — {playerName} ({entries.length})</h2>
      <p className="fr-sub">Chaque carte connue de {playerName}, tous sets confondus. ✓ = possédée, ★ = wishlist.</p>
      {!loading && entries.length > 0 && (
        <div className="fr-prog">
          <div className="fr-prog-l"><b>{haveCount} / {entries.length}</b> cartes · {pct} %</div>
          <div className="fr-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      <div className="fr-tools">
        <input value={q} onChange={e => { setQ(e.target.value); setLimit(120) }} placeholder="Chercher un set / une variation…" className="fr-search" />
        {(['all', 'have', 'miss', 'wish'] as Filter[]).map(f => (
          <button key={f} type="button" className={'fr-chip' + (filter === f ? ' on' : '')} onClick={() => { setFilter(f); setLimit(120) }}>
            {f === 'all' ? 'Tous' : f === 'have' ? 'Je les ai' : f === 'miss' ? 'Il me manque' : 'Wishlist'}
          </button>
        ))}
        {totalAutos > 0 && (
          <button type="button" className={'fr-chip' + (autosOnly ? ' on' : '')} onClick={() => { setAutosOnly(v => !v); setLimit(120) }}>
            ✒️ Autos ({totalAutos})
          </button>
        )}
      </div>
      <div className="fr-tools">
        <span className="fr-tools-l">Tri :</span>
        <button type="button" className={'fr-chip' + (order === 'chrono' ? ' on' : '')} onClick={() => setOrder('chrono')}>Chronologique</button>
        <button type="button" className={'fr-chip' + (order === 'alpha' ? ' on' : '')} onClick={() => setOrder('alpha')}>A → Z</button>
      </div>

      {loading && <p className="fr-sub">Chargement…</p>}

      {!loading && (
        <div className="pcg-grid">
          {list.slice(0, limit).map(({ e, label, sub }) => {
            const status = statusOf(e.id)
            const isSaving = saving === e.id
            const photo = e.image_url || communityImages.get(e.id) || null
            return (
              <div key={e.id} className={'pcg-cell' + (status === 'owned' ? ' owned' : status === 'wishlist' ? ' wishlist' : '')}>
                <div className="pcg-link">
                  <span className="pcg-photo">
                    {photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                      : <b>{e.card_number ? `#${e.card_number}` : '—'}</b>}
                  </span>
                  <span className="pcg-txt">
                    <span className="pcg-name" title={label}>{label}{e.card_number ? ` #${e.card_number}` : ''}</span>
                    <span className="pcg-sub">{sub}</span>
                  </span>
                </div>
                <div className="pcg-toggles">
                  <button type="button" className={'pcg-chk own' + (status === 'owned' ? ' on' : '')} disabled={isSaving}
                    title={status === 'owned' ? 'Décocher (je ne l’ai pas)' : "Cocher (je l'ai)"}
                    onClick={() => setEntryStatus(e.id, status === 'owned' ? 'none' : 'owned')}>
                    {status === 'owned' ? '✓' : ''}
                  </button>
                  <button type="button" className={'pcg-chk wish' + (status === 'wishlist' ? ' on' : '')} disabled={isSaving}
                    title={status === 'wishlist' ? 'Retirer de la wishlist' : 'Ajouter à ma wishlist'}
                    onClick={() => setEntryStatus(e.id, status === 'wishlist' ? 'none' : 'wishlist')}>
                    {status === 'wishlist' ? '★' : ''}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!loading && list.length === 0 && <p className="fr-sub">Aucune carte ne correspond.</p>}
      {!loading && limit < list.length && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" className="fr-chip on" onClick={() => setLimit(l => l + 200)}>Voir plus ({list.length - limit})</button>
        </div>
      )}
    </section>
  )
}
