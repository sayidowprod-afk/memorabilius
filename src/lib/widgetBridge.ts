import { Capacitor, registerPlugin } from '@capacitor/core'

interface WidgetGalleryOptions {
  imageUrl: string
  playerName: string
  totalCards: number
  galleryUrl: string
  team?: string
  year?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
}

interface WidgetBridgePlugin {
  updateGalleryWidget(options: WidgetGalleryOptions): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

export async function updateGalleryWidget(opts: WidgetGalleryOptions) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await WidgetBridge.updateGalleryWidget(opts)
  } catch {}
}
