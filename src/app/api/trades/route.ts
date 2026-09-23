import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { sendPushToUser } from '@/lib/pushNotify'
import { tradeOfferPush, someoneNameFallback, normalizePushLang } from '@/lib/pushTranslations'
import { notifyTradeEvent, TRADE_OFFER_TTL_DAYS } from '@/lib/tradeNotify'

const cardInputSchema = z.object({
  id: z.string().min(1).max(2000),
  isManuelle: z.boolean(),
  nom: z.string().max(200).optional(),
  annee: z.string().max(20).optional(),
  marque: z.string().max(100).optional(),
  image: z.string().max(2000).optional(),
})

const tradePostSchema = z.object({
  receiverId: z.string().uuid(),
  // min(1) sur les deux cotes : une offre sans carte offerte n'est pas un
  // echange, et permettait de faire passer une "offre" gratuite du systeme
  // d'XP (verse a l'acceptation, cf. api/trades/[id]/route.ts) sans rien
  // donner en retour.
  offeredCards: z.array(cardInputSchema).min(1).max(50),
  requestedCards: z.array(cardInputSchema).min(1).max(50),
  message: z.string().max(1000).optional(),
  // Contre-offre : id de l'offre d'origine (dont l'appelant est le destinataire)
  counterOf: z.string().uuid().optional(),
})

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

  const idsParam = req.nextUrl.searchParams.get('ids')
  const filterIds = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : null

  let tradesQuery = supabaseAdmin
    .from('trade_offers')
    .select('*')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
  if (filterIds && filterIds.length > 0) tradesQuery = tradesQuery.in('id', filterIds)

  const { data: tradesRaw } = await tradesQuery

  // Expiration paresseuse : une offre en attente dont expires_at est passe est
  // cloturee des qu'on la lit (le cron /api/cron/trade-expiry fait pareil pour
  // celles que personne n'ouvre, et envoie les notifications).
  const nowMs = Date.now()
  const overdue = (tradesRaw || []).filter(t => t.status === 'pending' && t.expires_at && new Date(t.expires_at).getTime() < nowMs)
  if (overdue.length) {
    await supabaseAdmin.from('trade_offers').update({ status: 'expired', updated_at: new Date().toISOString() })
      .in('id', overdue.map(t => t.id)).eq('status', 'pending')
  }
  const overdueIds = new Set(overdue.map(t => t.id))
  const trades = (tradesRaw || []).map(t => overdueIds.has(t.id) ? { ...t, status: 'expired' } : t)

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
        .select('id, nom, annee, marque, image_recto, rc, auto, patch, valeur')
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

  // Avis (migration v2) : mon avis sur chaque echange termine + celui recu.
  // Table absente = aucune ligne, pas d'erreur.
  const { data: reviewRows } = await supabaseAdmin
    .from('trade_reviews').select('trade_id, reviewer_id, rating, comment').in('trade_id', tradeIds)
  const reviewsByTrade = new Map<string, any[]>()
  for (const r of reviewRows || []) reviewsByTrade.set(r.trade_id, [...(reviewsByTrade.get(r.trade_id) || []), r])

  const enriched = trades.map(t => ({
    ...t,
    my_review: (reviewsByTrade.get(t.id) || []).find(r => r.reviewer_id === user.id) || null,
    their_review: (reviewsByTrade.get(t.id) || []).find(r => r.reviewer_id !== user.id) || null,
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

  const parsed = tradePostSchema.safeParse(await req.json())
  if (!parsed.success)
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  const { receiverId, offeredCards, requestedCards, message, counterOf } = parsed.data

  if (receiverId === user.id)
    return NextResponse.json({ error: 'Impossible de s\'échanger avec soi-même' }, { status: 400 })

  // Validation basique des cartes CSV : l'id doit être une URL publique externe
  const csvOffered = offeredCards.filter(c => !c.isManuelle)
  const csvRequested = requestedCards.filter(c => !c.isManuelle)
  const isValidCsvId = (id: string) => { try { const u = new URL(id); return u.protocol === 'https:' } catch { return false } }
  if (csvOffered.some(c => !isValidCsvId(c.id)) || csvRequested.some(c => !isValidCsvId(c.id)))
    return NextResponse.json({ error: 'Identifiant de carte invalide' }, { status: 400 })

  // Vérifier ownership des cartes manuelles offertes
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

  // Anti-doublon : bloque une offre identique (memes cartes offertes +
  // demandees) deja en attente vers le meme destinataire -- evite le spam
  // de doublons (clic multiple, retry reseau, ou envoi volontaire en boucle).
  const { data: pendingOffers } = counterOf ? { data: [] as { id: string }[] } : await supabaseAdmin
    .from('trade_offers')
    .select('id')
    .eq('sender_id', user.id)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')
  if (pendingOffers?.length) {
    const pendingIds = pendingOffers.map(o => o.id)
    const { data: existingCards } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('trade_id, card_id, owner_id')
      .in('trade_id', pendingIds)
    const newOfferedIds = new Set(offeredCards.map(c => c.id))
    const newRequestedIds = new Set(requestedCards.map(c => c.id))
    const isDuplicate = pendingIds.some(tid => {
      const cards = (existingCards || []).filter(c => c.trade_id === tid)
      const offered = new Set(cards.filter(c => c.owner_id === user.id).map(c => c.card_id))
      const requested = new Set(cards.filter(c => c.owner_id === receiverId).map(c => c.card_id))
      return offered.size === newOfferedIds.size && requested.size === newRequestedIds.size
        && [...offered].every(id => newOfferedIds.has(id))
        && [...requested].every(id => newRequestedIds.has(id))
    })
    if (isDuplicate)
      return NextResponse.json({ error: 'Une offre identique est déjà en attente pour ce destinataire' }, { status: 409 })
  }

  // Contre-offre : l'offre d'origine doit etre en attente ET m'avoir pour
  // destinataire, et la nouvelle offre repart vers son expediteur. Marquee
  // 'countered' AVANT l'insertion (atomique via .eq('status','pending')), puis
  // restauree si l'insertion echoue.
  if (counterOf) {
    const { data: parent } = await supabaseAdmin.from('trade_offers').select('id, sender_id, receiver_id, status').eq('id', counterOf).single()
    if (!parent || parent.receiver_id !== user.id || parent.sender_id !== receiverId)
      return NextResponse.json({ error: 'Contre-offre invalide' }, { status: 403 })
    const { data: marked, error: markErr } = await supabaseAdmin
      .from('trade_offers').update({ status: 'countered', updated_at: new Date().toISOString() })
      .eq('id', counterOf).eq('status', 'pending').select('id')
    if (markErr || !marked?.length)
      return NextResponse.json({ error: 'Cette offre a déjà été traitée' }, { status: 409 })
  }

  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from('trade_offers')
    .insert({ sender_id: user.id, receiver_id: receiverId, message: message || null })
    .select()
    .single()

  if (tradeErr || !trade) {
    if (counterOf) await supabaseAdmin.from('trade_offers').update({ status: 'pending' }).eq('id', counterOf)
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 })
  }

  // Expiration + lien de contre-offre (colonnes de la migration v2 : mise a
  // jour separee et tolerante pour ne rien casser tant qu'elle n'est pas appliquee).
  await supabaseAdmin.from('trade_offers').update({
    expires_at: new Date(Date.now() + TRADE_OFFER_TTL_DAYS * 86400000).toISOString(),
    ...(counterOf ? { parent_offer_id: counterOf } : {}),
  }).eq('id', trade.id)

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

  const [{ data: senderProfile }, { data: receiverProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', receiverId).single(),
  ])
  const receiverLang = normalizePushLang(receiverProfile?.preferred_lang)
  const senderName = senderProfile?.display_name || someoneNameFallback(receiverLang)
  const { title, body } = tradeOfferPush(receiverLang, senderName)

  if (counterOf) {
    await notifyTradeEvent(supabaseAdmin, { toUserId: receiverId, actorId: user.id, event: 'counter', imageUrl: rows.find(r => r.owner_id === receiverId && r.card_image)?.card_image })
  } else {
  await supabaseAdmin.from('notifications').insert({
    user_id: receiverId,
    type: 'trade_offer',
    message: body,
    lien: '/trades?tab=echanges',
    lu: false,
  })

  try {
    const tradeImage = rows.find(r => r.owner_id === receiverId && r.card_image)?.card_image
      || rows.find(r => r.card_image)?.card_image
    await sendPushToUser(receiverId, {
      title,
      body,
      url: '/messages?to=' + user.id,
      channelId: 'trades',
      imageUrl: tradeImage || undefined,
    })
  } catch { /* push non critique */ }
  }

  // Insérer automatiquement le message de l'offre dans le chat
  await supabaseAdmin.from('messages').insert({
    from_user_id: user.id,
    to_user_id: receiverId,
    contenu: `[[trade_offer:${trade.id}]]`,
    trade_id: null,
  })

  return NextResponse.json({ ok: true, tradeId: trade.id, receiverId })
}
