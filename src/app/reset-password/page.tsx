'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase gère automatiquement le token depuis l'URL
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Minimum 6 caractères'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/profil')
  }

  if (!ready) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>⏳</div>
      <p style={{ color: '#666' }}>Vérification du lien en cours...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>Nouveau mot de passe</h1>
        <p style={{ color: '#666', marginBottom: 30, fontSize: 14 }}>Choisissez un nouveau mot de passe pour votre compte.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Nouveau mot de passe</label>
            <input type="password" required placeholder="Min. 6 caractères" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Confirmer</label>
            <input type="password" required placeholder="Répétez le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} />
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
