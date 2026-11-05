'use client'
// Petit « ? » qui ouvre une explication courte à côté d'un champ (clic, survol ou clavier).
import { useId, useState } from 'react'

export default function HelpTip({ text, label = 'Aide' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="da-help" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="da-help-btn" aria-label={label} aria-describedby={open ? id : undefined} aria-expanded={open}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        onBlur={() => setOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>?</button>
      {open && <span id={id} role="tooltip" className="da-help-tip">{text}</span>}
    </span>
  )
}
