'use client'
import { useEffect } from 'react'

// Reflet "holo" LEGER sur les cartes de la galerie, de l'accueil et des listes : une lueur suit le pointeur et la
// carte s'incline de quelques degres. Delegation d'evenements : il suffit de poser la classe .holo-light sur
// l'element (jamais dans le visualiseur 3D ni les pages de partage). Uniquement sur les appareils a souris :
// au doigt, le survol n'existe pas et le geste de defilement ne doit pas etre perturbe.
export default function HoloLight() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let cur: HTMLElement | null = null
    const reset = () => {
      if (!cur) return
      cur.style.transform = ''
      cur.removeAttribute('data-holo')
      cur = null
    }
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.holo-light') as HTMLElement | null
      if (el !== cur) { reset(); cur = el }
      if (!el) return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      el.style.setProperty('--mx', `${px * 100}%`)
      el.style.setProperty('--my', `${py * 100}%`)
      el.setAttribute('data-holo', '1')
      el.style.transform = `perspective(900px) rotateY(${((px - 0.5) * 9).toFixed(2)}deg) rotateX(${((0.5 - py) * 9).toFixed(2)}deg)`
    }
    const out = (e: PointerEvent) => { if (!e.relatedTarget) reset() }
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerout', out, { passive: true })
    window.addEventListener('blur', reset)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
      window.removeEventListener('blur', reset)
      reset()
    }
  }, [])
  return null
}
