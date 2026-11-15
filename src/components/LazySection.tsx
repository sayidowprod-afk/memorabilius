'use client'
import { useEffect, useState, type ReactNode } from 'react'

// Section repliée au départ : son contenu n'est monté (donc chargé) qu'à l'ouverture. Sert aux checklists des pages joueur et équipe.
// Un lien vers « #<id> » (ex. « Checklist ↓ ») l'ouvre aussi.
export default function LazySection({ id, title, hint, children, marginTop = 40 }: { id: string; title: string; hint?: string; children: ReactNode; marginTop?: number }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const check = () => { if (window.location.hash === `#${id}`) setOpen(true) }
    check()
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.(`a[href="#${id}"]`)
      if (a) setOpen(true)
    }
    window.addEventListener('hashchange', check)
    document.addEventListener('click', onClick)
    return () => { window.removeEventListener('hashchange', check); document.removeEventListener('click', onClick) }
  }, [id])

  return (
    <section id={id} style={{ marginTop, scrollMarginTop: 80 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer',
        padding: '14px 18px', borderRadius: 12, border: '1.5px solid var(--jp-border, rgba(255,255,255,.15))',
        background: 'var(--jp-surface, rgba(255,255,255,.05))', color: 'var(--jp-text, inherit)', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <span style={{ fontSize: 20, fontWeight: 900 }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 700, color: 'var(--jp-muted, #8a96ad)' }}>
          {!open && hint && <span>{hint}</span>}
          <span aria-hidden style={{ display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
        </span>
      </button>
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </section>
  )
}
