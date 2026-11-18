'use client'
/* eslint-disable @next/next/no-img-element */
// « Mes cartes tirées » : toutes les cartes sorties de tes packs, avec tri, filtres et doublons.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { RARITY_COLOR, RARITY_NAME, type Rarity } from '@/lib/packs'
import { CardImg, Pills, hasPatch } from '@/app/packs/PacksClient'
import ShareToDiscord from '@/components/ShareToDiscord'
import '@/app/packs/packs.css'

type Pulled = {
  id: number; setId: number; qty: number; first: string; last: string; rarity: Rarity; player: string; team: string | null; number: string | null
  variation: string | null; rc: boolean; auto: boolean; patch?: boolean; run?: number | null; img: string; set: string | null; year: number | null; brand: string | null; sport: string | null; credit: string | null
}
type Sort = 'recent' | 'rarity' | 'az' | 'team' | 'year' | 'qty'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Plus récentes' }, { id: 'rarity', label: 'Rareté' }, { id: 'az', label: 'Joueur A → Z' },
  { id: 'team', label: 'Équipe' }, { id: 'year', label: 'Année' }, { id: 'qty', label: 'Doublons' },
]
const norm = (t: string) => (t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

export default function PackHistory({ onClose }: { onClose: () => void }) {
  const [cards, setCards] = useState<Pulled[] | null>(null)
  const [err, setErr] = useState('')
  const [uid, setUid] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('recent')
  const [rar, setRar] = useState<Rarity | 0>(0)
  const [kind, setKind] = useState<'' | 'rc' | 'auto' | 'patch' | 'dup'>('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Pulled | null>(null)
  const [wished, setWished] = useState<Set<number>>(new Set())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (sel) setSel(null); else onClose() } }
    window.addEventListener('keydown', key)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', key) }
  }, [onClose, sel])

  useEffect(() => {
    let off = false
    supabase.auth.getSession().then(async ({ data }) => {
      const t = data.session?.access_token
      if (!t) { setErr('Connecte-toi pour voir tes cartes tirées.'); return }
      setUid(data.session?.user?.id || null)
      try {
        const r = await fetch('/api/packs?view=inventory', { headers: { Authorization: 'Bearer ' + t } })
        const j = await r.json().catch(() => ({}))
        if (off) return
        if (!r.ok) { setErr(j.error ? 'Historique indisponible : ' + j.error : 'Historique indisponible'); return }
        setCards(j.cards as Pulled[])
      } catch { if (!off) setErr('Connexion impossible.') }
    })
    return () => { off = true }
  }, [])

  const counts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const x of cards || []) c[x.rarity] += 1
    return c
  }, [cards])
  const total = (cards || []).reduce((s, x) => s + x.qty, 0)

  const list = useMemo(() => {
    let l = [...(cards || [])]
    if (rar) l = l.filter(x => x.rarity === rar)
    if (kind === 'rc') l = l.filter(x => x.rc)
    if (kind === 'auto') l = l.filter(x => x.auto)
    if (kind === 'patch') l = l.filter(x => hasPatch(x))
    if (kind === 'dup') l = l.filter(x => x.qty > 1)
    const n = norm(q).trim()
    if (n) l = l.filter(x => norm([x.player, x.team, x.set, x.variation, x.year].filter(Boolean).join(' ')).includes(n))
    const cmp: Record<Sort, (a: Pulled, b: Pulled) => number> = {
      recent: (a, b) => b.last.localeCompare(a.last),
      rarity: (a, b) => b.rarity - a.rarity || a.player.localeCompare(b.player),
      az: (a, b) => a.player.localeCompare(b.player),
      team: (a, b) => (a.team || '~').localeCompare(b.team || '~') || a.player.localeCompare(b.player),
      year: (a, b) => (b.year || 0) - (a.year || 0) || a.player.localeCompare(b.player),
      qty: (a, b) => b.qty - a.qty || b.rarity - a.rarity,
    }
    return l.sort(cmp[sort])
  }, [cards, rar, kind, q, sort])

  async function toWishlist(c: Pulled) {
    if (!uid || wished.has(c.id)) return
    setWished(w => new Set(w).add(c.id))
    const { data: ex } = await supabase.from('wishlist').select('id').eq('user_id', uid).eq('nom', c.player).eq('collection', c.set || '').eq('variation', c.variation || '').limit(1)
    if (ex && ex.length) return
    const { error } = await supabase.from('wishlist').insert({
      user_id: uid, nom: c.player, annee: c.year ? String(c.year) : '', marque: c.brand || '', collection: c.set || '', variation: c.variation || '',
      num: '', rc: c.rc, auto: c.auto, patch: hasPatch(c), notes: [c.number ? `#${c.number}` : '', c.team || ''].filter(Boolean).join(' · '),
    })
    if (error) setWished(w => { const n = new Set(w); n.delete(c.id); return n })
  }

  return (
    <div className="pk ph" role="dialog" aria-modal="true" aria-label="Mes cartes tirées">
      <div className="ph-head">
        <div>
          <h2 className="da-display">Mes cartes tirées</h2>
          <small>{cards ? `${cards.length} différentes · ${total} au total` : 'Chargement…'}</small>
        </div>
        <button type="button" className="ph-x" onClick={onClose} aria-label="Fermer">✕</button>
      </div>

      {cards && cards.length > 0 && (
        <div className="ph-bar">
          <input className="ph-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Chercher un joueur, une équipe, un set…" />
          <select className="ph-sort" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Trier">
            {SORTS.map(s => <option key={s.id} value={s.id}>Tri : {s.label}</option>)}
          </select>
          <div className="ph-chips">
            <button type="button" className={!rar ? 'on' : ''} onClick={() => setRar(0)}>Toutes</button>
            {([5, 4, 3, 2, 1] as Rarity[]).map(r => (
              <button key={r} type="button" className={rar === r ? 'on' : ''} style={{ ['--rc' as string]: RARITY_COLOR[r] }} onClick={() => setRar(rar === r ? 0 : r)}>{RARITY_NAME[r]} <em>{counts[r]}</em></button>
            ))}
          </div>
          <div className="ph-chips">
            {([['', 'Tout'], ['rc', 'RC'], ['auto', 'Signées'], ['patch', 'Patch'], ['dup', 'Doublons']] as const).map(([id, label]) => (
              <button key={id} type="button" className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>{label}</button>
            ))}
          </div>
        </div>
      )}

      <div className="ph-body">
        {err && <p className="ph-empty">{err}</p>}
        {cards && cards.length === 0 && !err && <p className="ph-empty">Tu n’as encore tiré aucune carte. Ouvre ton premier pack !</p>}
        {cards && cards.length > 0 && list.length === 0 && <p className="ph-empty">Aucune carte ne correspond à ces filtres.</p>}
        <div className="ph-grid">
          {list.map(c => (
            <button key={c.id} type="button" className="ph-card" style={{ ['--rc' as string]: RARITY_COLOR[c.rarity] }} onClick={() => setSel(c)} title={`${c.player} · ${RARITY_NAME[c.rarity]}`}>
              <span className="ph-art"><CardImg src={c.img} /></span>
              <span className="ph-tag">{RARITY_NAME[c.rarity]}</span>
              {c.qty > 1 && <span className="ph-qty">×{c.qty}</span>}
              <span className="ph-corner">{c.rc && <i className="rc">RC</i>}{c.auto && <i className="au">AUTO</i>}{hasPatch(c) && <i className="pa">PATCH</i>}</span>
              <span className="ph-name">{c.player}</span>
            </button>
          ))}
        </div>
      </div>

      {sel && (
        <div className="ph-detail" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="ph-detail-card" style={{ ['--rc' as string]: RARITY_COLOR[sel.rarity] }}>
            <button type="button" className="ph-x" onClick={() => setSel(null)} aria-label="Fermer">✕</button>
            <div className="ph-big"><span className="ph-art"><CardImg src={sel.img} /></span><span className="ph-tag">{RARITY_NAME[sel.rarity]}</span></div>
            <div className="ph-info">
              <b className="da-display">{sel.player}</b>
              <small>{[sel.team, sel.number ? `#${sel.number}` : ''].filter(Boolean).join(' · ')}</small>
              <small>{[sel.year, sel.set].filter(Boolean).join(' ')}</small>
              <Pills c={{ ...sel, setId: sel.setId } as never} />
              <small>{sel.qty > 1 ? `Tirée ${sel.qty} fois` : 'Tirée 1 fois'} · la dernière fois le {new Date(sel.last).toLocaleDateString('fr-FR')}</small>
              <div className="pk-acts">
                <button type="button" className={wished.has(sel.id) ? 'on' : ''} onClick={() => void toWishlist(sel)}>{wished.has(sel.id) ? '★ En wishlist' : '☆ Wishlist'}</button>
                <Link href={`/setlist/${sel.setId}`} onClick={onClose}>Voir le set</Link>
                {sel.rarity >= 4 && <ShareToDiscord entryId={sel.id} />}
              </div>
              {sel.credit && <small className="cr">Photo : {sel.credit}</small>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
