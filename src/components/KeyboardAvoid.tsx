'use client'
import { useEffect } from 'react'

// 291 · Clavier mobile : quand on touche un champ, la page défile toute seule pour qu'il ne soit pas recouvert par le clavier.
// Ne touche ni aux champs fixés en bas d'écran (messagerie) ni aux appareils sans clavier à l'écran.
export default function KeyboardAvoid() {
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return
    const inFixed = (el: Element | null) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true } return false }
    let timer: number | undefined
    const reveal = (el: HTMLElement) => {
      const vv = window.visualViewport
      const viewH = vv ? vv.height : window.innerHeight
      const r = el.getBoundingClientRect()
      // on garde de la marge : une barre d'action fixe en bas (Enregistrer…) ou la barre du haut ne doivent pas non plus le recouvrir
      if (r.bottom > viewH - 72 || r.top < 64) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null
      if (!el?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]), textarea, select')) return
      if (el.closest('[data-no-kbd]') || inFixed(el)) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => reveal(el), 320) // le clavier met un instant à s'ouvrir
      const vv = window.visualViewport
      if (vv) { const once = () => { vv.removeEventListener('resize', once); window.clearTimeout(timer); timer = window.setTimeout(() => reveal(el), 60) }; vv.addEventListener('resize', once); window.setTimeout(() => vv.removeEventListener('resize', once), 1500) }
    }
    document.addEventListener('focusin', onFocus)
    return () => { document.removeEventListener('focusin', onFocus); window.clearTimeout(timer) }
  }, [])
  return null
}
