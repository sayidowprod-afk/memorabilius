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

interface CardInput {
  id: string
  isManuelle: boolean
  nom?: string
  annee?: string
  marque?: string
  image?: string
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

  const { data: tradeCards } = await supabaseAdmin
    .from('trade_offer_cards')
    .select('trade_id, card_id, is_manuelle, card_nom, card_annee, card_marque, card_image, owner_id')
    .in('trade_id', tradeIds)

  // Récupérer les infos des cartes manuelles depuis la DB
  const manualIds = (tradeCards || []).filter(tc => tc.is_manuelle).map(tc => tc.card_id)
  const { data: manualCards } = manualIds.length
    ? await supabaseAdmin.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, rc, auto, patch')
        .in('id', manualIds)
    : { data: [] }

  const manualMap = Object.fromEntries((manualCards || []).map(c => [c.id, c]))

  const enrichCard = (tc: { card_id: string; is_manuelle: boolean; card_nom?: string; card_annee?: string; card_marque?: string; card_image?: string }) => {
    if (tc.is_manuelle && manualMap[tc.card_id]) {
      return { id: tc.card_id, ...manualMap[tc.card_id] }
    }
    // Carte CSV — on utilise le snapshot stocké
    return {
      id: tc.card_id,
      nom: tc.card_nom || '',
      annee: tc.card_annee || '',
      marque: tc.card_marque || '',
      image_recto: tc.card_image || null,
      rc: false, auto: false, patch: false,
    }
  }

  const userIds = [...new Set(trades.flatMap(t => [t.sender_id, t.receiver_id]))]
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, display_name').in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))

  const enriched = trades.map(t => ({
    ...t,
    sender_name: profileMap[t.sender_id] || 'Collector',
    receiver_name: profileMap[t.receiver_id] || 'Collector',
    offered_cards: (tradeCards || [])
      .filter(tc => tc.trade_id === t.id && tc.owner_id === t.sender_id)
      .map(enrichCard),
    requested_cards: (tradeCards || [])
      .filter(tc => tc.trade_id === t.id && tc.owner_id === t.receiver_id)
      .map(enrichCard),
  }))

  return NextResponse.json({ trades: enriched })
}

// POST /api/trades — créer une offre d'échange
export async function POST(req: NextRequest) {
  try {
    return await postHandler(req)
  } catch (err) {
    console.error('[POST /api/trades] unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function postHandler(req: NextRequest) {
  const token = auth(req)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { receiverId, offeredCards, requestedCards, message }: {
    receiverId: string
    offeredCards: CardInput[]
    requestedCards: CardInput[]
    message?: string
  } = await req.json()

  if (!receiverId || !offeredCards?.length || !requestedCards?.length)
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  if (receiverId === user.id)
    return NextResponse.json({ error: 'Impossible de s\'échanger avec soi-même' }, { status: 400 })

  // Vérifier ownership des cartes manuelles offertes (cartes CSV : on fait confiance au client)
  const manualOfferedIds = offeredCards.filter(c => c.isManuelle).map(c => c.id)
  if (manualOfferedIds.length) {
    const { data: senderCards } = await supabaseAdmin
      .from('cartes_manuelles').select('id').in('id', manualOfferedIds).eq('user_id', user.id)
    if ((senderCards?.length || 0) !== manualOfferedIds.length)
      return NextResponse.json({ error: 'Cartes introuvables dans ta collection' }, { status: 403 })
  }

  // Vérifier ownership des cartes manuelles demandées
  const manualRequestedIds = requestedCards.filter(c => c.isManuelle).map(c => c.id)
  if (manualRequestedIds.length) {
    const { data: receiverCards } = await supabaseAdmin
      .from('cartes_manuelles').select('id').in('id', manualRequestedIds).eq('user_id', receiverId)
    if ((receiverCards?.length || 0) !== manualRequestedIds.length)
      return NextResponse.json({ error: 'Cartes introuvables dans la collection du destinataire' }, { status: 403 })
  }

  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from('trade_offers')
    .insert({ sender_id: user.id, receiver_id: receiverId, message: message || null })
    .select()
    .single()

  if (tradeErr || !trade)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })

  const rows = [
    ...offeredCards.map(c => ({
      trade_id: trade.id,
      card_id: c.id,
      is_manuelle: c.isManuelle,
      card_nom: c.nom || null,
      card_annee: c.annee || null,
      card_marque: c.marque || null,
      card_image: c.image || null,
      owner_id: user.id,
    })),
    ...requestedCards.map(c => ({
      trade_id: trade.id,
      card_id: c.id,
      is_manuelle: c.isManuelle,
      card_nom: c.nom || null,
      card_annee: c.annee || null,
      card_marque: c.marque || null,
      card_image: c.image || null,
      owner_id: receiverId,
    })),
  ]
  await supabaseAdmin.from('trade_offer_cards').insert(rows)

  const { data: senderProfile } = await supabaseAdmin
    .from('profiles').select('display_name').eq('id', user.id).single()
  const senderName = senderProfile?.display_name || 'Quelqu\'un'

  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'trade_offer',
    message: `${senderName} te propose un échange`,
    lien: '/trades?tab=echanges',
    lu: false,
  })

  try {
    await sendPushToUser(receiverId, {
      title: '🔄 Nouvelle offre d\'échange',
      body: `${senderName} te propose un échange`,
      url: '/messages?to=' + user.id,
    })
  } catch { /* push non critique */ }

  // Insérer automatiquement le message de l'offre dans le chat
  await supabaseAdmin.from('messages').insert({
    from_user_id: user.id,
    to_user_id: receiverId,
    contenu: `[[trade_offer:${trade.id}]]`,
    trade_id: null,
  })

  return NextResponse.json({ ok: true, tradeId: trade.id, receiverId })
}
