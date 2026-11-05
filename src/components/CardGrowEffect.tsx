'use client'
import { useEffect } from 'react'

// Effet « la carte grandit » : au clic sur une tuile de la grille, une copie de sa photo s'agrandit depuis sa place vers le centre de l'écran
// puis s'estompe pendant que la fiche s'ouvre dessous. Purement décoratif (pointer-events: none) : il ne change ni le clic ni la navigation.
// Aucun arrondi sur la carte (bords nets). Désactivé si le téléphone demande de réduire les animations, ou en mode sélection.
export default function CardGrowEffect({ disabled }: { disabled?: boolean }) {
  useEffect(() => {
    if (disabled) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null
      const tile = t?.closest?.('.card-grid .card-item')
      if (!tile || t?.closest?.('button, a, input, textarea, select, [role="button"]')) return
      const img = tile.querySelector('img') as HTMLImageElement | null
      if (!img || !img.currentSrc) return
      const r = img.getBoundingClientRect()
      if (r.width < 30 || r.height < 30) return
      const ghost = document.createElement('img')
      ghost.src = img.currentSrc
      ghost.alt = ''
      Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, objectFit: 'cover', zIndex: '99990', pointerEvents: 'none', borderRadius: '0', boxShadow: '0 18px 50px rgba(0,0,0,.55)', margin: '0', willChange: 'transform, opacity' })
      document.body.appendChild(ghost)
      const targetW = Math.min(window.innerWidth * 0.8, 360), s = targetW / r.width
      const dx = window.innerWidth / 2 - (r.left + r.width / 2), dy = window.innerHeight / 2 - (r.top + r.height / 2)
      const anim = ghost.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 1, offset: 0.7 },
        { transform: `translate(${dx}px,${dy}px) scale(${s * 1.04})`, opacity: 0 },
      ], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' })
      anim.onfinish = () => ghost.remove()
      anim.oncancel = () => ghost.remove()
      window.setTimeout(() => ghost.remove(), 600) // filet de sécurité
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [disabled])
  return null
}
