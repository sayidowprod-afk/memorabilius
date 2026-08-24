'use client'

// Petite salve de confettis DOM, sans dependance externe. Usage :
// import { fireConfetti } from '@/components/Confetti'; fireConfetti()
const COLORS = ['#003DA6', '#ffd700', '#e74c3c', '#2ecc71', '#9b59b6', '#ff8c00']

export function fireConfetti(x?: number, y?: number) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const originX = x ?? window.innerWidth / 2
  const originY = y ?? window.innerHeight / 3
  const count = 24
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.className = 'confetti-piece'
    const size = 6 + Math.random() * 6
    el.style.left = `${originX + (Math.random() - 0.5) * 80}px`
    el.style.top = `${originY}px`
    el.style.width = `${size}px`
    el.style.height = `${size * 0.4}px`
    el.style.background = COLORS[i % COLORS.length]
    el.style.borderRadius = '2px'
    el.style.transform = `rotate(${(Math.random() - 0.5) * 300}deg)`
    el.style.animationDelay = `${Math.random() * 0.15}s`
    document.body.appendChild(el)
    const cleanup = () => el.remove()
    el.addEventListener('animationend', cleanup)
    setTimeout(cleanup, 2000)
  }
}
