import Link from 'next/link'

// Adresse de refus déclarée dans le portail eBay : le membre a annulé l'autorisation chez eBay.
export default function EbayRefus() {
  return (
    <div style={{ maxWidth: 520, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 30, margin: '0 0 14px' }}>Connexion annulée</h1>
      <p style={{ color: 'var(--text2)', lineHeight: 1.5, margin: '0 0 22px' }}>
        Ton compte eBay n’a pas été relié : rien n’a été importé. Tu peux réessayer quand tu veux.
      </p>
      <Link href="/mes-achats" className="btn-main" style={{ display: 'inline-block', padding: '12px 22px', textDecoration: 'none' }}>Retour à Mes achats</Link>
    </div>
  )
}
