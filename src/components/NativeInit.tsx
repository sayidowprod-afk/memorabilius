'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsNative } from '@/lib/useIsNative'

export default function NativeInit() {
  const isNative = useIsNative()
  const router = useRouter()

  useEffect(() => {
    if (!isNative) return
    document.body.classList.add('native-app')
    document.documentElement.style.overscrollBehaviorY = 'none'

    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setBackgroundColor({ color: '#003DA6' }).catch(() => {})
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
    }).catch(() => {})

    import('@capacitor/keyboard').then(({ Keyboard, KeyboardResize }) => {
      Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {})
    }).catch(() => {})

    // Deep linking (App Links) — memorabilius.fr/... ouvert depuis une autre app
    // doit naviguer dans le SPA plutôt que recharger toute la WebView.
    const goToPath = (url: string) => {
      try {
        const u = new URL(url)
        const path = u.pathname + u.search
        if (path && path !== window.location.pathname + window.location.search) {
          router.push(path)
        }
      } catch {}
    }

    let removeListener: (() => void) | undefined
    import('@capacitor/app').then(async ({ App }) => {
      const launch = await App.getLaunchUrl().catch(() => null)
      if (launch?.url) goToPath(launch.url)

      const listener = await App.addListener('appUrlOpen', (data) => goToPath(data.url))
      removeListener = () => listener.remove()
    }).catch(() => {})

    return () => {
      document.body.classList.remove('native-app')
      document.documentElement.style.overscrollBehaviorY = ''
      removeListener?.()
    }
  }, [isNative, router])

  return null
}
