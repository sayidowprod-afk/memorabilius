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

    import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const url = action.notification.extra?.url
        if (url) router.push(url)
      }).then(listener => { if (!cancelled) removeListener = () => listener.remove(); else listener.remove() })
    }).catch(() => {})

    return () => { cancelled = true; removeListener?.() }
  }, [isNative, user?.id, router])

  return null
}
