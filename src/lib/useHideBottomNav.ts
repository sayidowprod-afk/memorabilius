'use client'
import { useEffect } from 'react'

// Vue plein ecran (recadrage de photo, scanner...) : la barre du bas de l'app (zIndex 99999) se dessinait par-dessus les boutons de validation du bas.
// Tant que `active` est vrai, la classe modal-fullscreen-active est posee sur <body> (voir globals.css) et la barre est masquee.
// Compteur : plusieurs vues ouvertes en meme temps ne se retirent pas la classe l'une a l'autre.
let count = 0
export function useHideBottomNav(active: boolean) {
  useEffect(() => {
    if (!active) return
    count++
    document.body.classList.add('modal-fullscreen-active')
    return () => {
      count = Math.max(0, count - 1)
      if (count === 0) document.body.classList.remove('modal-fullscreen-active')
    }
  }, [active])
}
