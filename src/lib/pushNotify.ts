import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

let fcmApp: import('firebase-admin/app').App | null | undefined

// undefined = pas encore tenté, null = tenté et échoué (clé absente/invalide) — évite de retenter à chaque appel.
async function getFcmApp() {
  if (fcmApp !== undefined) return fcmApp
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!key) { fcmApp = null; return null }
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const existing = getApps()[0]
    fcmApp = existing || initializeApp({ credential: cert(JSON.parse(key)) })
  } catch (err) {
    console.error('[fcm] Clé de compte de service invalide:', err)
    fcmApp = null
  }
  return fcmApp
}

async function sendFcmToUser(userId: string, payload: PushPayload) {
  const app = await getFcmApp()
  if (!app) return

  const { data: tokens } = await supabaseAdmin
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', userId)

  if (!tokens?.length) return

  const { getMessaging } = await import('firebase-admin/messaging')
  const messaging = getMessaging(app)

  const results = await Promise.allSettled(
    tokens.map(t => messaging.send({
      token: t.token,
      notification: { title: payload.title, body: payload.body },
      data: payload.url ? { url: payload.url } : undefined,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: payload.channelId || 'community',
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
      },
    }))
  )

  const invalid = tokens
    .filter((_, i) => {
      const r = results[i]
      // firebase-admin met le code directement sur `err.code` (ex:
      // "messaging/registration-token-not-registered"), pas sous
      // `err.errorInfo.code` — cette propriété n'existe pas sur les erreurs
      // realistes, donc ce filtre ne matchait jamais rien : les tokens morts
      // n'étaient jamais purgés, et chaque envoi futur retentait contre eux
      // indéfiniment pour rien.
      return r.status === 'rejected' && /registration-token-not-registered|invalid-argument/.test(String((r.reason as any)?.code || r.reason))
    })
    .map(t => t.token)

  if (invalid.length) {
    await supabaseAdmin.from('fcm_tokens').delete().eq('user_id', userId).in('token', invalid)
  }
}

// channelId doit correspondre à un des canaux créés côté natif (MainActivity.java) :
// 'messages' | 'trades' | 'wishlist' | 'community'. imageUrl est affichée en grand
// (BigPictureStyle) par FCM sur Android sans code natif supplémentaire.
export interface PushPayload {
  title: string
  body: string
  url?: string
  channelId?: 'messages' | 'trades' | 'wishlist' | 'community'
  imageUrl?: string
}

const CHANNEL_PREF_COLUMN: Record<NonNullable<PushPayload['channelId']>, string> = {
  messages: 'notif_pref_messages',
  trades: 'notif_pref_trades',
  wishlist: 'notif_pref_wishlist',
  community: 'notif_pref_community',
}

// Point unique : tout appelant de sendPushToUser passe par ici, donc verifier
// la preference du destinataire ici couvre tous les canaux sans avoir a
// modifier chacun des appelants (messages, trades, wishlist, communaute...).
// Pas de payload.channelId -> on envoie quand meme (canal non classifie).
async function isChannelAllowed(userId: string, channelId?: PushPayload['channelId']): Promise<boolean> {
  if (!channelId) return true
  const column = CHANNEL_PREF_COLUMN[channelId]
  const { data } = await supabaseAdmin.from('profiles').select(column).eq('id', userId).single()
  return (data as any)?.[column] !== false
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!(await isChannelAllowed(userId, payload.channelId))) return
  await sendFcmToUser(userId, payload)

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return

  // Dynamic import avoids Turbopack trying to bundle this Node-only package at build time
  const webpush = (await import('web-push')).default

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[push] Clés VAPID manquantes — vérifiez NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les variables d\'env Vercel')
    return
  }

  // web-push valide /^[A-Za-z0-9\-\_]*$/ — convertit base64 → base64url et retire tout = et espace
  const toBase64url = (s: string) => s.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  const pubKey = toBase64url(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  const privKey = toBase64url(process.env.VAPID_PRIVATE_KEY)
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || 'contact@memorabilius.fr'}`,
    pubKey,
    privKey
  )

  const payloadStr = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
          { TTL: 86400, urgency: 'high' }
        )
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 401) {
          // Subscription invalide ou clés VAPID incompatibles → purge
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('[push] Erreur sendNotification:', err.statusCode, err.message)
        }
      }
    })
  )
}
