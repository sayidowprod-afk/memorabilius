import { NextResponse } from 'next/server'
import { fetchEspnPlayerBio } from '@/lib/espnHeadshot'
import { TEAM_COLORS } from '@/lib/teamColors'

// Équipes où un joueur a évolué (abréviations de nos corps d'équipe) : GET /api/player-teams?name=Allen Iverson
// Sert au menu du maillot des boîtes de PC (« équipes passées » du joueur).
const ALIAS: Record<string, string> = { 'la clippers': 'LAC', 'los angeles clippers': 'LAC', 'la lakers': 'LAL', 'new jersey nets': 'BKN', 'seattle supersonics': 'SEA', 'charlotte bobcats': 'BOB' }
const byName = new Map<string, string>()
for (const [n, v] of Object.entries(TEAM_COLORS)) byName.set(n.toLowerCase(), v.abbr)
const memo = new Map<string, { at: number; abbrs: string[] }>()

export async function GET(req: Request) {
  const name = (new URL(req.url).searchParams.get('name') || '').trim().slice(0, 80)
  if (name.length < 2) return NextResponse.json({ abbrs: [] })
  const hit = memo.get(name)
  if (hit && Date.now() - hit.at < 24 * 3600_000) return NextResponse.json({ abbrs: hit.abbrs })
  let abbrs: string[] = []
  try {
    const bio = await fetchEspnPlayerBio(name, 'nba')
    const seen = new Set<string>()
    for (const t of bio?.teams || []) {
      const k = t.toLowerCase(); const ab = ALIAS[k] || byName.get(k)
      if (ab && !seen.has(ab)) { seen.add(ab); abbrs.push(ab) }
    }
  } catch { abbrs = [] }
  if (abbrs.length) memo.set(name, { at: Date.now(), abbrs })
  return NextResponse.json({ abbrs }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
}
