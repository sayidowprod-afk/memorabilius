import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadSharedPull } from '@/lib/packShare'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const c = await loadSharedPull(id)
  if (!c) return { title: 'Tirage introuvable | Memorabilius' }
  const title = `${c.pseudo} a tiré une carte ${c.rarityName} : ${c.player}`
  const description = [c.team, [c.year, c.set].filter(Boolean).join(' '), c.variation].filter(Boolean).join(' · ') + ' — Ouvre un pack gratuit toutes les heures sur Memorabilius.'
  return { title, description, robots: { index: false, follow: false }, openGraph: { title, description, type: 'website' }, twitter: { card: 'summary_large_image', title, description } }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await loadSharedPull(id)
  if (!c) notFound()
  const tags = [c.rc && 'RC', c.auto && 'AUTO', c.patch && 'PATCH', c.run && `/${c.run}`, c.variation].filter(Boolean) as string[]
  return (
    <main style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '40px 16px', color: '#fff', textAlign: 'center' }}>
      <div style={{ font: '800 12px system-ui, sans-serif', letterSpacing: '.18em', textTransform: 'uppercase', color: c.color }}>{c.pseudo} a tiré une carte {c.rarityName}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={c.img} alt={c.player} style={{ width: 'min(320px, 80vw)', aspectRatio: '2.5 / 3.5', objectFit: 'contain', background: '#060f2c', border: `4px solid ${c.color}`, boxShadow: `0 0 40px -6px ${c.color}` }} />
      <div>
        <h1 style={{ margin: 0, font: "400 clamp(36px, 7vw, 64px) 'Surfquest', Impact, sans-serif", textTransform: 'uppercase', lineHeight: .95 }}>{c.player}</h1>
        <p style={{ margin: '8px 0 0', opacity: .75 }}>{[c.team, c.number ? `#${c.number}` : '', [c.year, c.set].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
        {tags.length > 0 && <p style={{ margin: '10px 0 0', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>{tags.map(t => <span key={t} style={{ border: '2px solid rgba(255,255,255,.35)', padding: '3px 9px', font: '800 11px system-ui, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t}</span>)}</p>}
      </div>
      <Link href="/?pack=1" style={{ background: '#fff', color: '#06122e', padding: '14px 26px', font: "400 20px 'Surfquest', Impact, sans-serif", textTransform: 'uppercase', letterSpacing: '.05em', textDecoration: 'none', border: '3px solid #fff' }}>Ouvre ton pack gratuit</Link>
    </main>
  )
}
