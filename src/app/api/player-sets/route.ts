import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseServer'

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

  const setsRpcRes0 = await supabase.rpc('get_player_sets_unaccent', { p_first: firstName, p_last: lastName })
  const setsRpcRes = setsRpcRes0.error
    ? await supabase.rpc('get_player_sets', { p_first: firstName, p_last: lastName })
    : setsRpcRes0
  const rawSets: any[] = setsRpcRes.data || []

  const sets = rawSets
    .map((s: any) => ({ ...s, isRc: s.is_rc }))
    .sort((a: any, b: any) => (b.year || 0) - (a.year || 0))

  const total = sets.length
  const page = sets.slice(offset, offset + limit)
  return NextResponse.json({ sets: page, total, hasMore: offset + limit < total })
}
