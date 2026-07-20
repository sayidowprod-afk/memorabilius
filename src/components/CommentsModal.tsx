'use client'
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import GalerieComments from './GalerieComments'

export default function CommentsModal({ title, onClose, ...commentsProps }: {
  title: string
  onClose: () => void
  galerieUserId: string; accent: string; isOwner: boolean
  cardKey?: string; binderId?: number; notifyUserId?: string; emptyLabel?: string
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 id={titleId} style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>💬 {title}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <GalerieComments {...commentsProps} />
      </div>
    </div>,
    document.body
  )
}
