import { NextRequest, NextResponse } from 'next/server'
import { kitCatalog } from '@/lib/bobbleheadsServer'

// Toutes les tenues de toutes les équipes : GET /api/bobble-kits (basket) ou /api/bobble-kits?sport=mlb (baseball)
// Sert au menu du maillot des boîtes de PC et à l'en-tête des galeries.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('sport'), sport = q === 'mlb' ? 'mlb' : q === 'nfl' ? 'nfl' : 'nba'
  return NextResponse.json(kitCatalog(sport), { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=300' } })
}
