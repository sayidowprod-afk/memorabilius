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
    // Filet de securite : certaines WebView (app native, PWA installee) ne
    // declenchent jamais l'observer (viewport/layout pas encore stable au
    // moment de l'observation) -- sans ca l'element reste bloque a opacity:0
    // indefiniment (gros espace vide a la place du contenu).
    const fallback = setTimeout(() => setVisible(true), 1500)
    return () => { observer.disconnect(); clearTimeout(fallback) }
  }, [])

  return { ref, className: `scroll-reveal${visible ? ' scroll-reveal-visible' : ''}` }
}
