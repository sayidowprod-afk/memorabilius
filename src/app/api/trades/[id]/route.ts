import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { awardTradeXPIfUnderCap } from '@/lib/xp'
import { tradeResponsePush, someoneNameFallback, normalizePushLang } from '@/lib/pushTranslations'
import { notifyTradeEvent } from '@/lib/tradeNotify'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH /api/trades/[id]
//  - accept | refuse | cancel : reponse a une offre en attente
//  - ship    : "j'ai envoye mes cartes" (echange accepte)
//  - receive : "j'ai recu les cartes de l'autre" (echange accepte) -- quand les
//              DEUX parties ont confirme la reception, l'echange passe a 'completed'
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json()
  if (!['accept', 'refuse', 'cancel', 'ship', 'receive'].includes(action))
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })

  const { data: trade } = await supabaseAdmin
    .from('trade_offers').select('*').eq('id', id).single()

  if (!trade) return NextResponse.json({ error: 'Échange introuvable' }, { status: 404 })

  // ── Suivi apres acceptation ────────────────────────────────────────────────
  if (action === 'ship' || action === 'receive') {
    const isSender = trade.sender_id === user.id
    if (!isSender && trade.receiver_id !== user.id)
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    if (trade.status !== 'accepted')
      return NextResponse.json({ error: 'Cet échange n\'est pas en cours' }, { status: 409 })

    const col = action === 'ship'
      ? (isSender ? 'sender_shipped_at' : 'receiver_shipped_at')
      : (isSender ? 'sender_received_at' : 'receiver_received_at')
    if (trade[col]) return NextResponse.json({ ok: true, already: true })

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { [col]: now, updated_at: now }
    // Termine des que les deux parties ont confirme avoir RECU leurs cartes.
    const otherReceivedCol = isSender ? 'receiver_received_at' : 'sender_received_at'
    const completes = action === 'receive' && !!trade[otherReceivedCol]
    if (completes) { patch.status = 'completed'; patch.completed_at = now }

    const { data: updated, error } = await supabaseAdmin
      .from('trade_offers').update(patch).eq('id', trade.id).eq('status', 'accepted').select('id')
    if (error || !updated?.length) return NextResponse.json({ error: 'Mise à jour impossible' }, { status: 409 })

    const otherId = isSender ? trade.receiver_id : trade.sender_id
    if (completes) {
      await Promise.all([
        notifyTradeEvent(supabaseAdmin, { toUserId: trade.sender_id, actorId: trade.receiver_id, event: 'completed' }),
        notifyTradeEvent(supabaseAdmin, { toUserId: trade.receiver_id, actorId: trade.sender_id, event: 'completed' }),
      ])
    } else {
      await notifyTradeEvent(supabaseAdmin, { toUserId: otherId, actorId: user.id, event: action === 'ship' ? 'shipped' : 'received' })
    }
    return NextResponse.json({ ok: true, completed: completes })
  }

  // ── Reponse a une offre en attente ─────────────────────────────────────────
  if (trade.status !== 'pending') return NextResponse.json({ error: 'Échange déjà traité' }, { status: 409 })

  if (action === 'cancel' && trade.sender_id !== user.id)
    return NextResponse.json({ error: 'Seul l\'expéditeur peut annuler' }, { status: 403 })
  if ((action === 'accept' || action === 'refuse') && trade.receiver_id !== user.id)
    return NextResponse.json({ error: 'Seul le destinataire peut accepter/refuser' }, { status: 403 })

  // Offre expiree mais pas encore traitee par le cron : on la cloture ici.
  if (trade.expires_at && new Date(trade.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('trade_offers').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', trade.id).eq('status', 'pending')
    return NextResponse.json({ error: 'Cette offre a expiré' }, { status: 409 })
  }

  // Re-verifie a l'acceptation que les cartes manuelles offertes/demandees
  // existent toujours chez leur proprietaire attendu -- entre la creation de
  // l'offre et son acceptation, une carte a pu etre supprimee ou deplacee
  // (ex: deja donnee dans un autre echange). Sans ce controle, l'offre
  // pouvait etre acceptee (XP versee, notif envoyee) pour une carte qui
  // n'existe plus.
  let manualCardIds: string[] = []
  if (action === 'accept') {
    const { data: cards } = await supabaseAdmin
      .from('trade_offer_cards')
      .select('card_id, is_manuelle, owner_id')
      .eq('trade_id', trade.id)
      .eq('is_manuelle', true)
    if (cards?.length) {
      manualCardIds = cards.map(c => c.card_id)
      const byOwner = new Map<string, string[]>()
      for (const c of cards) byOwner.set(c.owner_id, [...(byOwner.get(c.owner_id) || []), c.card_id])
      for (const [ownerId, cardIds] of byOwner) {
        const { data: stillOwned } = await supabaseAdmin
          .from('cartes_manuelles').select('id').in('id', cardIds).eq('user_id', ownerId)
        if ((stillOwned?.length || 0) !== cardIds.length)
          return NextResponse.json({ error: 'Une des cartes de cet échange n\'est plus disponible' }, { status: 409 })
      }
    }
  }

  // .eq('status', 'pending') rend le check-then-update atomique : sans ça, deux
  // requêtes concurrentes (double-tap, retry réseau sur mobile, ou un accept et
  // un cancel arrivant en même temps) pouvaient toutes les deux relire
  // status === 'pending' avant qu'aucune n'écrive, et toutes les deux passer —
  // doublant l'XP versée à l'acceptation, ou laissant un état incohérent selon
  // laquelle écrivait en dernier. select() vide = quelqu'un d'autre a gagné la
  // course entre notre lecture et notre écriture.
  const statusMap: Record<string, string> = { accept: 'accepted', refuse: 'refused', cancel: 'cancelled' }
  const { data: updated } = await supabaseAdmin
    .from('trade_offers')
    .update({ status: statusMap[action], updated_at: new Date().toISOString() })
    .eq('id', trade.id)
    .eq('status', 'pending')
    .select('id')
  if (!updated || updated.length === 0) return NextResponse.json({ error: 'Échange déjà traité' }, { status: 409 })

  if (action === 'accept') {
    await awardTradeXPIfUnderCap(supabaseAdmin, trade.sender_id)
    await awardTradeXPIfUnderCap(supabaseAdmin, trade.receiver_id)
    // Les cartes engagees dans un echange accepte ne doivent plus apparaitre
    // "disponibles" sur /trades. accepted_at : colonne de la migration v2 --
    // mise a jour separee et tolerante pour ne rien casser tant qu'elle n'est
    // pas appliquee.
    if (manualCardIds.length) {
      await supabaseAdmin.from('cartes_manuelles').update({ disponible_vente: false }).in('id', manualCardIds)
    }
    await supabaseAdmin.from('trade_offers').update({ accepted_at: new Date().toISOString() }).eq('id', trade.id)
  }

  const notifyUserId = action === 'cancel' ? trade.receiver_id : trade.sender_id
  const [{ data: actorProfile }, { data: notifyProfile }] = await Promise.all([
    supabaseAdmin.from('profiles').select('display_name').eq('id', user.id).single(),
    supabaseAdmin.from('profiles').select('preferred_lang').eq('id', notifyUserId).single(),
  ])
  const notifyLang = normalizePushLang(notifyProfile?.preferred_lang)
  const actorName = actorProfile?.display_name || someoneNameFallback(notifyLang)
  const { title, body } = tradeResponsePush(notifyLang, action as 'accept' | 'refuse' | 'cancel', actorName)

  await supabaseAdmin.from('notifications').insert({
    user_id: notifyUserId,
    type: 'trade_response',
    message: body,
    lien: '/trades?tab=echanges',
    lu: false,
  })

  if (action !== 'cancel') {
    await sendPushToUser(notifyUserId, {
      title,
      body,
      url: '/trades?tab=echanges',
      channelId: 'trades',
    })
  }

  return NextResponse.json({ ok: true })
}
