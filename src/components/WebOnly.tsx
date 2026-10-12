'use client'
import { useIsAppUI } from '@/lib/useIsNative'

export default function WebOnly({ children }: { children: React.ReactNode }) {
  const isApp = useIsAppUI()
  if (isApp) return null
  return <>{children}</>
}
