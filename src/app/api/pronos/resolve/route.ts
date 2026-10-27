import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { fetchMatchesForOffsets } from '@/lib/pronosMatches'
import { XP_AWARDS } from '@/lib/xp'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Picks conservés 8 jours après le coup d'envoi : assez pour que
// l'utilisateur puisse revenir résoudre ses bons pronos (fenêtre de
// résolution ci-dessous = 7 jours), pas besoin de les garder au-delà.
const RETENTION_DAYS = 8

// Verse +5 XP par pick gagnant parmi les matchs terminés. La correction du
// pick est recalculée ici depuis les résultats serveur (jamais confiée au
// client). Idempotent : un index unique partiel sur xp_events (voir
// migration) refuse un second versement pour le même (user, match), donc
// la route peut être rappelée à chaque chargement de l'accueil.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Purge globale des vieux picks (pas besoin de cron : chaque appel
    // nettoie, et la table reste de toute façon minuscule).
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
    await supabase.from('pronos_picks').delete().lt('kickoff_at', cutoff)

    const { data: picks } = await supabase.from('pronos_picks')
      .select('match_id, pick').eq('user_id', user.id).lt('kickoff_at', new Date().toISOString())
    if (!picks || picks.length === 0) return NextResponse.json({ ok: true, awarded: 0, xp: 0 })

    const { matches } = await fetchMatchesForOffsets([-7, -6, -5, -4, -3, -2, -1, 0])
    const byId = new Map(matches.map(m => [m.id, m]))

    let awarded = 0
    for (const p of picks) {
      const m = byId.get(p.match_id)
      if (!m || m.status !== 'final' || !m.winner || m.winner !== p.pick) continue
      const { error } = await supabase.from('xp_events').insert({
        user_id: user.id, type: 'pronos_win', amount: XP_AWARDS.PRONO_WIN, meta: { match_id: p.match_id },
      })
      if (!error) awarded++ // 23505 (déjà versé) => ignoré
    }

    return NextResponse.json({ ok: true, awarded, xp: awarded * XP_AWARDS.PRONO_WIN })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
