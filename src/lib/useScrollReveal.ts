import { useRef } from 'react'

// Ajoute .scroll-reveal (voir globals.css) pour un fondu-enchaine + translateY
// au montage. Purement CSS -- ne depend d'aucun IntersectionObserver/timer JS
// (une version anterieure basee sur IntersectionObserver + setTimeout de secours
// pouvait rester bloquee a opacity:0 indefiniment dans un contexte throttle :
// app native, PWA, onglet en arriere-plan -- l'observer et le timer ne se
// declenchaient jamais, rendant le Grail Wall / la grille de cartes invisibles).
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  return { ref, className: 'scroll-reveal' }
}
