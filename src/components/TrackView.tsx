'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function TrackView() {
  const path = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (path === last.current) return
    last.current = path
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    }).catch(() => {})
  }, [path])

  return null
}
