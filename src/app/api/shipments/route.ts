import { NextRequest, NextResponse } from 'next/server'
import { validateShipmentInput, type ShipmentCardSnapshot } from '@/lib/shipping'
import { supabaseAdmin, getUserFromRequest, postMessage, shipmentBubble, notifyShipment, purgeOldAddresses } from '@/lib/shipmentServer'

export const maxDuration = 30

// Demande de livraison : l'ACHETEUR (utilisateur connecté) indique son mode de livraison et son adresse au vendeur,
// une fois d'accord avec lui par messages. Aucun paiement : prix et frais d'envoi se règlent entre membres.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })

    const parsed = validateShipmentInput(await req.json().catch(() => null))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const v = parsed.value
    if (v.sellerId === user.id) return NextResponse.json({ error: 'Tu ne peux pas t’envoyer une carte à toi-même.' }, { status: 400 })

    const { data: seller } = await supabaseAdmin.from('profiles').select('id').eq('id', v.sellerId).maybeSingle()
    if (!seller) return NextResponse.json({ error: 'Vendeur introuvable.' }, { status: 404 })

    // Anti-abus : au plus 10 demandes par jour et par acheteur.
    const since = new Date(Date.now() - 86400000).toISOString()
    const { count } = await supabaseAdmin.from('shipments').select('id', { count: 'exact', head: true }).eq('buyer_id', user.id).gte('created_at', since)
    if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Trop de demandes aujourd’hui. Réessaie demain.' }, { status: 429 })

    // Cartes : relues en base (jamais confiées au client) et vérifiées comme appartenant bien au vendeur et non vendues.
    let cards: ShipmentCardSnapshot[] = []
    if (v.cardIds.length) {
      const { data } = await supabaseAdmin.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, prix_vente, vendue')
        .in('id', v.cardIds).eq('user_id', v.sellerId)
      const rows = (data || []).filter(c => !c.vendue)
      if (rows.length !== v.cardIds.length) return NextResponse.json({ error: 'Une des cartes n’est plus disponible chez ce vendeur.' }, { status: 409 })
      cards = rows.map(c => ({ id: c.id, nom: c.nom, annee: c.annee, marque: c.marque, image: c.image_recto, prix: c.prix_vente != null ? Number(c.prix_vente) : null }))

      // Une carte ne peut pas être dans deux envois en cours.
      const { data: active } = await supabaseAdmin.from('shipments').select('cards').eq('seller_id', v.sellerId).in('status', ['requested', 'shipped'])
      const busy = new Set((active || []).flatMap(s => ((s.cards as ShipmentCardSnapshot[]) || []).map(c => c.id)))
      if (cards.some(c => busy.has(c.id))) return NextResponse.json({ error: 'Une des cartes est déjà dans une demande de livraison en cours.' }, { status: 409 })
    }
    const prices = cards.map(c => c.prix).filter((p): p is number => typeof p === 'number')
    const declared = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) * 100) / 100 : null

    const { data: created, error } = await supabaseAdmin.from('shipments').insert({
      buyer_id: user.id, seller_id: v.sellerId, cards, note: v.note || null, declared_value: declared,
      carrier: v.carrier, delivery_mode: v.deliveryMode,
      recipient_name: v.recipientName, address_line1: v.addressLine1 || null, address_line2: v.addressLine2 || null,
      postal_code: v.postalCode, city: v.city, country: 'FR', phone: v.phone || null, relay_label: v.relayLabel || null,
    }).select('id').single()
    if (error || !created) return NextResponse.json({ error: error?.message || 'Création impossible.' }, { status: 500 })

    await postMessage(user.id, v.sellerId, shipmentBubble(created.id))
    await notifyShipment(v.sellerId, user.id, 'requested')
    purgeOldAddresses().catch(() => {})
    return NextResponse.json({ ok: true, id: created.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
