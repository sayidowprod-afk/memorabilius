import { NextResponse } from 'next/server'
import { kitCatalog } from '@/lib/bobbleheadsServer'

// Toutes les tenues de toutes les équipes : GET /api/bobble-kits (sert au menu du maillot des boîtes de PC et à l'en-tête des galeries)
export async function GET() {
  return NextResponse.json(kitCatalog(), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
}
