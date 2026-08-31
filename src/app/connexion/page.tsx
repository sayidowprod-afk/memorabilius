'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
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
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)

  useEffect(() => {
    if (!isNative) return
    isBiometricAvailable().then(setBioAvailable)
    setBioSaved(hasSavedBiometricCredentials())
  }, [isNative])

  // Journalise la connexion reussie (best-effort, ne bloque jamais la
  // navigation si ca echoue) puis termine le flux de connexion.
  const finishLogin = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/auth/login-history', {
      method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` },
    }).catch(() => {})

    if (isNative && bioAvailable && !bioSaved && !wasBiometricPromptDismissed()) {
      setAskBiometric(true)
      setLoading(false)
      setBioLoading(false)
      return
    }
    router.push('/profil')
  }

  // Apres un mot de passe correct, verifie si le compte a la 2FA active
  // (aal2 requis) -- si oui, affiche l'ecran de saisie du code TOTP au lieu
  // de terminer directement la connexion.
  const checkMfaThenFinish = async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const factor = factors?.totp?.[0]
      if (factor) {
        setMfaFactorId(factor.id)
        setLoading(false)
        setBioLoading(false)
        return
      }
    }
    await finishLogin()
  }

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId) return
    setMfaVerifying(true)
    setError('')
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (challengeErr || !challenge) {
      setError(t('login_err_credentials'))
      setMfaVerifying(false)
      return
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode })
    if (verifyErr) {
      setError(t('login_2fa_wrong_code'))
      setMfaVerifying(false)
      return
    }
    // mfaFactorId doit etre efface avant finishLogin() : le rendu verifie
    // mfaFactorId AVANT askBiometric, donc sans ca l'ecran "Verification..."
    // reste affiche pour toujours meme apres une connexion reussie (biometrie
    // proposee en arriere-plan, mais jamais visible).
    setMfaFactorId(null)
    await finishLogin()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Verrouillage anti-bruteforce : verifie AVANT d'appeler Supabase pour ne
    // pas gaspiller une tentative reseau si le compte est deja bloque.
    try {
      const lockRes = await fetch(`/api/auth/login-attempt?email=${encodeURIComponent(form.email)}`)
      const lock = await lockRes.json()
      if (lock.locked) {
        setError(t('login_err_locked').replace('{min}', String(Math.ceil(lock.retryAfterSeconds / 60))))
        setLoading(false)
        return
      }
    } catch { /* verif indisponible -> on laisse passer, ne bloque jamais la connexion */ }

    let { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    if (error && isAuthRetryableFetchError(error)) {
      // Échec réseau (pas identifiants) — fréquent au tout premier lancement de
      // l'app si le réseau Android n'est pas encore prêt. Un seul retry après un
      // court délai résout la grande majorité des cas sans action de l'utilisateur.
      await new Promise(r => setTimeout(r, 1500))
      ;({ error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password }))
    }
    if (error) {
      if (!isAuthRetryableFetchError(error)) {
        fetch('/api/auth/login-attempt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email }),
        }).catch(() => {})
      }
      setError(isAuthRetryableFetchError(error) ? t('login_err_network') : t('login_err_credentials'))
      setLoading(false)
      return
    }

    await checkMfaThenFinish()
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
      let { error } = await supabase.auth.signInWithPassword({ email: creds.username, password: creds.password })
      if (error && isAuthRetryableFetchError(error)) {
        await new Promise(r => setTimeout(r, 1500))
        ;({ error } = await supabase.auth.signInWithPassword({ email: creds.username, password: creds.password }))
      }
      if (error) {
        setError(isAuthRetryableFetchError(error) ? t('login_err_network') : t('login_err_biometric'))
        setBioLoading(false)
        return
      }
      await checkMfaThenFinish()
    } catch {
      setError(t('login_err_biometric'))
      setBioLoading(false)
    }
  }

  if (mfaFactorId) {
    return (
      <div style={{ maxWidth: 460, margin: '60px auto' }}>
        <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 12, textAlign: 'center' }}>🔐</div>
          <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8, textAlign: 'center' }}>{t('login_2fa_title')}</h1>
          <p style={{ color: dark ? '#aaa' : '#666', marginBottom: 24, fontSize: 14, textAlign: 'center' }}>{t('login_2fa_desc')}</p>
          <form onSubmit={handleMfaVerify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 6, fontWeight: 700 }} autoFocus
            />
            {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
            <button type="submit" className="btn-main btn-primary" disabled={mfaVerifying || mfaCode.length !== 6} aria-busy={mfaVerifying}>
              {mfaVerifying ? t('login_verifying') : t('login_2fa_verify')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (askBiometric) {
    return (
      <div style={{ maxWidth: 460, margin: '60px auto' }}>
        <div style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔓</div>
          <h1 style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>{t('login_faster_title')}</h1>
          <p style={{ color: dark ? '#aaa' : '#666', marginBottom: 24, fontSize: 14 }}>
            {t('login_faster_desc')}
          </p>
          <button onClick={acceptBiometric} className="btn-main btn-primary" style={{ width: '100%', marginBottom: 10 }}>
            {t('login_enable')}
          </button>
          <button onClick={declineBiometric} style={{ width: '100%', background: 'none', border: 'none', color: dark ? '#aaa' : '#666', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 10 }}>
            {t('addcard_no_thanks')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 460, margin: '60px auto' }}>
      <div className="auth-card-bg" style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>{t('login_title')}</h1>
        <p style={{ color: dark ? '#aaa' : '#666', marginBottom: 30, fontSize: 14 }}>{t('login_welcome_back')}</p>
        {isNative && bioAvailable && bioSaved && (
          <button onClick={handleBiometricLogin} disabled={bioLoading} aria-busy={bioLoading} className="btn-main btn-primary"
            style={{ width: '100%', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            🔓 {bioLoading ? t('login_verifying') : t('login_biometric_signin')}
          </button>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_email')}</label>
            <input type="email" required placeholder="votre@email.com" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={t('login_password_placeholder')} autoComplete="current-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading} aria-busy={loading}>
            {loading ? t('login_signing_in') : t('login_btn')}
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
