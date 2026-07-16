import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
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
