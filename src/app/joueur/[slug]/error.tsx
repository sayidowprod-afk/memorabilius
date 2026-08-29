'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div style={{ textAlign: 'center', padding: '80px 24px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
      <h2 style={{ fontWeight: 800, fontSize: 22, marginBottom: 8, color: 'var(--text, #111)' }}>Joueur introuvable</h2>
      <p style={{ color: 'var(--text2, #666)', fontSize: 15, marginBottom: 24 }}>
        Ce joueur n'existe pas ou une erreur est survenue.
      </p>
      <button
        onClick={reset}
        style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 50, padding: '10px 24px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
      >
        Réessayer
      </button>
    </div>
  )
}
