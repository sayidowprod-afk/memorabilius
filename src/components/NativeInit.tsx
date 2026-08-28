'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useIsNative } from '@/lib/useIsNative'
import { supabase } from '@/lib/supabase'
import { fetchPendingShare, stagePendingShare } from '@/lib/shareBridge'

// Compare le SHA inline au build du bundle deja charge (NEXT_PUBLIC_APP_VERSION,
// fige au moment du build) au SHA actuel du serveur (/api/app-version, jamais
// mis en cache) -- si un nouveau deploy a eu lieu, un reload "doux"
// (router.refresh()) ne rattrape rien : le JS deja en memoire reste l'ancien
// bundle, et ses appels au nouveau serveur peuvent echouer silencieusement
// (payload RSC incompatible, chunk supprime...). D'ou le besoin de F5 manuel
// signale de facon recurrente -- un vrai reload complet resout ca proprement.
async function reloadIfStale(): Promise<boolean> {
  try {
    const r = await fetch('/api/app-version', { cache: 'no-store' })
    const { version } = await r.json()
    if (version && version !== process.env.NEXT_PUBLIC_APP_VERSION) {
      window.location.reload()
      return true
    }
  } catch {}
  return false
}

export default function NativeInit() {
  const isNative = useIsNative()
  const router = useRouter()
  const backgroundedAt = useRef<number | null>(null)

  useEffect(() => {
    if (!isNative) return
    document.body.classList.add('native-app')
    document.documentElement.style.overscrollBehaviorY = 'none'

    // Cold start : verifie tout de suite si le bundle qui vient de se charger
    // est deja perime (deploy survenu juste avant l'ouverture de l'app).
    reloadIfStale()

    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      // setBackgroundColor() est depreciee sur Android 15+ (API 35, edge-to-edge
      // impose par l'OS) -- overlay:true laisse la WebView dessiner sous la barre
      // de statut, et le fond bleu vient desormais du CSS (MobileTopBar/
      // MobileBottomNav), qui pad deja sur env(safe-area-inset-top/bottom).
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
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

    // Partage reçu d'une autre app (texte/image), éventuellement ciblé sur un contact
    // précis si lancé depuis un raccourci Partage direct — voir ShareBridgePlugin.java.
    const checkPendingShare = async () => {
      const share = await fetchPendingShare()
      if (!share) return
      stagePendingShare(share)
      router.push(share.toUserId ? `/messages?to=${share.toUserId}` : '/messages')
    }
    checkPendingShare()

    // Resynchronisation au retour au premier plan — le WebView Android gèle les
    // timers JS quand l'app est en arrière-plan (le auto-refresh du token Supabase
    // ne tourne plus), donc au retour la session peut être expirée et les données
    // affichées obsolètes tant que rien ne force une resynchro. C'est la cause
    // probable du "il faut faire F5 pour que ça marche" au retour dans l'app.
    const onVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        backgroundedAt.current = Date.now()
        return
      }
      const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
      backgroundedAt.current = null
      if (awayMs > 30 * 60 * 1000) {
        // Longue absence : session potentiellement expirée pour de bon, on repart propre.
        window.location.reload()
        return
      }
      if (awayMs > 5000) {
        // Un deploy pendant l'absence rend router.refresh() insuffisant (bundle
        // JS perime) -- verifie d'abord, et ne fait le refresh "doux" que si le
        // bundle est toujours a jour.
        if (await reloadIfStale()) return
        // Retour rapide : force le refresh du token si besoin + revalide les données de la page.
        supabase.auth.getSession()
        router.refresh()
      }
      checkPendingShare()
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
