import { NextRequest, NextResponse } from 'next/server'
import { getBoxScore } from '@/lib/pronosBoxscore'

// Box score d'un match (stats individuelles). Données publiques, mises en
// cache 10 min côté Next (voir pronosBoxscore.ts).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || ''
  try {
    const box = await getBoxScore(id)
    if (!box) return NextResponse.json({ error: 'unavailable' }, { status: 404 })
    return NextResponse.json(box)
  } catch {
    return NextResponse.json({ error: 'upstream' }, { status: 502 })
  }
}
