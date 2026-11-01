'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Retour de la page de connexion d'eBay (adresse d'acceptation déclarée dans le portail eBay) : on termine la
// connexion côté serveur avec le jeton `etat`, puis on ouvre « Mes achats ».
export default function EbayConnexion() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const etat = new URLSearchParams(window.location.search).get('etat')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Tu n’es plus connecté à Memorabilius : connecte-toi, puis relance « Connecter eBay ».'); return }
      if (!etat) { setError('Retour eBay incomplet : relance « Connecter eBay ».'); return }
      try {
        const res = await fetch('/api/ebay/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ etat }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) { setError(json.error || 'La connexion à eBay a échoué.'); return }
        router.replace('/mes-achats')
      } catch {
        setError('La connexion à eBay a échoué : réessaie dans un instant.')
      }
    })()
  }, [router])

  return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 30, margin: '0 0 14px' }}>{error ? 'Connexion impossible' : 'Connexion à eBay…'}</h1>
      <p style={{ color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 22px' }}>
        {error || 'On récupère tes achats et tes enchères. Ça prend quelques secondes.'}
      </p>
      {error && <Link href="/mes-achats" className="btn-main" style={{ display: 'inline-block', padding: '12px 22px', textDecoration: 'none' }}>Retour à Mes achats</Link>}
    </div>
  )
}
