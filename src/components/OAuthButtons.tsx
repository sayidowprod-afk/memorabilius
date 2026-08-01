'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

type Provider = 'google' | 'twitter' | 'discord'

const PROVIDERS: { id: Provider; label: string; bg: string; color: string; border: string; logo: React.ReactNode }[] = [
  {
    id: 'google',
    label: 'Google',
    bg: '#fff',
    color: '#3c3c3c',
    border: '#dadce0',
    logo: (
      <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        <path fill="none" d="M0 0h48v48H0z"/>
      </svg>
    ),
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    bg: '#000',
    color: '#fff',
    border: '#000',
    logo: (
      <svg width="18" height="18" viewBox="0 0 1200 1227" xmlns="http://www.w3.org/2000/svg" fill="white">
        <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"/>
      </svg>
    ),
  },
  {
    id: 'discord',
    label: 'Discord',
    bg: '#5865F2',
    color: '#fff',
    border: '#5865F2',
    logo: (
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"/>
      </svg>
    ),
  },
]

interface OAuthButtonsProps {
  mode: 'connexion' | 'inscription'
}

export default function OAuthButtons({ mode }: OAuthButtonsProps) {
  const { dark } = useTheme()
  const [loading, setLoading] = useState<Provider | null>(null)

  async function signIn(provider: Provider) {
    setLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // La redirection se fait automatiquement — pas besoin de reset loading
  }

  const dividerColor = dark ? '#333' : '#e5e7eb'
  const dividerTxt   = dark ? '#666' : '#9ca3af'

  return (
    <div>
      {/* Séparateur */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
        <div style={{ flex: 1, height: 1, background: dividerColor }} />
        <span style={{ fontSize: 12, color: dividerTxt, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {mode === 'connexion' ? 'ou se connecter avec' : 'ou continuer avec'}
        </span>
        <div style={{ flex: 1, height: 1, background: dividerColor }} />
      </div>

      {/* Boutons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            onClick={() => signIn(p.id)}
            disabled={loading !== null}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: p.bg, color: p.color,
              border: `1.5px solid ${p.border}`,
              borderRadius: 10, padding: '11px 16px',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              opacity: loading && loading !== p.id ? 0.5 : 1,
              transition: 'opacity 0.2s, transform 0.15s',
              width: '100%',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            {loading === p.id
              ? <span style={{ width: 18, height: 18, border: `2px solid ${p.color}`, borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'oauthSpin 0.7s linear infinite' }} />
              : p.logo
            }
            {loading === p.id ? 'Redirection…' : `Continuer avec ${p.label}`}
          </button>
        ))}
      </div>
      <style>{`@keyframes oauthSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
