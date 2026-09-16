'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// Page admin non listee (comme /admin/stats, /admin/reports...) -- l'acces
// reel est protege cote API par requireAdmin() dans /api/admin/demo-login,
// pas par cette page elle-meme. A ouvrir sur la tablette du salon pour
// basculer sur le compte demo avant de passer en mode kiosque.
export default function AdminDemoPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const launchDemo = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Connecte-toi avec ton compte admin d\'abord.')
      const res = await fetch('/api/admin/demo-login', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok || !json.tokenHash) throw new Error(json.error || 'Echec de generation du token demo')
      // verifyOtp() etablit directement la session cote client -- pas de
      // redirection par lien magique (voir commentaire de la route API :
      // incompatible avec flowType: 'pkce').
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: json.tokenHash,
        type: 'magiclink',
      })
      if (verifyErr) throw verifyErr
      window.location.href = '/profil'
    } catch (e: any) {
      setError(e.message || String(e))
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Lancer la demo salon</h1>
      <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Bascule cet appareil sur le compte demo. A faire une seule fois par
        tablette avant de passer en mode kiosque.
      </p>
      <button onClick={launchDemo} disabled={loading} className="btn-main btn-primary" style={{ width: '100%' }}>
        {loading ? 'Connexion...' : 'Lancer la demo'}
      </button>
      {error && <p style={{ color: '#e74c3c', fontSize: 13, marginTop: 16 }}>{error}</p>}
    </div>
  )
}
