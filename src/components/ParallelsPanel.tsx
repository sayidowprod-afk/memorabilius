'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toViewerCard, type CardRow } from '@/lib/viewerCard'
import type { ViewerCardData } from '@/components/Viewer3D'
import { matchesEntryExact } from '@/lib/setMatcher'

// 852 · « Parallèles » dans la fiche du viewer 3D : toutes les déclinaisons de la carte dans son set (Silver, Gold, Red…).
// Celles que j'ai : MA photo + ✓. Celles qui me manquent : la photo de la communauté (comme dans les setlists), grisée. Et la progression « Rainbow ».
// Lecture seule : rien n'est écrit. Les bords des cartes restent nets.
interface CardLike { n: string; y: string; br: string; s: string; v: string; card_number?: string }
interface SetRow { id: number; name: string; year: number | null; brand: string | null; lignes: number }
interface Entry { id: number; card_number: string | null; variation: string | null; image_url: string | null; is_rc?: boolean | null }
interface Mine extends CardRow { id: string; nom: string; annee: string | null; marque: string | null; collection: string | null; collection_tag: string | null; variation: string | null; card_number: string | null; image_recto: string | null; image_recto_thumb: string | null }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1)
const GENERIC = new Set(['panini', 'topps', 'upper', 'deck', 'leaf', 'fleer', 'basketball', 'baseball', 'football', 'hockey', 'soccer', 'nba', 'nfl', 'mlb', 'nhl', 'trading', 'cards', 'card', 'sport', 'sports'])
const specificWords = (name: string) => words(name).filter(w => w.length > 2 && !GENERIC.has(w) && !/^\d+$/.test(w))

function sameVariation(mine: string, theirs: string): boolean {
  const a = (mine || '').trim(), b = (theirs || '').trim()
  if (!a && !b) return true
  if (!a || !b) return false
  if (norm(a) === norm(b)) return true
  const wa = new Set(words(a)), wb = new Set(words(b))
  if (!wa.size || !wb.size) return false
  if (![...wa].every(w => wb.has(w))) return false
  return wa.size / wb.size >= 0.5
}
// possession : variation IDENTIQUE (« Fade To Black » n'est pas « Fade To Black Phoenix Blue Ice »). La règle large ci-dessus ne sert qu'à choisir le bon groupe de cartes.
const strictVariation = (a: string, b: string) => norm((a || '').trim()) === norm((b || '').trim())
// l'année de MA carte correspond-elle à l'année du set ? (« 2025-26 » pour un set 2025, « 2025 » pour un set 2025…)
function yearOk(cardYear: string | null, setYear: number | null): boolean {
  if (!setYear) return true
  const a = (cardYear || '').trim()
  if (!a) return false
  return a.startsWith(String(setYear)) || a === String(setYear + 1) || a.endsWith('-' + String(setYear).slice(2))
}
// MA carte est-elle de ce set ? (année, mots propres au set comme « chrome » ou « prizm », numéro si les deux en ont un)
function mineInSet(c: Mine, set: SetRow, entryNumber: string | null): boolean {
  if (!yearOk(c.annee, set.year)) return false
  const sw = specificWords(set.name)
  const text = norm((c.marque || '') + ' ' + (c.collection || '') + ' ' + (c.collection_tag || ''))
  if (sw.length > 0) { if (!sw.some(w => text.includes(w))) return false }
  else if (set.brand && c.marque) { const nb = norm(c.marque), ns = norm(set.brand); if (nb && ns && !nb.includes(ns) && !ns.includes(nb)) return false }
  if (entryNumber && c.card_number && norm(entryNumber) !== norm(c.card_number)) return false
  return true
}
const COLORS: [RegExp, string][] = [[/silver/i, '#cfd3e6'], [/gold/i, '#e0a526'], [/red/i, '#d6293e'], [/blue|ice/i, '#2f6bff'], [/green|neon/i, '#1e9e57'], [/orange/i, '#e67e22'], [/purple|violet/i, '#7a2bff'], [/pink/i, '#e75fa5'], [/black/i, '#444'], [/white/i, '#f5f5f5'], [/bronze|copper/i, '#b87333'], [/teal|aqua|cyan/i, '#1cb5b5'], [/yellow/i, '#e8d33d']]
const colorOf = (v: string | null) => (v ? COLORS.find(([re]) => re.test(v))?.[1] : '#aab3d1') || '#7f8aa8'

