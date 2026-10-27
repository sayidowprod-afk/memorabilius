// Mode hors ligne : à appeler à la déconnexion. Demande au service worker
// d'effacer les lectures Supabase gardées pour l'utilisateur (appareil
// partagé : le compte suivant ne doit rien retrouver). Sans effet s'il n'y
// a pas de service worker (app native, navigateur sans SW).
export function clearOfflineUserData() {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_DATA' })
  } catch { /* pas de SW : rien à purger */ }
}
