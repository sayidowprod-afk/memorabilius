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
  const participantId = req.nextUrl.searchParams.get('participantId')
  if (!code) return NextResponse.json({ error: 'code manquant' }, { status: 400 })

  const { data: session, error } = await admin.from('quiz_sessions').select('*').eq('code', code).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!session) return NextResponse.json({ error: 'session introuvable' }, { status: 404 })

  // La manche est "réglée" (sûre à montrer) dès qu'elle n'est plus activement
  // en train d'être votée -- pas seulement à status==='reveal' pile. Piège
  // trouvé en testant : passer directement de 'reveal' à 'ended' (terminer
  // la session sans repasser par "Retour lobby") laisse round_key/round_
  // correct_index intacts en base ; se baser sur status==='reveal' strict
  // recachait alors la dernière manche pourtant déjà révélée -- le
  // classement final perdait ses points, la bonne réponse redisparaissait.
  const settled = session.status !== 'question'
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
    .select('participant_id, pseudo, points, round_key, answered_at')
    .eq('session_id', session.id)
    .order('answered_at', { ascending: true })

  const scores = new Map<string, { pseudo: string; score: number }>()
  for (const r of answerRows || []) {
    if (!settled && r.round_key === roundKey) continue
    const entry = scores.get(r.participant_id) || { pseudo: r.pseudo, score: 0 }
    entry.pseudo = r.pseudo // dernier pseudo connu
    entry.score += r.points ?? 0
    scores.set(r.participant_id, entry)
  }
  const leaderboard = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 10)

  // Les 10 premiers a avoir repondu sur la manche en cours (pseudo + rang de
  // vitesse) -- pas de is_correct/points ici, juste "qui a repondu vite", pour
  // l'overlay pendant que la question est encore en cours (aucune info
  // sensible : ne revele ni la bonne reponse ni le choix de chacun).
  const speedFeed = roundKey
    ? (answerRows || []).filter(r => r.round_key === roundKey).slice(0, 10).map(r => r.pseudo)
    : []

  // Points de CE spectateur pour la manche en cours, révélés seulement une
  // fois la manche réglée (même règle que round_correct_index) -- lui permet
  // d'afficher "+750 pts" sans exposer qui que ce soit d'autre.
  let myPoints: number | null = null
  if (settled && roundKey && participantId) {
    const mine = (answerRows || []).find(r => r.round_key === roundKey && r.participant_id === participantId)
    myPoints = mine?.points ?? 0
  }

  return NextResponse.json({
    session: {
      code: session.code,
      title: session.title,
      status: session.status,
      roundType: session.round_type,
      roundKey,
      question: session.round_question,
      promptImage: session.round_prompt_image,
      choices: session.round_choices,
      correctIndex: settled ? session.round_correct_index : null,
      roundStartedAt: session.round_started_at,
      roundDurationSeconds: session.round_duration_seconds,
    },
    tally,
    totalAnswers,
    leaderboard,
    myPoints,
    speedFeed,
  })
}
