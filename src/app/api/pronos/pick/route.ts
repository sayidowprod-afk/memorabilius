import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { fetchMatchesForOffsets } from '@/lib/pronosMatches'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Enregistre / annule le pick d'un utilisateur. L'écriture passe par ici
// (pas en direct depuis le client) pour que la règle "on ne pronostique pas
// un match déjà commencé" soit appliquée côté serveur : sinon n'importe qui
// pourrait écrire un pick sur un match terminé et toucher l'XP.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const matchId = typeof body?.matchId === 'string' ? body.matchId : null
    const pick = body?.pick === 'left' || body?.pick === 'right' ? body.pick : body?.pick === null ? null : undefined
    if (!matchId || pick === undefined) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

    const { matches } = await fetchMatchesForOffsets([-1, 0, 1, 2, 3, 4, 5, 6])
    const match = matches.find(m => m.id === matchId)
    if (!match) return NextResponse.json({ error: 'unknown_match' }, { status: 404 })
    if (match.locked || match.status === 'final') return NextResponse.json({ error: 'locked' }, { status: 409 })

    if (pick === null) {
      await supabase.from('pronos_picks').delete().eq('user_id', user.id).eq('match_id', matchId)
    } else {
      const { error } = await supabase.from('pronos_picks').upsert({
        user_id: user.id, match_id: matchId, pick, kickoff_at: match.kickoff, updated_at: new Date().toISOString(),
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
