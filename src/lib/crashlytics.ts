import { Capacitor, registerPlugin } from '@capacitor/core'

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

// Aucun rapport natif ne couvrait le JS (le layer web n'a que Vercel Analytics, qui ne
// voit rien de ce qui casse dans la WebView de l'app). Toute erreur JS non interceptée
// remonte maintenant dans Firebase Crashlytics comme "non-fatal", avec le message et la
// pile d'appel — mêmes crashes visibles côté natif et côté web dans un seul dashboard.
// isPluginAvailable() vérifie juste que le plugin est enregistré côté JS --
// insuffisant si le SDK natif Firebase Crashlytics est mal initialisé côté
// Android (ex: Crashlytics pas activé dans la console Firebase), auquel cas
// le premier appel natif peut planter tout le process avant même de retourner
// une promesse (le .catch() JS ne protège que contre un rejet normal, pas un
// crash natif). On vérifie quand même isPluginAvailable en amont : ça évite
// l'appel dans les cas où le plugin n'est pas enregistré du tout, la cause la
// plus fréquente de ce genre de crash au tout premier appel.
function pluginReady() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseCrashlytics')
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
