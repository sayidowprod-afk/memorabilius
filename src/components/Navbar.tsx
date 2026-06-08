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
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { dark, toggle } = useTheme()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) loadUnread(data.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUnread(session.user.id)
      else setUnread(0)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) loadUnread(user.id)
    setMenuOpen(false)
  }, [pathname])

  const loadUnread = async (uid: string) => {
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user_id', uid).eq('lu', false)
    setUnread(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const ls = { color: dark ? '#ddd' : '#444', fontWeight: 600 as const, fontSize: 15, padding: '12px 0', display: 'flex' as const, alignItems: 'center' as const, gap: 6, textDecoration: 'none', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, width: '100%' }

  return (
    <>
      <nav style={{ background: dark ? '#1a1a1a' : 'white', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 }}>
        <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: '#003DA6', letterSpacing: '-0.5px' }}>Memorabilius</Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} className="nav-desktop">
          <Link href="/annuaire" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Annuaire</Link>
          <Link href="/teams" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Teams</Link>
          <Link href="/trades" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Trades</Link>
          <Link href="/tuto" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Tutoriel</Link>
          {user ? (
            <>
              <Link href={`/galerie/${user.id}`} style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Ma galerie</Link>
              <Link href="/messages" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                Messages {unread > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{unread > 9 ? '9+' : unread}</span>}
              </Link>
              <Link href="/profil" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Profil</Link>
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <button onClick={handleLogout} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Déconnexion</button>
            </>
          ) : (
            <>
              <Link href="/connexion" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Connexion</Link>
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <Link href="/sinscrire" className="btn-main btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>S'inscrire</Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', opacity: menuOpen ? 0 : 1 }} />
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
        </button>
      </nav>

      {/* Menu mobile */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, background: dark ? '#1a1a1a' : 'white', zIndex: 199, padding: '16px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="nav-mobile-menu">
          <Link href="/annuaire" style={ls} onClick={() => setMenuOpen(false)}>Annuaire</Link>
          <Link href="/teams" style={ls} onClick={() => setMenuOpen(false)}>Teams</Link>
          <Link href="/trades" style={ls} onClick={() => setMenuOpen(false)}>Trades</Link>
          <Link href="/tuto" style={ls} onClick={() => setMenuOpen(false)}>Tutoriel</Link>
          {user ? (
            <>
              <Link href={`/galerie/${user.id}`} style={ls} onClick={() => setMenuOpen(false)}>Ma galerie</Link>
              <Link href="/messages" style={ls} onClick={() => setMenuOpen(false)}>
                Messages {unread > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 900 }}>{unread}</span>}
              </Link>
              <Link href="/profil" style={ls} onClick={() => setMenuOpen(false)}>Profil</Link>
              <div style={{ padding: '12px 0', display: 'flex', gap: 12, borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️ Mode clair' : '🌙 Mode sombre'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <button onClick={handleLogout} style={{ width: '100%', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>Déconnexion</button>
              </div>
            </>
          ) : (
            <>
              <Link href="/connexion" style={ls} onClick={() => setMenuOpen(false)}>Connexion</Link>
              <div style={{ padding: '12px 0', display: 'flex', gap: 12, borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}` }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️ Mode clair' : '🌙 Mode sombre'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <Link href="/sinscrire" style={{ display: 'block', background: '#003DA6', color: 'white', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>S'inscrire</Link>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        .nav-hamburger { display: none !important; }
        .nav-mobile-menu { display: none !important; }
        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .nav-mobile-menu { display: flex !important; }
        }
      `}</style>
    </>
  )
}
