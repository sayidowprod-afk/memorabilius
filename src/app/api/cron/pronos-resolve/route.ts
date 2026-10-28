import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { resolvePronosWins, purgeOldPicks } from '@/lib/pronosResolve'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createServerServiceClient()

// Toutes les 3 heures : verse l'XP des bons pronos de TOUS les membres dès que leurs matchs sont terminés,
// sans attendre qu'ils rouvrent le site. Les classements hebdomadaires deviennent ainsi complets et exacts.
// Fenêtre de 5 jours : largement assez pour rattraper une exécution manquée ; le reste a déjà été traité.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await resolvePronosWins(supabase, { sinceDays: 5 })
    await purgeOldPicks(supabase)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
