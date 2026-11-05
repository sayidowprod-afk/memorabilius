'use client'
// Bascule « Confortable / Compact » pour les tableaux : garde le choix sur l'appareil et l'applique via data-density sur <html>.
import { useEffect, useState } from 'react'

const KEY = 'mb_table_density'

export default function DensityToggle() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    let v = false
    try { v = localStorage.getItem(KEY) === 'compact' } catch { /* stockage indisponible */ }
    const t = window.setTimeout(() => setCompact(v), 0)
    return () => { window.clearTimeout(t); document.documentElement.removeAttribute('data-density') }
  }, [])

  useEffect(() => {
    if (compact) document.documentElement.setAttribute('data-density', 'compact')
    else document.documentElement.removeAttribute('data-density')
  }, [compact])

  const choose = (v: boolean) => {
    setCompact(v)
    try { localStorage.setItem(KEY, v ? 'compact' : 'comfort') } catch { /* rien */ }
  }

  return (
    <div className="da-density" role="group" aria-label="Densité du tableau">
      <button type="button" aria-pressed={!compact} className={!compact ? 'on' : ''} onClick={() => choose(false)}>Confortable</button>
      <button type="button" aria-pressed={compact} className={compact ? 'on' : ''} onClick={() => choose(true)}>Compact</button>
    </div>
  )
}
