'use client'
import { useEffect, useRef, useState } from 'react'

// Anime un nombre de 0 -> valeur cible une seule fois, au premier montage du
// composant (pas a chaque changement de valeur -- useFlashOnChange gere deja
// le highlight des mises a jour ulterieures).
export function useCountUp(target: number, duration = 700) {
  const [display, setDisplay] = useState(target)
  const firstRunRef = useRef(true)

  useEffect(() => {
    // Seul le tout premier rendu est anime depuis 0 -- toute valeur cible
    // ulterieure (chargement asynchrone termine plus tard, changement de
    // filtre) doit s'afficher immediatement, sinon le compteur reste bloque
    // sur la valeur figee au moment de l'unique animation.
    if (!firstRunRef.current) { setDisplay(target); return }
    firstRunRef.current = false
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target)
      return
    }
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}
