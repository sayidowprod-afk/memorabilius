'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import { useIsNative } from '@/lib/useIsNative'
import { supabase } from '@/lib/supabase'
import { scheduleMonthlyWrapReminder, syncPendingTradesReminder, scheduleWishlistNudge } from '@/lib/localReminders'

export default function LocalRemindersInit() {
  const isNative = useIsNative()
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isNative || !user) return
    let removeListener: (() => void) | undefined
    let cancelled = false

    // Delai avant le tout premier appel LocalNotifications.schedule() apres
    // un cold start : appele trop tot, ce plugin declenche en interne un NPE
    // du coeur de Capacitor (getPermissionStates(), Activity pas encore geree
    // par le bridge) qui tue silencieusement le HandlerThread "CapacitorPlugins"
    // pour le reste de la session -- plus AUCUN plugin (biometrie, notifs,
    // telechargements...) ne peut plus repondre ensuite (confirme via adb logcat
    // sur le build Play Store, crash ~2.5s apres le demarrage de MainActivity).
    const timer = setTimeout(() => {
      if (cancelled) return
      scheduleMonthlyWrapReminder()
      scheduleWishlistNudge()

      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session?.access_token) return
        const res = await fetch('/api/trades', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (!res.ok) return
        const { trades } = await res.json()
        const hasPending = (trades || []).some((t: any) => t.status === 'pending' && t.receiver_id === user.id)
        syncPendingTradesReminder(hasPending)
      }).catch(() => {})
    }, 5000)

    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const url = action.notification.extra?.url
        if (url) router.push(url)
      }).then(listener => { if (!cancelled) removeListener = () => listener.remove(); else listener.remove() })
    }).catch(() => {})

    return () => { cancelled = true; clearTimeout(timer); removeListener?.() }
  }, [isNative, user?.id, router])

  return null
}
