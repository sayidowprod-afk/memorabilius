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
    // captureInput:true bascule la WebView sur un BaseInputConnection minimal
    // (CapacitorWebView.java) qui ne supporte ni la correction automatique ni
    // la suppression arriere normale au clavier tactile -- reserve aux
    // claviers physiques/Chromebooks, pas a l'usage telephone standard.
    // Signale : pas de correcteur, backspace peu fiable dans les formulaires.
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
}

export default config
