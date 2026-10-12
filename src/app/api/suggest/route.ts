import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Suggestions de recherche en direct (accueil) : version LEGERE de /api/recherche, qui scanne les galeries CSV et interroge 4 sports ESPN
// (plusieurs secondes). Ici : 3 collectionneurs + 4 joueurs, bases de donnees en parallele (~100 ms), ESPN en renfort avec un delai court.
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const CACHE = new Map<string, { at: number; body: unknown }>()
const TTL = 60_000
const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 240) return false
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

  // ESPN en renfort (photos, anciens joueurs) : delai dur de 600 ms quoi qu'il arrive, jamais bloquant pour le reste
  const ctl = new AbortController()
  const espn: Promise<any> = Promise.race([
    fetch(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=6&type=player&sport=basketball`, { signal: ctl.signal, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => { ctl.abort(); resolve(null) }, 600)),
  ])

  const [{ data: profiles }, { data: entries }, espnData] = await Promise.all([
    supabase.from('profiles').select('id, display_name, avatar_url').eq('is_demo', false).ilike('display_name', `%${safeQ}%`).limit(3),
    supabase.from('card_set_entries').select('player_name').ilike('player_name', `%${safeQ}%`).limit(80),
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
  for (const section of espnData?.results || []) {
    for (const a of section.contents || []) {
      if (!a.displayName) continue
      if (a.defaultLeagueSlug && a.defaultLeagueSlug !== 'nba') continue
      if (a.image?.default) photos.set(normStr(a.displayName), a.image.default)
      if (![...names].some(n => normStr(n) === normStr(a.displayName))) names.add(a.displayName)
    }
  }
  const players = [...names]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .slice(0, 4)
    .map(name => ({ name, photo: photos.get(normStr(name)) || null }))

  const body = { users: (profiles || []).map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url })), players }
  if (CACHE.size > 500) CACHE.clear()
  CACHE.set(query, { at: Date.now(), body })
  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=60' } })
}
