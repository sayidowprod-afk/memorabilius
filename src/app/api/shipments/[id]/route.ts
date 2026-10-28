import { NextRequest, NextResponse } from 'next/server'
import { validTracking, type ShipmentCardSnapshot } from '@/lib/shipping'
import { supabaseAdmin, getUserFromRequest, postMessage, notifyShipment } from '@/lib/shipmentServer'

export const maxDuration = 30

// Étapes d'une livraison :
//  - seller  « ship »     : demande → expédié (numéro de suivi)
//  - buyer   « received » : expédié → reçu (les cartes passent en « vendue » chez le vendeur)
//  - buyer ou seller « cancel » : seulement tant que rien n'est expédié
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const { id } = await params
    const body = await req.json().catch(() => null) as { action?: string; tracking?: string } | null
    const action = body?.action

    const { data: s } = await supabaseAdmin.from('shipments').select('*').eq('id', id).maybeSingle()
    if (!s || (s.buyer_id !== user.id && s.seller_id !== user.id)) return NextResponse.json({ error: 'Livraison introuvable.' }, { status: 404 })
    const isSeller = s.seller_id === user.id
    const other = isSeller ? s.buyer_id : s.seller_id
    const now = new Date().toISOString()

    if (action === 'ship') {
      if (!isSeller) return NextResponse.json({ error: 'Seul le vendeur peut marquer l’envoi.' }, { status: 403 })
      if (s.status !== 'requested') return NextResponse.json({ error: 'Cette demande n’est plus en attente.' }, { status: 409 })
      const tracking = (body?.tracking || '').trim()
      if (tracking && !validTracking(tracking)) return NextResponse.json({ error: 'Numéro de suivi non valide (lettres, chiffres, espaces, tirets).' }, { status: 400 })
      await supabaseAdmin.from('shipments').update({ status: 'shipped', tracking_number: tracking || null, shipped_at: now, updated_at: now }).eq('id', id)
      await postMessage(user.id, other, `🚚 J'ai expédié ta carte !${tracking ? ` Numéro de suivi : ${tracking}` : ''}`)
      await notifyShipment(other, user.id, 'shipped')
      return NextResponse.json({ ok: true })
    }

    if (action === 'received') {
      if (isSeller) return NextResponse.json({ error: 'Seul l’acheteur confirme la réception.' }, { status: 403 })
      if (s.status !== 'shipped') return NextResponse.json({ error: 'Le colis n’est pas encore expédié.' }, { status: 409 })
      await supabaseAdmin.from('shipments').update({ status: 'delivered', delivered_at: now, updated_at: now }).eq('id', id)
      // Les cartes de la galerie du vendeur passent en « vendue ».
      const ids = ((s.cards as ShipmentCardSnapshot[]) || []).map(c => c.id)
      if (ids.length) await supabaseAdmin.from('cartes_manuelles').update({ vendue: true }).in('id', ids).eq('user_id', s.seller_id)
      await postMessage(user.id, other, '✅ Bien reçu, merci !')
      await notifyShipment(other, user.id, 'delivered')
      return NextResponse.json({ ok: true })
    }

    if (action === 'cancel') {
      if (s.status !== 'requested') return NextResponse.json({ error: 'Impossible d’annuler : le colis est déjà parti.' }, { status: 409 })
      await supabaseAdmin.from('shipments').update({ status: 'cancelled', updated_at: now }).eq('id', id)
      await postMessage(user.id, other, '❌ Demande de livraison annulée.')
      await notifyShipment(other, user.id, 'cancelled')
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
