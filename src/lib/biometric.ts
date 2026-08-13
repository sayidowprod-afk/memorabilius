import { Capacitor } from '@capacitor/core'

const SERVER = 'memorabilius.fr'
const SAVED_FLAG = 'biometric_credentials_saved'
const DISMISSED_FLAG = 'biometric_prompt_dismissed'

export function hasSavedBiometricCredentials() {
  return typeof window !== 'undefined' && localStorage.getItem(SAVED_FLAG) === '1'
}

export function wasBiometricPromptDismissed() {
  return typeof window !== 'undefined' && localStorage.getItem(DISMISSED_FLAG) === '1'
}

export function dismissBiometricPrompt() {
  localStorage.setItem(DISMISSED_FLAG, '1')
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

export async function saveBiometricCredentials(username: string, password: string) {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.setCredentials({ username, password, server: SERVER })
  localStorage.setItem(SAVED_FLAG, '1')
}

export async function loginWithBiometric(): Promise<{ username: string; password: string } | null> {
  const { NativeBiometric } = await import('capacitor-native-biometric')
  await NativeBiometric.verifyIdentity({
    reason: 'Connexion à Memorabilius',
    title: 'Connexion biométrique',
  })
  const creds = await NativeBiometric.getCredentials({ server: SERVER })
  return { username: creds.username, password: creds.password }
}

export async function clearBiometricCredentials() {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric')
    await NativeBiometric.deleteCredentials({ server: SERVER })
  } catch {}
  localStorage.removeItem(SAVED_FLAG)
}
