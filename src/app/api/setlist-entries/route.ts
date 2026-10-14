import { NextRequest, NextResponse } from 'next/server'
import { fetchAllSetEntries } from '@/lib/setEntriesFetch'

// Checklist complete d'un set pour les guides : chargee APRES coup par le navigateur, pour que le HTML du guide reste leger
// (Google ne lit que les premiers Mo d'une page ; les gros sets pesaient 3 a 9 Mo). Format compact, mis en cache par le CDN.
export const maxDuration = 30

export async function GET(req: NextRequest) {
  const setId = Number(req.nextUrl.searchParams.get('setId'))
  if (!setId) return NextResponse.json({ e: [] }, { status: 400 })
  const rows = await fetchAllSetEntries(setId)
  return NextResponse.json({ e: rows.map(r => [r.card_number, r.player_name, r.team, r.variation, r.is_rc ? 1 : 0]) }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
