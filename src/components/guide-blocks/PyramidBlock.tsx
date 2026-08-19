'use client'
import { useEffect, useState } from 'react'
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

// Au-delà de ce nombre de lignes, la pyramide devient trop longue à parcourir en une
// seule colonne — on la coupe alors en deux (voir SplitPyramid). En dessous, une
// seule pyramide reste plus lisible qu'une coupure artificielle sur peu de lignes.
const SPLIT_THRESHOLD = 6

function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16)
  const g = parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16)
  const b = parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacityPct)) / 100})`
}

// Teinte + mode de fusion façon calque Photoshop, appliqués par-dessus la texture de
// base (patternImage) via background-blend-mode — permet de réutiliser une seule
// texture blanche/grise pour toutes les couleurs d'une variation (wave gold, wave
// silver, wave red...) sans avoir à uploader une image par couleur. L'opacité du
// calque de teinte passe par l'alpha de la couleur (background-blend-mode n'a pas de
// contrôle d'opacité propre) — un calque semi-transparent laisse plus de texture
// d'origine visible en dessous.
export function rowBackground(row: PyramidRow, fallback: string): { background: string; backgroundBlendMode?: string } {
  if (row.patternImage && row.patternColor) {
    const color = hexToRgba(row.patternColor, row.patternOpacity ?? 100)
    return {
      background: `linear-gradient(${color}, ${color}), url(${row.patternImage}) center/cover`,
      backgroundBlendMode: row.patternBlendMode || 'multiply',
    }
  }
  if (row.patternImage) return { background: `url(${row.patternImage}) center/cover` }
  return { background: fallback }
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setNarrow(mq.matches)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

export default function PyramidBlock({ title, rows }: Props) {
  const isNarrow = useIsNarrow()
  if (!rows.length) return null

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}
      {rows.length > SPLIT_THRESHOLD && !isNarrow ? <SplitPyramid rows={rows} /> : <SinglePyramid rows={rows} />}
    </div>
  )
}

// --- Pyramide unique (peu de lignes, ou mobile) -----------------------------

function SinglePyramid({ rows }: { rows: PyramidRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const n = rows.length
  const minWidth = 30
  const maxWidth = 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: 560, margin: '0 auto' }}>
      {rows.map((row, i) => {
        const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
        const isActive = active === i
        const isApex = i === 0
        const bg = rowBackground(row, PALETTE[i % PALETTE.length])

        if (isApex) {
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
  )
}

// --- Pyramide coupée en deux (beaucoup de lignes) ---------------------------
//
// La ligne la plus rare (sommet) reste un triangle centré en haut. Les lignes
// suivantes sont réparties en alternance entre une colonne gauche (ancrée à gauche,
// s'élargit vers la droite) et une colonne droite (ancrée à droite, s'élargit vers la
// gauche) — chacune forme sa propre petite pyramide rare→commune. Un encart central
// entre les deux affiche la carte + le nom de la ligne survolée/tapée, au lieu de
// faire apparaître l'image sous chaque barre (qui, avec 2 colonnes côte à côte,
// manquerait de place et chevaucherait la colonne voisine).
function SplitPyramid({ rows }: { rows: PyramidRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const apex = rows[0]
  const rest = rows.slice(1)
  const left = rest.filter((_, i) => i % 2 === 0)
  const right = rest.filter((_, i) => i % 2 === 1)
  const leftIndices = rest.map((_, i) => i + 1).filter((_, i) => i % 2 === 0)
  const rightIndices = rest.map((_, i) => i + 1).filter((_, i) => i % 2 === 1)

  const activeRow = active !== null ? rows[active] : null
  const apexBg = rowBackground(apex, PALETTE[0])

  const renderColumn = (colRows: PyramidRow[], colIndices: number[], anchor: 'left' | 'right') => {
    const n = colRows.length
    const minWidth = 40
    const maxWidth = 100
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        {colRows.map((row, i) => {
          const globalIndex = colIndices[i]
          const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
          const isActive = active === globalIndex
          const bg = rowBackground(row, PALETTE[globalIndex % PALETTE.length])
          return (
            <div
              key={globalIndex}
              onMouseEnter={() => setActive(globalIndex)}
              onMouseLeave={() => setActive(a => (a === globalIndex ? null : a))}
              onClick={() => setActive(a => (a === globalIndex ? null : globalIndex))}
              style={{
                width: `${widthPct}%`, cursor: 'pointer', ...bg, color: 'white',
                alignSelf: anchor === 'left' ? 'flex-start' : 'flex-end',
                borderRadius: 4, padding: isActive ? '9px 12px' : '6px 12px',
                display: 'flex', alignItems: 'center',
                justifyContent: anchor === 'left' ? 'flex-start' : 'flex-end',
                gap: 8, fontSize: isActive ? 12.5 : 11.5, fontWeight: 800,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.15s, padding 0.15s',
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
                textAlign: anchor === 'left' ? 'left' : 'right',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}{row.printRun && <span style={{ opacity: 0.9, fontWeight: 700 }}> /{row.printRun.replace(/^\//, '')}</span>}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div
        onMouseEnter={() => setActive(0)}
        onMouseLeave={() => setActive(a => (a === 0 ? null : a))}
        onClick={() => setActive(a => (a === 0 ? null : 0))}
        style={{ position: 'relative', width: '42%', margin: '0 auto 3px', cursor: 'pointer', height: active === 0 ? 56 : 44, transition: 'height 0.15s' }}
      >
        <div style={{
          position: 'absolute', inset: 0, ...apexBg,
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          boxShadow: active === 0 ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
        }} />
        <span style={{
          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
          color: 'white', fontSize: 11, fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {apex.name}{apex.printRun && ` /${apex.printRun.replace(/^\//, '')}`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
        {renderColumn(left, leftIndices, 'left')}

        <div style={{
          width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', textAlign: 'center', gap: 8, padding: '0 6px',
          borderLeft: '1px dashed var(--border, #ddd)', borderRight: '1px dashed var(--border, #ddd)',
        }}>
          {activeRow ? (
            <>
              {activeRow.cardImage && (
                <img src={activeRow.cardImage} alt={activeRow.name} style={{
                  width: 96, height: 134, objectFit: 'cover', borderRadius: 8,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                }} />
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text, #222)' }}>{activeRow.name}</div>
                {activeRow.printRun && <div style={{ fontSize: 11, color: 'var(--text3, #999)', marginTop: 2 }}>/{activeRow.printRun.replace(/^\//, '')}</div>}
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text3, #999)' }}>Survolez une variation</span>
          )}
        </div>

        {renderColumn(right, rightIndices, 'right')}
      </div>
    </div>
  )
}
