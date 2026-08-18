import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { awardXP, XP_AWARDS } from '@/lib/xp'
import { tradeResponsePush, someoneNameFallback, normalizePushLang } from '@/lib/pushTranslations'

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

  if (action === 'accept') {
    await awardXP(supabaseAdmin, trade.sender_id, 'trade_completed', XP_AWARDS.TRADE_COMPLETED)
    await awardXP(supabaseAdmin, trade.receiver_id, 'trade_completed', XP_AWARDS.TRADE_COMPLETED)
  }

  const notifyUserId = action === 'cancel' ? trade.receiver_id : trade.sender_id
  const [{ data: actorProfile }, { data: notifyProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', notifyUserId).single(),
  ])
  const notifyLang = normalizePushLang(notifyProfile?.preferred_lang)
  const actorName = actorProfile?.display_name || someoneNameFallback(notifyLang)
  const { title, body } = tradeResponsePush(notifyLang, action as 'accept' | 'refuse' | 'cancel', actorName)

  await supabaseAdmin.from('notifications').insert({
    user_id: notifyUserId,
    type: 'trade_response',
    message: body,
    lien: '/trades?tab=echanges',
    lu: false,
  })

  if (action !== 'cancel') {
    await sendPushToUser(notifyUserId, {
      title,
      body,
      url: '/trades?tab=echanges',
      channelId: 'trades',
    })
  }

  return NextResponse.json({ ok: true })
}
