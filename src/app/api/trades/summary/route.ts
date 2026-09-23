import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeMatches } from '@/lib/tradeMatches'

export const maxDuration = 20

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  return NextResponse.json({
    pendingReceived: pendingReceived || 0,
    inProgress: inProgress || 0,
    matches: matches.counts.total,
    perfectMatches: matches.counts.perfect,
  })
}
