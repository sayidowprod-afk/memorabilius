'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { playerSlug, normalizeName } from '@/lib/playerSlug'

// [nom, premiere saison, derniere saison, nb d'entrees de checklist]
export type FranchisePlayer = [string, number, number, number]

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950]
const decadeOf = (y: number) => Math.floor(y / 10) * 10

export default function FranchiseChecklist({ team, players, color, ownedNames }: { team: string; players: FranchisePlayer[]; color: string; ownedNames?: string[] }) {
  const [owned, setOwned] = useState<Set<string> | null>(null) // null = non connecte / en chargement
  const [loggedIn, setLoggedIn] = useState(false)
  const [decade, setDecade] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'have' | 'miss'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(120)

  useEffect(() => {
    // collection deja connue de l'appelant (ex. galerie d'un utilisateur, CSV compris) : pas besoin de la relire
    if (ownedNames) { setLoggedIn(true); setOwned(new Set(ownedNames.map(n => normalizeName(n)))); return }
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setLoggedIn(true)
      const names = new Set<string>()
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('cartes_manuelles').select('nom').eq('user_id', user.id).order('id').range(from, from + 999)
        for (const c of data || []) if (c.nom) names.add(normalizeName(c.nom))
        if (!data || data.length < 1000) break
      }
      if (!cancelled) setOwned(names)
    })()
    return () => { cancelled = true }
  }, [ownedNames])

  const rows = useMemo(() => players.map(p => ({ name: p[0], y0: p[1], y1: p[2], n: p[3], key: normalizeName(p[0]) })), [players])
  const haveCount = owned ? rows.filter(r => owned.has(r.key)).length : 0
  const pct = rows.length ? Math.round((haveCount / rows.length) * 100) : 0
  const nq = normalizeName(q)
  const list = rows.filter(r => {
    if (decade != null && !(r.y0 && decadeOf(r.y0) <= decade && decadeOf(r.y1 || r.y0) >= decade)) return false
    if (filter === 'have' && !(owned && owned.has(r.key))) return false
    if (filter === 'miss' && owned && owned.has(r.key)) return false
    if (nq && !r.key.includes(nq)) return false
    return true
  })
  const presentDecades = DECADES.filter(d => rows.some(r => r.y0 && decadeOf(r.y0) <= d && decadeOf(r.y1 || r.y0) >= d))

  return (
    <section className="fr" style={{ ['--fr-c' as string]: color }}>
      <h2 className="fr-title">Tous les joueurs de la franchise ({rows.length})</h2>
      <p className="fr-sub">Chaque joueur ayant une carte recensée sous les couleurs des {team}. Le défi : une carte de chacun.</p>
      {loggedIn && owned && (
        <div className="fr-prog">
          <div className="fr-prog-l"><b>{haveCount} / {rows.length}</b> joueurs · {pct} %</div>
          <div className="fr-bar"><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
      {!loggedIn && <p className="fr-sub"><Link href="/connexion">Connecte-toi</Link> pour voir ceux dont tu as déjà une carte.</p>}
      <div className="fr-tools">
        <input value={q} onChange={e => { setQ(e.target.value); setLimit(120) }} placeholder="Chercher un joueur…" className="fr-search" />
        {loggedIn && (['all', 'have', 'miss'] as const).map(f => (
          <button key={f} type="button" className={'fr-chip' + (filter === f ? ' on' : '')} onClick={() => { setFilter(f); setLimit(120) }}>
            {f === 'all' ? 'Tous' : f === 'have' ? 'Je les ai' : 'Il me manque'}
          </button>
        ))}
      </div>
      <div className="fr-tools">
        <button type="button" className={'fr-chip' + (decade == null ? ' on' : '')} onClick={() => { setDecade(null); setLimit(120) }}>Toutes époques</button>
        {presentDecades.map(d => (
          <button key={d} type="button" className={'fr-chip' + (decade === d ? ' on' : '')} onClick={() => { setDecade(d); setLimit(120) }}>{d}s</button>
        ))}
      </div>
      <div className="fr-grid">
        {list.slice(0, limit).map(r => {
          const has = !!(owned && owned.has(r.key))
          return (
            <Link key={r.name} href={`/joueur/${playerSlug(r.name)}`} className={'fr-cell' + (has ? ' have' : '')} title={r.name}>
              <span className="fr-mark">{has ? '✓' : owned ? '?' : ''}</span>
              <span className="fr-name">{r.name}</span>
              <span className="fr-years">{r.y0 ? (r.y1 && r.y1 !== r.y0 ? `${r.y0} – ${r.y1}` : r.y0) : ''}</span>
            </Link>
          )
        })}
      </div>
      {list.length === 0 && <p className="fr-sub">Aucun joueur ne correspond.</p>}
      {limit < list.length && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button type="button" className="fr-chip on" onClick={() => setLimit(l => l + 200)}>Voir plus ({list.length - limit})</button>
        </div>
      )}
    </section>
  )
}
