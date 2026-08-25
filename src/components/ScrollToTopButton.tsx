'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ScrollToTopButton({ threshold = 600 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  if (typeof document === 'undefined') return null
  return createPortal(
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Retour en haut"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 500,
        width: 44, height: 44, borderRadius: '50%', border: 'none',
        background: '#003DA6', color: 'white', fontSize: 18, cursor: 'pointer',
        boxShadow: 'var(--elevation-lg, 0 8px 24px rgba(0,0,0,0.25))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >↑</button>,
    document.body
  )
}
