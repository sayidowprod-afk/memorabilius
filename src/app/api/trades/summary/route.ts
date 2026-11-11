import { NextRequest, NextResponse } from 'next/server'
import { computeMatches } from '@/lib/tradeMatches'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 20

const supabase = createServerServiceClient()

// GET /api/trades/summary -- pour l'encart de l'accueil : offres recues en
// attente + nombre de matches wishlist. Volontairement separe du chargement
// principal du dashboard (non bloquant).
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ count: pendingReceived }, { count: inProgress }, matches] = await Promise.all([
    supabase.from('trade_offers').select('id', { count: 'exact', head: true }).eq('receiver_id', user.id).eq('status', 'pending'),
    supabase.from('trade_offers').select('id', { count: 'exact', head: true }).eq('status', 'accepted').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
    computeMatches(supabase, user.id).catch(() => ({ members: [], counts: { total: 0, perfect: 0 } })),
  ])

  // 637 : le navigateur garde la réponse 1 minute (et la sert encore 5 minutes le temps de la rafraîchir) : revenir sur l'accueil ne refait pas le calcul des matchs.
  // « Vary: Authorization » : jamais partagée entre deux comptes sur un même appareil.
  return NextResponse.json({
    pendingReceived: pendingReceived || 0,
    inProgress: inProgress || 0,
    matches: matches.counts.total,
    perfectMatches: matches.counts.perfect,
  }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300', Vary: 'Authorization' } })
}
