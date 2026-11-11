'use client'
// 654 : progression par extension pour les cartes Pokémon (« Épée et Bouclier : 42 / 172 »). Le total vient de TCGdex ; les autres jeux affichent le nombre de cartes.
import { useEffect, useMemo, useState } from 'react'

interface C { jeu?: string; collection?: string; s?: string; card_number?: string; tcg_ref?: string; langue?: string }
const setIdOf = (ref?: string) => { const i = (ref || '').lastIndexOf('-'); return i > 0 ? (ref as string).slice(0, i) : '' }

export default function TcgSetProgress({ cards, accent, dark }: { cards: C[]; accent: string; dark: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; setId: string; lang: string; nums: Set<string>; n: number }>()
    for (const c of cards) {
      if (!c.jeu) continue
      const name = (c.collection ?? c.s ?? '').trim()
      if (!name) continue
      const key = `${c.jeu}|${name}`
      const g = m.get(key) || { name, setId: c.jeu === 'pokemon' ? setIdOf(c.tcg_ref) : '', lang: c.langue || 'FR', nums: new Set<string>(), n: 0 }
      g.n++
      g.nums.add((c.card_number || '').split('/')[0].replace(/^0+/, '') || String(g.n))
      if (!g.setId && c.jeu === 'pokemon') g.setId = setIdOf(c.tcg_ref)
      m.set(key, g)
    }
    return [...m.values()].sort((a, b) => b.nums.size - a.nums.size).slice(0, 12)
  }, [cards])
  const [totals, setTotals] = useState<Record<string, number>>({})
  useEffect(() => {
    let dead = false
    groups.forEach(g => {
      if (!g.setId || totals[g.setId] != null) return
      fetch(`/api/tcg/set?id=${encodeURIComponent(g.setId)}&lang=${encodeURIComponent(g.lang)}`).then(r => r.json())
        .then(j => { if (!dead && typeof j.total === 'number') setTotals(t => ({ ...t, [g.setId]: j.total })) }).catch(() => {})
    })
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])
  if (!groups.length) return null
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
      {groups.map(g => {
        const total = g.setId ? totals[g.setId] : undefined
        const have = g.nums.size
        const pct = total ? Math.min(100, Math.round((have / total) * 100)) : 0
        return (
          <div key={g.name + g.setId} style={{ background: dark ? '#1e1e1e' : '#fff', border: `1px solid ${dark ? '#333' : '#eee'}`, borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, fontWeight: 800, color: dark ? '#eee' : '#222' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{total ? `${have} / ${total}` : have}{total ? ` · ${pct} %` : ''}</span>
            </div>
            {total ? <div style={{ height: 6, borderRadius: 3, background: dark ? '#333' : '#eee', marginTop: 6, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: accent }} /></div> : null}
          </div>
        )
      })}
    </div>
  )
}
