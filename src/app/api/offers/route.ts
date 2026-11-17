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
    const body = await req.json().catch(() => null) as { sellerId?: string; cardId?: string; cardIds?: unknown; price?: unknown; message?: unknown } | null
    const sellerId = body?.sellerId, cardId = body?.cardId
    if (!sellerId || !cardId) return NextResponse.json({ error: 'Carte ou vendeur manquant.' }, { status: 400 })
    if (sellerId === user.id) return NextResponse.json({ error: 'Tu ne peux pas faire une offre à toi-même.' }, { status: 400 })
    const price = parsePrice(body?.price)
    if (price == null) return NextResponse.json({ error: 'Indique un prix valide.' }, { status: 400 })

    // Une ou plusieurs cartes (offre groupée, 10 max) : chacune est relue en base (au vendeur, à vendre, ni vendue ni réservée).
    const ids = Array.from(new Set((Array.isArray(body?.cardIds) && body!.cardIds!.length ? (body!.cardIds as unknown[]) : [cardId]).map(String))).slice(0, 10)
    const { data: rows } = await supabaseAdmin.from('cartes_manuelles').select('*').in('id', ids).eq('user_id', sellerId)
    const cardsDb = ids.map(i => (rows || []).find(r => String(r.id) === i)).filter(Boolean) as any[]
    if (cardsDb.length !== ids.length || cardsDb.some(c => !c.disponible_vente || c.vendue)) return NextResponse.json({ error: ids.length > 1 ? 'Une des cartes n’est plus à vendre.' : 'Cette carte n’est plus à vendre.' }, { status: 409 })
    if (cardsDb.some(c => c.reservee)) return NextResponse.json({ error: ids.length > 1 ? 'Une des cartes est réservée pour un autre membre.' : 'Cette carte est réservée pour un autre membre.' }, { status: 409 })
    const prices = cardsDb.map(c => (c.prix_vente != null ? Number(c.prix_vente) : null))
    const asking = prices.every(x => x != null) ? Math.round((prices as number[]).reduce((a, b) => a + b, 0) * 100) / 100 : null
    if (asking != null && price >= asking) return NextResponse.json({ error: `Ton offre doit être inférieure au prix demandé (${fmtPrice(asking)}).` }, { status: 400 })

    // Limites : 3 offres ouvertes en même temps, et une seule par carte (y compris dans un lot).
    const nowIso = new Date().toISOString()
    const { data: open } = await supabaseAdmin.from('offers').select('id, card_id, card').eq('buyer_id', user.id).in('status', ['pending', 'countered']).gt('expires_at', nowIso)
    if ((open?.length ?? 0) >= MAX_OPEN_OFFERS) return NextResponse.json({ error: `Tu as déjà ${MAX_OPEN_OFFERS} offres en attente. Attends une réponse ou retire-en une.` }, { status: 429 })
    const inOpen = new Set((open || []).flatMap(o => [String(o.card_id), ...((o.card?.lot as { id: string }[] | undefined) || []).map(x => String(x.id))]))
    if (ids.some(i => inOpen.has(i))) return NextResponse.json({ error: 'Tu as déjà une offre en cours sur une de ces cartes.' }, { status: 409 })

    const one = (c: any) => ({ id: String(c.id), nom: c.nom, annee: c.annee, marque: c.marque, image: c.image_recto, prix: c.prix_vente != null ? Number(c.prix_vente) : null })
    const snapshot = cardsDb.length === 1
      ? one(cardsDb[0])
      : { id: String(cardsDb[0].id), nom: `Lot de ${cardsDb.length} cartes`, annee: null, marque: cardsDb.map(c => c.nom).slice(0, 3).join(', ') + (cardsDb.length > 3 ? ` +${cardsDb.length - 3}` : ''), image: cardsDb[0].image_recto, prix: asking, lot: cardsDb.map(one) }
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
