import { NextResponse } from 'next/server'
import { playerOwnerCounts, rankIn } from '@/lib/playerOwners'

// Rang d'un membre parmi les collectionneurs d'un joueur : GET /api/player-rank?name=Allen Iverson&userId=<membre>
// -> { pct, rank, total, cards } ou { none: true } si le membre n'a aucune carte du joueur. Même calcul que les « Top x % » sous les figurines de la galerie.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const name = (sp.get('name') || '').trim(), userId = sp.get('userId') || ''
  if (!name || name.length > 80 || !/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ none: true })
  try {
    const r = rankIn(await playerOwnerCounts(name), userId)
    return NextResponse.json(r ?? { none: true }, { headers: { 'Cache-Control': 'private, max-age=120' } })
  } catch (e) {
    console.log('[player-rank] échec pour', name, String(e))
    return NextResponse.json({ none: true })
  }
}
