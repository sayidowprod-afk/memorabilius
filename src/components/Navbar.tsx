'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [unread, setUnread] = useState(0)
  const [notifTrade, setNotifTrade] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { dark, toggle } = useTheme()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) { loadUnread(data.user.id); loadTradeNotif(data.user.id) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadUnread(session.user.id); loadTradeNotif(session.user.id) }
      else { setUnread(0); setNotifTrade(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) { loadUnread(user.id); loadTradeNotif(user.id) }
  }, [pathname])

  const loadUnread = async (uid: string) => {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', uid)
      .eq('lu', false)
    setUnread(count || 0)
  }

  const loadTradeNotif = async (uid: string) => {
    // Vérifie si des messages non lus concernent un trade
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', uid)
      .eq('lu', false)
      .not('trade_id', 'is', null)
    setNotifTrade((count || 0) > 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const navStyle = { color: dark ? '#ccc' : '#444' }

  return (
    <nav style={{
      background: dark ? '#1a1a1a' : 'white',
      borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}`,
      padding: '0 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 60,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: '#003DA6', letterSpacing: '-0.5px' }}>
        Memorabilius
      </Link>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
        <Link href="/annuaire" style={navStyle}>Annuaire</Link>
        <Link href="/teams" style={navStyle}>Teams</Link>
        {/* Trades avec notif */}
        <Link href="/trades" style={{ ...navStyle, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Trades
          {notifTrade && <span style={{ background: '#e74c3c', width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />}
        </Link>
        <Link href="/tuto" style={navStyle}>Tutoriel</Link>
        {user ? (
          <>
            <Link href={`/galerie/${user.id}`} style={navStyle}>Ma galerie</Link>
            {/* Messages avec badge */}
            <Link href="/messages" style={{ ...navStyle, position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Messages
              {unread > 0 && (
                <span style={{
                  background: '#e74c3c', color: 'white', borderRadius: '50%',
                  minWidth: 18, height: 18, fontSize: 10, fontWeight: 900,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/profil" style={navStyle}>Profil</Link>
            {/* Toggle mode sombre */}
            <button onClick={toggle} style={{
              background: 'none', border: `1px solid ${dark ? '#444' : '#ddd'}`,
              borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
              fontSize: 16, color: dark ? '#ccc' : '#666',
            }} title={dark ? 'Mode clair' : 'Mode sombre'}>
              {dark ? '☀️' : '🌙'}
            </button>
            <button onClick={handleLogout} className="btn-main btn-secondary" style={{ padding: '8px 20px', fontSize: 13 }}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link href="/connexion" style={navStyle}>Connexion</Link>
            <button onClick={toggle} style={{
              background: 'none', border: `1px solid ${dark ? '#444' : '#ddd'}`,
              borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
              fontSize: 16, color: dark ? '#ccc' : '#666',
            }}>
              {dark ? '☀️' : '🌙'}
            </button>
            <Link href="/sinscrire" className="btn-main btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
              S'inscrire
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
