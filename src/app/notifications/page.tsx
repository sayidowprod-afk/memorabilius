'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { subscribePush } from '@/components/PWAInstall'
import SkeletonBlock from '@/components/SkeletonBlock'

export default function Notifications() {
  const router = useRouter()
  const { t } = useLang()
  const { dark } = useTheme()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pushPerm, setPushPerm] = useState<NotificationPermission | null>(null)
  const [pushLoading, setPushLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) setPushPerm(Notification.permission)
  }, [])

  const handleEnablePush = async () => {
    setPushLoading(true)
    try {
      // PWAInstall (qui enregistre normalement le SW) n'est monté que sur
      // l'accueil — on force l'enregistrement ici sinon subscribePush() reste
      // bloqué sur navigator.serviceWorker.ready si le SW n'existe pas encore
      await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      setPushPerm(perm)
      if (perm === 'granted') await subscribePush(true)
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)
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
        setPushPerm(Notification.permission)
      }
    } finally {
      setPushLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const data = { user: session.user }
      const { data: n } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifs(n || [])
      // Tout marquer comme lu
      await supabase.from('notifications').update({ lu: true }).eq('user_id', data.user.id).eq('lu', false)
      setLoading(false)
    })
  }, [])

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      team_join: '👥', team_candidature: '📋', message: '💬', trade: '🔄', system: '🔔', wishlist_match: '🎯', comment: '💬', badge: '🏆', like: '❤️'
    }
    return icons[type] || '🔔'
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'À l\'instant'
    if (mins < 60) return `Il y a ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Il y a ${hours}h`
    const days = Math.floor(hours / 24)
    return `Il y a ${days}j`
  }

  if (loading) return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SkeletonBlock style={{ height: 28, width: 180, marginBottom: 14 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0' }}>
          <SkeletonBlock style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock style={{ height: 12, width: `${50 + (i % 3) * 15}%` }} />
            <SkeletonBlock style={{ height: 10, width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('notif_title')}</h1>
        {'Notification' in window && pushPerm === 'denied' && (
          <span style={{ fontSize: 12, color: '#e74c3c', fontWeight: 700 }}>🔕 Notifications bloquées dans le navigateur</span>
        )}
        {'Notification' in window && pushPerm !== 'granted' && pushPerm !== 'denied' && pushPerm !== null && (
          <button onClick={handleEnablePush} disabled={pushLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#003DA6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {pushLoading ? '...' : '🔔 Activer les notifications push'}
          </button>
        )}
        {pushPerm === 'granted' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#2ecc71', fontWeight: 700 }}>🔔 Notifications activées</span>
            <button
              onClick={async () => {
                setTestLoading(true)
                setTestResult(null)
                try {
                  const { data: { session } } = await supabase.auth.getSession()
                  const res = await fetch('/api/push-test', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${session?.access_token}` },
                  })
                  const json = await res.json()
                  setTestResult(res.ok ? { ok: true } : { error: json.error || 'Erreur inconnue' })
                } catch (e: any) {
                  setTestResult({ error: e?.message || 'Erreur réseau' })
                } finally {
                  setTestLoading(false)
                }
              }}
              disabled={testLoading}
              style={{ padding: '6px 12px', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              {testLoading ? '...' : '🧪 Tester'}
            </button>
            <button onClick={handleDisablePush} disabled={pushLoading} style={{ padding: '6px 12px', background: 'var(--bg3, #f0f0f0)', color: 'var(--text2, #333)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {pushLoading ? '...' : 'Désactiver'}
            </button>
          </div>
        )}
        {testResult && (
          <div style={{
            fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
            background: testResult.ok ? '#e8f5e9' : '#fdecea',
            color: testResult.ok ? '#1b5e20' : '#b71c1c',
          }}>
            {testResult.ok ? '✓ Notification envoyée — vérifie ton téléphone !' : `✗ ${testResult.error}`}
          </div>
        )}
      </div>

      {notifs.length === 0 ? (
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 60, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
          <p style={{ color: 'var(--text3, #bbb)', fontSize: 16 }}>{t('notif_none')}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          {notifs.map((n, i) => (
            <div key={n.id} onClick={() => n.lien && router.push(n.lien)} style={{
              padding: '16px 20px', borderBottom: i < notifs.length - 1 ? `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` : 'none',
              display: 'flex', alignItems: 'center', gap: 16,
              background: n.lu ? (dark ? '#1e1e1e' : 'white') : (dark ? '#0f1f42' : '#f0f4ff'),
              cursor: n.lien ? 'pointer' : 'default',
              transition: '0.2s',
            }}
              onMouseEnter={e => { if (n.lien) e.currentTarget.style.background = dark ? '#1a2b57' : '#e8eeff' }}
              onMouseLeave={e => e.currentTarget.style.background = n.lu ? (dark ? '#1e1e1e' : 'white') : (dark ? '#0f1f42' : '#f0f4ff')}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{getIcon(n.type)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: n.lu ? 400 : 700, color: dark ? '#f0f0f0' : '#121212' }}>{n.message}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text3, #999)' }}>{timeAgo(n.created_at)}</p>
              </div>
              {!n.lu && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#003DA6', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
