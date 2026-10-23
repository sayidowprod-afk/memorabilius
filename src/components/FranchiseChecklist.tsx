'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { playerSlug, normalizeName } from '@/lib/playerSlug'
import { TAG_BASE, type TagKind } from '@/lib/cardTags'

// [nom, premiere saison, derniere saison, nb d'entrees de checklist, au moins une carte auto existe (toutes checklists, pas seulement ma collection)]
export type FranchisePlayer = [string, number, number, number, boolean?]
// Ce que le collectionneur possede d'un joueur dans sa galerie : au moins une carte RC / auto / patch / numerotee
export type OwnedFlags = Record<TagKind, boolean>
const KINDS: { k: TagKind; l: string }[] = [{ k: 'rc', l: 'RC' }, { k: 'auto', l: 'Auto' }, { k: 'patch', l: 'Patch' }, { k: 'num', l: 'Num' }]

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950]
const decadeOf = (y: number) => Math.floor(y / 10) * 10

// overrides / onToggle (proprietaire uniquement) : case cochee ou decochee a la main, par-dessus le calcul automatique depuis la galerie.
// overrides[cle] = true -> force « je l'ai » ; false -> force « il me manque » ; absent -> automatique. sport : pour retrouver les photos des joueurs.
export default function FranchiseChecklist({ team, players, color, ownedNames, ownedFlags, overrides, onToggle, sport }: {
  team: string; players: FranchisePlayer[]; color: string; ownedNames?: string[]; ownedFlags?: Record<string, OwnedFlags>
  overrides?: Record<string, boolean>; onToggle?: (key: string, value: boolean | undefined) => void; sport?: string
}) {
  const [owned, setOwned] = useState<Set<string> | null>(null) // null = non connecte / en chargement
  const [autoOwned, setAutoOwned] = useState<Set<string> | null>(null) // noms (normalises) pour qui j'ai au moins une carte auto -- utilise seulement si ownedFlags n'est pas fourni par l'appelant
  const [loggedIn, setLoggedIn] = useState(false)
  const [decade, setDecade] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'have' | 'miss'>('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(120)
  const [order, setOrder] = useState<'alpha' | 'chrono'>('alpha')
  // filtre par type de carte (MA collection) : 0 = ignore, 1 = j'en ai, 2 = il me manque (un clic fait tourner)
  const [tf, setTf] = useState<Record<TagKind, 0 | 1 | 2>>({ rc: 0, auto: 0, patch: 0, num: 0 })
  // filtre independant : joueurs ayant au moins une carte auto QUELCONQUE recensee pour cette franchise, meme si je ne l'ai pas
  const [autoOnly, setAutoOnly] = useState(false)
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const askedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // collection deja connue de l'appelant (ex. galerie d'un utilisateur, CSV compris) : pas besoin de la relire
    if (ownedNames) { setLoggedIn(true); setOwned(new Set(ownedNames.map(n => normalizeName(n)))); return }
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      setLoggedIn(true)
      const names = new Set<string>()
      const autoNames = new Set<string>()
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from('cartes_manuelles').select('nom, auto').eq('user_id', user.id).order('id').range(from, from + 999)
        for (const c of data || []) if (c.nom) { const k = normalizeName(c.nom); names.add(k); if (c.auto) autoNames.add(k) }
        if (!data || data.length < 1000) break
      }
      if (!cancelled) { setOwned(names); setAutoOwned(autoNames) }
    })()
    return () => { cancelled = true }
  }, [ownedNames])

  // ordre alphabetique par nom de famille (les suffixes Jr / Sr / II... ne comptent pas), ou chronologique (premiere saison)
  const rows = useMemo(() => {
    const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v'])
    const sortKey = (name: string) => {
      const w = normalizeName(name).split(' ').filter(Boolean)
      while (w.length > 1 && SUFFIX.has(w[w.length - 1])) w.pop()
      return `${w[w.length - 1] || ''} ${w.slice(0, -1).join(' ')}`
    }
    const r = players.map(p => ({ name: p[0], y0: p[1], y1: p[2], n: p[3], hasAuto: !!p[4], key: normalizeName(p[0]), sk: sortKey(p[0]) }))
    if (order === 'alpha') r.sort((a, b) => a.sk.localeCompare(b.sk, 'fr'))
    else r.sort((a, b) => (a.y0 || 9999) - (b.y0 || 9999) || a.sk.localeCompare(b.sk, 'fr'))
    return r
  }, [players, order])
  const autoHas = (key: string) => !!(owned && owned.has(key))
  const hasOf = (key: string) => (overrides && key in overrides ? overrides[key] : autoHas(key))
  const haveCount = owned ? rows.filter(r => hasOf(r.key)).length : 0
  const pct = rows.length ? Math.round((haveCount / rows.length) * 100) : 0
  // parmi les joueurs ayant au moins une carte auto recensee (toutes checklists), combien j'en possede une (MA collection)
  const autoRows = rows.filter(r => r.hasAuto)
  const hasAutoOf = (key: string) => (ownedFlags ? !!ownedFlags[key]?.auto : !!(autoOwned && autoOwned.has(key)))
  const autoHaveCount = (ownedFlags || autoOwned) ? autoRows.filter(r => hasAutoOf(r.key)).length : 0
  const autoPct = autoRows.length ? Math.round((autoHaveCount / autoRows.length) * 100) : 0
  const nq = normalizeName(q)
  const list = rows.filter(r => {
    if (autoOnly && !r.hasAuto) return false
    if (decade != null && !(r.y0 && decadeOf(r.y0) <= decade && decadeOf(r.y1 || r.y0) >= decade)) return false
    if (filter === 'have' && !hasOf(r.key)) return false
    if (filter === 'miss' && owned && hasOf(r.key)) return false
    if (nq && !r.key.includes(nq)) return false
    if (ownedFlags) {
      const fl = ownedFlags[r.key]
      for (const { k } of KINDS) {
        if (tf[k] === 1 && !(fl && fl[k])) return false
        if (tf[k] === 2 && fl && fl[k]) return false
      }
    }
    return true
  })
  // photos des joueurs affiches (par lots de 40, a mesure qu'ils apparaissent) : remplacent le « ? »
  const visibleKey = list.slice(0, limit).map(r => r.name).join('|')
  useEffect(() => {
    if (!sport) return
    const need = list.slice(0, limit).map(r => r.name).filter(n => !askedRef.current.has(n))
    if (need.length === 0) return
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < need.length && !cancelled; i += 40) {
        const chunk = need.slice(i, i + 40)
        chunk.forEach(n => askedRef.current.add(n))
        try {
          const r = await fetch('/api/player-photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ names: chunk, sport }) })
          if (!r.ok) continue
          const d = await r.json() as { photos: Record<string, string | null> }
          if (!cancelled) setPhotos(prev => ({ ...prev, ...d.photos }))
          // les joueurs que le serveur n'a pas eu le temps de traiter seront redemandes au prochain affichage
          chunk.forEach(n => { if (!(n in d.photos)) askedRef.current.delete(n) })
        } catch { chunk.forEach(n => askedRef.current.delete(n)) }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, sport])

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
      {loggedIn && owned && (ownedFlags || autoOwned) && autoRows.length > 0 && (
        <div className="fr-prog fr-prog-auto" style={{ ['--tk' as string]: TAG_BASE.auto }}>
          <div className="fr-prog-l"><b>{autoHaveCount} / {autoRows.length}</b> autos · {autoPct} %</div>
          <div className="fr-bar"><i style={{ width: `${autoPct}%` }} /></div>
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
        <button type="button" className={'fr-chip fr-tf' + (autoOnly ? ' on' : '')} style={{ ['--tk' as string]: TAG_BASE.auto }}
          title="N'afficher que les joueurs ayant au moins une carte auto recensee avec cette franchise, meme si je ne l'ai pas"
          onClick={() => { setAutoOnly(v => !v); setLimit(120) }}>
          Auto existante{autoOnly ? ' ✓' : ''}
        </button>
      </div>
      {ownedFlags && (
        <div className="fr-tools">
          <span className="fr-tools-l">Mes cartes :</span>
          {KINDS.map(({ k, l }) => (
            <button key={k} type="button" className={'fr-chip fr-tf' + (tf[k] === 1 ? ' on' : tf[k] === 2 ? ' no' : '')} style={{ ['--tk' as string]: TAG_BASE[k] }}
              title={tf[k] === 0 ? `Afficher les joueurs dont j’ai une carte ${l}` : tf[k] === 1 ? `Afficher les joueurs dont il me manque une carte ${l}` : 'Retirer ce filtre'}
              onClick={() => { setTf(prev => ({ ...prev, [k]: ((prev[k] + 1) % 3) as 0 | 1 | 2 })); setLimit(120) }}>
              {l}{tf[k] === 1 ? ' ✓' : tf[k] === 2 ? ' ✗' : ''}
            </button>
          ))}
        </div>
      )}
      <div className="fr-tools">
        <span className="fr-tools-l">Tri :</span>
        <button type="button" className={'fr-chip' + (order === 'alpha' ? ' on' : '')} onClick={() => { setOrder('alpha'); setLimit(120) }}>A → Z</button>
        <button type="button" className={'fr-chip' + (order === 'chrono' ? ' on' : '')} onClick={() => { setOrder('chrono'); setLimit(120) }}>Chronologique</button>
      </div>
      <div className="fr-tools">
        <button type="button" className={'fr-chip' + (decade == null ? ' on' : '')} onClick={() => { setDecade(null); setLimit(120) }}>Toutes époques</button>
        {presentDecades.map(d => (
          <button key={d} type="button" className={'fr-chip' + (decade === d ? ' on' : '')} onClick={() => { setDecade(d); setLimit(120) }}>{d}s</button>
        ))}
      </div>
      <div className="fr-grid">
        {list.slice(0, limit).map(r => {
          const has = hasOf(r.key)
          const manual = !!(overrides && r.key in overrides)
          const photo = photos[r.name]
          return (
            <div key={r.name} className={'fr-cell' + (has ? ' have' : '') + (onToggle ? ' can-toggle' : '')}>
              <Link href={`/joueur/${playerSlug(r.name)}`} prefetch={false} className="fr-link" title={r.name}>
                <span className="fr-photo">
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    : <b>{r.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</b>}
                </span>
                <span className="fr-txt">
                  <span className="fr-name">{r.name}</span>
                  <span className="fr-years">{r.y0 ? (r.y1 && r.y1 !== r.y0 ? `${r.y0} – ${r.y1}` : r.y0) : ''}</span>
                  {ownedFlags && ownedFlags[r.key] && (
                    <span className="fr-kinds" aria-label="Mes cartes de ce joueur">
                      {KINDS.map(({ k, l }) => (
                        <i key={k} className={ownedFlags[r.key][k] ? 'on' : ''} style={{ ['--tk' as string]: TAG_BASE[k] }} title={ownedFlags[r.key][k] ? `J’ai une carte ${l}` : `Pas de carte ${l}`}>{k === 'num' ? 'N' : k === 'auto' ? 'A' : k === 'patch' ? 'P' : 'RC'}</i>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
              {onToggle ? (
                <button type="button" className={'fr-chk' + (has ? ' on' : '') + (manual ? ' manual' : '')} aria-pressed={has}
                  title={has ? 'Décocher (je ne l’ai pas)' : 'Cocher (je l’ai)'}
                  onClick={() => { const next = !has; onToggle(r.key, next === autoHas(r.key) ? undefined : next) }}>{has ? '✓' : ''}</button>
              ) : (
                has && <span className="fr-chk on static">✓</span>
              )}
            </div>
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
