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

// Sur tactile, un tap synthétise mouseenter PUIS click dans le même cycle d'événement
// — avec onMouseEnter qui ouvre (setActive(i)) et onClick qui bascule (setActive(a =>
// a === i ? null : i)), le click voit l'état déjà ouvert par le mouseenter et le
// referme aussitôt : la ligne ne s'ouvre jamais au premier tap ("pas cliquable, pas
// de carte qui s'affiche"). On ne branche donc les gestionnaires de survol que sur
// les appareils qui ont un vrai hover ; sur les autres, seul onClick agit (un simple
// toggle, sans conflit).
function useHoverCapable(): boolean {
  const [hoverCapable, setHoverCapable] = useState(true)
  useEffect(() => {
    setHoverCapable(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])
  return hoverCapable
}
const PALETTE = ['#f5c518', '#f2a90a', '#e8720f', '#e0392b', '#c62368', '#8e3aa8', '#4a3ac6', '#1e63e0', '#0090c1', '#00a884', '#4caf50', '#9ccc3f']

// Au-delà de ce nombre de lignes, la pyramide devient trop longue à parcourir en une
// seule colonne — on la coupe alors en deux (voir SplitPyramid), y compris sur
// mobile (chaque colonne reste collée à son bord d'écran). En dessous, une seule
// pyramide reste plus lisible qu'une coupure artificielle sur peu de lignes.
const SPLIT_THRESHOLD = 6

// Beaucoup de lignes n'ont pas de patternColor défini à la main par l'admin (juste un
// nom + print run) — sans ça elles retombaient sur PALETTE cyclée par index, donnant
// des couleurs arc-en-ciel sans rapport avec le nom affiché (ex: "WAVE BLACK" rendu
// en cyan). On devine la couleur depuis le nom de la variation en premier, PALETTE ne
// sert plus qu'aux noms sans mot-couleur reconnaissable (ex: "REFRACTOR", "X-FACTOR").
const NAME_COLOR_MAP: [RegExp, string][] = [
  [/white/i, '#d8d8d8'],
  [/black/i, '#1c1c1c'],
  [/gold/i, '#c9a227'],
  [/silver/i, '#9a9a9a'],
  [/\bred\b/i, '#c0392b'],
  [/orange/i, '#d9791e'],
  [/purple/i, '#7d3ac1'],
  [/pink|magenta/i, '#d6336c'],
  [/green/i, '#2f9e44'],
  [/\bblue\b/i, '#1c6fd6'],
  [/aqua|teal|cyan/i, '#0f9e94'],
  [/yellow/i, '#c9a800'],
]

function fallbackColorFor(name: string, i: number): string {
  for (const [re, color] of NAME_COLOR_MAP) if (re.test(name)) return color
  return PALETTE[i % PALETTE.length]
}

// Combien de lignes en tête de pyramide partagent le même print run (ex: deux
// variations toutes deux /1) : elles se partagent alors le sommet à égalité au lieu
// qu'une seule occupe le triangle et l'autre retombe en simple barre en dessous. Ne
// groupe que sur un print run réellement renseigné (sinon des lignes sans print run
// se retrouveraient groupées par erreur).
function apexGroupCount(rows: PyramidRow[]): number {
  const first = (rows[0]?.printRun || '').trim()
  if (!first) return 1
  let n = 1
  while (n < rows.length && (rows[n].printRun || '').trim() === first) n++
  return n
}

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

// Découpe le triangle apex (clip-path 'polygon(50% 0%, 100% 100%, 0% 100%)') en N
// tranches verticales égales, pour que plusieurs variations ex-aequo au sommet
// (même print run, ex: deux /1) se PARTAGENT un seul triangle plutôt que d'afficher
// chacune son propre petit triangle complet côte à côte. Renvoie le clip-path (en
// coordonnées locales 0-100% de la tranche k) de la portion du triangle global
// tombant dans cette tranche : un triangle simple pour les deux tranches extrêmes
// (bord extérieur droit vertical/gauche vertical), un pentagone en forme de maison
// pour toute tranche centrale qui contient la pointe (utile si N ≥ 3).
function apexSlicePolygon(k: number, N: number): string {
  if (N <= 1) return 'polygon(50% 0%, 100% 100%, 0% 100%)'
  const x0 = (k / N) * 100
  const x1 = ((k + 1) / N) * 100
  const yTop = (x: number) => (x <= 50 ? 100 - 2 * x : 2 * x - 100)
  const y0 = Math.max(0, Math.min(100, yTop(x0)))
  const y1 = Math.max(0, Math.min(100, yTop(x1)))
  const points: [number, number][] = [[0, y0]]
  if (x0 < 50 && x1 > 50) points.push([((50 - x0) / (x1 - x0)) * 100, 0])
  points.push([100, y1], [100, 100], [0, 100])
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`
}

export default function PyramidBlock({ title, rows }: Props) {
  if (!rows.length) return null

  return (
    <div style={{ margin: '32px 0' }}>
      {title && <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 14px' }}>{title}</h3>}
      {rows.length > SPLIT_THRESHOLD ? <SplitPyramid rows={rows} /> : <SinglePyramid rows={rows} />}
    </div>
  )
}

// --- Pyramide unique (peu de lignes) ----------------------------------------

function SinglePyramid({ rows }: { rows: PyramidRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const hoverCapable = useHoverCapable()
  const n = rows.length
  const minWidth = 30
  const maxWidth = 100
  const apexCount = apexGroupCount(rows)
  const apexRows = rows.slice(0, apexCount)
  const restRows = rows.slice(apexCount)
  // Largeur du sommet identique à celle qu'aurait occupée un apex unique (même
  // formule qu'avant, à i=0) — partagée à parts égales entre les lignes ex-aequo.
  const apexSlotWidthPct = minWidth + ((maxWidth - minWidth) * 1) / n

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 3, width: `${apexSlotWidthPct}%` }}>
        {apexRows.map((row, i) => {
          const isActive = active === i
          const bg = rowBackground(row, fallbackColorFor(row.name, i))
          return (
            <div
              key={i}
              onMouseEnter={hoverCapable ? () => setActive(i) : undefined}
              onMouseLeave={hoverCapable ? () => setActive(a => (a === i ? null : a)) : undefined}
              onClick={() => setActive(a => (a === i ? null : i))}
              style={{
                position: 'relative', flex: '1 1 0', minWidth: 0, cursor: 'pointer',
                height: isActive ? 56 : 44, transition: 'height 0.15s',
              }}
            >
              <div style={{
                position: 'absolute', inset: 0, ...bg,
                clipPath: apexSlicePolygon(i, apexRows.length),
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
                  width: 90, height: 126, objectFit: 'contain', background: 'var(--bg3, #f2f2f2)', borderRadius: 8,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3,
                }} />
              )}
            </div>
          )
        })}
      </div>

      {restRows.map((row, j) => {
        const i = apexCount + j
        const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
        const isActive = active === i
        const bg = rowBackground(row, fallbackColorFor(row.name, i))
        return (
          <div
            key={i}
            onMouseEnter={hoverCapable ? () => setActive(i) : undefined}
            onMouseLeave={hoverCapable ? () => setActive(a => (a === i ? null : a)) : undefined}
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
                objectFit: 'contain', background: 'var(--bg3, #f2f2f2)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- Pyramide coupée en deux (beaucoup de lignes, desktop ET mobile) --------
//
// La ligne la plus rare (sommet) reste un triangle centré en haut. Les lignes
// suivantes sont réparties en alternance entre une colonne gauche (ancrée à gauche,
// s'élargit vers la droite) et une colonne droite (ancrée à droite, s'élargit vers la
// gauche) — chacune forme sa propre petite pyramide rare→commune, collée à son bord
// d'écran sur mobile comme sur desktop.
//
// Deux façons d'afficher la carte survolée/tapée coexistent dans le DOM en
// permanence, et c'est UNIQUEMENT une media query CSS qui bascule laquelle est
// visible (`.pyr-panel` / `.pyr-inline`) — pas de condition React sur la largeur
// d'écran. Un `useState`+`matchMedia` ferait la même bascule mais avec un flash
// (SSR ne connaît pas la largeur d'écran, donc un premier rendu "faux" avant que
// l'effect ne corrige) ; le CSS pur évite ce flash et reste correct dès le premier
// rendu, sans JS.
function SplitPyramid({ rows }: { rows: PyramidRow[] }) {
  const [active, setActive] = useState<number | null>(null)
  const hoverCapable = useHoverCapable()
  const apexCount = apexGroupCount(rows)
  const apexRows = rows.slice(0, apexCount)
  const rest = rows.slice(apexCount)
  const left = rest.filter((_, i) => i % 2 === 0)
  const right = rest.filter((_, i) => i % 2 === 1)
  const leftIndices = rest.map((_, i) => i + apexCount).filter((_, i) => i % 2 === 0)
  const rightIndices = rest.map((_, i) => i + apexCount).filter((_, i) => i % 2 === 1)

  const activeRow = active !== null ? rows[active] : null

  const inlineReveal = (row: PyramidRow, anchor: 'left' | 'right' | 'center') => (
    row.cardImage ? (
      <img src={row.cardImage} alt={row.name} className="pyr-inline" style={{
        position: 'absolute', top: '100%', marginTop: 6,
        left: anchor === 'right' ? 'auto' : 0, right: anchor === 'right' ? 0 : 'auto',
        ...(anchor === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : {}),
        width: 72, height: 100, objectFit: 'contain', background: 'var(--bg3, #f2f2f2)', borderRadius: 8,
        boxShadow: '0 8px 20px rgba(0,0,0,0.35)', zIndex: 3,
      }} />
    ) : null
  )

  const renderColumn = (colRows: PyramidRow[], colIndices: number[], anchor: 'left' | 'right') => {
    const n = colRows.length
    const minWidth = 48
    const maxWidth = 100
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        {colRows.map((row, i) => {
          const globalIndex = colIndices[i]
          const widthPct = minWidth + ((maxWidth - minWidth) * (i + 1)) / n
          const isActive = active === globalIndex
          const bg = rowBackground(row, fallbackColorFor(row.name, globalIndex))
          return (
            <div
              key={globalIndex}
              onMouseEnter={hoverCapable ? () => setActive(globalIndex) : undefined}
              onMouseLeave={hoverCapable ? () => setActive(a => (a === globalIndex ? null : a)) : undefined}
              onClick={() => setActive(a => (a === globalIndex ? null : globalIndex))}
              style={{
                position: 'relative', width: `${widthPct}%`, cursor: 'pointer', ...bg, color: 'white',
                alignSelf: anchor === 'left' ? 'flex-start' : 'flex-end',
                borderRadius: 6, padding: isActive ? '9px 12px' : '6px 12px',
                display: 'flex', alignItems: 'center',
                justifyContent: anchor === 'left' ? 'flex-start' : 'flex-end',
                gap: 8, fontSize: isActive ? 12.5 : 11.5, fontWeight: 800,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                transform: isActive ? 'scale(1.03)' : 'scale(1)', transition: 'transform 0.15s, padding 0.15s',
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
                textAlign: anchor === 'left' ? 'left' : 'right',
                zIndex: isActive ? 2 : 1,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.name}{row.printRun && <span style={{ opacity: 0.9, fontWeight: 700 }}> /{row.printRun.replace(/^\//, '')}</span>}
              </span>
              {isActive && inlineReveal(row, anchor)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 3, width: '42%', margin: '0 auto 3px' }}>
        {apexRows.map((row, i) => {
          const isActive = active === i
          const bg = rowBackground(row, fallbackColorFor(row.name, i))
          return (
            <div
              key={i}
              onMouseEnter={hoverCapable ? () => setActive(i) : undefined}
              onMouseLeave={hoverCapable ? () => setActive(a => (a === i ? null : a)) : undefined}
              onClick={() => setActive(a => (a === i ? null : i))}
              style={{ position: 'relative', flex: '1 1 0', minWidth: 0, cursor: 'pointer', height: isActive ? 56 : 44, transition: 'height 0.15s' }}
            >
              <div style={{
                position: 'absolute', inset: 0, ...bg,
                clipPath: apexSlicePolygon(i, apexRows.length),
                boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
              }} />
              <span style={{
                position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
                color: 'white', fontSize: 11, fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                whiteSpace: 'nowrap', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {row.name}{row.printRun && ` /${row.printRun.replace(/^\//, '')}`}
              </span>
              {isActive && inlineReveal(row, apexRows.length > 1 ? (i === 0 ? 'left' : 'right') : 'center')}
            </div>
          )
        })}
      </div>

      <div className="pyr-columns" style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        {renderColumn(left, leftIndices, 'left')}

        <div className="pyr-panel" style={{
          width: 190, flexShrink: 0, alignSelf: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', gap: 12, padding: '22px 14px', minHeight: 280,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)',
          borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          {activeRow ? (
            <>
              {activeRow.cardImage ? (
                <img src={activeRow.cardImage} alt={activeRow.name} style={{
                  width: 150, height: 210, objectFit: 'contain', background: 'var(--bg3, #f2f2f2)', borderRadius: 10,
                  boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
                }} />
              ) : (
                <div style={{
                  width: 150, height: 210, borderRadius: 10, background: 'var(--bg3, #f0f0f0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--text3, #ccc)" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                    <circle cx="9" cy="10" r="2" />
                    <path d="M3 17l5-4 4 3 4-5 5 6" />
                  </svg>
                </div>
              )}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text, #222)', lineHeight: 1.3 }}>{activeRow.name}</div>
                {activeRow.printRun && (
                  <div style={{
                    display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 20,
                    background: 'var(--bg3, #f0f0f0)', fontSize: 11, fontWeight: 700, color: 'var(--text2, #666)',
                  }}>
                    /{activeRow.printRun.replace(/^\//, '')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--text3, #ccc)" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <path d="M3 17l5-4 4 3 4-5 5 6" />
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text3, #999)', lineHeight: 1.4 }}>Survolez une variation pour voir la carte</span>
            </>
          )}
        </div>

        {renderColumn(right, rightIndices, 'right')}
      </div>

      <style>{`
        .pyr-inline { display: none; }
        @media (max-width: 640px) {
          .pyr-panel { display: none !important; }
          .pyr-inline { display: block !important; }
          .pyr-columns { gap: 6px !important; align-items: flex-start !important; }
        }
      `}</style>
    </div>
  )
}
