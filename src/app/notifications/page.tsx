'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import { useLang, localeFor } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import SkeletonBlock from '@/components/SkeletonBlock'
import EmptyState from '@/components/EmptyState'
import PushNotificationSettings from '@/components/PushNotificationSettings'

export default function Notifications() {
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // try/finally + withTimeout : voir withTimeout.ts -- evite que la page se
    // bloque sur son skeleton pour toujours en cas de rejet ou de requete qui
    // ne resout jamais.
    (async () => {
      try {
        await withTimeout((async () => {
          const { data: { session } } = await supabase.auth.getSession()
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
        })(), 8000, undefined)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      team_join: '👥', team_candidature: '📋', message: '💬', trade: '🔄', system: '🔔', wishlist_match: '🎯', comment: '💬', badge: '🏆', like: '❤️'
    }
    return icons[type] || '🔔'
  }

  const getColor = (type: string) => {
    const c: Record<string, string> = {
      team_join: '#7a3fbf', team_candidature: '#7a3fbf', message: '#2f6bff', trade: '#2f6bff', system: '#5b6b8c',
      wishlist_match: '#e67e22', comment: '#2f6bff', badge: '#e9b44c', like: '#e63a6e',
    }
    return c[type] || '#5b6b8c'
  }

  const dateGroupLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
    const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000)
    if (diffDays === 0) return 'Aujourd\'hui'
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return d.toLocaleDateString(localeFor(lang), { weekday: 'long' })
    return d.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' })
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
        <PushNotificationSettings dark={dark} />
      </div>

      {notifs.length === 0 ? (
        <EmptyState icon="🔔" title={t('notif_none')} />
      ) : (
        <div className="notif-list">
          {notifs.map((n, i) => {
            const label = dateGroupLabel(n.created_at)
            const showHeader = i === 0 || dateGroupLabel(notifs[i - 1].created_at) !== label
            return (
              <div key={n.id} style={{ display: 'contents' }}>
                {showHeader && <div className="notif-day">{label}<span /></div>}
                <div
                  onClick={() => n.lien && router.push(n.lien)}
                  role={n.lien ? 'button' : undefined}
                  tabIndex={n.lien ? 0 : undefined}
                  onKeyDown={e => { if (n.lien && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); router.push(n.lien) } }}
                  aria-label={!n.lu ? `${t('notif_unread_label')} — ${n.message}` : n.message}
                  className={`notif-banner${n.lu ? '' : ' unread'}${n.lien ? ' link' : ''}`}
                  style={{ ['--c' as string]: getColor(n.type) }}
                >
                  <div className="notif-ic" aria-hidden="true">{getIcon(n.type)}</div>
                  <div className="notif-tx">
                    <p className="m">{n.message}</p>
                    <p className="t">{timeAgo(n.created_at)}{!n.lu && <b>Nouveau</b>}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
