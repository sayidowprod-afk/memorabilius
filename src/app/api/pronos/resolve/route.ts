import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { resolvePronosWins, purgeOldPicks } from '@/lib/pronosResolve'
import { XP_AWARDS } from '@/lib/xp'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Verse +5 XP par pick gagnant parmi les matchs terminés de l'utilisateur (voir lib/pronosResolve). Appelée
// à chaque chargement de l'accueil ; le cron /api/cron/pronos-resolve fait la même chose pour tous les
// utilisateurs, y compris ceux qui ne reviennent pas sur le site.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await purgeOldPicks(supabase)
    const { picks, awarded } = await resolvePronosWins(supabase, { userId: user.id })
    if (picks === 0) return NextResponse.json({ ok: true, awarded: 0, xp: 0 })
    return NextResponse.json({ ok: true, awarded, xp: awarded * XP_AWARDS.PRONO_WIN })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
