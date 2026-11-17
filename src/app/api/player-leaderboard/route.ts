import { NextResponse } from 'next/server'
import { playerOwnerCounts } from '@/lib/playerOwners'
import { createServerClient } from '@/lib/supabaseServer'

// Classement complet des collectionneurs d'un joueur : GET /api/player-leaderboard?name=Allen Iverson
// -> { total, rows: [{ rank, id, name, avatar, cards }] } (les 100 premiers ; égalités = même rang). Même calcul que « Top x % » (playerOwnerCounts).
export const maxDuration = 60

export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get('name') || '').trim()
  if (!name || name.length > 80) return NextResponse.json({ total: 0, rows: [] })
  try {
    const counts = await playerOwnerCounts(name)
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (!entries.length) return NextResponse.json({ total: 0, rows: [], error: true }, { headers: { 'Cache-Control': 'no-store' } })
    const top = entries.slice(0, 100)
    const sb = createServerClient()
    const { data } = await sb.from('profiles').select('id, display_name, avatar_url').in('id', top.map(e => e[0]))
    const byId = new Map((data || []).map((p: any) => [p.id, p]))
    let rank = 0, prev = -1
    const rows = top.map(([id, cards], i) => {
      if (cards !== prev) { rank = i + 1; prev = cards }
      const p: any = byId.get(id)
      return { rank, id, name: p?.display_name || 'Collectionneur', avatar: p?.avatar_url || null, cards }
    })
    return NextResponse.json({ total: entries.length, rows }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } })
  } catch (e) {
    console.log('[player-leaderboard] échec pour', name, String(e))
    return NextResponse.json({ total: 0, rows: [], error: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
