import { createClient } from '@supabase/supabase-js'

// Meme protection que fetchWithTimeout dans src/lib/supabase.ts (client
// navigateur), transposee cote serveur : sans timeout, une requete Supabase
// qui ne repond jamais (connexion coupee sans RST, Supabase degrade --
// observe en prod, voir l'incident /galerie/[userId] du 2026-10-24/25 : 5959
// "Task timed out after 300 seconds" en 16h) reste bloquee jusqu'au kill dur
// de la fonction serverless Vercel (300s), au lieu d'echouer vite et de
// laisser la page se degrader proprement.
const fetchWithTimeout = (timeoutMs: number): typeof fetch => (input, init) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  init?.signal?.addEventListener('abort', () => controller.abort())
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeoutId))
}

// Client anon cote serveur (Server Components / Route Handlers), a utiliser
// a la place d'un createClient() nu partout ou un hang Supabase ne doit pas
// pouvoir geler toute une page pendant 5 minutes. timeoutMs par defaut a
// 15s (meme valeur que le client navigateur).
export function createServerClient(timeoutMs = 15000) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: fetchWithTimeout(timeoutMs) } }
  )
}
