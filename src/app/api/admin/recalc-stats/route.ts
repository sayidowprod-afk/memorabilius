import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { recalcAndSaveUserStats } from '@/lib/recalcStats'

export const maxDuration = 300

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bouton "Recalculer les stats" du panel admin -- recompte TOUT LE MONDE
// immediatement (contrairement au cron nightly qui ne retouche que les
// profils perimes depuis 24h+, donc n'aide pas si un profil a ete ecrase
// avec une valeur fausse par un run recent -- voir recalcul-stats/route.ts).
// A n'utiliser qu'en cas de doute sur les compteurs, pas en routine.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: profiles, error } = await admin.from('profiles').select('id, display_name, lien_csv, stats_total')
  if (error || !profiles) return NextResponse.json({ error: error?.message ?? 'No profiles' }, { status: 500 })

  let changed = 0
  const errors: { display_name: string; error: string }[] = []
  const BATCH = 15
  for (let i = 0; i < profiles.length; i += BATCH) {
    const batch = profiles.slice(i, i + BATCH)
    await Promise.all(batch.map(async (p) => {
      const result = await recalcAndSaveUserStats(admin, p.id, p.lien_csv, { csvTimeoutMs: 15000 })
      if ('error' in result) { errors.push({ display_name: p.display_name, error: result.error }); return }
      if (result.stats.total !== (p.stats_total || 0)) changed++
    }))
  }

  return NextResponse.json({ ok: true, total: profiles.length, changed, errors })
}
