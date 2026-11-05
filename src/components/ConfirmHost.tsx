'use client'
// Fenêtre de confirmation aux couleurs de la DA, à la place du confirm() du navigateur.
// Usage : `if (!(await askConfirm('Supprimer cette carte ?', { danger: true, confirmLabel: 'Supprimer' }))) return`
// <ConfirmHost /> est monté une fois dans layout.tsx. Sans hôte (rendu serveur, test), on retombe sur window.confirm.
import { useEffect, useRef, useState } from 'react'

type Opts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
type Pending = { message: string; opts: Opts; resolve: (v: boolean) => void }

let openFn: ((message: string, opts: Opts) => Promise<boolean>) | null = null

export function askConfirm(message: string, opts: Opts = {}): Promise<boolean> {
  if (openFn) return openFn(message, opts)
  return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : false)
}

export default function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    openFn = (message, opts) => new Promise<boolean>(resolve => {
      setPending(prev => { prev?.resolve(false); return { message, opts, resolve } })
    })
    return () => { openFn = null }
  }, [])

  const close = (v: boolean) => {
    setPending(cur => { cur?.resolve(v); return null })
  }

  const isOpen = pending !== null
  useEffect(() => {
    if (!isOpen) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPending(cur => { cur?.resolve(false); return null }) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (!pending) return null
  const { message, opts } = pending
  return (
    <div className="da-confirm-back" onMouseDown={e => { if (e.target === e.currentTarget) close(false) }}>
      <div className="da-confirm" role="alertdialog" aria-modal="true" aria-labelledby="da-confirm-title" aria-describedby="da-confirm-msg">
        <div id="da-confirm-title" className="da-confirm-title">{opts.title || (opts.danger ? 'Confirmer la suppression' : 'Confirmer')}</div>
        <p id="da-confirm-msg" className="da-confirm-msg">{message}</p>
        <div className="da-confirm-actions">
          <button ref={cancelRef} type="button" className="da-confirm-btn" onClick={() => close(false)}>{opts.cancelLabel || 'Annuler'}</button>
          <button type="button" className={`da-confirm-btn ${opts.danger ? 'danger' : 'primary'}`} onClick={() => close(true)}>{opts.confirmLabel || (opts.danger ? 'Supprimer' : 'Confirmer')}</button>
        </div>
      </div>
    </div>
  )
}
