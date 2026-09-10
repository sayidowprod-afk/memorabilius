'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  // Repli pour l'ancien format de lien (ConfirmationURL -> hash
  // #access_token=...&type=recovery) : Supabase etablit alors la session
  // automatiquement des le chargement de la page.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    return () => subscription.unsubscribe()
  }, [])

  // Nouveau format : le lien pointe directement vers cette page avec
  // token_hash en query param (jamais vers l'endpoint /verify de Supabase).
  // On ne verifie ce token qu'au clic sur "Changer mon mot de passe", jamais
  // au simple chargement -- certains clients mail (scanners de securite
  // d'entreprise, previsualisation automatique) chargent les liens des
  // emails pour les analyser avant que la vraie personne ne clique. Si la
  // verification se declenchait au chargement, ce prefetch consommerait le
  // token a usage unique en premier, laissant la page bloquee sur
  // "Verification du lien..." indefiniment pour l'utilisateur reel -- bug
  // constate en prod. Voir aussi le template email (Supabase Dashboard >
  // Authentication > Emails > Reset password) qui doit utiliser ce format :
  // {{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery
  const tokenHash = searchParams.get('token_hash')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Minimum 6 caractères'); return }
    setLoading(true)
    setError('')

    if (!ready && tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (verifyError) {
        const expired = /expired|invalid/i.test(verifyError.message)
        setError(expired
          ? 'Ce lien a expiré ou a déjà été utilisé. Redemandez un email de réinitialisation.'
          : verifyError.message)
        setLoading(false)
        return
      }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/profil')
  }

  // Ni token_hash (nouveau format) ni session deja etablie (ancien format) :
  // on attend l'evenement PASSWORD_RECOVERY quelques instants.
  if (!ready && !tokenHash) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>
      <p style={{ color: 'var(--text2, #666)' }}>Vérification du lien en cours...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>
      <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', maxWidth: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>Nouveau mot de passe</h1>
        <p style={{ color: 'var(--text2, #666)', marginBottom: 30, fontSize: 14 }}>Choisissez un nouveau mot de passe pour votre compte.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="reset-password-new" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>Nouveau mot de passe</label>
            <input id="reset-password-new" type="password" required placeholder="Min. 6 caractères" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label htmlFor="reset-password-confirm" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3, #888)', display: 'block', marginBottom: 6 }}>Confirmer</label>
            <input id="reset-password-confirm" type="password" required placeholder="Répétez le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" disabled={loading}>
            {loading ? 'Mise à jour...' : 'Changer mon mot de passe'}
          </button>
        </form>
      </div>
    </div>
  )
}
