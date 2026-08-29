import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verification live (pas d'historique d'incidents persiste -- inutile vu la
// taille du site, ca aurait demande sa propre table + cron de sondage
// periodique pour peu de valeur ajoutee face a un simple "est-ce que ca
// repond maintenant").
export async function GET() {
  const checks: Record<string, boolean> = {}

  try {
    const { error } = await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).limit(1)
    checks.database = !error
  } catch {
    checks.database = false
  }

  checks.api = true // si cette route repond, l'API elle-meme fonctionne

  const allOk = Object.values(checks).every(Boolean)
  return NextResponse.json({ ok: allOk, checks, checkedAt: new Date().toISOString() })
}
