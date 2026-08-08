import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user || user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Étape 1 : supprimer en parallèle toutes les tables indépendantes
    await Promise.all([
      supabaseAdmin.from('training_data').delete().eq('user_id', userId),
      supabaseAdmin.from('scan_corrections').delete().eq('user_id', userId),
      supabaseAdmin.from('ai_scan_events').delete().eq('user_id', userId),
      supabaseAdmin.from('card_likes').delete().eq('user_id', userId),
      supabaseAdmin.from('wishlist').delete().eq('user_id', userId),
      supabaseAdmin.from('badges').delete().eq('user_id', userId),
      supabaseAdmin.from('monthly_additions').delete().eq('user_id', userId),
      supabaseAdmin.from('push_subscriptions').delete().eq('user_id', userId),
      supabaseAdmin.from('notifications').delete().eq('user_id', userId),
      supabaseAdmin.from('messages').delete().eq('from_user_id', userId),
      supabaseAdmin.from('messages').delete().eq('to_user_id', userId),
      supabaseAdmin.from('team_members').delete().eq('user_id', userId),
      supabaseAdmin.from('team_candidatures').delete().eq('user_id', userId),
      supabaseAdmin.from('cartes_privees').delete().eq('user_id', userId),
      supabaseAdmin.from('cartes_manuelles').delete().eq('user_id', userId),
    ])

    // Étape 2 : trade_offer_cards avant trade_offers (contrainte FK)
    const { data: tradeIds } = await supabaseAdmin
      .from('trade_offers').select('id').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    if (tradeIds?.length) {
      await supabaseAdmin.from('trade_offer_cards').delete().in('trade_id', tradeIds.map(t => t.id))
    }
    await Promise.all([
      supabaseAdmin.from('trade_offers').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      supabaseAdmin.from('trades').delete().or(`user_id.eq.${userId},partner_id.eq.${userId}`),
    ])

    // Étape 3 : profil puis compte auth
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
