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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (pseudoStatus === 'taken') return
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
            <input type="email" required placeholder="votre@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>{t('login_password')}</label>
            <input type="password" required placeholder={t('signup_password_placeholder')} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" style={{ marginTop: 8 }} disabled={loading || pseudoStatus === 'taken' || pseudoStatus === 'checking'}>
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
