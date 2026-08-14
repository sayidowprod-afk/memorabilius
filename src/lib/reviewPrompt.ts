import { Capacitor } from '@capacitor/core'

const KEY = 'review-prompted-at'
// On ne redemande pas avant ce délai, même si l'utilisateur ré-atteint un palier
// (l'API Play elle-même limite déjà la fréquence réelle d'affichage du popup).
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 90 // 90 jours

export async function maybePromptReview() {
  if (!Capacitor.isNativePlatform()) return
  if (typeof window === 'undefined') return
  const last = Number(localStorage.getItem(KEY) || 0)
  if (Date.now() - last < COOLDOWN_MS) return
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
    localStorage.setItem(KEY, String(Date.now()))
  } catch {}
}
