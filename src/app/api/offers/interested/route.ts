import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'

export const maxDuration = 30

// Membres qui ont mis en favori (⭐ de l'onglet Annonces) une de MES cartes à vendre, pour que je puisse leur proposer un prix.
// Lecture par le service role (les favoris sont privés à leur auteur) : seul le propriétaire de la carte voit qui s'y intéresse.
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const { data: cards } = await supabaseAdmin.from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto, prix_vente, reservee')
      .eq('user_id', user.id).eq('disponible_vente', true).or('vendue.is.null,vendue.eq.false').limit(500)
    const mine = (cards || []).filter(c => c.prix_vente != null && !c.reservee)
    if (!mine.length) return NextResponse.json({ interested: [] })
    const byId = new Map(mine.map(c => [String(c.id), c]))
    const { data: favs } = await supabaseAdmin.from('trade_favorites').select('user_id, item_id, created_at')
      .eq('item_type', 'galerie').in('item_id', [...byId.keys()]).neq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
    if (!favs?.length) return NextResponse.json({ interested: [] })
    // retirer ceux à qui j'ai déjà une offre ouverte sur cette carte
    const nowIso = new Date().toISOString()
    const { data: open } = await supabaseAdmin.from('offers').select('buyer_id, card_id').eq('seller_id', user.id).in('status', ['pending', 'countered']).gt('expires_at', nowIso)
    const openKey = new Set((open || []).map(o => `${o.buyer_id}:${o.card_id}`))
    const rows = favs.filter(f => !openKey.has(`${f.user_id}:${f.item_id}`))
    const ids = [...new Set(rows.map(r => r.user_id))]
    const { data: profs } = ids.length ? await supabaseAdmin.from('profiles').select('id, display_name, avatar_url').in('id', ids) : { data: [] as any[] }
    const pmap = new Map((profs || []).map((p: any) => [p.id, p]))
    const interested = rows.slice(0, 60).map(r => {
      const c = byId.get(String(r.item_id))!, p = pmap.get(r.user_id)
      return { buyerId: r.user_id, buyerName: p?.display_name || 'Membre', buyerAvatar: p?.avatar_url || null, at: r.created_at, card: { id: String(c.id), nom: c.nom, annee: c.annee, marque: c.marque, image: c.image_recto, prix: Number(c.prix_vente) } }
    })
    return NextResponse.json({ interested })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
