'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/**
 * Vérifie la session depuis localStorage (pas de réseau) avant de rediriger.
 * getSession() est plus fiable que getUser() pour les checks initiaux car il
 * ne dépend pas d'un appel réseau qui peut échouer et provoquer une fausse déconnexion.
 */
export function useRequireAuth(): { user: User | null; loading: boolean } {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/connexion')
        return
      }
      setUser(session.user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/connexion')
        return
      }
      setUser(session.user)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [router])

  return { user, loading }
}
