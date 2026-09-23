import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { notifyTradeEvent } from '@/lib/tradeNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

// POST /api/trades/[id]/review -- avis apres un echange termine (status
// 'completed'). Un seul avis par personne et par echange ; l'auteur doit
// avoir participe a l'echange, et note forcement l'autre partie.
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reviewSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Avis invalide' }, { status: 400 })

  const { data: trade } = await supabaseAdmin.from('trade_offers').select('id, sender_id, receiver_id, status').eq('id', id).single()
  if (!trade) return NextResponse.json({ error: 'Échange introuvable' }, { status: 404 })
  if (trade.sender_id !== user.id && trade.receiver_id !== user.id)
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  if (trade.status !== 'completed')
    return NextResponse.json({ error: 'Cet échange n\'est pas terminé' }, { status: 409 })

  const reviewedId = trade.sender_id === user.id ? trade.receiver_id : trade.sender_id
  const { error } = await supabaseAdmin.from('trade_reviews').insert({
    trade_id: trade.id, reviewer_id: user.id, reviewed_id: reviewedId,
    rating: parsed.data.rating, comment: parsed.data.comment?.trim() || null,
  })
  if (error) {
    // 23505 = violation de UNIQUE(trade_id, reviewer_id) : deja note
    if (error.code === '23505') return NextResponse.json({ error: 'Tu as déjà laissé un avis' }, { status: 409 })
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement' }, { status: 500 })
  }

  await notifyTradeEvent(supabaseAdmin, { toUserId: reviewedId, actorId: user.id, event: 'review' })
  return NextResponse.json({ ok: true })
}
