import { supabaseAdmin } from '@/lib/shipmentServer'
import { sendPushToUser } from '@/lib/pushNotify'

// Cloche + push pour une offre (le message dans la conversation est posté par la route). Best-effort : un échec n'arrête jamais l'action.
const TEXTS = {
  fr: { new: (n: string, p: string) => `${n} te propose ${p} pour une de tes cartes.`, counter: (n: string, p: string) => `${n} te propose ${p} en retour.`, accepted: (n: string, p: string) => `${n} a accepté l’offre à ${p}.`, refused: (n: string) => `${n} a refusé l’offre.`, cancelled: (n: string) => `${n} a retiré son offre.`, title: 'Offre de prix' },
  en: { new: (n: string, p: string) => `${n} offers ${p} for one of your cards.`, counter: (n: string, p: string) => `${n} counter-offers ${p}.`, accepted: (n: string, p: string) => `${n} accepted the offer at ${p}.`, refused: (n: string) => `${n} declined the offer.`, cancelled: (n: string) => `${n} withdrew their offer.`, title: 'Price offer' },
}

export async function notifyOffer(toUserId: string, actorId: string, event: 'new' | 'counter' | 'accepted' | 'refused' | 'cancelled', price?: string) {
  try {
    const [{ data: actor }, { data: recipient }] = await Promise.all([
      supabaseAdmin.from('profiles').select('display_name').eq('id', actorId).single(),
      supabaseAdmin.from('profiles').select('preferred_lang').eq('id', toUserId).single(),
    ])
    const T = String(recipient?.preferred_lang || 'fr').startsWith('fr') ? TEXTS.fr : TEXTS.en
    const name = actor?.display_name || (T === TEXTS.fr ? 'Un membre' : 'A member')
    const p = price ?? ''
    const body = event === 'new' ? T.new(name, p) : event === 'counter' ? T.counter(name, p) : event === 'accepted' ? T.accepted(name, p) : event === 'refused' ? T.refused(name) : T.cancelled(name)
    await supabaseAdmin.from('notifications').insert({ user_id: toUserId, type: 'offer', message: body, lien: `/messages?to=${actorId}`, lu: false })
    await sendPushToUser(toUserId, { title: T.title, body, url: `/messages?to=${actorId}`, channelId: 'messages' })
  } catch { /* notification best-effort */ }
}
