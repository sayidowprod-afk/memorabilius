'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [notifs, setNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropCommunaute, setDropCommunaute] = useState(false)
  const [dropOutils, setDropOutils] = useState(false)
  const communauteRef = useRef<HTMLDivElement>(null)
  const outilsRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const { dark, toggle } = useTheme()
  const { lang, setLang, t } = useLang()

  const LangToggle = () => (
    <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{
      background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`,
      borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
      fontSize: 12, fontWeight: 700, color: dark ? '#ddd' : '#666',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  )

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent) {
        if (communauteRef.current?.contains(e.target as Node)) return
        if (outilsRef.current?.contains(e.target as Node)) return
      }
      setDropCommunaute(false)
      setDropOutils(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      if (data.user) { loadNotifs(data.user.id); updateLastSeen(data.user.id) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((e, session) => {
      // Filet de sécurité : un lien de réinitialisation de mot de passe établit une
      // session (comportement normal Supabase), mais si l'email atterrit sur une page
      // autre que /reset-password (redirect URL mal configurée côté dashboard, etc.),
      // l'utilisateur se retrouverait connecté sans jamais changer son mot de passe.
      if (e === 'PASSWORD_RECOVERY' && pathname !== '/reset-password') {
        router.replace('/reset-password')
        return
      }
      setUser(session?.user ?? null)
      if (session?.user) loadNotifs(session.user.id)
      else setNotifs(0)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) { loadNotifs(user.id); updateLastSeen(user.id) }
    setMenuOpen(false)
  }, [pathname])

  const updateLastSeen = async (uid: string) => {
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
  }

  const loadNotifs = async (uid: string) => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('lu', false)
    setNotifs(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const linkStyle = { color: dark ? '#ddd' : '#444', fontWeight: 600 as const, fontSize: 15, textDecoration: 'none' }
  const ls = { color: dark ? '#ddd' : '#444', fontWeight: 600 as const, fontSize: 15, padding: '12px 0', display: 'flex' as const, alignItems: 'center' as const, gap: 6, textDecoration: 'none', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, width: '100%' }

  const dropBg = dark ? '#1a1a1a' : 'white'
  const dropBorder = dark ? '#2a2a2a' : '#eee'

  const dropItemStyle: React.CSSProperties = {
    display: 'block', padding: '10px 16px', color: dark ? '#ddd' : '#333',
    fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap',
    borderRadius: 8, transition: '0.15s',
  }

  const Badge = ({ count }: { count: number }) => count > 0 ? (
    <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
      {count > 9 ? '9+' : count}
    </span>
  ) : null

  const DropTrigger = ({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) => (
    <button onClick={onToggle} onKeyDown={e => e.key === 'Enter' || e.key === ' ' ? onToggle() : undefined}
      aria-expanded={open} aria-haspopup="true"
      style={{ ...linkStyle, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', background: 'none', border: 'none', padding: 0, font: 'inherit' }}>
      {label}
      <svg width="10" height="6" viewBox="0 0 10 6" style={{ transition: '0.2s', transform: open ? 'rotate(180deg)' : 'none', opacity: 0.5 }}>
        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    </button>
  )

  return (
    <>
      <nav style={{ background: dark ? '#1a1a1a' : 'white', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/memorabilius-logo.png" alt="Memorabilius" width={150} height={30}
            style={{ height: 30, width: 'auto', mixBlendMode: dark ? 'screen' : 'multiply', filter: dark ? 'invert(1)' : 'none' }}
          />
        </Link>

        {/* Desktop */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="nav-desktop">

          {/* Dropdown Communauté */}
          <div ref={communauteRef} style={{ position: 'relative' }}>
            <div style={{ padding: '0 12px', height: 60, display: 'flex', alignItems: 'center' }}>
              <DropTrigger label="Communauté" open={dropCommunaute} onToggle={() => setDropCommunaute(v => !v)} />
            </div>
            {dropCommunaute && (
              <div style={{ position: 'absolute', top: 56, left: 0, background: dropBg, border: `1px solid ${dropBorder}`, borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 300 }}>
                <Link href="/annuaire" style={dropItemStyle} onClick={() => setDropCommunaute(false)}>👥 {t('nav_annuaire')}</Link>
                <Link href="/teams" style={dropItemStyle} onClick={() => setDropCommunaute(false)}>🏆 {t('nav_teams')}</Link>
                <Link href="/trades" style={dropItemStyle} onClick={() => setDropCommunaute(false)}>🔄 {t('nav_trades')}</Link>
                <Link href="/evenements" style={dropItemStyle} onClick={() => setDropCommunaute(false)}>📅 {lang === 'fr' ? 'Événements' : 'Events'}</Link>
              </div>
            )}
          </div>

          {/* Dropdown Outils */}
          <div ref={outilsRef} style={{ position: 'relative' }}>
            <div style={{ padding: '0 12px', height: 60, display: 'flex', alignItems: 'center' }}>
              <DropTrigger label="Outils" open={dropOutils} onToggle={() => setDropOutils(v => !v)} />
            </div>
            {dropOutils && (
              <div style={{ position: 'absolute', top: 56, left: 0, background: dropBg, border: `1px solid ${dropBorder}`, borderRadius: 12, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 160, zIndex: 300 }}>
                <Link href="/scanner" style={dropItemStyle} onClick={() => setDropOutils(false)}>📷 Scanner de prix</Link>
                <Link href="/setlist" style={dropItemStyle} onClick={() => setDropOutils(false)}>📋 Setlist</Link>
                <Link href="/pack-simulator" style={dropItemStyle} onClick={() => setDropOutils(false)}>🎴 Pack Simulator</Link>
                <Link href="/recherche" style={dropItemStyle} onClick={() => setDropOutils(false)}>{t('nav_recherche')}</Link>
              </div>
            )}
          </div>

          <div style={{ padding: '0 12px', height: 60, display: 'flex', alignItems: 'center' }}>
            <Link href="/tuto" style={linkStyle}>{t('nav_tuto')}</Link>
          </div>

          {/* Ma Galerie — dans les liens principaux */}
          {user && (
            <Link href={`/galerie/${user.id}`}
              style={{ background: '#003DA6', color: 'white', borderRadius: 20, padding: '8px 18px', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginLeft: 8, whiteSpace: 'nowrap' }}>
              {t('nav_galerie')}
            </Link>
          )}

          {/* Séparateur */}
          <div style={{ width: 1, height: 24, background: dark ? '#333' : '#e0e0e0', margin: '0 8px' }} />

          {user === undefined ? (
            <div style={{ visibility: 'hidden', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
              <span style={{ fontWeight: 600 }}>🔔</span>
              <span style={{ fontWeight: 600 }}>Profil</span>
              <button style={{ background: 'none', border: '1px solid #ddd', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>FR</button>
              <button style={{ background: 'none', border: '1px solid #ddd', borderRadius: 20, padding: '4px 12px', fontSize: 14 }}>🌙</button>
              <button style={{ background: 'none', border: '1px solid #ddd', borderRadius: 20, padding: '6px 14px', fontSize: 13 }}>Déco</button>
            </div>
          ) : user ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <div style={{ padding: '0 8px', height: 60, display: 'flex', alignItems: 'center' }}>
                <Link href="/notifications" aria-label="Notifications" style={{ ...linkStyle, display: 'flex', alignItems: 'center', gap: 4 }}>
                  🔔 <Badge count={notifs} />
                </Link>
              </div>
              <div style={{ padding: '0 8px', height: 60, display: 'flex', alignItems: 'center' }}>
                <Link href="/profil" style={linkStyle}>{t('nav_profil')}</Link>
              </div>
              <LangToggle />
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <button onClick={handleLogout} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: dark ? '#ddd' : '#555' }}>{t('nav_deconnexion')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link href="/connexion" style={linkStyle}>{t('nav_connexion')}</Link>
              <LangToggle />
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <Link href="/sinscrire" className="btn-main btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>{t('nav_inscription')}</Link>
            </div>
          )}
        </div>

        {/* Ma Galerie + Hamburger groupés (mobile uniquement) */}
        <div className="nav-hamburger" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user && (
            <Link href={`/galerie/${user.id}`}
              style={{ background: '#003DA6', color: 'white', borderRadius: 20, padding: '9px 18px', fontWeight: 700, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              {t('nav_galerie')}
            </Link>
          )}
          <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
            <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', opacity: menuOpen ? 0 : 1 }} />
            <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, background: dark ? '#1a1a1a' : 'white', zIndex: 199, padding: '16px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="nav-mobile-menu">
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#999', letterSpacing: 1, padding: '4px 0 4px' }}>Communauté</div>
          <Link href="/annuaire" style={ls} onClick={() => setMenuOpen(false)}>👥 {t('nav_annuaire')}</Link>
          <Link href="/teams" style={ls} onClick={() => setMenuOpen(false)}>🏆 {t('nav_teams')}</Link>
          <Link href="/trades" style={ls} onClick={() => setMenuOpen(false)}>🔄 {t('nav_trades')}</Link>
          <Link href="/evenements" style={ls} onClick={() => setMenuOpen(false)}>📅 {lang === 'fr' ? 'Événements' : 'Events'}</Link>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#999', letterSpacing: 1, padding: '16px 0 4px' }}>Outils</div>
          <Link href="/scanner" style={ls} onClick={() => setMenuOpen(false)}>📷 Scanner de prix</Link>
          <Link href="/setlist" style={ls} onClick={() => setMenuOpen(false)}>📋 Setlist</Link>
          <Link href="/pack-simulator" style={ls} onClick={() => setMenuOpen(false)}>🎴 Pack Simulator</Link>
          <Link href="/recherche" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_recherche')}</Link>
          <Link href="/tuto" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_tuto')}</Link>
          {user ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#999', letterSpacing: 1, padding: '16px 0 4px' }}>Mon compte</div>
              <Link href="/notifications" style={ls} onClick={() => setMenuOpen(false)}>🔔 Notifications <Badge count={notifs} /></Link>
              <Link href="/profil" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_profil')}</Link>
              <div style={{ padding: '12px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, display: 'flex', gap: 8 }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️' : '🌙'}</button>
                <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 700 }}>{lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <button onClick={handleLogout} style={{ width: '100%', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>{t('nav_deconnexion')}</button>
              </div>
            </>
          ) : (
            <>
              <Link href="/connexion" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_connexion')}</Link>
              <div style={{ padding: '12px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, display: 'flex', gap: 8 }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️' : '🌙'}</button>
                <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 700 }}>{lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <Link href="/sinscrire" style={{ display: 'block', background: '#003DA6', color: 'white', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>{t('nav_inscription')}</Link>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}