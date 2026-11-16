import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, postMessage } from '@/lib/shipmentServer'
import { notifyOffer } from '@/lib/offersServer'
import { offerBubble, parsePrice, OFFER_TTL_HOURS } from '@/lib/offers'
import { fmtPrice } from '@/lib/marketplace'

export const maxDuration = 30

// Le VENDEUR (connecté) propose un prix à un membre qui a mis sa carte en favori. Aucun paiement.
// Modélisé comme une contre-proposition (status « countered ») : l'acheteur reçoit « le vendeur te propose X € » et peut accepter ou refuser,
// avec exactement les mêmes écrans et règles que pour une contre-proposition classique (/api/offers/[id]). `card.initiator = 'seller'` la distingue.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const body = await req.json().catch(() => null) as { buyerId?: string; cardId?: string; price?: unknown } | null
    const buyerId = body?.buyerId, cardId = body?.cardId
    if (!buyerId || !cardId) return NextResponse.json({ error: 'Carte ou membre manquant.' }, { status: 400 })
    if (buyerId === user.id) return NextResponse.json({ error: 'Tu ne peux pas t’envoyer une offre.' }, { status: 400 })
    const price = parsePrice(body?.price)
    if (price == null) return NextResponse.json({ error: 'Indique un prix valide.' }, { status: 400 })

    const { data: card } = await supabaseAdmin.from('cartes_manuelles').select('*').eq('id', cardId).eq('user_id', user.id).maybeSingle()
    if (!card || !card.disponible_vente || card.vendue) return NextResponse.json({ error: 'Cette carte n’est plus à vendre.' }, { status: 409 })
    if (card.reservee) return NextResponse.json({ error: 'Cette carte est déjà réservée.' }, { status: 409 })
    const asking = card.prix_vente != null ? Number(card.prix_vente) : null
    if (asking != null && price > asking) return NextResponse.json({ error: `Ton prix ne peut pas dépasser le prix affiché (${fmtPrice(asking)}).` }, { status: 400 })

    // seulement à un membre qui a réellement mis cette carte en favori (pas d'offres non sollicitées)
    const { data: fav } = await supabaseAdmin.from('trade_favorites').select('user_id').eq('user_id', buyerId).eq('item_type', 'galerie').eq('item_id', String(cardId)).maybeSingle()
    if (!fav) return NextResponse.json({ error: 'Ce membre n’a pas mis cette carte en favori.' }, { status: 403 })

    const nowIso = new Date().toISOString()
    const { data: open } = await supabaseAdmin.from('offers').select('id').eq('buyer_id', buyerId).eq('seller_id', user.id).eq('card_id', String(cardId)).in('status', ['pending', 'countered']).gt('expires_at', nowIso)
    if (open?.length) return NextResponse.json({ error: 'Une offre est déjà en cours avec ce membre pour cette carte.' }, { status: 409 })

    const snapshot = { id: String(card.id), nom: card.nom, annee: card.annee, marque: card.marque, image: card.image_recto, prix: asking, initiator: 'seller' }
    const { data: created, error } = await supabaseAdmin.from('offers').insert({
      buyer_id: buyerId, seller_id: user.id, card_id: String(cardId), card: snapshot, price, counter_price: price,
      status: 'countered', expires_at: new Date(Date.now() + OFFER_TTL_HOURS * 3600000).toISOString(),
    }).select('id').single()
    if (error || !created) return NextResponse.json({ error: error?.message || 'Création impossible.' }, { status: 500 })

    await postMessage(user.id, buyerId, offerBubble(created.id))
    await notifyOffer(buyerId, user.id, 'counter', fmtPrice(price))
    return NextResponse.json({ ok: true, id: created.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
