'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.memorabilius.fr/reset-password',
    })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>📧</div>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>Email envoyé !</h1>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Un lien de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez vos spams si besoin.
      </p>
      <Link href="/connexion" className="btn-main btn-primary">Retour à la connexion</Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 460, margin: '60px auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 40, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 8 }}>Mot de passe oublié</h1>
        <p style={{ color: '#666', marginBottom: 30, fontSize: 14 }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
          </div>
          {error && <p style={{ color: '#e74c3c', fontSize: 13 }}>{error}</p>}
          <button type="submit" className="btn-main btn-primary" disabled={loading}>
            {loading ? 'Envoi...' : 'Envoyer le lien'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#666' }}>
          <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
