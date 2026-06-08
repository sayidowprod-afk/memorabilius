import Link from 'next/link'

export default function Confirm() {
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>📬</div>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 12 }}>Vérifiez vos emails !</h1>
      <p style={{ color: '#666', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>
        Un lien de confirmation vous a été envoyé. Cliquez dessus pour activer votre compte et accéder à votre galerie.
      </p>
      <div style={{ background: '#fffbf0', border: '1px solid #ffe082', borderRadius: 12, padding: 16, marginBottom: 32, fontSize: 14, color: '#7a6000' }}>
        💡 Vérifiez aussi vos spams si vous ne trouvez pas l'email.
      </div>
      <Link href="/connexion" className="btn-main btn-primary">Aller à la connexion</Link>
    </div>
  )
}
