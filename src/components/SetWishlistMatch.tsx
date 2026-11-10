'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// « 🎯 5 joueurs de ta wishlist dans ce set : Wembanyama, Maxey… » : pour savoir, avant d'acheter, si une sortie te concerne.
// Léger : la wishlist est lue une seule fois (mémorisée), et chaque set n'est interrogé que sur ces noms (pas toute sa checklist).
// Rien n'est affiché si tu n'es pas connecté, si ta wishlist est vide ou si aucun de tes joueurs n'est dans le set.

let wishPromise: Promise<string[]> | null = null
const loadWish = (): Promise<string[]> => {
  if (!wishPromise) {
    wishPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return []
        const { data } = await supabase.from('wishlist').select('nom').eq('user_id', session.user.id).limit(500)
        return [...new Set((data || []).map(r => String((r as { nom: string | null }).nom || '').trim()).filter(Boolean))]
      } catch { return [] }
    })()
  }
  return wishPromise
}

type Match = { count: number; sample: string[] }
const cache = new Map<number, Promise<Match>>()
function matchFor(setId: number, names: string[]): Promise<Match> {
  let p = cache.get(setId)
  if (!p) {
    p = (async () => {
      const found = new Set<string>()
      for (let i = 0; i < names.length; i += 100) {
        const { data } = await supabase.from('card_set_entries').select('player_name').eq('set_id', setId).in('player_name', names.slice(i, i + 100)).limit(1000)
        for (const r of data || []) found.add(String((r as { player_name: string }).player_name))
      }
      const list = [...found].sort()
      return { count: list.length, sample: list.slice(0, 3) }
    })().catch(() => ({ count: 0, sample: [] }))
    cache.set(setId, p)
  }
  return p
}

export default function SetWishlistMatch({ setId, className, style }: { setId: number | string; className?: string; style?: React.CSSProperties }) {
  const [m, setM] = useState<Match | null>(null)
  useEffect(() => {
    let alive = true
    const id = Number(setId)
    if (!Number.isFinite(id)) return
    loadWish().then(async names => {
      if (!names.length) return
      const r = await matchFor(id, names)
      if (alive) setM(r)
    })
    return () => { alive = false }
  }, [setId])
  if (!m || m.count === 0) return null
  return (
    <div className={className} style={style}>
      🎯 {m.count} joueur{m.count > 1 ? 's' : ''} de ta wishlist dans ce set : {m.sample.join(', ')}{m.count > m.sample.length ? '…' : ''}
    </div>
  )
}
