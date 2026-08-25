'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Bandeau condense (titre + retour) qui apparait une fois qu'on a scrolle
// au-dela du titre principal de l'article — pratique sur les guides longs
// pour toujours savoir sur quel guide on est / revenir en un clic.
export default function GuideMiniHeader({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  const [visible, setVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 60, left: 0, right: 0, zIndex: 240,
          background: 'var(--card-bg, #fff)', borderBottom: '1px solid var(--border, #eee)',
          padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: visible ? '0 4px 16px rgba(0,0,0,0.06)' : 'none',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.25s ease, opacity 0.25s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}>
          <a href={backHref} style={{ fontSize: 13, fontWeight: 700, color: '#003DA6', textDecoration: 'none', flexShrink: 0 }}>{backLabel}</a>
          <span style={{ width: 1, height: 16, background: 'var(--border, #eee)', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text, #121212)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        </div>,
        document.body
      )}
    </>
  )
}
