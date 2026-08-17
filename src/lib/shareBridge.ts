import { Capacitor, registerPlugin } from '@capacitor/core'

export interface PendingShare {
  text?: string
  imagePath?: string
  toUserId?: string
}

interface ShareBridgePluginType {
  getPendingShare(): Promise<PendingShare>
  updateShareTargets(options: { contacts: { id: string; name: string; avatarUrl?: string }[] }): Promise<void>
}

const ShareBridge = registerPlugin<ShareBridgePluginType>('ShareBridge')

const STAGED_KEY = 'memorabilius-pending-share'

// Récupère un éventuel partage reçu d'une autre app (texte/image, + le contact visé si
// lancé depuis un raccourci Partage direct), et le convertit en une image directement
// affichable par la WebView (le chemin natif brut ne l'est pas — origine différente).
export async function fetchPendingShare(): Promise<PendingShare | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const result = await ShareBridge.getPendingShare()
    if (!result.text && !result.imagePath) return null
    return {
      ...result,
      imagePath: result.imagePath ? Capacitor.convertFileSrc(result.imagePath) : undefined,
    }
  } catch {
    return null
  }
}

export function stagePendingShare(share: PendingShare) {
  try { sessionStorage.setItem(STAGED_KEY, JSON.stringify(share)) } catch {}
}

// Consommé une seule fois — la page Messages l'appelle au montage puis l'utilise.
export function takeStagedShare(): PendingShare | null {
  try {
    const raw = sessionStorage.getItem(STAGED_KEY)
    if (!raw) return null
    sessionStorage.removeItem(STAGED_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function updateShareTargets(contacts: { id: string; name: string; avatarUrl?: string }[]) {
  if (!Capacitor.isNativePlatform()) return
  try { await ShareBridge.updateShareTargets({ contacts }) } catch {}
}
