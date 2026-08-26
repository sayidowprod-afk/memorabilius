'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useIsNative } from '@/lib/useIsNative'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

const GALLERY_ROOT = /^\/galerie\/[^/]+$/

const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const ChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

function IconButton({ href, badge, children, alignRight, ariaLabel }: { href: string; badge: number; children: React.ReactNode; alignRight?: boolean; ariaLabel: string }) {
  return (
    <Link href={href} aria-label={ariaLabel} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: alignRight ? 'flex-end' : 'flex-start', width: 40, height: 28 }}>
      {children}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: -3, right: alignRight ? 0 : undefined, left: alignRight ? undefined : 20,
          background: '#e74c3c', color: 'white', borderRadius: '50%', minWidth: 15, height: 15, fontSize: 9, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid #003DA6',
        }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  )
}

export default function MobileTopBar() {
  const isNative = useIsNative()
  const { user } = useAuth()
  const { t } = useLang()
  const pathname = usePathname()
  const [notifCount, setNotifCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)

  const loadCounts = (uid: string) => {
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('lu', false)
      .then(({ count }) => setNotifCount(count || 0))
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user_id', uid).eq('lu', false)
      .then(({ count }) => setChatCount(count || 0))
  }

  useEffect(() => {
    if (!user || !isNative) { setNotifCount(0); setChatCount(0); return }
    loadCounts(user.id)
  }, [user?.id, isNative])

  // Re-vérifie à chaque changement de page (ex: retour de /messages après avoir
  // lu ses messages) — sans ça le badge de la barre du haut restait figé sur
  // le nombre au lancement de l'app jusqu'à un redémarrage complet, qu'on ait
  // lu les messages/notifs ou qu'il en arrive de nouveaux entre-temps.
  useEffect(() => {
    if (!user || !isNative) return
    loadCounts(user.id)
  }, [pathname, user?.id, isNative])

  useEffect(() => {
    if (!user || !isNative) return
    const channel = supabase.channel(`top-bar-badges-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `to_user_id=eq.${user.id}` }, () => loadCounts(user.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => loadCounts(user.id))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, isNative])

  if (!isNative) return null

  const scrollsAway = GALLERY_ROOT.test(pathname)

  return (
    <div
      style={{
        position: scrollsAway ? 'static' : 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        paddingTop: 'calc(var(--safe-area-inset-top, env(safe-area-inset-top)) + 10px)',
        paddingBottom: 10,
        paddingLeft: 12,
        paddingRight: 12,
        background: '#003DA6',
      }}
    >
      {user ? (
        <IconButton href="/notifications" badge={notifCount} ariaLabel={t('settings_notifications')}><BellIcon /></IconButton>
      ) : <div style={{ width: 40 }} />}

      <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
        <img
          src="/memorabilius-logo-white-sm.png"
          alt="Memorabilius"
          style={{ height: 20, width: 'auto', background: 'transparent' }}
        />
      </Link>

      {user ? (
        <IconButton href="/messages" badge={chatCount} alignRight ariaLabel={t('nav_messages')}><ChatIcon /></IconButton>
      ) : <div style={{ width: 40 }} />}
    </div>
  )
}
