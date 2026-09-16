import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Sans timeout, une requete reseau qui ne repond jamais (ni succes ni erreur --
// connexion coupee sans RST, cas frequent apres une longue veille/cold start)
// reste bloquee indefiniment. GoTrueClient (auth-js) serialise ses appels via
// un verrou interne (_acquireLock/lockAcquired) : tant que l'appel bloque n'a
// ni resolu ni rejete, ce verrou reste tenu pour toujours, et TOUT appel
// Supabase suivant (auth ET requetes .from(), qui lisent le token via ce meme
// client) reste en file derriere ce verrou mort -- y compris les nouvelles
// tentatives et un bouton "Reessayer", qui ne font qu'ajouter d'autres appels
// bloques a la meme file. Seul un rechargement complet (nouveau client JS,
// donc nouveau verrou) debloquait la situation -- c'est le "bug du F5"
// signale depuis des mois, reproductible sur web ET app. Un timeout dur sur
// le fetch sous-jacent garantit qu'un appel bloque finit toujours par
// echouer proprement, liberant le verrou et laissant les tentatives
// suivantes aboutir normalement.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)
  init?.signal?.addEventListener('abort', () => controller.abort())
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: { fetch: fetchWithTimeout },
})
