import { Capacitor, registerPlugin } from '@capacitor/core'

interface FirebaseCrashlyticsPlugin {
  crash(options: { message: string }): Promise<void>
  recordException(options: { message: string; stacktrace?: unknown[] }): Promise<void>
  setUserId(options: { userId: string }): Promise<void>
  log(options: { message: string }): Promise<void>
}

const FirebaseCrashlytics = registerPlugin<FirebaseCrashlyticsPlugin>('FirebaseCrashlyticsPlugin')

// Aucun rapport natif ne couvrait le JS (le layer web n'a que Vercel Analytics, qui ne
// voit rien de ce qui casse dans la WebView de l'app). Toute erreur JS non interceptée
// remonte maintenant dans Firebase Crashlytics comme "non-fatal", avec le message et la
// pile d'appel — mêmes crashes visibles côté natif et côté web dans un seul dashboard.
export function recordJsError(error: unknown, context?: string) {
  if (!Capacitor.isNativePlatform()) return
  const message = context ? `${context}: ${errorMessage(error)}` : errorMessage(error)
  FirebaseCrashlytics.recordException({ message }).catch(() => {})
}

export function setCrashlyticsUserId(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return
  FirebaseCrashlytics.setUserId({ userId: userId || '' }).catch(() => {})
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}
