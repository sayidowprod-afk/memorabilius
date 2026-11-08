'use client'
import { useEffect, useRef, useState } from 'react'

// Champ texte avec propositions (joueur, équipe…) : l'utilisateur tape, on lui propose les noms exacts connus pour qu'il n'ait pas à
// deviner l'orthographe (utile pour la wishlist, où le nom doit coïncider avec celui des cartes). Un texte libre reste accepté.
// `getSuggestions` peut être synchrone (liste locale) ou asynchrone (appel serveur, anti-rebond de 250 ms).
export default function SuggestInput({ value, onChange, getSuggestions, placeholder, minChars = 2 }: {
  value: string
  onChange: (v: string) => void
  getSuggestions: (q: string) => string[] | Promise<string[]>
  placeholder?: string
  minChars?: number
}) {
  const [items, setItems] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const seq = useRef(0)
  const picked = useRef(false) // vrai juste après le choix d'une proposition : on ne relance pas la recherche sur le texte choisi

  useEffect(() => {
    if (picked.current) { picked.current = false; return }
    const q = value.trim()
    if (q.length < minChars) { setItems([]); return }
    const my = ++seq.current
    const id = setTimeout(async () => {
      try {
        const res = await getSuggestions(q)
        if (my === seq.current) { setItems(res.filter(s => s.toLowerCase() !== q.toLowerCase()).slice(0, 8)); setActive(-1) }
      } catch { if (my === seq.current) setItems([]) }
    }, 250)
    return () => clearTimeout(id)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (s: string) => { picked.current = true; onChange(s); setItems([]); setOpen(false); setActive(-1) }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value} placeholder={placeholder} autoComplete="off" autoCorrect="off" spellCheck={false}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={e => {
          if (!open || items.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % items.length) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a <= 0 ? items.length - 1 : a - 1)) }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && items.length > 0 && (
        <ul role="listbox" style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', margin: '2px 0 0', padding: 0, listStyle: 'none', maxHeight: 240, overflowY: 'auto',
          background: 'var(--card-bg, #fff)', border: '2px solid var(--border, #ccc)', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          {items.map((s, i) => (
            <li key={s} role="option" aria-selected={i === active}
              onMouseDown={e => { e.preventDefault(); pick(s) }}
              style={{ padding: '10px 12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--text, #222)', background: i === active ? 'var(--bg3, #eee)' : 'transparent' }}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
