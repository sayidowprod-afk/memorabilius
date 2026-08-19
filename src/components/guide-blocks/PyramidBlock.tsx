'use client'
import { useState } from 'react'
import type { PyramidRow } from '@/lib/guideBlockTypes'

interface Props {
  title?: string
  rows: PyramidRow[]
}

// Pyramide de variations : une barre par ligne, largeur croissante du haut (rare) au
// bas (commune). Le nom + print run restent toujours visibles sur la barre ; au
// survol (desktop) ou au tap (mobile — :hover n'existe pas de façon fiable au
// toucher) la ligne grossit légèrement et révèle l'image d'exemple.
const PALETTE = ['#f5c518', '#f2a90a', '#e8720f', '#e0392b', '#c62368', '#8e3aa8', '#4a3ac6', '#1e63e0', '#0090c1', '#00a884', '#4caf50', '#9ccc3f']

export default function PyramidBlock({ title, rows }: Props) {
  const [active, setActive] = useState<number | null>(null)
  if (!rows.length) return null

  const n = rows.length
  const minWidth = 30
  const maxWidth = 100

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        {rows.map((row, i) => {
          const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
          const isActive = active === i
          return (
            <div
              key={i}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(a => (a === i ? null : a))}
              onClick={() => setActive(a => (a === i ? null : i))}
              style={{
                position: 'relative', width: `${widthPct}%`, maxWidth: 560, cursor: 'pointer',
                background: row.patternImage ? `url(${row.patternImage}) center/cover` : PALETTE[i % PALETTE.length],
                color: 'white',
                borderRadius: 4, padding: isActive ? '10px 14px' : '6px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                fontSize: isActive ? 13 : 12, fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                transform: isActive ? 'scale(1.04)' : 'scale(1)', transition: 'transform 0.15s, padding 0.15s',
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.3)' : 'none', zIndex: isActive ? 2 : 1,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}{row.printRun && <span style={{ opacity: 0.9, fontWeight: 700 }}> /{row.printRun.replace(/^\//, '')}</span>}
              </span>
              {isActive && row.cardImage && (
                <img src={row.cardImage} alt={row.name} style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 6, width: 90, height: 126,
                  objectFit: 'cover', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3,
                }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
