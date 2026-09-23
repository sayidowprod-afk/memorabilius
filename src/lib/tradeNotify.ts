import type { SupabaseClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { tradeEventPush, someoneNameFallback, normalizePushLang, type TradeEvent } from '@/lib/pushTranslations'

// Notification (ligne in-app + push) pour un evenement du cycle de vie d'un
// echange. `actorId` = celui dont le nom apparait dans le message (ex: qui a
// envoye ses cartes) ; ne leve jamais -- une notif ratee ne doit pas faire
// echouer l'action metier qui l'a declenchee.
export async function notifyTradeEvent(
  admin: SupabaseClient,
  opts: { toUserId: string; actorId: string; event: TradeEvent; imageUrl?: string | null }
) {
  try {
    const [{ data: actor }, { data: to }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', opts.actorId).single(),
      admin.from('profiles').select('preferred_lang').eq('id', opts.toUserId).single(),
    ])
    const lang = normalizePushLang(to?.preferred_lang)
    const { title, body } = tradeEventPush(lang, opts.event, actor?.display_name || someoneNameFallback(lang))
    await admin.from('notifications').insert({
      user_id: opts.toUserId,
      type: `trade_${opts.event}`,
      message: body,
      lien: '/trades?tab=echanges',
      lu: false,
    })
    await sendPushToUser(opts.toUserId, {
      title, body, url: '/trades?tab=echanges', channelId: 'trades', imageUrl: opts.imageUrl || undefined,
    })
  } catch (e) {
    console.error('[notifyTradeEvent]', opts.event, e)
  }
}

// Duree de validite d'une offre avant expiration automatique.
export const TRADE_OFFER_TTL_DAYS = 7
