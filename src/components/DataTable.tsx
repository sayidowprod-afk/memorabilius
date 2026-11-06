'use client'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// 271 · Tableau lisible : en-têtes qui restent en haut pendant le défilement, lignes très légèrement zébrées, colonnes triables (flèche),
// chiffres alignés, ligne de totaux collée en bas. Défile dans son cadre sur petit écran.
export type Col<T> = {
  key: string; label: string
  align?: 'left' | 'right'
  sort?: (r: T) => string | number | null
  render: (r: T) => ReactNode
  total?: (rows: T[]) => ReactNode
}

export default function DataTable<T>({ rows, cols, rowKey, defaultSort, caption }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; defaultSort?: { key: string; dir: 'asc' | 'desc' }; caption: string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(defaultSort ?? null)

  const sorted = useMemo(() => {
    const col = sort ? cols.find(c => c.key === sort.key) : null
    if (!sort || !col?.sort) return rows
    const get = col.sort
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b)
      if (x === null && y === null) return 0
      if (x === null) return 1   // les valeurs absentes restent en bas, quel que soit le sens
      if (y === null) return -1
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')) * dir
    })
  }, [rows, cols, sort])

  const toggle = (c: Col<T>) => { if (c.sort) setSort(s => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' })) }
  const hasTotals = cols.some(c => c.total)

  return (
    <div className="da-table-wrap">
      <table className="da-table">
        <caption className="da-sr-only">{caption}</caption>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} scope="col" style={{ textAlign: c.align || 'left' }} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : c.sort ? 'none' : undefined}>
                {c.sort
                  ? <button type="button" className="da-th-btn" onClick={() => toggle(c)}>{c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span></button>
                  : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={rowKey(r)}>{cols.map(c => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render(r)}</td>)}</tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot>
            <tr>{cols.map((c, i) => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.total ? c.total(sorted) : i === 0 ? `Total · ${sorted.length}` : ''}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
