import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 30

// Service role bypasses RLS on card_set_entries (anon key is blocked by RLS policy)
const admin = createServerServiceClient()

interface RpcRow {
  id: number; set_id: number; card_number: string | null; variation: string | null
  is_rc: boolean; is_auto: boolean; image_url: string | null
  set_name: string; set_year: number | null; set_brand: string | null; set_sport: string
}

function fromRpcRow(r: RpcRow) {
  return {
    id: r.id, set_id: r.set_id, card_number: r.card_number, variation: r.variation,
    is_rc: r.is_rc, is_auto: r.is_auto, image_url: r.image_url,
    card_sets: { id: r.set_id, name: r.set_name, year: r.set_year, brand: r.set_brand, sport: r.set_sport },
  }
}

export async function GET(req: NextRequest) {
  const firstName = req.nextUrl.searchParams.get('firstName')?.trim()
  const lastName  = req.nextUrl.searchParams.get('lastName')?.trim()

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const PAGE = 1000
  const all: any[] = []
  let from = 0

  // search_player_entries_unaccent (voir scripts/sql-player-entries-unaccent.sql) :
  // fusionne les variantes orthographiques d'un meme joueur ("Doncic" / "Dončić",
  // sources d'import differentes) en les matchant sans distinction d'accents --
  // avant, la checklist d'un joueur accentue etait fragmentee entre ses 2 graphies,
  // chacune incomplete. Repli sur l'ancien double .ilike() (sensible aux accents,
  // comportement historique) si la migration SQL n'a pas encore ete executee.
  // N'importe quelle erreur ici (fonction absente, timeout le temps que l'index
  // associe finisse de se construire, etc.) bascule sur le repli ci-dessous plutot
  // que de renvoyer une 500 -- une 500 cassait TOUTE la checklist joueur (pas
  // seulement les noms accentues) le temps que l'index soit pret, constate en prod.
  let rpcFailed = false
  while (true) {
    const { data, error } = await admin
      .rpc('search_player_entries_unaccent', { p_first: firstName, p_last: lastName })
      .range(from, from + PAGE - 1)
    if (error) { rpcFailed = true; all.length = 0; break }
    if (!data || data.length === 0) break
    all.push(...(data as RpcRow[]).map(fromRpcRow))
    if (data.length < PAGE) break
    from += PAGE
  }

  if (all.length === 0) {
    // Repli : migration SQL pas encore executee, ou vraiment aucune carte pour ce joueur.
    // On ne peut pas distinguer les deux cas sans un 2e aller-retour -- celui-ci est sans
    // risque (ancien comportement exact) et ne coute rien quand il confirme juste "aucune carte".
    from = 0
    while (true) {
      const { data, error } = await admin
        .from('card_set_entries')
        .select('id, set_id, card_number, variation, is_rc, is_auto, image_url, card_sets(id, name, year, brand, sport)')
        .ilike('player_name', `${firstName}%`)
        .ilike('player_name', `%${lastName}%`)
        .order('set_id')
        .order('card_number')
        .range(from, from + PAGE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (!data || data.length === 0) break
      all.push(...data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // Donnee non-personnalisee, identique pour tout le monde -- safe en cache
  // partage court, absorbe les visites repetees d'un meme joueur populaire
  // (cette route ignore le revalidate=3600 de la page /joueur, appelee cote
  // client sur chaque montage).
  return NextResponse.json({ entries: all }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
}
