'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { useIsNative } from '@/lib/useIsNative'
import { hapticTap } from '@/lib/haptics'
import BottomSheet from '@/components/BottomSheet'
import { NAV_CONTENT_HEIGHT, NAV_SAFE_AREA_BOTTOM, NAV_TOTAL_HEIGHT_CSS } from '@/lib/nativeLayout'

const COMMUNAUTE_PATHS = ['/annuaire', '/teams', '/trades', '/evenements']
const OUTILS_PATHS = ['/scanner', '/setlist', '/recherche', '/profil']

const UsersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const ToolIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)

// Monogramme Memorabilius (façon dos de carte à collectionner) — watermark discret
const MonogramMark = () => (
  <svg width="15" height="20" viewBox="0 0 24 32" fill="none">
    <rect x="1" y="1" width="22" height="30" rx="1.5" stroke="white" strokeWidth="1.6" fill="none" />
    <path d="M6 24V8l6 8 6-8v16" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

export default function MobileBottomNav() {
  const isNative = useIsNative()
  const { user } = useAuth()
  const { dark } = useTheme()
  const { t } = useLang()
  const router = useRouter()
  const pathname = usePathname()

  const [sheet, setSheet] = useState<'communaute' | 'outils' | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const sheetRef = useRef(sheet)
  useEffect(() => { sheetRef.current = sheet }, [sheet])

  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  useEffect(() => { setSheet(null) }, [pathname])

  useEffect(() => {
    if (!isNative) return
    let remove: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (sheetRef.current) { setSheet(null); return }
        if (pathnameRef.current === '/') { App.exitApp(); return }
        router.back()
      }).then(listener => { remove = () => listener.remove() })
    })
    return () => { remove?.() }
  }, [isNative])

  useEffect(() => {
    if (!user) { setIsAdmin(false); return }
    supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      .then(({ data: p }) => setIsAdmin(p?.is_admin ?? false))
  }, [user?.id])

  useEffect(() => {
    document.body.classList.toggle('native-bottom-nav', isNative)
    return () => { document.body.classList.remove('native-bottom-nav') }
  }, [isNative])

  if (!isNative) return null

  const toggle = (name: 'communaute' | 'outils') => {
    hapticTap()
    setSheet(cur => cur === name ? null : name)
  }

  const communauteActive = COMMUNAUTE_PATHS.some(p => pathname.startsWith(p))
  const outilsActive = OUTILS_PATHS.some(p => pathname.startsWith(p))

  const dropItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '13px 12px',
    color: dark ? '#eee' : '#222', fontWeight: 600, fontSize: 15, textDecoration: 'none',
    borderRadius: 10,
  }

  const tabColor = (active: boolean) => active ? '#003DA6' : (dark ? '#888' : '#888')

  const handleLogout = async () => {
    setSheet(null)
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 250, minHeight: NAV_CONTENT_HEIGHT,
          background: dark ? '#1a1a1a' : 'white',
          borderTop: '2px solid #003DA6',
          paddingBottom: NAV_SAFE_AREA_BOTTOM,
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}
      >
        <button
          onClick={() => toggle('communaute')}
          style={{
            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            padding: '4px 4px', color: tabColor(communauteActive || sheet === 'communaute'),
          }}
        >
          <UsersIcon />
          <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{t('nav_communaute')}</span>
        </button>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Link
            href={user ? `/galerie/${user.id}` : '/connexion'}
            onClick={() => hapticTap()}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              textDecoration: 'none', marginTop: -20,
            }}
          >
            <div style={{ position: 'relative', width: 70, height: 62 }}>
              <div style={{
                position: 'absolute', top: 2, left: 8, width: 38, height: 52, borderRadius: 9,
                background: 'linear-gradient(160deg,#6d97ee,#2352c9)',
                transform: 'rotate(-15deg)',
                boxShadow: '0 3px 8px rgba(0,0,0,.28)',
                border: `2px solid ${dark ? '#1a1a1a' : 'white'}`,
              }} />
              <div style={{
                position: 'absolute', top: 2, left: 24, width: 38, height: 52, borderRadius: 9,
                background: 'linear-gradient(160deg,#1e63e0,#00307e)',
                transform: 'rotate(12deg)',
                boxShadow: '0 6px 16px rgba(0,61,166,.5)',
                border: `2px solid ${dark ? '#1a1a1a' : 'white'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ opacity: 0.5 }}><MonogramMark /></span>
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#003DA6' }}>{t('nav_galerie')}</span>
          </Link>
        </div>

        <button
          onClick={() => toggle('outils')}
          style={{
            position: 'relative', flex: 1, background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
            padding: '4px 4px', color: tabColor(outilsActive || sheet === 'outils'),
          }}
        >
          <ToolIcon />
          <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{t('nav_outils')}</span>
        </button>
      </div>

      <BottomSheet open={sheet === 'communaute'} onClose={() => setSheet(null)} title={t('nav_communaute')} bottomOffset={NAV_TOTAL_HEIGHT_CSS}>
        <Link href="/annuaire" style={dropItemStyle} onClick={() => setSheet(null)}>👥 {t('nav_annuaire')}</Link>
        <Link href="/teams" style={dropItemStyle} onClick={() => setSheet(null)}>🏆 {t('nav_teams')}</Link>
        <Link href="/trades" style={dropItemStyle} onClick={() => setSheet(null)}>🔄 {t('nav_trades')}</Link>
        <Link href="/evenements" style={dropItemStyle} onClick={() => setSheet(null)}>📅 {t('nav_evenements')}</Link>
      </BottomSheet>

      <BottomSheet open={sheet === 'outils'} onClose={() => setSheet(null)} title={t('nav_outils')} bottomOffset={NAV_TOTAL_HEIGHT_CSS}>
        <Link href="/scanner" style={dropItemStyle} onClick={() => setSheet(null)}>📷 {t('nav_scanner')}</Link>
        <Link href="/setlist" style={dropItemStyle} onClick={() => setSheet(null)}>📋 {t('nav_setlist')}</Link>
        <Link href="/recherche" style={dropItemStyle} onClick={() => setSheet(null)}>{t('nav_recherche')}</Link>
        {isAdmin && (
          <Link href="/admin/stats" style={{ ...dropItemStyle, color: '#003DA6' }} onClick={() => setSheet(null)}>📊 {t('nav_admin_stats')}</Link>
        )}

        {user && (
          <>
            <div style={{ margin: '6px 12px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }} />
            <Link href="/profil" style={dropItemStyle} onClick={() => setSheet(null)}>👤 {t('nav_profil')}</Link>
          </>
        )}

        <Link href="/parametres" style={dropItemStyle} onClick={() => setSheet(null)}>⚙️ Paramètres</Link>

        {!user && (
          <>
            <div style={{ margin: '6px 12px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }} />
            <Link href="/connexion" style={dropItemStyle} onClick={() => setSheet(null)}>🔑 {t('nav_connexion')}</Link>
            <Link href="/sinscrire" style={dropItemStyle} onClick={() => setSheet(null)}>✨ {t('nav_inscription')}</Link>
          </>
        )}

        <div style={{ margin: '6px 12px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }} />

        {user && (
          <button onClick={handleLogout} style={{ ...dropItemStyle, width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', color: '#c0392b' }}>
            🚪 {t('nav_deconnexion')}
          </button>
        )}
      </BottomSheet>
    </>
  )
}
