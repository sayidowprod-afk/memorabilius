'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'

// Contexte partage plutot que useState+useEffect local a chaque appelant --
// 21 composants appellent useIsNative() independamment (dont GalerieClient.tsx
// et BinderLibrary.tsx, tous deux tres volumineux), chacun causant son propre
// re-render au montage sur natif (false -> true, apres hydratation). Calcule
// une seule fois ici et partage via contexte : 1 re-render au lieu de 21.
const NativeContext = createContext(false)

export function NativeProvider({ children }: { children: ReactNode }) {
  const [isNative, setIsNative] = useState(false)
  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform())
  }, [])
  return <NativeContext.Provider value={isNative}>{children}</NativeContext.Provider>
}

export function useIsNative() {
  return useContext(NativeContext)
}
