import { NextRequest, NextResponse } from 'next/server'
import { getCachedHeadshots } from '@/lib/espnHeadshot'

// Photos de joueurs par lots (liste de la franchise d'une equipe, pour remplacer le « ? » des joueurs manquants).
// Meme source que le reste du site (ESPN, puis CDN NBA, puis Wikipedia pour les anciens).
// Cache persistant en base (table player_photo_cache, voir espnHeadshot.ts) --
// remplace l'ancien cache en memoire (Map), qui ne survivait quasiment jamais
// entre deux invocations serverless sur Vercel (cold start frequent) : chaque
// page rechargeait donc les photos a chaque fois au lieu de les avoir "en
// direct". La table survit aux cold starts et aux redeploiements.
export const maxDuration = 20

const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 40) return false
  e.n++; return true
}
const SPORTS = new Set(['nba', 'nfl', 'nhl', 'mlb', 'football'])

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ photos: {} }, { status: 429 })
  let body: { names?: unknown; sport?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ photos: {} }, { status: 400 }) }
  const sport = typeof body.sport === 'string' && SPORTS.has(body.sport) ? body.sport : null
  const names = Array.isArray(body.names) ? (body.names as unknown[]).filter((n): n is string => typeof n === 'string' && n.length > 1 && n.length < 80).slice(0, 48) : []
  if (!sport || names.length === 0) return NextResponse.json({ photos: {} })

  // 14 s au maximum : ce qui n'est pas pret est simplement redemande au
  // prochain passage (deja en cache des lors qu'une premiere requete l'a
  // ecrit, meme depuis une autre page).
  const photos = await getCachedHeadshots(names, sport, Date.now() + 14_000)
  return NextResponse.json({ photos })
}
