// Mémoire de la position de défilement d'une liste (galerie, annuaire…), gardée sur l'appareil.
// - retour arrière (bouton Précédent) : la liste retrouve sa place ;
// - nouvelle visite : la galerie peut proposer « Reprendre où tu t'étais arrêté ».
const PREFIX = 'mb_scroll_'

export type ScrollMemo = { y: number; at: number; n?: number; card?: string }

export function saveScroll(key: string, extra: { n?: number; card?: string } = {}) {
  try {
    const y = Math.round(window.scrollY)
    if (y < 50) return // pas d'écriture au sommet : le changement de page remet le défilement à zéro avant le nettoyage
    localStorage.setItem(PREFIX + key, JSON.stringify({ y, at: Date.now(), ...extra }))
  } catch { /* stockage indisponible */ }
}

export function readScroll(key: string): ScrollMemo | null {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIX + key) || 'null')
    return v && typeof v.y === 'number' && typeof v.at === 'number' ? v : null
  } catch { return null }
}

export function clearScroll(key: string) {
  try { localStorage.removeItem(PREFIX + key) } catch { /* rien */ }
}

// Le bouton Précédent / Suivant du navigateur (popstate) vient-il d'être utilisé ? (écouteur posé une seule fois, au chargement de l'app)
let lastPop = 0
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { lastPop = Date.now() })
export const arrivedByBack = () => Date.now() - lastPop < 4000

// Remet la page à la position voulue, en réessayant le temps que le contenu (chargé après coup) soit assez haut.
export function scrollToWhenReady(y: number, tries = 24) {
  let n = 0
  const go = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (max >= y - 4 || n >= tries) { window.scrollTo({ top: Math.min(y, Math.max(0, max)), behavior: 'auto' }); return }
    n++; window.setTimeout(go, 120)
  }
  go()
}
