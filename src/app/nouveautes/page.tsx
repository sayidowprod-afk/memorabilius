import type { Metadata } from 'next'
import Link from 'next/link'
import { ENTRIES } from '@/lib/nouveautes'

export const metadata: Metadata = {
  title: 'Nouveautés | Memorabilius',
  description: 'Les dernières nouveautés et améliorations de Memorabilius.',
  alternates: { canonical: '/nouveautes' },
}

export default function NouveautesPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px 60px' }}>
      <h1 style={{ fontSize: 'clamp(2rem, 4.5vw, 2.75rem)', margin: '0 0 6px' }}>Nouveautés</h1>
      <p style={{ color: 'var(--text2, #666)', margin: '0 0 26px' }}>Ce qui change sur Memorabilius, de la plus récente à la plus ancienne. Une idée ? <Link href="/guides" style={{ textDecoration: 'underline' }}>Parles-en dans les guides</Link> ou signale-la via « Signaler un bug / suggestion » en bas de page.</p>
      <div style={{ display: 'grid', gap: 16 }}>
        {ENTRIES.map(e => (
          <section key={e.date} style={{ border: '2px solid var(--border, #243063)', background: 'var(--card-bg, transparent)', padding: '16px 18px' }}>
            <div style={{ font: '800 12px system-ui, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: '#5b8def' }}>{e.date}</div>
            <h2 style={{ fontSize: 24, margin: '4px 0 8px', fontFamily: "'Surfquest', Impact, sans-serif", fontWeight: 400, textTransform: 'uppercase' }}>{e.titre}</h2>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              {e.points.map(p => <li key={p}>{p}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
