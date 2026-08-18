'use client'
import { useEffect } from 'react'
import { recordJsError } from '@/lib/crashlytics'

// À chaque déploiement, les fichiers _next/static/<buildId>/... changent. Un onglet
// (ou l'app native, qui charge le même site) resté ouvert PENDANT un déploiement garde
// en mémoire des références vers l'ancien buildId. Le prochain clic qui déclenche un
// chargement de chunk (navigation, import() dynamique, RSC fetch) échoue silencieusement
// contre ces anciennes URLs — rien ne se passe, jusqu'à ce que l'utilisateur fasse F5
// (qui recharge une page fraîche avec les bonnes références). C'est la cause probable du
// "faut souvent rafraîchir" — vu aussi bien sur PC que dans l'app, donc pas lié au natif.
// On ne peut pas empêcher ça (on déploie trop souvent), seulement le rendre invisible :
// détecter l'échec et recharger tout seul au lieu de laisser l'interface morte.
const CHUNK_ERROR_PATTERN = /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|error loading dynamically imported module/i

function reloadOnce() {
  const key = 'chunk-error-reload-at'
  const last = Number(sessionStorage.getItem(key) || 0)
  // Garde-fou : si le rechargement lui-même retombe sur une erreur de chunk (CDN en
  // panne, pas juste un déploiement), ne pas boucler à l'infini.
  if (Date.now() - last < 10000) return
  sessionStorage.setItem(key, String(Date.now()))
  window.location.reload()
}

export default function ChunkErrorReload() {
  useEffect(() => {
    // Autant profiter de ces écouteurs globaux pour faire remonter TOUTE erreur JS non
    // interceptée dans Crashlytics (pas seulement les erreurs de chunk) — c'est la seule
    // visibilité qu'on a sur ce qui casse réellement dans la WebView en production.
    const onError = (event: ErrorEvent) => {
      recordJsError(event.error || event.message, 'window.onerror')
      if (CHUNK_ERROR_PATTERN.test(event.message || '')) reloadOnce()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || '')
      recordJsError(event.reason, 'unhandledrejection')
      if (CHUNK_ERROR_PATTERN.test(msg)) reloadOnce()
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
