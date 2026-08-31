import { Capacitor } from '@capacitor/core'
import { checkNotificationPermission, requestNotificationPermission } from './notificationPermission'

// IDs fixes réutilisés pour remplacer/annuler un rappel existant plutôt que d'en empiler.
export const REMINDER_IDS = {
  monthlyWrap: 9001,
  pendingTrades: 9002,
  wishlistNudge: 9003,
} as const

async function ensurePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    // Passe par le pont natif custom (voir notificationPermission.ts) --
    // LocalNotifications.checkPermissions()/requestPermissions() plantent tout
    // le process natif (bug du coeur de Capacitor confirme sur appareil reel).
    const state = await checkNotificationPermission()
    if (state === 'granted') return true
    return (await requestNotificationPermission()) === 'granted'
  } catch {
    return false
  }
}

// Rappel mensuel récurrent : le wrap du mois est prêt à consulter
export async function scheduleMonthlyWrapReminder() {
  if (!(await ensurePermission())) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_IDS.monthlyWrap,
        title: 'Ton wrap du mois est prêt 📊',
        body: 'Découvre le récap de ta collection ce mois-ci.',
        schedule: { on: { day: 2, hour: 10, minute: 0 }, allowWhileIdle: true },
        extra: { url: '/profil#wrap-telecharger' },
      }],
    })
  } catch {}
}

// Rappel ponctuel : offres d'échange en attente de réponse (reprogrammé/annulé à
// chaque ouverture de l'app selon l'état réel — ne se déclenche donc que si
// l'utilisateur n'a pas rouvert l'app entre-temps).
export async function syncPendingTradesReminder(hasPending: boolean) {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if (!hasPending) {
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_IDS.pendingTrades }] })
      return
    }
    if (!(await ensurePermission())) return
    const at = new Date(Date.now() + 1000 * 60 * 60 * 48)
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_IDS.pendingTrades,
        title: "Offre d'échange en attente 🔄",
        body: "Tu as une offre d'échange qui attend ta réponse.",
        schedule: { at, allowWhileIdle: true },
        extra: { url: '/trades' },
      }],
    })
  } catch {}
}

// Nudge "reviens voir ta wishlist" : repoussé à chaque ouverture de l'app,
// ne se déclenche donc que si l'utilisateur n'est pas revenu depuis 14 jours.
export async function scheduleWishlistNudge() {
  if (!(await ensurePermission())) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_IDS.wishlistNudge,
        title: 'Des news de ta wishlist ? 🔍',
        body: 'Reviens vérifier si de nouvelles cartes correspondent à tes recherches.',
        schedule: { at, allowWhileIdle: true },
        extra: { url: '/profil' },
      }],
    })
  } catch {}
}
