import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WINDOW_MS = 5 * 60_000
// detect-corners est automatique (appelé à chaque scan), scan-card est manuel.
// On monte le quota global pour ne pas bloquer un utilisateur qui scanne plusieurs cartes d'affilée.
const MAX_CALLS_PER_WINDOW = 50

// Retourne null si l'appel est autorisé (et l'enregistre),
// ou un message d'erreur lisible si le quota est dépassé.
export async function checkAiRateLimit(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  const { count } = await supabaseAdmin
    .from('ai_scan_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)

  if ((count || 0) >= MAX_CALLS_PER_WINDOW) {
    return `Trop de requêtes IA — limite de ${MAX_CALLS_PER_WINDOW} analyses par 5 minutes atteinte. Réessayez dans quelques minutes.`
  }

  await supabaseAdmin.from('ai_scan_events').insert({ user_id: userId })
  return null
}

// Backwards compat
export async function checkAiScanRateLimit(userId: string): Promise<boolean> {
  return (await checkAiRateLimit(userId)) === null
}
