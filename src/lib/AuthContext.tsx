'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import { setCrashlyticsUserId } from '@/lib/crashlytics'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true })

// Clé localStorage par défaut de supabase-js (storageKey non surchargé dans
// supabase.ts) : `sb-<project-ref>-auth-token`, contenant directement l'objet
// Session tel quel (access_token, refresh_token, expires_at, user...).
function readPersistedSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const ref = url ? new URL(url).hostname.split('.')[0] : null
    if (!ref) return null
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.access_token ? (parsed as Session) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Le problème signalé ("je dois presque toujours F5") ne venait pas d'une
  // simple lenteur -- meme le filet de secours (getSession() avec timeout)
  // ne se declenchait pas toujours a temps, et surtout l'UI restait bloquee
  // sur `loading` en attendant une resolution ASYNC (onAuthStateChange ou
  // getSession) qui pouvait ne jamais arriver a temps sur certains cold
  // starts (WebView native en arriere-plan, timers throttles, etc.). Plutot
  // que d'essayer d'accelerer encore cette resolution async, on court-circuite
  // completement l'attente pour le premier rendu : la session persistee est
  // lue directement et SYNCHRONEMENT depuis localStorage dans l'initialiseur
  // de useState (qui s'execute pendant le tout premier rendu, avant meme le
  // premier effet) -- si un token existe, l'utilisateur voit son panel/
  // dashboard immediatement, sans jamais dependre d'une promesse Supabase.
  // onAuthStateChange/getSession continuent de tourner ensuite en arriere-plan
  // pour corriger l'etat (token expire, deconnexion ailleurs, etc.) via
  // setState, mais ne bloquent plus le premier affichage.
  const [state, setState] = useState<AuthState>(() => {
    const session = readPersistedSession()
    return { session, user: session?.user ?? null, loading: !session }
  })
  const router = useRouter()

  useEffect(() => {
    let settled = false

    // onAuthStateChange fires INITIAL_SESSION immediately with the session from
    // localStorage — this warms the Supabase in-memory cache before any child
    // component calls getSession(), preventing the race condition that requires F5.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true
      setState({ session, user: session?.user ?? null, loading: false })
      setCrashlyticsUserId(session?.user?.id ?? null)

      // Un lien de recuperation envoye depuis le dashboard Supabase (bouton
      // admin "Send password recovery") n'a pas de redirectTo personnalise --
      // contrairement a /mot-de-passe-oublie qui pointe explicitement vers
      // /reset-password, il retombe sur l'URL du site par defaut (accueil).
      // L'evenement PASSWORD_RECOVERY se declenche malgre tout ici (le SDK
      // Supabase detecte le hash de recuperation sur N'IMPORTE QUELLE page),
      // donc on rattrape en redirigeant vers /reset-password peu importe ou
      // le lien a atterri, plutot que de devoir configurer Supabase.
      if (_event === 'PASSWORD_RECOVERY' && !window.location.pathname.startsWith('/reset-password')) {
        router.replace('/reset-password')
      }
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

      // Hors-ligne (cold start sans reseau notamment, signale comme "comme
      // deconnecte" -- galerie invisible) : getSession() peut tenter une
      // validation/rafraichissement reseau du token en interne et echouer,
      // ecrasant une session pourtant toujours valide en local par null. On
      // laisse alors plus de temps a onAuthStateChange (lecture localStorage
      // pure, pas de reseau) plutot que de risquer ce faux "deconnecte".
      try {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        if (!status.connected) {
          await new Promise(r => setTimeout(r, 4000))
          if (settled) return
        }
      } catch {}
      if (settled) return

      let session: Session | null = null
      try {
        session = (await getSessionWithTimeout(3000)).data.session
        if (!session) {
          // Repli prématuré possible -- un seul nouvel essai après un court délai
          // avant d'accepter definitivement l'etat deconnecte.
          await new Promise(r => setTimeout(r, 400))
          if (settled) return
          session = (await getSessionWithTimeout(3000)).data.session
        }
      } catch {}
      if (settled) return
      settled = true
      setState({ session, user: session?.user ?? null, loading: false })
      setCrashlyticsUserId(session?.user?.id ?? null)
      // Délai initial raccourci (1200ms, avant 2500ms) : ne change rien au cas
      // rapide/courant (onAuthStateChange court-circuite ce filet via `settled`
      // des qu'il se declenche, quelle que soit la duree de ce delai), mais
      // reduit d'autant l'attente pour le cas signale en prod ou INITIAL_SESSION
      // ne se declenche pas promptement -- l'utilisateur devait presque toujours
      // faire F5 avant que ce filet (qui prenait jusqu'a ~9s au pire cas) n'ait
      // eu le temps de resoudre lui-meme.
    }, 1200)

    return () => { subscription.unsubscribe(); clearTimeout(timeoutId) }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
