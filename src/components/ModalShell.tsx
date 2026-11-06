'use client'
import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'

// 245 · Fenêtre homogène : même en-tête (titre Surfquest + croix de 44 px), même corps défilant, mêmes boutons en pied de fenêtre.
// Gère aussi : barre du bas masquée sur mobile, fermeture par Échap / clic à côté, défilement de la page bloqué, focus rendu à la fermeture.
//  - variant="center" : fenêtre centrée ; variant="sheet" : volet qui monte du bas (téléphone).
//  - backdrop={false} : pas de fond assombri et la page derrière reste utilisable (aperçu en direct de la personnalisation).
export default function ModalShell({ title, onClose, children, footer, variant = 'center', maxWidth = 460, backdrop = true, style }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode
  variant?: 'center' | 'sheet'; maxWidth?: number; backdrop?: boolean; style?: CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    document.body.classList.add('modal-fullscreen-active')
    const prevOverflow = document.body.style.overflow
    if (backdrop) document.body.style.overflow = 'hidden'
    ref.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = Array.from(ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')).filter(x => x.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-fullscreen-active')
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={'da-modal-back' + (backdrop ? '' : ' nobackdrop')} data-variant={variant} onMouseDown={backdrop ? e => { if (e.target === e.currentTarget) onClose() } : undefined}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1} className={`da-modal da-modal-${variant}`} style={{ maxWidth, ...style }}>
        <header className="da-modal-head">
          <b className="da-modal-title">{title}</b>
          <button type="button" className="da-modal-x" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        <div className="da-modal-body">{children}</div>
        {footer && <footer className="da-modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}
