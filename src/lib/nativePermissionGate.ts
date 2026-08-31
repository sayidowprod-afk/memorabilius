// Protection contre un crash natif Capacitor confirmé sur au moins un appareil
// réel (adb logcat) : NullPointerException dans com.getcapacitor.d0 (Bridge
// interne) déclenchée par LocalNotifications/PushNotifications.checkPermissions().
// Aucun try/catch JS ne peut intercepter ce crash (il se produit côté natif
// avant qu'une réponse ne puisse remonter au pont JS). Deux hypothèses
// combinées ici :
//   1. Appel trop tôt au cold start, avant que la page/WebView soit
//      complètement chargée -- on attend 'load' + une marge.
//   2. Appels concurrents depuis plusieurs plugins en même temps (rappels
//      locaux + push, tous les deux déclenchés dès qu'un utilisateur est
//      authentifié) -- on les sérialise avec une file d'attente partagée.
let ready: Promise<void> | null = null
let queue: Promise<unknown> = Promise.resolve()

function waitUntilReady(): Promise<void> {
  if (ready) return ready
  ready = new Promise(resolve => {
    const done = () => setTimeout(resolve, 1500)
    if (typeof document !== 'undefined' && document.readyState === 'complete') done()
    else window.addEventListener('load', done, { once: true })
  })
  return ready
}

// Exécute fn() une fois la page chargée, jamais en parallèle d'un autre appel
// passé par cette même file -- fn() doit être l'appel natif lui-même
// (checkPermissions/requestPermissions), pas juste sa préparation.
export function runGatedNativeCall<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    await waitUntilReady()
    return fn()
  }
  const result = queue.then(run, run)
  // Que fn() réussisse ou échoue, la file continue -- une erreur d'un appelant
  // ne doit jamais bloquer les suivants.
  queue = result.catch(() => {})
  return result
}
