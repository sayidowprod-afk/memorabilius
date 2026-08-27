'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { useIsNative } from '@/lib/useIsNative'
import { isHapticsEnabled, setHapticsEnabled } from '@/lib/haptics'
import PushNotificationSettings from '@/components/PushNotificationSettings'
import { supabase } from '@/lib/supabase'

const LANGS = [
  { code: 'fr' as const, flag: '🇫🇷', label: 'Français' },
  { code: 'en' as const, flag: '🇬🇧', label: 'English' },
  { code: 'de' as const, flag: '🇩🇪', label: 'Deutsch' },
  { code: 'es' as const, flag: '🇪🇸', label: 'Español' },
  { code: 'it' as const, flag: '🇮🇹', label: 'Italiano' },
]

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
        background: on ? '#003DA6' : '#ccc', position: 'relative', flexShrink: 0, transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%',
        background: 'white', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </button>
  )
}

export default function Parametres() {
  const { dark, toggle: toggleTheme } = useTheme()
  const { t, lang, setLang } = useLang()
  const isNative = useIsNative()
  const [hapticsOn, setHapticsOnState] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [notifPrefs, setNotifPrefs] = useState<{ notif_popularity_digest: boolean; notif_streak_warning: boolean; notif_winback: boolean } | null>(null)

  useEffect(() => { setHapticsOnState(isHapticsEnabled()) }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user.id ?? null
      setUserId(uid)
      if (uid) {
        supabase.from('profiles').select('notif_popularity_digest, notif_streak_warning, notif_winback').eq('id', uid).single()
          .then(({ data }) => { if (data) setNotifPrefs(data as any) })
      }
    })
  }, [])

  const toggleNotifPref = (key: 'notif_popularity_digest' | 'notif_streak_warning' | 'notif_winback') => {
    if (!notifPrefs || !userId) return
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    supabase.from('profiles').update({ [key]: next[key] }).eq('id', userId)
  }

  const toggleHaptics = () => {
    const next = !hapticsOn
    setHapticsOnState(next)
    setHapticsEnabled(next)
  }

  const card: React.CSSProperties = {
    background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 24,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20,
  }
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0',
  }
  const rowLabel: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: dark ? '#eee' : '#222' }
  const rowSub: React.CSSProperties = { fontSize: 12, color: dark ? '#999' : '#888', marginTop: 2 }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px 60px' }}>
      <h1 style={{ fontWeight: 900, fontSize: 22, marginBottom: 20, color: dark ? '#fff' : '#111' }}>⚙️ {t('settings_title')}</h1>

      <div style={card}>
        <h3 style={{ fontWeight: 800, marginBottom: 4 }}>🎨 {t('settings_appearance')}</h3>
        <div style={row}>
          <div>
            <div style={rowLabel}>{t('settings_dark_mode')}</div>
            <div style={rowSub}>{t('settings_dark_mode_desc')}</div>
          </div>
          <Toggle on={dark} onClick={toggleTheme} />
        </div>
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={rowLabel}>{t('settings_language')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)} title={l.label} style={{
                background: lang === l.code ? '#003DA6' : (dark ? '#2a2a2a' : '#f5f5f5'),
                color: lang === l.code ? 'white' : (dark ? '#ddd' : '#333'),
                border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 15, fontWeight: 700,
              }}>{l.flag}</button>
            ))}
          </div>
        </div>
      </div>

      {isNative && (
        <div style={card}>
          <h3 style={{ fontWeight: 800, marginBottom: 4 }}>📳 {t('settings_haptics')}</h3>
          <div style={row}>
            <div>
              <div style={rowLabel}>{t('settings_vibrations')}</div>
              <div style={rowSub}>{t('settings_vibrations_desc')}</div>
            </div>
            <Toggle on={hapticsOn} onClick={toggleHaptics} />
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>🔔 {t('settings_notifications')}</h3>
        {userId ? (
          <PushNotificationSettings dark={dark} />
        ) : (
          <p style={rowSub}>
            <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700, textDecoration: 'none' }}>{t('settings_login_cta')}</Link> {t('settings_login_to_manage')}
          </p>
        )}
      </div>

      {userId && notifPrefs && (
        <div style={card}>
          <h3 style={{ fontWeight: 800, marginBottom: 4 }}>🎛️ {t('settings_notif_types')}</h3>
          <div style={row}>
            <div>
              <div style={rowLabel}>{t('settings_notif_popularity')}</div>
              <div style={rowSub}>{t('settings_notif_popularity_desc')}</div>
            </div>
            <Toggle on={notifPrefs.notif_popularity_digest} onClick={() => toggleNotifPref('notif_popularity_digest')} />
          </div>
          <div style={row}>
            <div>
              <div style={rowLabel}>{t('settings_notif_streak')}</div>
              <div style={rowSub}>{t('settings_notif_streak_desc')}</div>
            </div>
            <Toggle on={notifPrefs.notif_streak_warning} onClick={() => toggleNotifPref('notif_streak_warning')} />
          </div>
          <div style={row}>
            <div>
              <div style={rowLabel}>{t('settings_notif_winback')}</div>
              <div style={rowSub}>{t('settings_notif_winback_desc')}</div>
            </div>
            <Toggle on={notifPrefs.notif_winback} onClick={() => toggleNotifPref('notif_winback')} />
          </div>
        </div>
      )}
    </div>
  )
}
