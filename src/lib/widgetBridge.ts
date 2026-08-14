import { Capacitor, registerPlugin } from '@capacitor/core'

interface WidgetBridgePlugin {
  updateGalleryWidget(options: {
    imageUrl: string
    playerName: string
    totalCards: number
    galleryUrl: string
  }): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

export async function updateGalleryWidget(opts: {
  imageUrl: string
  playerName: string
  totalCards: number
  galleryUrl: string
}) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await WidgetBridge.updateGalleryWidget(opts)
  } catch {}
}