export default function ParallelsPanel({ card, currentUserId, metaColor, textColor, borderColor, onOpen }: { card: CardLike; currentUserId?: string; metaColor: string; textColor: string; borderColor: string; onOpen?: (card: ViewerCardData, ownerId: string, mine: boolean) => void }) {
  const [sets, setSets] = useState<SetRow[]>([])
  const [setId, setSetId] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [mine, setMine] = useState<Mine[]>([])
  const [community, setCommunity] = useState<Map<number, { image: string; card: CardRow & { user_id?: string } }>>(new Map())
  const [numSel, setNumSel] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'none' | 'ok'>('loading')
  const [wish, setWish] = useState<Map<string, number>>(new Map())   // 889 : variations de ce set déjà dans ma wishlist (variation normalisée -> id)
  const [open, setOpen] = useState(false)   // volet fermé de base : rien n'est chargé côté photos tant qu'on ne l'ouvre pas

  // 1) le set de cette carte
  useEffect(() => {
    let cancel = false
    ;(async () => {
      setState('loading'); setSets([]); setSetId(null); setEntries([]); setCommunity(new Map())
      const name = (card.n || '').trim()
      const yr = parseInt((card.y || '').slice(0, 4))
      if (!name || !yr) { setState('none'); return }
      const ws = words((card.s || '') + ' ' + (card.br || '')).filter(w => w.length > 2 && !/^\d+$/.test(w) && !GENERIC.has(w))
      let qb = supabase.from('card_sets').select('id, name, year, brand').in('year', [yr, yr - 1]).limit(30)
      for (const w of ws.slice(0, 2)) qb = qb.ilike('name', '%' + w + '%')
      const { data } = await qb
      const mineWords = new Set(words([card.y, card.br, card.s].filter(Boolean).join(' ')))
      const score = (st: { name: string; year: number | null }) => {
        const extra = words(st.name).filter(w => !mineWords.has(w) && !/^\d+$/.test(w)).length
        return (st.year === yr ? 3 : 0) + (card.y && norm(st.name).includes(norm(card.y)) ? 3 : 0) - extra * 2
      }
      const ranked = ((data || []) as Omit<SetRow, 'lignes'>[]).sort((x, y) => score(y) - score(x)).slice(0, 6)
      const counts = await Promise.all(ranked.map(st => supabase.from('card_set_entries').select('id', { count: 'exact', head: true }).eq('set_id', st.id).ilike('player_name', name).then(r => r.count || 0)))
      if (cancel) return
      const list = ranked.map((st, i) => ({ ...st, lignes: counts[i] })).filter(st => st.lignes > 0)
      if (!list.length) { setState('none'); return }
      setSets(list); setSetId(list[0].id)
    })()
    return () => { cancel = true }
  }, [card.n, card.y, card.br, card.s])

  // 2) ses lignes dans le set, mes cartes de ce joueur
  useEffect(() => {
    if (!setId) return
    let cancel = false
    ;(async () => {
      const name = (card.n || '').trim()
      const [{ data: es }, { data: ms }] = await Promise.all([
        supabase.from('card_set_entries').select('id, card_number, variation, image_url, is_rc').eq('set_id', setId).ilike('player_name', name).limit(600),
        currentUserId
          ? supabase.from('cartes_manuelles').select('*').eq('user_id', currentUserId).ilike('nom', name).limit(300)
          : Promise.resolve({ data: [] as Mine[] }),
      ])
      if (cancel) return
      setEntries((es || []) as Entry[]); setMine((ms || []) as Mine[]); setState((es || []).length ? 'ok' : 'none')
    })()
    return () => { cancel = true }
  }, [setId, card.n, currentUserId])

  const set = sets.find(s => s.id === setId) || null
  useEffect(() => {
    if (!open || !set || !currentUserId) return
    let cancel = false
    supabase.from('wishlist').select('id, variation').eq('user_id', currentUserId).eq('collection', set.name).ilike('nom', (card.n || '').trim()).limit(300).then(({ data }) => {
      if (cancel) return
      setWish(new Map((data || []).map(w => [norm(String(w.variation || '')), w.id as number])))
    })
    return () => { cancel = true }
  }, [open, set, currentUserId, card.n])
  const toggleWish = async (e: Entry) => {
    if (!currentUserId || !set) return
    const k = norm(e.variation || '')
    const id = wish.get(k)
    if (id) {
      setWish(m => { const n = new Map(m); n.delete(k); return n })
      const { error } = await supabase.from('wishlist').delete().eq('id', id)
      if (error) setWish(m => new Map(m).set(k, id))
    } else {
      const { data, error } = await supabase.from('wishlist').insert({
        user_id: currentUserId, nom: (card.n || '').trim(), annee: set.year ? String(set.year) : '', marque: set.brand || '', collection: set.name,
        variation: e.variation || '', num: '', rc: !!e.is_rc, auto: false, patch: false, notes: e.card_number ? '#' + e.card_number : '',
      }).select('id').single()
      if (!error && data) setWish(m => new Map(m).set(k, data.id as number))
    }
  }
  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>()
    for (const e of entries) { const k = e.card_number || '—'; m.set(k, [...(m.get(k) || []), e]) }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [entries])
  useEffect(() => {
    // la bonne « carte » du set : le même numéro ; sinon celle dont une variation ressemble à celle de cette carte ; sinon la plus fournie
    const byNumber = card.card_number && groups.find(g => norm(g[0]) === norm(card.card_number || ''))
    const byVariation = card.v ? (groups.find(g => g[1].some(e => strictVariation(card.v, e.variation || ''))) || groups.find(g => g[1].some(e => sameVariation(card.v, e.variation || '')))) : groups.find(g => g[1].some(e => !e.variation))
    setNumSel((byNumber || byVariation || groups[0])?.[0] || null)
  }, [groups, card.card_number, card.v])
  const group = groups.find(g => g[0] === numSel)?.[1] || []
  const rows = useMemo(() => group.map(e => {
    const own = set ? mine.find(c => matchesEntryExact({ nom: c.nom, annee: c.annee, marque: c.marque, collection: c.collection, collection_tag: c.collection_tag, variation: c.variation, card_number: c.card_number }, { id: e.id, player_name: card.n, card_number: e.card_number, variation: e.variation, set_id: set.id }, { id: set.id, name: set.name, year: set.year, brand: set.brand })) : undefined
    return { e, own }
  }), [group, mine, set])
  const owned = rows.filter(r => r.own).length

  // 3) photos de la communauté pour les parallèles que je n'ai pas : seulement si la variation correspond EXACTEMENT, sinon rien (un « ? »)
  useEffect(() => {
    if (!open || !set || !rows.length) return
    const missing = rows.filter(r => !r.own && !r.e.image_url).map(r => ({ id: r.e.id, card_number: r.e.card_number, variation: r.e.variation }))
    if (!missing.length) return
    let cancel = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token || cancel) return
      fetch('/api/setlist-images/parallels', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
        body: JSON.stringify({ setId: set.id, setYear: set.year, setBrand: set.brand, setName: set.name, player: card.n, entries: missing }),
      }).then(r => (r.ok ? r.json() : [])).then((imgs: { entry_id: number; image_url: string; card: CardRow & { user_id?: string } }[]) => {
        if (cancel || !imgs.length) return
        setCommunity(prev => { const n = new Map(prev); for (const i of imgs) n.set(i.entry_id, { image: i.image_url, card: i.card }); return n })
      }).catch(() => {})
    })
    return () => { cancel = true }
  }, [open, set, rows, card.n])

  if (state === 'none' || (state === 'ok' && rows.length < 2)) return null   // pas de parallèles connues : on n'affiche rien
  if (state === 'loading') return <div style={{ marginTop: 10, fontSize: 11, color: metaColor }}>Parallèles…</div>

  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid ' + borderColor }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, marginBottom: open ? 6 : 0, cursor: 'pointer', color: textColor, textAlign: 'left' }}>
        <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: metaColor }}>Parallèles</span>
        <div style={{ flex: 1, height: 6, background: 'rgba(128,128,128,.25)' }}><div style={{ width: (owned / rows.length * 100) + '%', height: '100%', background: '#1e9e57' }} /></div>
        <b style={{ fontSize: 11, color: textColor }}>{owned} / {rows.length}</b>
        <span aria-hidden="true" style={{ fontSize: 10, color: metaColor, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>
      {open && <>
      {sets.length > 1 && (
        <select value={setId ?? ''} onChange={e => setSetId(parseInt(e.target.value))} style={{ width: '100%', marginBottom: 6, fontSize: 11, padding: 4, background: 'transparent', color: textColor, border: '1px solid ' + borderColor }}>
          {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {groups.length > 1 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {groups.slice(0, 8).map(([n, g]) => <button key={n} type="button" onClick={() => setNumSel(n)} style={{ padding: '2px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: numSel === n ? '#fff' : textColor, background: numSel === n ? '#2f6bff' : 'transparent', border: '1px solid ' + (numSel === n ? '#2f6bff' : borderColor) }}>N° {n} · {g.length}</button>)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4, maxHeight: 132, overflowY: 'auto' }}>
        {rows.map(({ e, own }) => {
          const com = community.get(e.id)
          const img = own ? (own.image_recto_thumb || own.image_recto) : (com?.image || e.image_url || null)
          const openIt = () => {
            if (!onOpen) return
            if (own) onOpen(toViewerCard(own), currentUserId || '', true)
            else if (com) onOpen(toViewerCard(com.card), String(com.card.user_id || ''), false)
          }
          const clickable = !!own || !!com
          const col = colorOf(e.variation)
          return (
            <button key={e.id} type="button" onClick={openIt} title={(e.variation || 'Base') + (own ? ' · tu l’as : ouvrir en 3D' : com ? ' · il te manque : voir la carte de ce membre en 3D' : ' · il te manque')}
              style={{ background: 'none', border: 0, padding: 0, cursor: clickable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: textColor }}>
              <div style={{ width: '100%', aspectRatio: '5 / 7', position: 'relative', border: '2px ' + (own ? 'solid' : 'dashed') + ' ' + col, overflow: 'hidden', background: 'rgba(128,128,128,.12)' }}>
                {img
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={img} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: own ? 1 : .5, filter: own ? 'none' : 'grayscale(.5)' }} />
                  : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: col, font: '800 14px system-ui' }}>?</div>}
                {own && <span style={{ position: 'absolute', top: 1, right: 1, background: '#1e9e57', color: '#fff', font: '900 10px system-ui', padding: '0 4px' }}>✓</span>}
                {!own && currentUserId && (
                  <span role="button" aria-label={wish.has(norm(e.variation || '')) ? 'Retirer de ma wishlist' : 'Ajouter à ma wishlist'} title={wish.has(norm(e.variation || '')) ? 'Dans ta wishlist : retirer' : 'Ajouter à ma wishlist'}
                    onClick={ev => { ev.stopPropagation(); toggleWish(e) }}
                    style={{ position: 'absolute', bottom: 1, left: 1, background: wish.has(norm(e.variation || '')) ? '#e0a526' : 'rgba(0,0,0,.6)', color: '#fff', font: '700 10px system-ui', padding: '1px 4px', cursor: 'pointer' }}>{wish.has(norm(e.variation || '')) ? '★' : '☆'}</span>
                )}
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, textAlign: 'center', lineHeight: 1.1, opacity: own ? 1 : .75, overflowWrap: 'anywhere' }}>{e.variation || 'Base'}</span>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 9, color: metaColor, marginTop: 3 }}>En couleur : tes cartes. Grisées : la carte d’un autre membre (un clic l’ouvre en 3D). ☆ : ajouter à ta wishlist.</div>
      </>}
    </div>
  )
}
