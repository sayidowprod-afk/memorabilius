'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>Une erreur est survenue</h1>
      <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
        Quelque chose s'est mal passé. Tu peux réessayer ou retourner à l'accueil.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={reset} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 50, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          Réessayer
        </button>
        <Link href="/" style={{ background: 'transparent', color: '#003DA6', border: '2px solid #003DA6', padding: '12px 28px', borderRadius: 50, fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>
          Accueil
        </Link>
      </div>
    </div>
  )
}
