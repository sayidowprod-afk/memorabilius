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

// Teinte + mode de fusion façon calque Photoshop, appliqués par-dessus la texture de
// base (patternImage) via background-blend-mode — permet de réutiliser une seule
// texture blanche/grise pour toutes les couleurs d'une variation (wave gold, wave
// silver, wave red...) sans avoir à uploader une image par couleur.
function rowBackground(row: PyramidRow, fallback: string): { background: string; backgroundBlendMode?: string } {
  if (row.patternImage && row.patternColor) {
    return {
      background: `linear-gradient(${row.patternColor}, ${row.patternColor}), url(${row.patternImage}) center/cover`,
      backgroundBlendMode: row.patternBlendMode || 'multiply',
    }
  }
  if (row.patternImage) return { background: `url(${row.patternImage}) center/cover` }
  return { background: fallback }
}

export default function PyramidBlock({ title, rows }: Props) {
  const [active, setActive] = useState<number | null>(null)
  if (!rows.length) return null

  const n = rows.length
  const minWidth = 30
  const maxWidth = 100

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: 560, margin: '0 auto' }}>
        {rows.map((row, i) => {
          // Largeur en % du conteneur (pas de plafond en pixels par ligne) : sinon,
          // dès que plusieurs lignes dépassaient la largeur max en pixels, elles se
          // retrouvaient toutes identiques en bas au lieu de continuer à s'élargir,
          // aplatissant la forme triangulaire.
          const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
          const isActive = active === i
          const isApex = i === 0

          const bg = rowBackground(row, PALETTE[i % PALETTE.length])

          if (isApex) {
            // Sommet = un vrai triangle pointu (façon pièce 1/1), pas une barre.
            return (
              <div
                key={i}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(a => (a === i ? null : a))}
                onClick={() => setActive(a => (a === i ? null : i))}
                style={{
                  position: 'relative', width: `${widthPct}%`, cursor: 'pointer',
                  height: isActive ? 56 : 44, transition: 'height 0.15s, width 0.15s',
                }}
              >
                <div style={{
                  position: 'absolute', inset: 0, ...bg,
                  clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
                  boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
                }} />
                <span style={{
                  position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                  color: 'white', fontSize: 11, fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {row.name}{row.printRun && ` /${row.printRun.replace(/^\//, '')}`}
                </span>
                {isActive && row.cardImage && (
                  <img src={row.cardImage} alt={row.name} style={{
                    position: 'absolute', left: '50%', top: '100%', marginTop: 6, transform: 'translateX(-50%)',
                    width: 90, height: 126, objectFit: 'cover', borderRadius: 8,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3,
                  }} />
                )}
              </div>
            )
          }

          return (
            <div
              key={i}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(a => (a === i ? null : a))}
              onClick={() => setActive(a => (a === i ? null : i))}
              style={{
                position: 'relative', width: `${widthPct}%`, cursor: 'pointer',
                ...bg, color: 'white',
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
