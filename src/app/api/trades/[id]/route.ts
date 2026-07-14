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
    .from('trade_offers')
    .select('*')
    .eq('id', id)
    .single()

  if (!trade) return NextResponse.json({ error: 'Échange introuvable' }, { status: 404 })
  if (trade.status !== 'pending') return NextResponse.json({ error: 'Échange déjà traité' }, { status: 409 })

  // Contrôle d'accès
  if (action === 'cancel' && trade.sender_id !== user.id)
    return NextResponse.json({ error: 'Seul l\'expéditeur peut annuler' }, { status: 403 })
  if ((action === 'accept' || action === 'refuse') && trade.receiver_id !== user.id)
    return NextResponse.json({ error: 'Seul le destinataire peut accepter/refuser' }, { status: 403 })

  const statusMap: Record<string, string> = { accept: 'accepted', refuse: 'refused', cancel: 'cancelled' }
  const newStatus = statusMap[action]

  if (action === 'accept') {
    // Récupérer les cartes des deux côtés
    const { data: tradeCards } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('card_id, owner_id')
      .eq('trade_id', trade.id)

    // Vérifier que les cartes existent toujours chez leurs propriétaires
    const offeredIds = (tradeCards || []).filter(tc => tc.owner_id === trade.sender_id).map(tc => tc.card_id)
    const requestedIds = (tradeCards || []).filter(tc => tc.owner_id === trade.receiver_id).map(tc => tc.card_id)

    const [{ data: senderCards }, { data: receiverCards }] = await Promise.all([
      supabaseAdmin.from('cartes_manuelles').select('id').in('id', offeredIds).eq('user_id', trade.sender_id),
      supabaseAdmin.from('cartes_manuelles').select('id').in('id', requestedIds).eq('user_id', trade.receiver_id),
    ])

    if ((senderCards?.length || 0) !== offeredIds.length || (receiverCards?.length || 0) !== requestedIds.length)
      return NextResponse.json({ error: 'Certaines cartes ne sont plus disponibles' }, { status: 409 })

    // Échanger les user_id
    await Promise.all([
      ...offeredIds.map(id => supabaseAdmin.from('cartes_manuelles').update({ user_id: trade.receiver_id }).eq('id', id)),
      ...requestedIds.map(id => supabaseAdmin.from('cartes_manuelles').update({ user_id: trade.sender_id }).eq('id', id)),
    ])

    // Annuler tous les autres trades pending impliquant ces cartes
    const allCardIds = [...offeredIds, ...requestedIds]
    const { data: conflictTrades } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('trade_id')
      .in('card_id', allCardIds)
      .neq('trade_id', trade.id)

    const conflictIds = [...new Set((conflictTrades || []).map(tc => tc.trade_id))]
    if (conflictIds.length) {
      await supabaseAdmin
        .from('trade_offers')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', conflictIds)
        .eq('status', 'pending')
    }
  }

  // Mettre à jour le statut
  await supabaseAdmin
    .from('trade_offers')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', trade.id)

  // Notif à l'autre partie
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
