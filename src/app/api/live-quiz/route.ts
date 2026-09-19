import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Route PUBLIQUE (spectateurs sans compte + overlay OBS/Streamlabs) -- clé
// service role utilisée uniquement pour lire, JAMAIS pour exposer
// round_correct_index avant que l'animateur ait cliqué "Révéler" (voir
// /api/admin/live-quiz). Polling léger côté client plutôt que Realtime
// direct sur la table : Realtime renverrait la ligne complète (donc la bonne
// réponse) dans le payload websocket, que le composant l'affiche ou non.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'code manquant' }, { status: 400 })

  const { data: session, error } = await admin.from('quiz_sessions').select('*').eq('code', code).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!session) return NextResponse.json({ error: 'session introuvable' }, { status: 404 })

  const revealed = session.status === 'reveal'
  const roundKey = session.round_key as string | null

  let tally: number[] = []
  let totalAnswers = 0
  if (roundKey && session.round_choices) {
    const { data: rows } = await admin.from('quiz_answers').select('choice_index').eq('round_key', roundKey)
    tally = new Array((session.round_choices as any[]).length).fill(0)
    for (const r of rows || []) {
      if (typeof r.choice_index === 'number' && tally[r.choice_index] !== undefined) tally[r.choice_index]++
    }
    totalAnswers = (rows || []).length
  }

  // Classement cumulé : exclut la manche EN COURS tant qu'elle n'est pas
  // révélée, pour qu'aucune variation du classement en direct ne puisse
  // laisser deviner qui a déjà la bonne réponse avant l'animateur.
  const { data: answerRows } = await admin
    .from('quiz_answers')
    .select('participant_id, pseudo, is_correct, round_key, answered_at')
    .eq('session_id', session.id)
    .order('answered_at', { ascending: true })

  const scores = new Map<string, { pseudo: string; score: number }>()
  for (const r of answerRows || []) {
    if (!revealed && r.round_key === roundKey) continue
    const entry = scores.get(r.participant_id) || { pseudo: r.pseudo, score: 0 }
    entry.pseudo = r.pseudo // dernier pseudo connu
    if (r.is_correct) entry.score++
    scores.set(r.participant_id, entry)
  }
  const leaderboard = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 10)

  return NextResponse.json({
    session: {
      code: session.code,
      title: session.title,
      status: session.status,
      roundType: session.round_type,
      roundKey,
      question: session.round_question,
      choices: session.round_choices,
      correctIndex: revealed ? session.round_correct_index : null,
      roundStartedAt: session.round_started_at,
      roundDurationSeconds: session.round_duration_seconds,
    },
    tally,
    totalAnswers,
    leaderboard,
  })
}
