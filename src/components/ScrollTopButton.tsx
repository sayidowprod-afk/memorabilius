'use client'
import { useEffect, useState } from 'react'

// Bouton flottant "remonter en haut" : apparait des qu'on a defile de plus d'un ecran et demi.
export default function ScrollTopButton() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 1.5)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!show) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut"
      style={{
        position: 'fixed', right: 14, bottom: 'calc(var(--bottom-nav-h, 0px) + 16px)', zIndex: 900,
        width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: '#003DA6', color: 'white', fontSize: 20, fontWeight: 900, lineHeight: 1,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >↑</button>
  )
}
