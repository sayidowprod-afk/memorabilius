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
  const { lang, setLang } = useLang()
  const isNative = useIsNative()
  const [hapticsOn, setHapticsOnState] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => { setHapticsOnState(isHapticsEnabled()) }, [])
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserId(session?.user.id ?? null))
  }, [])

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
      <h1 style={{ fontWeight: 900, fontSize: 22, marginBottom: 20, color: dark ? '#fff' : '#111' }}>⚙️ Paramètres</h1>

      <div style={card}>
        <h3 style={{ fontWeight: 800, marginBottom: 4 }}>🎨 Apparence</h3>
        <div style={row}>
          <div>
            <div style={rowLabel}>Mode sombre</div>
            <div style={rowSub}>Adapte l'interface pour un environnement peu éclairé</div>
          </div>
          <Toggle on={dark} onClick={toggleTheme} />
        </div>
        <div style={{ ...row, alignItems: 'flex-start' }}>
          <div style={rowLabel}>Langue</div>
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
          <h3 style={{ fontWeight: 800, marginBottom: 4 }}>📳 Retour haptique</h3>
          <div style={row}>
            <div>
              <div style={rowLabel}>Vibrations</div>
              <div style={rowSub}>Petite vibration lors des appuis sur Communauté / Outils</div>
            </div>
            <Toggle on={hapticsOn} onClick={toggleHaptics} />
          </div>
        </div>
      )}

      <div style={card}>
        <h3 style={{ fontWeight: 800, marginBottom: 8 }}>🔔 Notifications</h3>
        {userId ? (
          <PushNotificationSettings dark={dark} />
        ) : (
          <p style={rowSub}>
            <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700, textDecoration: 'none' }}>Connectez-vous</Link> pour gérer vos notifications.
          </p>
        )}
      </div>
    </div>
  )
}
