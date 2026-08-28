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
    //
    // getSession() lit le même client Supabase sous-jacent que onAuthStateChange --
    // si son initialisation interne (lecture/validation du token persisté) n'est
    // simplement pas encore terminée à ce moment (pas juste "l'événement n'a pas
    // encore été émis"), getSession() peut lui aussi répondre session:null de façon
    // prématurée, avant même d'avoir eu le temps de lire le vrai token. Sans second
    // essai, ça se traduisait par "comme si je n'étais pas connecté" jusqu'à un
    // rechargement manuel -- un seul essai retardé supplémentaire absorbe ce cas
    // sans boucler indéfiniment.
    const getSessionWithTimeout = (ms: number) => Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null } }>(resolve => setTimeout(() => resolve({ data: { session: null } }), ms)),
    ])

    const timeoutId = setTimeout(async () => {
      if (settled) return
      let session: Session | null = null
      try {
        session = (await getSessionWithTimeout(3000)).data.session
        if (!session) {
          // Repli prématuré possible -- un seul nouvel essai après un court délai
          // avant d'accepter definitivement l'etat deconnecte.
          await new Promise(r => setTimeout(r, 900))
          if (settled) return
          session = (await getSessionWithTimeout(3000)).data.session
        }
      } catch {}
      if (settled) return
      settled = true
      setState({ session, user: session?.user ?? null, loading: false })
      setCrashlyticsUserId(session?.user?.id ?? null)
    }, 2500)

    return () => { subscription.unsubscribe(); clearTimeout(timeoutId) }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
