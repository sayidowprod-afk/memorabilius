'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useTheme } from '@/lib/ThemeContext'

export interface GuideListItem {
  slug: string
  title: string
  excerpt: string | null
  cover_image: string | null
  category: string | null
  href: string
}

export default function GuidesListClient({
  guides, searchPlaceholder, filterAllLabel, noResultsLabel,
}: {
  guides: GuideListItem[]
  searchPlaceholder: string
  filterAllLabel: string
  noResultsLabel: string
}) {
  const { dark } = useTheme()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const categories = useMemo(
    () => [...new Set(guides.map(g => g.category).filter((c): c is string => !!c))].sort(),
    [guides]
  )

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const filtered = useMemo(() => {
    const q = norm(search.trim())
    return guides.filter(g => {
      if (category && g.category !== category) return false
      if (!q) return true
      return norm(g.title).includes(q) || norm(g.excerpt || '').includes(q)
    })
  }, [guides, search, category])

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
    border: active ? 'none' : `1.5px solid ${dark ? '#333' : '#e0e0e0'}`,
    background: active ? '#003DA6' : 'transparent',
    color: active ? 'white' : (dark ? '#ccc' : '#444'),
  })

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '10px 14px', fontSize: 14,
            borderRadius: 10, border: `1.5px solid ${dark ? '#333' : '#e0e0e0'}`,
            background: dark ? '#1e1e1e' : '#fff', color: dark ? '#eee' : '#121212', outline: 'none',
          }}
        />
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setCategory('')} style={chipStyle(category === '')}>{filterAllLabel}</button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={chipStyle(category === c)}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text3, #999)' }}>{noResultsLabel}</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {filtered.map(g => (
            <Link key={g.slug} href={g.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                border: '1px solid var(--border, #eee)', borderRadius: 14, overflow: 'hidden',
                background: 'var(--card-bg, #fff)', height: '100%', display: 'flex', flexDirection: 'column',
              }}>
                {g.cover_image ? (
                  <img src={g.cover_image} alt="" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--bg3, #f0f0f0)' }} />
                )}
                <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {g.category && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.category}</span>
                  )}
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{g.title}</h2>
                  {g.excerpt && <p style={{ fontSize: 13, color: 'var(--text2, #777)', margin: 0, lineHeight: 1.5 }}>{g.excerpt}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
