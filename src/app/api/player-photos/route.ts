import { NextRequest, NextResponse } from 'next/server'
import { fetchEspnHeadshot } from '@/lib/espnHeadshot'

// Photos de joueurs par lots (liste de la franchise d'une equipe, pour remplacer le « ? » des joueurs manquants).
// Meme source que le reste du site (ESPN, puis CDN NBA, puis Wikipedia pour les anciens). Cache memoire 24 h, y compris les « pas de photo ».
export const maxDuration = 20

const CACHE = new Map<string, { at: number; url: string | null }>()
const TTL = 24 * 3600_000
const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 40) return false
  e.n++; return true
}
const SPORTS = new Set(['nba', 'nfl', 'nhl', 'mlb', 'football'])
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ photos: {} }, { status: 429 })
  let body: { names?: unknown; sport?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ photos: {} }, { status: 400 }) }
  const sport = typeof body.sport === 'string' && SPORTS.has(body.sport) ? body.sport : null
  const names = Array.isArray(body.names) ? (body.names as unknown[]).filter((n): n is string => typeof n === 'string' && n.length > 1 && n.length < 80).slice(0, 48) : []
  if (!sport || names.length === 0) return NextResponse.json({ photos: {} })

  const photos: Record<string, string | null> = {}
  const todo: string[] = []
  for (const n of names) {
    const hit = CACHE.get(`${sport}:${norm(n)}`)
    if (hit && Date.now() - hit.at < TTL) photos[n] = hit.url
    else todo.push(n)
  }

  // 6 recherches en parallele, 14 s au maximum : on renvoie ce qui est pret, le reste sera redemande au prochain passage
  const deadline = Date.now() + 14_000
  let i = 0
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < todo.length && Date.now() < deadline) {
      const name = todo[i++]
      let url: string | null = null
      try { url = await fetchEspnHeadshot(name, sport) } catch { url = null }
      CACHE.set(`${sport}:${norm(name)}`, { at: Date.now(), url })
      photos[name] = url
    }
  }))
  if (CACHE.size > 5000) CACHE.clear()
  return NextResponse.json({ photos })
}
