'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useIsNative } from '@/lib/useIsNative'
import { supabase } from '@/lib/supabase'

export default function PushInit() {
  const isNative = useIsNative()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isNative || !user) return
    let removeListeners: (() => void) | undefined
    let cancelled = false

    import('@capacitor/push-notifications').then(async ({ PushNotifications }) => {
      const perm = await PushNotifications.checkPermissions()
      if (perm.receive !== 'granted') {
        const req = await PushNotifications.requestPermissions()
        if (req.receive !== 'granted') return
      }
      if (cancelled) return

      await PushNotifications.register()

      const regListener = await PushNotifications.addListener('registration', async (token) => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        fetch('/api/fcm-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ token: token.value }),
        }).catch(() => {})
      })

      const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const url = action.notification.data?.url
        if (url) router.push(url)
      })

      const errorListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('[push] Erreur d\'enregistrement:', err)
      })

      removeListeners = () => {
        regListener.remove()
        actionListener.remove()
        errorListener.remove()
      }
    }).catch(() => {})

    return () => {
      cancelled = true
      removeListeners?.()
    }
  }, [isNative, user?.id, router])

  return null
}
