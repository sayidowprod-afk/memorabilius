import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'fr.memorabilius.app',
  appName: 'Memorabilius',
  webDir: 'android-web',
  server: {
    // L'app charge directement le site en production
    // → les mises à jour du site sont automatiquement reflétées dans l'app
    url: 'https://www.memorabilius.fr',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
}

export default config
