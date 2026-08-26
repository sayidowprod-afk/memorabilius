import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { awardChallengeXPIfNeeded } from '@/lib/xp'
import { currentChallenge, startOfWeekISO, currentWeekKey } from '@/lib/weeklyChallenge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verse la récompense du défi hebdomadaire — la progression est recalculée
// ici depuis cartes_manuelles (jamais confiée au client) pour ne pas pouvoir
// s'auto-attribuer l'XP en appelant la route sans avoir vraiment complété le
// défi. Idempotent (voir awardChallengeXPIfNeeded) : peut être rappelée sans
// risque à chaque chargement du dashboard tant que le défi reste complété.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const challenge = currentChallenge()
    const { data: weekCards } = await supabase.from('cartes_manuelles')
      .select('rc, auto, patch, num').eq('user_id', user.id).gte('created_at', startOfWeekISO())

    const progress = (weekCards || []).filter(c => challenge.match({ rc: c.rc, auto: c.auto, patch: c.patch, num: c.num })).length
    if (progress < challenge.target) return NextResponse.json({ ok: false, reason: 'not_complete' })

    const awarded = await awardChallengeXPIfNeeded(supabase, user.id, currentWeekKey())
    return NextResponse.json({ ok: true, awarded })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
