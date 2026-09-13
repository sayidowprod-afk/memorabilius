'use client'
import { useEffect } from 'react'

declare global {
  interface Window {
    __memAppMounted?: boolean
  }
}

// Filet de secours pour le "page blanche/bloquée au lancement" signalé de façon
// recurrente (web ET natif) sans erreur JS catchable (donc invisible a
// ChunkErrorReload, qui ne reagit qu'a des erreurs/rejections explicites) --
// probablement un fetch/promise qui reste en attente indefiniment (reseau pas
// stabilise au cold start, requete Supabase qui ne resout jamais...). Plutot
// que traquer la cause exacte (pas reproductible a la demande), on detecte le
// symptome directement : si ce composant n'a pas fini son premier montage React
// dans les 9s (script inline poste dans <head>, tourne avant meme l'hydratation),
// l'app est consideree bloquee et on force un reload. Meme pattern de cooldown
// sessionStorage que NativeInit/ChunkErrorReload pour ne jamais boucler.
export default function HangWatchdog() {
  useEffect(() => {
    if (typeof window !== 'undefined') window.__memAppMounted = true
  }, [])
  return null
}
