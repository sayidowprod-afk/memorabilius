import { NextRequest, NextResponse } from 'next/server'
import { kitCatalog } from '@/lib/bobbleheadsServer'

// Toutes les tenues de toutes les équipes : GET /api/bobble-kits (basket) ou /api/bobble-kits?sport=mlb (baseball)
// Sert au menu du maillot des boîtes de PC et à l'en-tête des galeries.
export async function GET(req: NextRequest) {
  const sport = req.nextUrl.searchParams.get('sport') === 'mlb' ? 'mlb' : 'nba'
  return NextResponse.json(kitCatalog(sport), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
}
