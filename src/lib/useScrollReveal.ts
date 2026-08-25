import { useEffect, useRef, useState } from 'react'

// Ajoute .scroll-reveal-visible (voir globals.css) des qu'un element entre dans
// le viewport, pour un fade-in + translateY au lieu d'un apparition instantanee.
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, className: `scroll-reveal${visible ? ' scroll-reveal-visible' : ''}` }
}
