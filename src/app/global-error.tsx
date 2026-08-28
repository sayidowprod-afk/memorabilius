'use client'
import { useEffect } from 'react'

// error.tsx (racine) protege chaque route mais PAS le layout racine lui-meme
// (NavBar, providers Auth/Theme/Lang...) -- un crash a ce niveau precis
// affichait un ecran blanc total, sans aucun filet. global-error.tsx est le
// seul niveau qui peut l'attraper, d'ou le <html>/<body> autonome (le layout
// racine, potentiellement fautif, n'est plus dans l'arbre a ce stade).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'Inter, sans-serif' }}>
        <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>Une erreur est survenue</h1>
          <p style={{ color: '#666', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
            Quelque chose s'est mal passé au chargement du site. Réessaie, ou reviens plus tard.
          </p>
          <button onClick={reset} style={{ background: '#003DA6', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 50, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
