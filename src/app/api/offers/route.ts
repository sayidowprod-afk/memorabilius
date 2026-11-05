import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, postMessage } from '@/lib/shipmentServer'
import { notifyOffer } from '@/lib/offersServer'
import { offerBubble, parsePrice, cleanMessage, OFFER_TTL_HOURS, MAX_OPEN_OFFERS } from '@/lib/offers'
import { fmtPrice } from '@/lib/marketplace'

export const maxDuration = 30

// Nouvelle offre : l'ACHETEUR (connecté) propose un prix pour une carte à vendre chez le vendeur. Aucun paiement.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const body = await req.json().catch(() => null) as { sellerId?: string; cardId?: string; price?: unknown; message?: unknown } | null
    const sellerId = body?.sellerId, cardId = body?.cardId
    if (!sellerId || !cardId) return NextResponse.json({ error: 'Carte ou vendeur manquant.' }, { status: 400 })
    if (sellerId === user.id) return NextResponse.json({ error: 'Tu ne peux pas faire une offre à toi-même.' }, { status: 400 })
    const price = parsePrice(body?.price)
    if (price == null) return NextResponse.json({ error: 'Indique un prix valide.' }, { status: 400 })

    // La carte est relue en base : elle doit appartenir au vendeur, être à vendre et ne pas être vendue.
    const { data: card } = await supabaseAdmin.from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto, prix_vente, vendue, disponible_vente').eq('id', cardId).eq('user_id', sellerId).maybeSingle()
    if (!card || !card.disponible_vente || card.vendue) return NextResponse.json({ error: 'Cette carte n’est plus à vendre.' }, { status: 409 })
    const asking = card.prix_vente != null ? Number(card.prix_vente) : null
    if (asking != null && price >= asking) return NextResponse.json({ error: `Ton offre doit être inférieure au prix demandé (${fmtPrice(asking)}).` }, { status: 400 })

    // Limites : 3 offres ouvertes en même temps, et une seule par carte.
    const nowIso = new Date().toISOString()
    const { data: open } = await supabaseAdmin.from('offers').select('id, card_id').eq('buyer_id', user.id).in('status', ['pending', 'countered']).gt('expires_at', nowIso)
    if ((open?.length ?? 0) >= MAX_OPEN_OFFERS) return NextResponse.json({ error: `Tu as déjà ${MAX_OPEN_OFFERS} offres en attente. Attends une réponse ou retire-en une.` }, { status: 429 })
    if ((open || []).some(o => String(o.card_id) === String(cardId))) return NextResponse.json({ error: 'Tu as déjà une offre en cours sur cette carte.' }, { status: 409 })

    const snapshot = { id: String(card.id), nom: card.nom, annee: card.annee, marque: card.marque, image: card.image_recto, prix: asking }
    const { data: created, error } = await supabaseAdmin.from('offers').insert({
      buyer_id: user.id, seller_id: sellerId, card_id: String(cardId), card: snapshot, price, message: cleanMessage(body?.message),
      status: 'pending', expires_at: new Date(Date.now() + OFFER_TTL_HOURS * 3600000).toISOString(),
    }).select('id').single()
    if (error || !created) return NextResponse.json({ error: error?.message || 'Création impossible.' }, { status: 500 })

    await postMessage(user.id, sellerId, offerBubble(created.id))
    await notifyOffer(sellerId, user.id, 'new', fmtPrice(price))
    return NextResponse.json({ ok: true, id: created.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
