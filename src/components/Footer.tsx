import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()
  const linkStyle = { color: '#666', textDecoration: 'none', fontSize: 13, fontWeight: 600 }
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 40, padding: '24px 16px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: '#999', fontSize: 13 }}>© {year} Memorabilius</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
          <Link href="/mentions-legales" style={linkStyle}>Mentions légales</Link>
          <Link href="/confidentialite" style={linkStyle}>Confidentialité</Link>
          <Link href="/cgu" style={linkStyle}>CGU</Link>
        </nav>
      </div>
    </footer>
  )
}
