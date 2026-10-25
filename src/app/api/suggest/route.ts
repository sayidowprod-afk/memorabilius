import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

// Suggestions de recherche en direct (accueil) : version LEGERE de /api/recherche, qui scanne les galeries CSV et interroge 4 sports ESPN
// (plusieurs secondes). Ici : 3 collectionneurs + 4 joueurs, bases de donnees en parallele (~100 ms), ESPN en renfort avec un delai court.
const supabase = createServerClient()

const CACHE = new Map<string, { at: number; body: unknown }>()
const TTL = 60_000
const RATE = new Map<string, { n: number; reset: number }>()
// 240/min etait tres genereux pour une route qui scanne card_set_entries (14M+
// lignes, motif %terme% sans index utilisable) -- resserre en attendant le vrai
// fix (index trigram pg_trgm, voir memoire du projet) le temps que la base se
// stabilise. Le debounce cote client (NativeHomeDashboard.tsx) absorbe deja
// l'essentiel du trafic normal, cette limite ne vise qu'un usage legitime.
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 60) return false
  e.n++; return true
}

const normStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ users: [], players: [] }, { status: 429 })

  const query = (req.nextUrl.searchParams.get('q') || '').toLowerCase().trim().slice(0, 60)
  if (query.length < 2) return NextResponse.json({ users: [], players: [] })

  const hit = CACHE.get(query)
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body, { headers: { 'Cache-Control': 'public, s-maxage=60' } })

  const safeQ = query.replace(/[%_\\,()]/g, ' ').trim()
  if (!safeQ) return NextResponse.json({ users: [], players: [] })

  // ESPN en renfort (photos, anciens joueurs, tous les sports) : delai dur de 600 ms quoi qu'il arrive, jamais bloquant pour le reste
  const SPORTS: [string, string | null][] = [['basketball', 'nba'], ['football', 'nfl'], ['hockey', 'nhl'], ['baseball', 'mlb'], ['soccer', null]]
  const ctl = new AbortController()
  const espn: Promise<{ league: string | null; data: any }[]> = Promise.race([
    Promise.all(SPORTS.map(([sport, league]) =>
      fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=6&type=player&sport=${sport}`, { signal: ctl.signal, cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null)).catch(() => null)
        .then(data => ({ league, data }))
    )),
    new Promise<{ league: string | null; data: any }[]>(resolve => setTimeout(() => { ctl.abort(); resolve([]) }, 600)),
  ])

  const [{ data: profiles }, { data: entries }, espnData] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url').eq('is_demo', false).ilike('display_name', `%${safeQ}%`).limit(3),
    supabase.from('card_set_entries').select('player_name, card_sets(sport)').ilike('player_name', `%${safeQ}%`).limit(80),
    espn,
  ])

  const rank = (name: string) => {
    const n = name.toLowerCase()
    if (n === query) return 0
    if (n.startsWith(query)) return 1
    if (n.split(' ').some(w => w.startsWith(query))) return 2
    return 3
  }
  const photos = new Map<string, string>()
  const names = new Set<string>((entries || []).map(e => e.player_name).filter(Boolean) as string[])
  const sportOf = new Map<string, string>()
  for (const e of (entries || []) as any[]) { const sp = Array.isArray(e.card_sets) ? e.card_sets[0]?.sport : e.card_sets?.sport; if (e.player_name && sp) sportOf.set(normStr(e.player_name), sp) }
  const normNames = new Set<string>([...names].map(normStr))
  for (const { league, data } of espnData) {
    for (const section of data?.results || []) {
      for (const a of section.contents || []) {
        if (!a.displayName) continue
        // ecarte les homonymes d'une autre ligue que celle cherchee (le foot / soccer n'a pas de filtre : ligues multiples)
        if (league && a.defaultLeagueSlug && a.defaultLeagueSlug !== league) continue
        const k = normStr(a.displayName)
        if (a.image?.default && !photos.has(k)) photos.set(k, a.image.default)
        if (!sportOf.has(k) && a.sport) sportOf.set(k, a.sport === 'soccer' ? 'football' : league || a.sport)
        if (!normNames.has(k)) { normNames.add(k); names.add(a.displayName) }
      }
    }
  }
  const players = [...names]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, 5)
    .map(name => ({ name, photo: photos.get(normStr(name)) || null, sport: sportOf.get(normStr(name)) || null }))

  const body = { users: (profiles || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })), players }
  if (CACHE.size > 500) CACHE.clear()
  CACHE.set(query, { at: Date.now(), body })
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
}
