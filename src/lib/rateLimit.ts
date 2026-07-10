import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WINDOW_MS = 5 * 60_000
const MAX_CALLS_PER_WINDOW = 20

// Limite le débit d'appels aux routes IA (Gemini) coûteuses par utilisateur.
// Retourne true si l'appel est autorisé (et l'enregistre), false s'il est refusé.
export async function checkAiScanRateLimit(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count } = await supabaseAdmin.from('ai_scan_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).gte('created_at', since)

  if ((count || 0) >= MAX_CALLS_PER_WINDOW) return false

  await supabaseAdmin.from('ai_scan_events').insert({ user_id: userId })
  return true
}
