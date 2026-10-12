'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'

// Contexte partage plutot que useState+useEffect local a chaque appelant --
// 21 composants appellent useIsNative() independamment (dont GalerieClient.tsx
// et BinderLibrary.tsx, tous deux tres volumineux), chacun causant son propre
// re-render au montage sur natif (false -> true, apres hydratation). Calcule
// une seule fois ici et partage via contexte : 1 re-render au lieu de 21.
const NativeContext = createContext(false)
// « Interface app » (barre du haut/bas, accueil tableau de bord, tirer-pour-rafraichir...) : vraie dans l'app native ET dans la PWA installee sur
// l'ecran d'accueil d'un telephone Android / iPhone / iPad. Distincte de isNative, qui reste reserve aux plugins Capacitor (haptique, push, camera...).
const AppUIContext = createContext(false)

function detectAppUI(native: boolean): boolean {
  if (native) return true
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ua = navigator.userAgent
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return standalone && mobile
}

export function NativeProvider({ children }: { children: ReactNode }) {
  const [isNative, setIsNative] = useState(false)
  const [isApp, setIsApp] = useState(false)
  useEffect(() => {
    const native = Capacitor.isNativePlatform()
    setIsNative(native)
    const app = detectAppUI(native)
    setIsApp(app)
    // PWA installee : le systeme gere deja la zone de securite (env(safe-area-inset-bottom) sur iPhone), pas besoin du minimum de 56 px prevu pour la navigation 3 boutons d'Android
    if (app && !native) document.documentElement.style.setProperty('--nav-min-bottom', '12px')
  }, [])
  return (
    <NativeContext.Provider value={isNative}>
      <AppUIContext.Provider value={isApp}>{children}</AppUIContext.Provider>
    </NativeContext.Provider>
  )
}

export function useIsNative() {
  return useContext(NativeContext)
}

export function useIsAppUI() {
  return useContext(AppUIContext)
}
