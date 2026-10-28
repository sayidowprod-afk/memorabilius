import { createServerServiceClient } from '@/lib/supabaseServer'
import { sendPushToUser } from '@/lib/pushNotify'
import { shipmentPush, normalizePushLang, someoneNameFallback } from '@/lib/pushTranslations'
import { SHIPMENT_PREFIX } from '@/lib/shipping'

// Aides serveur pour la livraison entre membres (routes /api/shipments) : authentification, messages dans la conversation,
// notification (cloche + push), purge des adresses. Tout passe par le service role : les règles sont appliquées ici.
export const supabaseAdmin = createServerServiceClient()

export async function getUserFromRequest(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}

// Message dans la conversation acheteur/vendeur (apparaît en direct grâce au realtime de la table messages).
export async function postMessage(fromId: string, toId: string, contenu: string) {
  await supabaseAdmin.from('messages').insert({ from_user_id: fromId, to_user_id: toId, contenu })
}

export const shipmentBubble = (id: string) => `${SHIPMENT_PREFIX}${id}]]`

// Cloche + push au destinataire. Les échecs de notification ne doivent jamais faire échouer l'action elle-même.
export async function notifyShipment(toUserId: string, actorId: string, event: 'requested' | 'shipped' | 'delivered' | 'cancelled') {
  try {
    const [{ data: actor }, { data: recipient }] = await Promise.all([
      supabaseAdmin.from('profiles').select('display_name').eq('id', actorId).single(),
      supabaseAdmin.from('profiles').select('preferred_lang').eq('id', toUserId).single(),
    ])
    const lang = normalizePushLang(recipient?.preferred_lang)
    const { title, body } = shipmentPush(lang, event, actor?.display_name || someoneNameFallback(lang))
    await supabaseAdmin.from('notifications').insert({ user_id: toUserId, type: 'shipment', message: body, lien: `/messages?to=${actorId}`, lu: false })
    await sendPushToUser(toUserId, { title, body, url: `/messages?to=${actorId}`, channelId: 'messages' })
  } catch { /* notification best-effort */ }
}

// Les adresses sont des données personnelles : effacées 30 jours après la livraison ou l'annulation.
export async function purgeOldAddresses() {
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
  await supabaseAdmin.from('shipments')
    .update({ recipient_name: null, address_line1: null, address_line2: null, postal_code: null, city: null, phone: null, relay_label: null })
    .in('status', ['delivered', 'cancelled'])
    .lt('updated_at', cutoff)
    .not('recipient_name', 'is', null)
}
