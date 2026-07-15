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

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_MAILTO || 'contact@memorabilius.fr'}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[push] Clés VAPID manquantes — vérifiez NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les variables d\'env Vercel')
    return
  }

  const payloadStr = JSON.stringify(payload)

  await Promise.allSettled(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        )
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        } else {
          console.error('[push] Erreur sendNotification:', err.statusCode, err.message)
        }
      }
    })
  )
}
