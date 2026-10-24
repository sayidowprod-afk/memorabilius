import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Suggestions legeres pour la recherche du header (icone loupe, voir
// HeaderSearch.tsx) -- volontairement separee de /api/recherche, qui elle
// scanne aussi les cartes manuelles, les CSV et l'API ESPN (couteux, pensee
// pour la page /recherche en plein, pas pour etre appelee a chaque frappe
// clavier depuis n'importe quelle page du site). Ici : juste joueurs +
// collectionneurs, sur colonnes deja indexees en trigram (voir migration
// 20260828_search_trigram_indexes.sql), limites a quelques lignes chacun.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RATE_MAP = new Map<string, { count: number; reset: number }>()
setInterval(() => {
  const now = Date.now()
  for (const [ip, e] of RATE_MAP) if (now > e.reset) RATE_MAP.delete(ip)
}, 60 * 60 * 1000)
function checkRate(ip: string): boolean {
  const now = Date.now()
  const e = RATE_MAP.get(ip)
  if (!e || now > e.reset) { RATE_MAP.set(ip, { count: 1, reset: now + 60_000 }); return true }
  if (e.count >= 40) return false
  e.count++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRate(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ players: [], collectors: [] })
  const safeQ = q.replace(/%/g, '\\%').replace(/_/g, '\\_')

  const [{ data: playerRows }, { data: profileRows }] = await Promise.all([
    supabase.from('card_set_entries').select('player_name').ilike('player_name', `%${safeQ}%`).limit(30),
    supabase.rpc('search_profiles_unaccent', { q: safeQ, max_rows: 5 }),
  ])

  const players = [...new Set((playerRows || []).map((r: any) => r.player_name).filter(Boolean))].slice(0, 6)
  const collectors = (profileRows || []).map((p: any) => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }))

  return NextResponse.json({ players, collectors })
}
