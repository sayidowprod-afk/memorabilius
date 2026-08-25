'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ReadingProgressBar() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      setPct(scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  if (typeof document === 'undefined') return null
  // Portale sur document.body : rendu depuis un composant serveur profondement
  // imbrique, un ancetre avec `transform` (transition de page) casserait sinon
  // le `position: fixed` — meme bug deja rencontre sur les modales de l'app.
  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 250, background: 'transparent', pointerEvents: 'none' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', transition: 'width 0.1s linear' }} />
    </div>,
    document.body
  )
}
