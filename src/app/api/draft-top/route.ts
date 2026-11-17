import { NextResponse } from 'next/server'

// Les premiers choix de la draft d'une année : GET /api/draft-top?sport=nba&year=2025&n=5 -> { picks: [{ pick, name }] }
// Source : ESPN (même source que les photos et fiches joueurs). Sert au « Top 5 rookies » des pages de set.
const PATHS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', hockey: 'hockey/nhl', baseball: 'baseball/mlb' }
const memo = new Map<string, { at: number; picks: { pick: number; name: string }[] }>()

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') || 'nba', year = parseInt(sp.get('year') || ''), n = Math.min(80, Math.max(1, parseInt(sp.get('n') || '5')))
  const path = PATHS[sport]
  if (!path || !year || year < 1990 || year > 2100) return NextResponse.json({ picks: [] })
  const key = `${sport}:${year}`, hit = memo.get(key)
  if (hit && Date.now() - hit.at < 24 * 3600_000) return NextResponse.json({ picks: hit.picks.slice(0, n) })
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/draft?season=${year}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return NextResponse.json({ picks: [] })
    const j = await r.json()
    const picks = ((j.picks || []) as { overall?: number; pick?: number; athlete?: { displayName?: string; fullName?: string } }[])
      .map(p => ({ pick: p.overall || p.pick || 0, name: (p.athlete?.displayName || p.athlete?.fullName || '').replace(/\s+/g, ' ').trim() }))
      .filter(p => p.pick > 0 && p.name).sort((a, b) => a.pick - b.pick).slice(0, 80)
    if (picks.length) memo.set(key, { at: Date.now(), picks })
    return NextResponse.json({ picks: picks.slice(0, n) }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch { return NextResponse.json({ picks: [] }) }
}
