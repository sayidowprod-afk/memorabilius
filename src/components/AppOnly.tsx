'use client'
import { useIsAppUI } from '@/lib/useIsNative'

// Contraire de WebOnly : n'affiche son contenu que dans l'application mobile.
export default function AppOnly({ children }: { children: React.ReactNode }) {
  const isApp = useIsAppUI()
  if (!isApp) return null
  return <>{children}</>
}
