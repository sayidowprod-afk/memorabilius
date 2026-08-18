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
    // onAuthStateChange fires INITIAL_SESSION immediately with the session from
    // localStorage — this warms the Supabase in-memory cache before any child
    // component calls getSession(), preventing the race condition that requires F5.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false })
      setCrashlyticsUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
