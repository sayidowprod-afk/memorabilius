import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest, postMessage } from '@/lib/shipmentServer'
import { notifyOffer } from '@/lib/offersServer'
import { isOpen, parsePrice, OFFER_TTL_HOURS } from '@/lib/offers'
import { fmtPrice } from '@/lib/marketplace'

export const maxDuration = 30

// Étapes d'une offre :
//  - vendeur « accept » / « refuse » / « counter » (prix) : offre en attente (pending)
//  - acheteur « accept » / « refuse » : contre-proposition reçue (countered)
//  - acheteur « cancel » : offre en attente ou contre-proposée
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => null) as { action?: string; price?: unknown } | null
    const action = body?.action

    const { data: o } = await supabaseAdmin.from('offers').select('*').eq('id', id).maybeSingle()
    if (!o || (o.buyer_id !== user.id && o.seller_id !== user.id)) return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 })
    const isSeller = o.seller_id === user.id
    const other = isSeller ? o.buyer_id : o.seller_id
    if (!isOpen(o)) return NextResponse.json({ error: o.status === 'pending' || o.status === 'countered' ? 'Cette offre a expiré.' : 'Cette offre est déjà terminée.' }, { status: 409 })
    const now = new Date().toISOString()
    const nameOf = o.card?.nom || 'la carte'

    // Qui doit répondre : le vendeur si « pending », l'acheteur si « countered ».
    const responder = o.status === 'pending' ? o.seller_id : o.buyer_id

    if (action === 'accept') {
      if (user.id !== responder) return NextResponse.json({ error: 'Ce n’est pas à toi de répondre.' }, { status: 403 })
      const final = o.status === 'countered' ? Number(o.counter_price) : Number(o.price)
      // la carte doit toujours être à vendre
      const { data: card } = await supabaseAdmin.from('cartes_manuelles').select('vendue, disponible_vente').eq('id', o.card_id).eq('user_id', o.seller_id).maybeSingle()
      if (!card || card.vendue || !card.disponible_vente) return NextResponse.json({ error: 'Cette carte n’est plus à vendre.' }, { status: 409 })
      await supabaseAdmin.from('offers').update({ status: 'accepted', updated_at: now }).eq('id', id)
      // la carte passe en « réservée » (simple oui/non public ; l'acheteur n'est connu que de l'offre, privée) ; erreur ignorée si la migration n'est pas appliquée
      await supabaseAdmin.from('cartes_manuelles').update({ reservee: true }).eq('id', o.card_id).eq('user_id', o.seller_id)
      await postMessage(user.id, other, `✅ Offre acceptée : ${nameOf} à ${fmtPrice(final)}. On organise l’envoi ? (bouton 📦 de la conversation)`)
      await notifyOffer(other, user.id, 'accepted', fmtPrice(final))
      return NextResponse.json({ ok: true })
    }

    if (action === 'refuse') {
      if (user.id !== responder) return NextResponse.json({ error: 'Ce n’est pas à toi de répondre.' }, { status: 403 })
      await supabaseAdmin.from('offers').update({ status: 'refused', updated_at: now }).eq('id', id)
      await postMessage(user.id, other, `❌ Offre refusée pour ${nameOf}.`)
      await notifyOffer(other, user.id, 'refused')
      return NextResponse.json({ ok: true })
    }

    if (action === 'counter') {
      if (!isSeller || o.status !== 'pending') return NextResponse.json({ error: 'Seul le vendeur peut contre-proposer, une fois.' }, { status: 403 })
      const price = parsePrice(body?.price)
      if (price == null) return NextResponse.json({ error: 'Indique un prix valide.' }, { status: 400 })
      const asking = o.card?.prix != null ? Number(o.card.prix) : null
      if (price <= Number(o.price)) return NextResponse.json({ error: 'Ta contre-proposition doit être supérieure à l’offre reçue.' }, { status: 400 })
      if (asking != null && price > asking) return NextResponse.json({ error: `Ta contre-proposition ne peut pas dépasser ton prix (${fmtPrice(asking)}).` }, { status: 400 })
      const expires = new Date(Date.now() + OFFER_TTL_HOURS * 3600000).toISOString()
      await supabaseAdmin.from('offers').update({ status: 'countered', counter_price: price, expires_at: expires, updated_at: now }).eq('id', id)
      await postMessage(user.id, other, `↔️ Contre-proposition : ${fmtPrice(price)} pour ${nameOf}.`)
      await notifyOffer(other, user.id, 'counter', fmtPrice(price))
      return NextResponse.json({ ok: true })
    }

    if (action === 'cancel') {
      if (isSeller) return NextResponse.json({ error: 'Seul l’acheteur peut retirer son offre.' }, { status: 403 })
      await supabaseAdmin.from('offers').update({ status: 'cancelled', updated_at: now }).eq('id', id)
      await postMessage(user.id, other, `↩️ Offre retirée pour ${nameOf}.`)
      await notifyOffer(other, user.id, 'cancelled')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
