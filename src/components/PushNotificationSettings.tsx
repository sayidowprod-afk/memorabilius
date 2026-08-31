'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useIsNative } from '@/lib/useIsNative'
import { subscribePush } from '@/components/PWAInstall'
import { useLang } from '@/lib/LangContext'
import { checkNotificationPermission, requestNotificationPermission } from '@/lib/notificationPermission'

export default function PushNotificationSettings({ dark }: { dark: boolean }) {
  const isNative = useIsNative()
  const { t } = useLang()
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState('')
  const [nativePushPermission, setNativePushPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
      setPushSupported(true)
      setPushPermission(Notification.permission)
      // La permission navigateur ne peut pas être révoquée par JS et reste
      // 'granted' pour toujours : l'état réel à afficher est l'abonnement push.
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.register('/sw.js')
          .then(() => navigator.serviceWorker.ready)
          .then(sw => sw.pushManager.getSubscription())
          .then(sub => setPushSubscribed(!!sub))
          .catch(() => setPushSubscribed(false))
      }
    }
  }, [])

  // Sur l'app native, le push passe par FCM (PushInit.tsx) et non par l'API
  // web Notification/ServiceWorker — on affiche donc l'état de permission natif.
  useEffect(() => {
    if (!isNative) return
    checkNotificationPermission().then(setNativePushPermission).catch(() => {})
  }, [isNative])

  const handleRequestNativePush = async () => {
    setPushLoading(true)
    try {
      const state = await requestNotificationPermission()
      setNativePushPermission(state)
      if (state === 'granted') {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        await PushNotifications.register()
      }
    } finally {
      setPushLoading(false)
    }
  }

  const handleEnablePush = async () => {
    setPushLoading(true)
    setPushError('')
    try {
      // Le SW n'est pas forcément déjà enregistré sur la page courante — on
      // s'en assure ici, sinon navigator.serviceWorker.ready ne résout jamais.
      await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      setPushPermission(perm)
      if (perm === 'granted') {
        const ok = await subscribePush(true)
        setPushSubscribed(ok)
        if (!ok) setPushError(t('push_ios_error'))
      }
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)
    setPushError('')
    try {
      await navigator.serviceWorker.register('/sw.js')
      const sw = await navigator.serviceWorker.ready
      const sub = await sw.pushManager.getSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushSubscribed(false)
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <>
      {isNative ? (
        nativePushPermission === 'granted' ? (
          <p style={{ fontSize: 13, color: '#2ecc71', fontWeight: 700 }}>{t('push_enabled')}</p>
        ) : nativePushPermission === 'denied' ? (
          <p style={{ fontSize: 13, color: '#e74c3c' }}>
            {t('push_blocked_native')}
          </p>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: dark ? '#999' : '#666', marginBottom: 12 }}>
              {t('push_pitch')}
            </p>
            <button onClick={handleRequestNativePush} disabled={pushLoading} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {pushLoading ? '...' : t('push_enable')}
            </button>
          </div>
        )
      ) : !pushSupported ? (
        <p style={{ fontSize: 13, color: '#999' }}>
          {t('push_unsupported')}
        </p>
      ) : pushPermission === 'denied' ? (
        <p style={{ fontSize: 13, color: '#e74c3c' }}>
          {t('push_blocked_browser')}
        </p>
      ) : pushPermission === 'granted' && pushSubscribed ? (
        <div>
          <p style={{ fontSize: 13, color: '#2ecc71', fontWeight: 700, marginBottom: 12 }}>{t('push_enabled')}</p>
          <button onClick={handleDisablePush} disabled={pushLoading} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {pushLoading ? '...' : t('push_disable')}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: dark ? '#999' : '#666', marginBottom: 12 }}>
            {t('push_pitch')}
          </p>
          {pushError && <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>{pushError}</p>}
          <button onClick={handleEnablePush} disabled={pushLoading} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {pushLoading ? '...' : t('push_enable')}
          </button>
        </div>
      )}
    </>
  )
}
