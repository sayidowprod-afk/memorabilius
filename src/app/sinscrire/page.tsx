'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import OAuthButtons from '@/components/OAuthButtons'

type PseudoStatus = 'idle' | 'checking' | 'available' | 'taken'

export default function Inscription() {
  const { t } = useLang()
  const [form, setForm] = useState({ email: '', password: '', display_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pseudoStatus, setPseudoStatus] = useState<PseudoStatus>('idle')
  const [touched, setTouched] = useState({ email: false, password: false })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Erreurs par champ affichees en direct plutot que decouvertes seulement
  // au submit via le message generique de Supabase (ex: "Password should be
  // at least 6 characters" en anglais brut, illisible pour un utilisateur FR).
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  const passwordValid = form.password.length >= 6
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
    setLoading(true)
    setError('')
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
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading || pseudoStatus === 'taken' || pseudoStatus === 'checking' || emailError || passwordError}>
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
