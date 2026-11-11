import { NextRequest, NextResponse } from 'next/server'
import { searchTcg } from '@/lib/tcgSources'
import { getTcgGame } from '@/lib/tcgGames'

export const maxDuration = 20

// Recherche d'une carte TCG par nom (Pokémon : TCGdex, Magic : Scryfall) pour pré-remplir la fiche : extension, numéro, rareté, année, prix en euros.
// Réponse mise en cache (données qui changent rarement) ; limitée par adresse pour ne pas surcharger les services externes.
const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now(), e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 40) return false
  e.n++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ hits: [] }, { status: 429 })
  const sp = req.nextUrl.searchParams
  const game = getTcgGame(sp.get('game'))
  const q = (sp.get('q') || '').trim().slice(0, 60)
  const lang = (sp.get('lang') || 'FR').toUpperCase().slice(0, 2)
  if (!game || !game.source || q.length < 2) return NextResponse.json({ hits: [] })
  const hits = await searchTcg(game.id, q, lang, 8)
  return NextResponse.json({ hits }, { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } })
}
