import { NextRequest, NextResponse } from 'next/server'
import { SPORTS_TEAMS, type SportsTeam } from '@/lib/sportsTeams'
import { teamSlug } from '@/lib/playerSlug'
import { createServerClient } from '@/lib/supabaseServer'

// Pagination de la section "Sets" d'une page equipe (defilement), meme
// principe que /api/player-sets -- generer+serialiser TOUS les sets d'une
// franchise d'un coup cote serveur pouvait peser plus de 10 Mo de HTML pour
// une franchise historique (ex: Chicago Bulls).
const supabase = createServerClient()

function findTeam(slug: string): SportsTeam | null {
  return SPORTS_TEAMS.find(t => teamSlug(t.name) === slug) || null
}

const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 30) return false
  e.n++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const sp = req.nextUrl.searchParams
  const slug = sp.get('slug')?.trim()
  const team = slug ? findTeam(slug) : null
  if (!team) return NextResponse.json({ sets: [], total: 0, hasMore: false })
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  const limit = Math.min(120, Math.max(1, parseInt(sp.get('limit') || '40', 10) || 40))

  const teamLastWord = team.name.split(' ').slice(-1)[0]
  const { data: entries } = await supabase
    .from('card_set_entries')
    .select('set_id, card_sets(id, name, year, brand, sport)')
    .ilike('team', `%${teamLastWord}%`)

  const setsMap = new Map<number, any>()
  for (const e of entries || []) {
    const cs = (e as any).card_sets
    if (!cs) continue
    if (!setsMap.has(cs.id)) setsMap.set(cs.id, { ...cs })
  }
  const sets = [...setsMap.values()].sort((a, b) => (b.year || 0) - (a.year || 0))

  const total = sets.length
  const page = sets.slice(offset, offset + limit)
  return NextResponse.json({ sets: page, total, hasMore: offset + limit < total })
}
