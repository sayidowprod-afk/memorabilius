import { registerPlugin, Capacitor } from '@capacitor/core'

// Contourne un bug du coeur de Capacitor qui plante/bloque
// checkPermissions()/requestPermissions() sur les plugins officiels
// (LocalNotifications, PushNotifications) -- voir NotificationPermissionPlugin.java
// cote natif. Cette permission est partagee par les deux (une seule permission
// Android POST_NOTIFICATIONS derriere), donc un seul pont suffit pour les deux.
interface NotificationPermissionBridgePlugin {
  check(): Promise<{ receive: 'granted' | 'denied' }>
  request(): Promise<{ receive: 'granted' | 'denied' }>
}

const NotificationPermissionBridge = registerPlugin<NotificationPermissionBridgePlugin>('NotificationPermissionBridge')

export async function checkNotificationPermission(): Promise<'granted' | 'denied'> {
  if (!Capacitor.isNativePlatform()) return 'denied'
  const { receive } = await NotificationPermissionBridge.check()
  return receive
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (!Capacitor.isNativePlatform()) return 'denied'
  const { receive } = await NotificationPermissionBridge.request()
  return receive
}
