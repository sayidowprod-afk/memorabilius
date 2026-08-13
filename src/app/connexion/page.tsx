'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { useIsNative } from '@/lib/useIsNative'
import OAuthButtons from '@/components/OAuthButtons'
import {
  isBiometricAvailable, hasSavedBiometricCredentials, wasBiometricPromptDismissed,
  dismissBiometricPrompt, saveBiometricCredentials, loginWithBiometric,
} from '@/lib/biometric'

export default function Connexion() {
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const isNative = useIsNative()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioSaved, setBioSaved] = useState(false)
  const [askBiometric, setAskBiometric] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    if (!isNative) return
    isBiometricAvailable().then(setBioAvailable)
    setBioSaved(hasSavedBiometricCredentials())
  }, [isNative])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error) { setError(lang === 'fr' ? 'Email ou mot de passe incorrect' : 'Incorrect email or password'); setLoading(false); return }

    if (isNative && bioAvailable && !bioSaved && !wasBiometricPromptDismissed()) {
      setAskBiometric(true)
      setLoading(false)
      return
    }
    router.push('/profil')
  }

  const acceptBiometric = async () => {
    await saveBiometricCredentials(form.email, form.password)
    router.push('/profil')
  }

  const declineBiometric = () => {
    dismissBiometricPrompt()
    router.push('/profil')
  }

  const handleBiometricLogin = async () => {
    setBioLoading(true)
    setError('')
    try {
      const creds = await loginWithBiometric()
      if (!creds) throw new Error('no creds')
      const { error } = await supabase.auth.signInWithPassword({ email: creds.username, password: creds.password })
      if (error) throw error
      router.push('/profil')
    } catch {
      setError(lang === 'fr' ? 'Authentification biométrique échouée' : 'Biometric authentication failed')
      setBioLoading(false)
    }
  }

  if (askBiometric) {
    return (
      <div style={{ maxWidth: 460, margin: '60px auto' }}>
        <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
          <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{lang === 'fr' ? 'Connexion plus rapide ?' : 'Faster sign-in?'}</h1>
          <p style={{ color: dark ? '#aaa' : '#666', marginBottom: 24, fontSize: 14 }}>
            {lang === 'fr' ? 'Active la connexion biométrique pour te reconnecter sans mot de passe la prochaine fois.' : 'Enable biometric sign-in to log back in without a password next time.'}
          </p>
          <button onClick={acceptBiometric} className="btn-main btn-primary" style={{ width: '100%', marginBottom: 10 }}>
            {lang === 'fr' ? 'Activer' : 'Enable'}
          </button>
          <button onClick={declineBiometric} style={{ width: '100%', background: 'none', border: 'none', color: dark ? '#aaa' : '#666', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 10 }}>
            {lang === 'fr' ? 'Non merci' : 'No thanks'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto' }}>
      <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>{t('login_title')}</h1>
        <p style={{ color: dark ? '#aaa' : '#666', marginBottom: 30, fontSize: 14 }}>{lang === 'fr' ? 'Content de vous revoir !' : 'Welcome back!'}</p>
        {isNative && bioAvailable && bioSaved && (
          <button onClick={handleBiometricLogin} disabled={bioLoading} aria-busy={bioLoading} className="btn-main btn-primary"
            style={{ width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            🔓 {bioLoading ? (lang === 'fr' ? 'Vérification…' : 'Verifying…') : (lang === 'fr' ? 'Connexion biométrique' : 'Biometric sign-in')}
          </button>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_email')}</label>
            <input type="email" required placeholder="votre@email.com" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={lang === 'fr' ? 'Votre mot de passe' : 'Your password'} autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading} aria-busy={loading}>
            {loading ? (lang === 'fr' ? 'Connexion…' : 'Signing in…') : t('login_btn')}
          </button>
        </form>
        <OAuthButtons mode="connexion" />
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          {t('login_no_account')} <Link href="/sinscrire" style={{ color: '#003DA6', fontWeight: 700 }}>{t('nav_inscription')}</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, fontSize: 13 }}>
          <Link href="/mot-de-passe-oublie" style={{ color: '#999' }}>{t('login_forgot')}</Link>
        </p>
      </div>
    </div>
  )
}
