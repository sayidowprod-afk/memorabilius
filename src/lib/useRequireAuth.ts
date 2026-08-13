'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'
import type { User } from '@supabase/supabase-js'

export function useRequireAuth(): { user: User | null; loading: boolean } {
  const router = useRouter()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) router.replace('/connexion')
  }, [loading, user, router])

  return { user, loading }
}
