'use client'
import { useIsNative } from '@/lib/useIsNative'

export default function WebOnly({ children }: { children: React.ReactNode }) {
  const isNative = useIsNative()
  if (isNative) return null
  return <>{children}</>
}
