'use client'
import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import OAuthButtons from '@/components/OAuthButtons'

type PseudoStatus = 'idle' | 'checking' | 'available' | 'taken'

declare global {
  interface Window {
    onTurnstileVerified?: (token: string) => void
    onTurnstileExpired?: () => void
    turnstile?: { reset: (widgetId?: string) => void }
  }
}

export default function Inscription() {
  const { t } = useLang()
  const [form, setForm] = useState({ email: '', password: '', display_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pseudoStatus, setPseudoStatus] = useState<PseudoStatus>('idle')
  const [touched, setTouched] = useState({ email: false, password: false })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  useEffect(() => {
    window.onTurnstileVerified = (token: string) => setCaptchaToken(token)
    window.onTurnstileExpired = () => setCaptchaToken(null)
    return () => { delete window.onTurnstileVerified; delete window.onTurnstileExpired }
  }, [])

  // Erreurs par champ affichees en direct plutot que decouvertes seulement
  // au submit via le message generique de Supabase (ex: "Password should be
  // at least 6 characters" en anglais brut, illisible pour un utilisateur FR).
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const passwordValid = form.password.length >= 6
  // Score 0-4 : longueur, casse mixte, chiffre, symbole -- purement indicatif
  // (le minimum requis pour s'inscrire reste 6 caracteres, inchange).
  const passwordScore = (() => {
    const pw = form.password
    if (!pw) return 0
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
    if (/\d/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    return Math.min(s, 4)
  })()
  const PASSWORD_LEVELS = [
    { label: t('signup_pw_weak'), color: '#e74c3c' },
    { label: t('signup_pw_weak'), color: '#e74c3c' },
    { label: t('signup_pw_medium'), color: '#f39c12' },
    { label: t('signup_pw_good'), color: '#2ecc71' },
    { label: t('signup_pw_strong'), color: '#003DA6' },
  ]
  const emailError = touched.email && form.email.length > 0 && !emailValid
  const passwordError = touched.password && form.password.length > 0 && !passwordValid

  useEffect(() => {
    const name = form.display_name.trim()
    if (name.length < 2) { setPseudoStatus('idle'); return }
    setPseudoStatus('checking')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('display_name', name)
      setPseudoStatus((count ?? 0) > 0 ? 'taken' : 'available')
    }, 500)
  }, [form.display_name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (pseudoStatus === 'taken' || !emailValid || !passwordValid) return
    if (!captchaToken) { setError(t('signup_captcha_missing')); return }
    setLoading(true)
    setError('')

    try {
      const r = await fetch('/api/verify-turnstile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: captchaToken }),
      })
      const { success } = await r.json()
      if (!success) {
        setError(t('signup_captcha_failed'))
        setLoading(false)
        window.turnstile?.reset()
        setCaptchaToken(null)
        return
      }
    } catch {
      setError(t('signup_captcha_failed'))
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.display_name } }
    })
    if (error) { setError(error.message); setLoading(false); return }
    window.location.href = '/confirm?email=' + encodeURIComponent(form.email)
  }

  const pseudoHint = {
    idle: null,
    checking: <span style={{ color: '#888', fontSize: 12 }}>…</span>,
    available: <span style={{ color: '#2e7d32', fontSize: 12 }}>✓ {t('signup_available')}</span>,
    taken: <span style={{ color: '#c62828', fontSize: 12 }}>✗ {t('signup_taken')}</span>,
  }[pseudoStatus]

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 16px', boxSizing: 'border-box' }}>
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      )}
      <div className="auth-card-bg" style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', maxWidth: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>{t('register_title')}</h1>
        <p style={{ color: 'var(--text2, #666)', marginBottom: 30, fontSize: 14 }}>{t('register_sub')}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)' }}>{t('register_pseudo')}</label>
              {pseudoHint}
            </div>
            <input
              type="text" required
              placeholder={t('signup_username_placeholder')}
              value={form.display_name}
              onChange={e => setForm({ ...form, display_name: e.target.value })}
              style={{ borderColor: pseudoStatus === 'taken' ? '#c62828' : pseudoStatus === 'available' ? '#2e7d32' : undefined }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('login_email')}</label>
            <input type="email" required placeholder="votre@email.com" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched(p => ({ ...p, email: true }))}
              aria-invalid={emailError} style={{ borderColor: emailError ? '#c62828' : undefined }} />
            {emailError && <p style={{ color: '#c62828', fontSize: 12, margin: '4px 0 0' }}>{t('signup_email_invalid')}</p>}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={t('signup_password_placeholder')} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onBlur={() => setTouched(p => ({ ...p, password: true }))}
              aria-invalid={passwordError} style={{ borderColor: passwordError ? '#c62828' : undefined }} />
            {passwordError && <p style={{ color: '#c62828', fontSize: 12, margin: '4px 0 0' }}>{t('signup_password_too_short')}</p>}
            {!passwordError && form.password.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: i < passwordScore ? PASSWORD_LEVELS[passwordScore].color : 'var(--border, #e0e0e0)',
                      transition: 'background 0.15s',
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 11, color: PASSWORD_LEVELS[passwordScore].color, margin: '4px 0 0', fontWeight: 700 }}>
                  {PASSWORD_LEVELS[passwordScore].label}
                </p>
              </div>
            )}
          </div>
          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <div
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              data-callback="onTurnstileVerified"
              data-expired-callback="onTurnstileExpired"
            />
          )}
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading || pseudoStatus === 'taken' || pseudoStatus === 'checking' || emailError || passwordError || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken)}>
            {loading ? '...' : t('register_btn')}
          </button>
        </form>
        <OAuthButtons mode="inscription" />
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text2, #666)' }}>
          {t('register_have_account')} <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>{t('register_connect')}</Link>
        </p>
      </div>
    </div>
  )
}
