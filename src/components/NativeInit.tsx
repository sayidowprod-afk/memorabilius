'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsNative } from '@/lib/useIsNative'
import { supabase } from '@/lib/supabase'

export default function NativeInit() {
  const isNative = useIsNative()
  const router = useRouter()
  const backgroundedAt = useRef<number | null>(null)

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

    // Resynchronisation au retour au premier plan — le WebView Android gèle les
    // timers JS quand l'app est en arrière-plan (le auto-refresh du token Supabase
    // ne tourne plus), donc au retour la session peut être expirée et les données
    // affichées obsolètes tant que rien ne force une resynchro. C'est la cause
    // probable du "il faut faire F5 pour que ça marche" au retour dans l'app.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundedAt.current = Date.now()
        return
      }
      const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
      backgroundedAt.current = null
      if (awayMs > 30 * 60 * 1000) {
        // Longue absence : session potentiellement expirée pour de bon, on repart propre.
        window.location.reload()
      } else if (awayMs > 5000) {
        // Retour rapide : force le refresh du token si besoin + revalide les données de la page.
        supabase.auth.getSession()
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    let removeListener: (() => void) | undefined
    let removeStateListener: (() => void) | undefined
    import('@capacitor/app').then(async ({ App }) => {
      const launch = await App.getLaunchUrl().catch(() => null)
      if (launch?.url) goToPath(launch.url)

      const listener = await App.addListener('appUrlOpen', (data) => goToPath(data.url))
      removeListener = () => listener.remove()

      // Filet de sécurité en plus de visibilitychange : certains OEM Android ne
      // déclenchent pas toujours l'événement de visibilité de façon fiable, mais
      // appStateChange (spécifique Capacitor) est plus constant sur le cycle de vie natif.
      const stateListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) { backgroundedAt.current = Date.now(); return }
        onVisibilityChange()
      })
      removeStateListener = () => stateListener.remove()
    }).catch(() => {})

    return () => {
      document.body.classList.remove('native-app')
      document.documentElement.style.overscrollBehaviorY = ''
      document.removeEventListener('visibilitychange', onVisibilityChange)
      removeListener?.()
      removeStateListener?.()
    }
  }, [isNative, router])

  return null
}
