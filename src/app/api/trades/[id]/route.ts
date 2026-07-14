import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/trades/[id] — accepter / refuser / annuler
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json() // 'accept' | 'refuse' | 'cancel'
  if (!['accept', 'refuse', 'cancel'].includes(action))
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  const { data: trade } = await supabaseAdmin
    .from('trade_offers').select('*').eq('id', id).single()

  if (!trade) return NextResponse.json({ error: 'Échange introuvable' }, { status: 404 })
  if (trade.status !== 'pending') return NextResponse.json({ error: 'Échange déjà traité' }, { status: 409 })

  if (action === 'cancel' && trade.sender_id !== user.id)
    return NextResponse.json({ error: 'Seul l\'expéditeur peut annuler' }, { status: 403 })
  if ((action === 'accept' || action === 'refuse') && trade.receiver_id !== user.id)
    return NextResponse.json({ error: 'Seul le destinataire peut accepter/refuser' }, { status: 403 })

  const statusMap: Record<string, string> = { accept: 'accepted', refuse: 'refused', cancel: 'cancelled' }
  await supabaseAdmin
    .from('trade_offers')
    .update({ status: statusMap[action], updated_at: new Date().toISOString() })
    .eq('id', trade.id)

  const notifyUserId = action === 'cancel' ? trade.receiver_id : trade.sender_id
  const { data: actorProfile } = await supabaseAdmin
    .from('profiles').select('display_name').eq('id', user.id).single()
  const actorName = actorProfile?.display_name || 'Quelqu\'un'

  const msgMap: Record<string, string> = {
    accept: `${actorName} a accepté ton offre d'échange ! 🎉`,
    refuse: `${actorName} a refusé ton offre d'échange`,
    cancel: `${actorName} a annulé son offre d'échange`,
  }

  await supabaseAdmin.from('notifications').insert({
    user_id: notifyUserId,
    type: 'trade_response',
    message: msgMap[action],
    lien: '/echanges',
    lu: false,
  })

  if (action !== 'cancel') {
    await sendPushToUser(notifyUserId, {
      title: action === 'accept' ? '🎉 Échange accepté !' : '❌ Échange refusé',
      body: msgMap[action],
      url: '/echanges',
    })
  }

  return NextResponse.json({ ok: true })
}
