'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          {notifs.map((n, i) => {
            const label = dateGroupLabel(n.created_at)
            const showHeader = i === 0 || dateGroupLabel(notifs[i - 1].created_at) !== label
            return (
              <div key={n.id}>
                {showHeader && (
                  <div style={{
                    position: 'sticky', top: 0, zIndex: 1,
                    padding: '8px 20px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4,
                    color: 'var(--text3, #999)', background: dark ? '#161616' : '#fafafa',
                    borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}`,
                  }}>{label}</div>
                )}
                <div
                  onClick={() => n.lien && router.push(n.lien)}
                  role={n.lien ? 'button' : undefined}
                  tabIndex={n.lien ? 0 : undefined}
                  onKeyDown={e => { if (n.lien && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); router.push(n.lien) } }}
                  aria-label={!n.lu ? `${t('notif_unread_label')} — ${n.message}` : n.message}
                  style={{
                  padding: '16px 20px', borderBottom: i < notifs.length - 1 ? `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` : 'none',
                  borderLeft: n.lu ? '4px solid transparent' : '4px solid #003DA6',
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: n.lu ? (dark ? '#1e1e1e' : 'white') : (dark ? '#0f1f42' : '#f0f4ff'),
                  cursor: n.lien ? 'pointer' : 'default',
                  transition: '0.2s',
                }}
                  onMouseEnter={e => { if (n.lien) e.currentTarget.style.background = dark ? '#1a2b57' : '#e8eeff' }}
                  onMouseLeave={e => e.currentTarget.style.background = n.lu ? (dark ? '#1e1e1e' : 'white') : (dark ? '#0f1f42' : '#f0f4ff')}
                >
                  <span aria-hidden="true" style={{ fontSize: 24, flexShrink: 0 }}>{getIcon(n.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: n.lu ? 400 : 700, color: dark ? '#f0f0f0' : '#121212' }}>{n.message}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text3, #999)' }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.lu && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#003DA6', flexShrink: 0 }} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
