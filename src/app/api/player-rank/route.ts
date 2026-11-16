import { NextResponse } from 'next/server'
import { playerOwnerCounts, rankIn } from '@/lib/playerOwners'

// Rang d'un membre parmi les collectionneurs d'un joueur : GET /api/player-rank?name=Allen Iverson&userId=<membre>
// -> { pct, rank, total, cards } ou { none: true } si le membre n'a aucune carte du joueur. Même calcul que les « Top x % » sous les figurines de la galerie.
// Le 1er calcul d'un joueur très collectionné lit des milliers de cartes : il dépassait le délai par défaut de la fonction (donc aucun % pour Embiid, Iverson…, seulement pour les petits joueurs comme Maxey).
export const maxDuration = 60

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const name = (sp.get('name') || '').trim(), userId = sp.get('userId') || ''
  if (!name || name.length > 80 || !/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ none: true })
  try {
    const counts = await playerOwnerCounts(name)
    // aucun collectionneur trouvé = la recherche a échoué (base saturée) : réponse NON gardée, le prochain essai refait le calcul
    if (!Object.keys(counts).length) return NextResponse.json({ none: true, error: true }, { headers: { 'Cache-Control': 'no-store' } })
    const r = rankIn(counts, userId)
    return NextResponse.json(r ?? { none: true }, { headers: { 'Cache-Control': r ? 'public, s-maxage=600, stale-while-revalidate=3600' : 'public, s-maxage=60' } })
  } catch (e) {
    console.log('[player-rank] échec pour', name, String(e))
    return NextResponse.json({ none: true, error: true }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
