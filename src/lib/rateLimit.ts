import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WINDOW_MS = 5 * 60_000
const MAX_CALLS_PER_WINDOW = 50

// Cache mémoire : évite le SELECT Supabase quand le compteur local est clair
const memRateCache = new Map<string, { count: number; reset: number }>()

export async function checkAiRateLimit(userId: string): Promise<string | null> {
  const now = Date.now()

  const mem = memRateCache.get(userId)
  if (mem && now < mem.reset) {
    if (mem.count >= MAX_CALLS_PER_WINDOW) {
      return `Trop de requêtes IA — limite de ${MAX_CALLS_PER_WINDOW} analyses par 5 minutes atteinte. Réessayez dans quelques minutes.`
    }
    mem.count++
  } else {
    // Nouvelle fenêtre ou première fois : vérifie Supabase pour être précis
    const since = new Date(now - WINDOW_MS).toISOString()
    const { count } = await supabaseAdmin
      .from('ai_scan_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since)
    if ((count || 0) >= MAX_CALLS_PER_WINDOW) {
      return `Trop de requêtes IA — limite de ${MAX_CALLS_PER_WINDOW} analyses par 5 minutes atteinte. Réessayez dans quelques minutes.`
    }
    memRateCache.set(userId, { count: (count || 0) + 1, reset: now + WINDOW_MS })
  }

  await supabaseAdmin.from('ai_scan_events').insert({ user_id: userId })
  return null
}

// Backwards compat
export async function checkAiScanRateLimit(userId: string): Promise<boolean> {
  return (await checkAiRateLimit(userId)) === null
}
