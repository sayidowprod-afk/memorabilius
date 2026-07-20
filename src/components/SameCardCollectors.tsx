'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { cardSlug } from '@/lib/playerSlug'

interface Collector {
  id: string; slug: string; display_name: string
  avatar_url: string; accent: string; cardImg?: string
}

export default function SameCardCollectors({ cardName, year, brand, set, variant, num, rc, auto, patch, excludeUserId, accent }: {
  cardName: string
  year?: string
  brand?: string
  set?: string
  variant?: string
  num?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  excludeUserId?: string
  accent: string
}) {
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cardName) return
    const params = new URLSearchParams({ name: cardName })
    if (year)    params.set('year', year)
    if (brand)   params.set('brand', brand)
    if (set)     params.set('set', set)
    if (variant) params.set('variant', variant)
    if (num)     params.set('num', num)
    if (rc    != null) params.set('rc',    String(rc))
    if (auto  != null) params.set('auto',  String(auto))
    if (patch != null) params.set('patch', String(patch))
    if (excludeUserId) params.set('exclude', excludeUserId)
    fetch(`/api/same-card?${params}`)
      .then(r => r.json())
      .then(d => { setCollectors(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cardName, year, brand, set, variant, num, rc, auto, patch, excludeUserId])

  if (loading || collectors.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {collectors.length} autre{collectors.length > 1 ? 's' : ''} collectionneur{collectors.length > 1 ? 's' : ''} avec cette carte
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {collectors.map(c => {
          // Vers la fiche publique précise de sa carte quand on connaît son image (maillage
          // interne entre toutes les pages de cette même carte, utile pour le SEO), sinon
          // simple lien vers sa galerie.
          const href = c.cardImg
            ? `/galerie/${c.slug || c.id}/${cardSlug(cardName, year, brand, set)}?src=${encodeURIComponent(c.cardImg)}`
            : `/galerie/${c.slug || c.id}`
          return (
          <Link key={c.id} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#f8f8f8', border: `1.5px solid ${c.accent}20`,
              borderRadius: 50, padding: '4px 12px 4px 4px',
              transition: '0.15s', cursor: 'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = `${c.accent}12`; e.currentTarget.style.borderColor = c.accent }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.borderColor = `${c.accent}20` }}
            >
              <img
                src={c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${c.accent}` }}
                alt={c.display_name}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{c.display_name}</span>
            </div>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
