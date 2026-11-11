import { NextRequest, NextResponse } from 'next/server'
import { tcgByRef } from '@/lib/tcgSources'
import { getTcgGame } from '@/lib/tcgGames'

export const maxDuration = 20

// Prix en euros d'une carte TCG déjà identifiée (tcg_ref) : Pokémon = prix Cardmarket via TCGdex, Magic = prix en euros de Scryfall.
// Mis en cache 12 h : les prix de ces sources sont mis à jour une fois par jour.
const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now(), e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 60) return false
  e.n++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ price: null }, { status: 429 })
  const sp = req.nextUrl.searchParams
  const game = getTcgGame(sp.get('game'))
  const ref = (sp.get('ref') || '').trim().slice(0, 80)
  const lang = (sp.get('lang') || 'FR').toUpperCase().slice(0, 2)
  if (!game || !game.source || !ref) return NextResponse.json({ price: null })
  const hit = await tcgByRef(game.id, ref, lang)
  return NextResponse.json({ price: hit?.price ?? null, hit }, { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } })
}
