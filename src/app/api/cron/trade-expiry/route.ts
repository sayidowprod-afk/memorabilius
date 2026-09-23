import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyTradeEvent } from '@/lib/tradeNotify'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Quotidien : cycle de vie des offres d'echange (colonnes de la migration
// 20260924_trades_v2.sql) --
//  1. expire les offres en attente dont expires_at est passe (previent l'expediteur)
//  2. relance le destinataire des offres qui expirent dans moins de 48h (une seule fois)
//  3. relance les deux parties d'un echange accepte depuis 4+ jours et toujours
//     pas termine (une seule fois)
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const in48h = new Date(now.getTime() + 48 * 3600000).toISOString()
  const fourDaysAgo = new Date(now.getTime() - 4 * 86400000).toISOString()
  let expired = 0, reminded = 0, followedUp = 0

  // 1. Expiration
  const { data: overdue, error: overdueErr } = await supabase
    .from('trade_offers').select('id, sender_id, receiver_id')
    .eq('status', 'pending').lt('expires_at', nowIso).limit(200)
  if (overdueErr) return NextResponse.json({ error: overdueErr.message, hint: 'migration 20260924_trades_v2.sql appliquee ?' }, { status: 500 })
  for (const t of overdue || []) {
    const { data: done } = await supabase.from('trade_offers')
      .update({ status: 'expired', updated_at: nowIso }).eq('id', t.id).eq('status', 'pending').select('id')
    if (done?.length) {
      expired++
      await notifyTradeEvent(supabase, { toUserId: t.sender_id, actorId: t.receiver_id, event: 'expired' })
    }
  }

  // 2. Rappel avant expiration
  const { data: expiring } = await supabase
    .from('trade_offers').select('id, sender_id, receiver_id')
    .eq('status', 'pending').gte('expires_at', nowIso).lt('expires_at', in48h).is('reminder_sent_at', null).limit(200)
  for (const t of expiring || []) {
    const { data: done } = await supabase.from('trade_offers')
      .update({ reminder_sent_at: nowIso }).eq('id', t.id).is('reminder_sent_at', null).select('id')
    if (done?.length) {
      reminded++
      await notifyTradeEvent(supabase, { toUserId: t.receiver_id, actorId: t.sender_id, event: 'expiring' })
    }
  }

  // 3. Relance des echanges acceptes qui traînent
  const { data: stale } = await supabase
    .from('trade_offers').select('id, sender_id, receiver_id')
    .eq('status', 'accepted').lt('accepted_at', fourDaysAgo).is('followup_sent_at', null).limit(200)
  for (const t of stale || []) {
    const { data: done } = await supabase.from('trade_offers')
      .update({ followup_sent_at: nowIso }).eq('id', t.id).is('followup_sent_at', null).select('id')
    if (done?.length) {
      followedUp++
      await Promise.all([
        notifyTradeEvent(supabase, { toUserId: t.sender_id, actorId: t.receiver_id, event: 'followup' }),
        notifyTradeEvent(supabase, { toUserId: t.receiver_id, actorId: t.sender_id, event: 'followup' }),
      ])
    }
  }

  return NextResponse.json({ ok: true, expired, reminded, followedUp })
}
