'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import { setCrashlyticsUserId } from '@/lib/crashlytics'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true })

  useEffect(() => {
    let settled = false

    // onAuthStateChange fires INITIAL_SESSION immediately with the session from
    // localStorage — this warms the Supabase in-memory cache before any child
    // component calls getSession(), preventing the race condition that requires F5.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true
      setState({ session, user: session?.user ?? null, loading: false })
      setCrashlyticsUserId(session?.user?.id ?? null)
    })

    // Filet de sécurité : sur certains cold starts (surtout natif/PWA), l'événement
    // INITIAL_SESSION peut ne jamais arriver (ex: lecture localStorage anormalement
    // lente au tout premier démarrage) -- loading restait alors bloqué à true pour
    // toujours, ce qui faisait par exemple afficher le hero marketing au lieu du
    // dashboard sur NativeHomeGate jusqu'à un F5 manuel. Même filet que GalerieClient
    // (fetchFirstBatch) et NativeHomeDashboard : un appel direct de repli après un
    // court délai plutôt que de dépendre uniquement d'un événement qui peut ne jamais
    // se déclencher.
    const timeoutId = setTimeout(() => {
      if (settled) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (settled) return
        settled = true
        setState({ session, user: session?.user ?? null, loading: false })
        setCrashlyticsUserId(session?.user?.id ?? null)
      }).catch(() => {
        if (settled) return
        settled = true
        setState(s => ({ ...s, loading: false }))
      })
    }, 2500)

    return () => { subscription.unsubscribe(); clearTimeout(timeoutId) }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
