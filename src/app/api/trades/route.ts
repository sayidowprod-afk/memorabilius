import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function auth(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') || ''
}

// GET /api/trades — mes échanges (envoyés + reçus)
export async function GET(req: NextRequest) {
  const token = auth(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: trades } = await supabaseAdmin
    .from('trade_offers')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (!trades?.length) return NextResponse.json({ trades: [] })

  const tradeIds = trades.map(t => t.id)

  // Récupérer toutes les trade_cards d'un coup
  const { data: tradeCards } = await supabaseAdmin
    .from('trade_offer_cards')
    .select('trade_id, card_id, owner_id')
    .in('trade_id', tradeIds)

  // Récupérer les infos des cartes (nom, image, marque…)
  const cardIds = [...new Set((tradeCards || []).map(tc => tc.card_id))]
  const { data: cards } = cardIds.length
    ? await supabaseAdmin.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, rc, auto, patch, num')
        .in('id', cardIds)
    : { data: [] }

  // Récupérer les display_name des participants
  const userIds = [...new Set(trades.flatMap(t => [t.sender_id, t.receiver_id]))]
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)

  const cardMap = Object.fromEntries((cards || []).map(c => [c.id, c]))
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))

  const enriched = trades.map(t => ({
    ...t,
    sender_name: profileMap[t.sender_id] || 'Collector',
    receiver_name: profileMap[t.receiver_id] || 'Collector',
    offered_cards: (tradeCards || [])
      .filter(tc => tc.trade_id === t.id && tc.owner_id === t.sender_id)
      .map(tc => cardMap[tc.card_id]).filter(Boolean),
    requested_cards: (tradeCards || [])
      .filter(tc => tc.trade_id === t.id && tc.owner_id === t.receiver_id)
      .map(tc => cardMap[tc.card_id]).filter(Boolean),
  }))

  return NextResponse.json({ trades: enriched })
}

// POST /api/trades — créer une offre d'échange
export async function POST(req: NextRequest) {
  const token = auth(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId, offeredCardIds, requestedCardIds, message } = await req.json()

  if (!receiverId || !offeredCardIds?.length || !requestedCardIds?.length)
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  if (receiverId === user.id)
    return NextResponse.json({ error: 'Impossible de s\'échanger avec soi-même' }, { status: 400 })

  // Vérifier que les cartes offertes appartiennent bien à l'expéditeur
  const { data: senderCards } = await supabaseAdmin
    .from('cartes_manuelles')
    .select('id')
    .in('id', offeredCardIds)
    .eq('user_id', user.id)

  if ((senderCards?.length || 0) !== offeredCardIds.length)
    return NextResponse.json({ error: 'Cartes introuvables dans ta collection' }, { status: 403 })

  // Vérifier que les cartes demandées appartiennent bien au destinataire
  const { data: receiverCards } = await supabaseAdmin
    .from('cartes_manuelles')
    .select('id')
    .in('id', requestedCardIds)
    .eq('user_id', receiverId)

  if ((receiverCards?.length || 0) !== requestedCardIds.length)
    return NextResponse.json({ error: 'Cartes introuvables dans la collection du destinataire' }, { status: 403 })

  // Anti-spam : max 5 échanges pending vers le même utilisateur
  const { count } = await supabaseAdmin
    .from('trade_offers')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')

  if ((count || 0) >= 5)
    return NextResponse.json({ error: 'Trop d\'offres en attente vers cet utilisateur' }, { status: 429 })

  // Créer le trade
  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from('trade_offers')
    .insert({ sender_id: user.id, receiver_id: receiverId, message: message || null })
    .select()
    .single()

  if (tradeErr || !trade)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })

  // Insérer les cartes des deux côtés
  const rows = [
    ...offeredCardIds.map((id: string) => ({ trade_id: trade.id, card_id: id, owner_id: user.id })),
    ...requestedCardIds.map((id: string) => ({ trade_id: trade.id, card_id: id, owner_id: receiverId })),
  ]
  await supabaseAdmin.from('trade_offer_cards').insert(rows)

  // Notif + push au destinataire
  const { data: senderProfile } = await supabaseAdmin
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.display_name || 'Quelqu\'un'

  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'trade_offer',
    message: `${senderName} te propose un échange`,
    lien: '/echanges',
    lu: false,
  })

  await sendPushToUser(receiverId, {
    title: '🔄 Nouvelle offre d\'échange',
    body: `${senderName} te propose un échange`,
    url: '/echanges',
  })

  return NextResponse.json({ ok: true, tradeId: trade.id })
}
