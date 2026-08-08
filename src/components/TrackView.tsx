'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function TrackView() {
  const path = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (path === last.current) return
    last.current = path
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        fetch('/api/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, token: session?.access_token }),
        }).catch(() => {})
      })
      .catch(() => {})
  }, [path])

  return null
}
