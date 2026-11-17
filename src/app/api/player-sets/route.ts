import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'
import { cachedAsync } from '@/lib/ttlCache'
import { getPlayerSetsCached } from '@/lib/playerSetsCache'

// Pagination de la section "Sets" d'un joueur, appelee par
// PlayerSetsSection.tsx (defilement). Duplique volontairement l'appel RPC
// deja present dans joueur/[slug]/page.tsx (le RPC lui-meme est rapide cote
// DB -- c'etait le RENDU react/HTML de TOUS les sets d'un coup qui etait
// lent, pas la requete) plutot que de le factoriser -- page.tsx garde son
// fetch initial complet (deja teste, necessaire pour rcYear/sports pills).
const supabase = createServerClient()

const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now()
  const e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 30) return false
  e.n++; return true
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const sp = req.nextUrl.searchParams
  const playerName = sp.get('name')?.trim()
  if (!playerName || playerName.length > 80) return NextResponse.json({ sets: [], total: 0, hasMore: false })
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  const limit = Math.min(120, Math.max(1, parseInt(sp.get('limit') || '40', 10) || 40))

  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]

  // get_player_sets (indexee, cf idx_card_set_entries_player_name_trgm) essayee
  // en premier -- get_player_sets_unaccent n'a pas encore l'index equivalent sur
  // la colonne sans accents (echec de build recurrent, incident Supabase Management
  // API en cours depuis le 2026-10-23) et peut timeout sur un prenom courant.
  // Repli temporaire le temps que cet index puisse enfin etre construit.
  // La RPC est lourde (séries d'un joueur parmi ~15 millions de lignes) et la pagination la rappelait à CHAQUE page : résultat gardé 30 minutes par joueur.
  // Après un dépassement de délai (57014), pas de deuxième appel « unaccent » : il échouerait pareil et doublerait la charge.
  const rawSets: any[] = await cachedAsync(`ps:${playerName.toLowerCase()}`, (v: any[]) => (v.length ? 1_800_000 : 60_000), async () => {
    const r0 = await getPlayerSetsCached(firstName, lastName)
    const r = r0.error && (r0.error as { code?: string }).code !== '57014' ? await supabase.rpc('get_player_sets_unaccent', { p_first: firstName, p_last: lastName }) : r0
    return (r.data as any[]) || []
  })

  const sets = rawSets
    .map((s: any) => ({ ...s, isRc: s.is_rc }))
    .sort((a: any, b: any) => (b.year || 0) - (a.year || 0))

  const total = sets.length
  const page = sets.slice(offset, offset + limit)
  // 638 : données publiques qui changent rarement : servies depuis le cache partagé 1 h (puis encore 24 h le temps de les rafraîchir)
  return NextResponse.json({ sets: page, total, hasMore: offset + limit < total }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=604800' } })
}
