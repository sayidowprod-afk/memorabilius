// Mode hors ligne de l'app NATIVE (Android) -- en bêta, désactivé par défaut.
// Sur le web/PWA le service worker est toujours actif ; dans l'app native il
// ne l'est que si l'utilisateur l'a activé ici. Raison : l'app charge le site
// en direct, donc un défaut du service worker toucherait tous les utilisateurs
// d'un coup, et un ancien cache-first avait déjà gelé l'app sur certains
// appareils. En opt-in, seuls les appareils qui l'ont choisi sont concernés.
const KEY = 'native_offline_mode'

export function isNativeOfflineEnabled(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export async function enableNativeOffline(): Promise<void> {
  localStorage.setItem(KEY, '1')
  await navigator.serviceWorker.register('/sw.js')
}

// Retour arrière complet : désenregistre le service worker et vide ses caches.
export async function disableNativeOffline(): Promise<void> {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  const regs = await navigator.serviceWorker.getRegistrations()
  await Promise.all(regs.map(r => r.unregister()))
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
}
