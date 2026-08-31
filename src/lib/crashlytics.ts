import { registerPlugin } from '@capacitor/core'

interface FirebaseCrashlyticsPlugin {
  crash(options: { message: string }): Promise<void>
  recordException(options: { message: string; stacktrace?: unknown[] }): Promise<void>
  setUserId(options: { userId: string }): Promise<void>
  log(options: { message: string }): Promise<void>
}

// Le nom doit correspondre exactement à @CapacitorPlugin(name = "FirebaseCrashlytics")
// côté natif (@capacitor-firebase/crashlytics) — 'FirebaseCrashlyticsPlugin' ne
// résolvait aucun plugin, donc recordException/setUserId échouaient silencieusement
// (chaque appel est wrappé en .catch(() => {})) et Crashlytics n'a jamais rien reçu.
const FirebaseCrashlytics = registerPlugin<FirebaseCrashlyticsPlugin>('FirebaseCrashlytics')

// DESACTIVE (31/08) : le premier appel natif (setUserId, juste apres connexion)
// plante tout le process Android sans passer par le .catch() JS -- meme avec
// isPluginAvailable() en garde (donc le plugin EST enregistre, il plante a
// l'interieur de l'appel natif lui-meme, probablement un souci d'init cote
// SDK/config Firebase). La connexion passe avant le monitoring de crash : on
// coupe l'appel natif entierement jusqu'a verification separee de la config
// Crashlytics cote console Firebase.
function pluginReady() {
  return false
}

export function recordJsError(error: unknown, context?: string) {
  if (!pluginReady()) return
  const message = context ? `${context}: ${errorMessage(error)}` : errorMessage(error)
  FirebaseCrashlytics.recordException({ message }).catch(() => {})
}

export function setCrashlyticsUserId(userId: string | null) {
  if (!pluginReady()) return
  FirebaseCrashlytics.setUserId({ userId: userId || '' }).catch(() => {})
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}
