import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🃏</div>
      <h1 style={{ fontWeight: 900, fontSize: 48, color: '#003DA6', marginBottom: 8 }}>404</h1>
      <h2 style={{ fontWeight: 900, fontSize: 24, marginBottom: 16 }}>Cette carte n'existe pas</h2>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 40 }}>
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/" className="btn-main btn-primary">Retour à l'accueil</Link>
        <Link href="/annuaire" className="btn-main btn-secondary">Voir l'annuaire</Link>
      </div>
    </div>
  )
}
