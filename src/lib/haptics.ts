import { Capacitor } from '@capacitor/core'

const KEY = 'haptics-enabled'

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(KEY) !== 'false'
}

export function setHapticsEnabled(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? 'true' : 'false')
}

export async function hapticTap() {
  if (!Capacitor.isNativePlatform()) return
  if (!isHapticsEnabled()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {}
}
