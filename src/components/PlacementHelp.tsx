'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { candidatesForCard, norm, normBrand, setCouldMatchCard, type MCard, type MEntry, type MSet } from '@/lib/setMatcher'

// Dans la fiche d'une carte NON rangée (viewer, bloc « Setlist », propriétaire seulement) :
//  919 · carte sans collection : « Collection probable : Topps Chrome ? » (d'après l'année, la marque et le joueur) ;
//  920 · variation inconnue de la checklist : « Tu voulais dire : China, Silver… ? » (les variations connues de ce joueur dans ce set).
// Un clic enregistre la correction sur la carte puis la range dans la setlist si la ligne est unique.
interface Props {
  card: { n: string; y: string; br: string; s: string; v: string; card_number?: string; collection_tag?: string }
  cardId?: string
  onPlaced: (entryId: number, set: MSet & { sport?: string }) => Promise<void> | void
  metaColor: string; borderColor: string; accent: string
}
type Choice = { label: string; apply: Partial<{ collection: string; variation: string }>; hint?: string }

const words = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 1)

export default function PlacementHelp({ card, cardId, onPlaced, metaColor, borderColor, accent }: Props) {
  const [title, setTitle] = useState('')
  const [choices, setChoices] = useState<Choice[]>([])
  const [ctx, setCtx] = useState<{ sets: Map<number, MSet & { sport?: string }>; entries: MEntry[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setChoices([]); setTitle(''); setMsg(''); setCtx(null)
      const yr = parseInt((card.y || '').slice(0, 4))
      const name = (card.n || '').trim()
      if (!yr || !name) return
      const { data: setsData } = await supabase.from('card_sets').select('id, name, year, brand, sport').eq('year', yr).limit(120)
      const sets = (setsData || []) as (MSet & { sport?: string })[]
      if (!sets.length) return
      const coll = (card.s || '').trim() || (card.collection_tag || '').trim()

      // lignes de ce joueur dans les sets de l'année (limitées aux sets de la marque si elle est connue)
      const brand = normBrand(card.br)
      const pool = sets.filter(s => !brand || !s.brand || normBrand(s.brand).includes(brand) || brand.includes(normBrand(s.brand)) || norm(s.name).includes(norm(card.br)))
      const entries: MEntry[] = []
      const setMap = new Map<number, MSet & { sport?: string }>()
      for (const st of pool.slice(0, 25)) {
        const { data: es } = await supabase.from('card_set_entries').select('id, player_name, card_number, variation, set_id').eq('set_id', st.id).ilike('player_name', name).limit(400)
        if (es?.length) { setMap.set(st.id, st); entries.push(...(es as MEntry[])) }
      }
      if (cancel || !entries.length) return
      setCtx({ sets: setMap, entries })

      if (!coll) {
        // 919 : plusieurs sets de la marque où ce joueur apparaît -> « Collection probable »
        const bw = new Set([...words(card.br), 'panini', 'topps', 'upper', 'deck', 'the'])
        const seen = new Set<string>(), out: Choice[] = []
        for (const st of setMap.values()) {
          const product = words(st.name).filter(w => !/^\d+$/.test(w) && !bw.has(w) && !words(st.brand || '').includes(w)).join(' ')
          if (!product || seen.has(product)) continue
          seen.add(product)
          out.push({ label: [card.br, product].filter(Boolean).join(' ').replace(/\b\w/g, c => c.toUpperCase()), apply: { collection: product.replace(/\b\w/g, c => c.toUpperCase()) }, hint: st.name })
        }
        if (out.length) { setTitle('Cette carte n’a pas de collection. Elle ressemble à :'); setChoices(out.slice(0, 5)) }
        return
      }

      // 920 : la collection est connue, le set aussi, mais aucune ligne ne correspond -> variations connues
      const mc: MCard = { nom: name, annee: card.y, marque: card.br, collection: card.s, collection_tag: card.collection_tag, variation: card.v, card_number: card.card_number }
      const strict = [...setMap.values()].filter(st => setCouldMatchCard(mc, st))
      if (!strict.length) return
      const inSets = entries.filter(e => strict.some(st => st.id === e.set_id))
      if (candidatesForCard(mc, inSets, setMap).length) return    // elle se range : pas d'aide à donner
      const cn = norm(card.card_number)
      const scope = cn ? inSets.filter(e => norm(e.card_number) === cn) : inSets
      const cardWords = new Set(words(card.v))
      const seen = new Set<string>()
      const ranked = (scope.length ? scope : inSets)
        .map(e => ({ v: (e.variation || '').trim(), score: words(e.variation || '').filter(w => cardWords.has(w)).length }))
        .filter(x => { const k = norm(x.v); if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => b.score - a.score || a.v.localeCompare(b.v))
        .slice(0, 6)
      if (ranked.length) {
        setTitle(card.v ? '« ' + card.v + ' » n’existe pas dans ce set. Tu voulais dire :' : 'Quelle variation est-ce ?')
        setChoices(ranked.map(x => ({ label: x.v || 'Base', apply: { variation: x.v } })))
      }
    })()
    return () => { cancel = true }
  }, [card.n, card.y, card.br, card.s, card.v, card.card_number, card.collection_tag])

  if (!choices.length || !cardId) return null

  const apply = async (c: Choice) => {
    if (!ctx) return
    setBusy(true); setMsg('')
    const patch: Record<string, string> = {}
    if (c.apply.collection !== undefined) patch.collection = c.apply.collection
    if (c.apply.variation !== undefined) patch.variation = c.apply.variation
    const { error } = await supabase.from('cartes_manuelles').update(patch).eq('id', cardId)
    if (error) { setMsg('Impossible d’enregistrer pour le moment.'); setBusy(false); return }
    // on tente de la ranger avec la correction : seulement si UNE ligne correspond
    const fixed: MCard = { nom: card.n, annee: card.y, marque: card.br, collection: c.apply.collection ?? card.s, collection_tag: card.collection_tag, variation: c.apply.variation ?? card.v, card_number: card.card_number }
    const cands = candidatesForCard(fixed, ctx.entries, ctx.sets as Map<number, MSet>)
    if (cands.length === 1) {
      const st = ctx.sets.get(cands[0].set_id)
      if (st) { await onPlaced(cands[0].id, st); setMsg('✓ Corrigé et rangée dans ' + st.name + '.'); setChoices([]); setBusy(false); return }
    }
    setMsg('✓ Corrigé. Plusieurs lignes restent possibles : choisis-la avec « Placer dans un set ».')
    setChoices([]); setBusy(false)
  }

  return (
    <div style={{ marginTop: 8, padding: '8px 9px', border: '1px solid ' + accent, background: 'rgba(47,107,255,.08)' }}>
      <div style={{ fontSize: 11, color: metaColor, marginBottom: 6, lineHeight: 1.35 }}>💡 {title}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {choices.map(c => (
          <button key={c.label} type="button" disabled={busy} title={c.hint} onClick={() => apply(c)}
            style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', border: '1px solid ' + borderColor, background: 'none', color: accent, cursor: 'pointer' }}>{c.label}</button>
        ))}
      </div>
      {msg && <div style={{ fontSize: 11, color: metaColor, marginTop: 6 }}>{msg}</div>}
    </div>
  )
}
