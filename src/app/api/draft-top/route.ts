import { NextResponse } from 'next/server'

// Les premiers choix de la draft d'une année : GET /api/draft-top?sport=nba&year=2025&n=5 -> { picks: [{ pick, name }] }
// Source : ESPN (même source que les photos et fiches joueurs). Sert au « Top 5 rookies » des pages de set.
const PATHS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', hockey: 'hockey/nhl', baseball: 'baseball/mlb' }
// Avant 2001 (NBA) ESPN n'a pas la draft : repli sur Wikipédia (tableau « Draft selections »)
const WIKI: Record<string, (y: number) => string> = { nba: y => `${y}_NBA_draft`, nfl: y => `${y}_NFL_draft`, hockey: y => `${y}_NHL_entry_draft`, baseball: y => `${y}_Major_League_Baseball_draft` }
async function wikiPicks(sport: string, year: number): Promise<{ pick: number; name: string }[]> {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI[sport](year)}&prop=wikitext&format=json&formatversion=2&redirects=1`, { headers: { 'User-Agent': 'Memorabilius/1.0' }, signal: AbortSignal.timeout(8000), next: { revalidate: 604800 } } as RequestInit)
  if (!r.ok) return []
  const j = await r.json().catch(() => null)
  const w: string = (j?.parse?.wikitext || '').replace(/<!--[\s\S]*?-->/g, '')
  const picks: { pick: number; name: string }[] = [], seen = new Set<number>()
  for (const row of w.split(/\n\|-/)) {
    const cells = row.split('\n').filter(l => /^[|!]/.test(l) && !/^\|[}+]/.test(l)).flatMap(l => l.slice(1).split('||'))
    let pick = 0, name = ''
    for (const c0 of cells) {
      const c = c0.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>|<small>[\s\S]*?<\/small>/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, (m, a) => (/^\d+$/.test(a) ? a : m))
      const bare = c.trim().replace(/^(?:[a-z-]+\s*=\s*"?[^"|]*"?\s*\|)/i, '').replace(/[†*‡§^~\s]/g, '')
      if (/^\d{1,3}$/.test(bare)) { pick = +bare; continue }
      const sn = c.match(/\{\{sortname\|([^|}]+)\|([^|}]+)(?:\|([^|}=]+))?/i)
      const lk = c.match(/\[\[(?!File:|Image:)([^\]|]+)(?:\|([^\]]+))?\]\]/)
      if (sn) { const full = `${sn[1]} ${sn[2]}`.trim(), alt = (sn[3] || '').replace(/\s*\(.*?\)$/, '').trim(); name = alt && alt.toLowerCase().includes(sn[2].trim().toLowerCase()) ? alt : full; break }
      if (lk) { name = (lk[2] || lk[1]).replace(/\s*\(.*?\)$/, '').trim(); break }
    }
    if (pick && name.length > 3 && !seen.has(pick)) { seen.add(pick); picks.push({ pick, name }) }
  }
  return picks.sort((a, b) => a.pick - b.pick).slice(0, 80)
}
const memo = new Map<string, { at: number; picks: { pick: number; name: string }[] }>()

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const sport = sp.get('sport') || 'nba', year = parseInt(sp.get('year') || ''), n = Math.min(80, Math.max(1, parseInt(sp.get('n') || '5')))
  const path = PATHS[sport]
  if (!path || !year || year < 1950 || year > 2100) return NextResponse.json({ picks: [] })
  const key = `${sport}:${year}`, hit = memo.get(key)
  if (hit && Date.now() - hit.at < 24 * 3600_000) return NextResponse.json({ picks: hit.picks.slice(0, n) })
  try {
    const wiki = async () => { const p = await wikiPicks(sport, year).catch(() => []); memo.set(key, { at: p.length ? Date.now() : Date.now() - 23.5 * 3600_000, picks: p }); return NextResponse.json({ picks: p.slice(0, n) }, p.length ? { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } } : undefined) }
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/draft?season=${year}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return wiki()
    const j = await r.json().catch(() => ({}))
    const picks = ((j.picks || []) as { overall?: number; pick?: number; athlete?: { displayName?: string; fullName?: string } }[])
      .map(p => ({ pick: p.overall || p.pick || 0, name: (p.athlete?.displayName || p.athlete?.fullName || '').replace(/\s+/g, ' ').trim() }))
      .filter(p => p.pick > 0 && p.name).sort((a, b) => a.pick - b.pick).slice(0, 80)
    if (!picks.length) return wiki()
    memo.set(key, { at: Date.now(), picks })
    return NextResponse.json({ picks: picks.slice(0, n) }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })
  } catch { return NextResponse.json({ picks: [] }) }
}
