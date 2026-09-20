import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Route PUBLIQUE : statut + score en DIRECT d'UN participant nommé (les
// chroniqueurs/invités du plateau, qui jouent comme les spectateurs depuis
// leur téléphone) -- pensée pour une petite overlay collée sous leur webcam
// (voir /quiz/[code]/overlay/player/[pseudo]). Même règle de sécurité que
// /api/live-quiz : jamais si CE participant a juste ou faux tant que la
// manche n'est pas révélée -- seulement "a répondu" ou pas.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  const pseudo = req.nextUrl.searchParams.get('pseudo')?.trim()
  if (!code || !pseudo) return NextResponse.json({ error: 'code/pseudo manquant' }, { status: 400 })

  const { data: session, error } = await admin.from('quiz_sessions').select('*').eq('code', code).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!session) return NextResponse.json({ error: 'session introuvable' }, { status: 404 })

  const settled = session.status !== 'question'
  const roundKey = session.round_key as string | null

  const { data: rows } = await admin
    .from('quiz_answers')
    .select('round_key, choice_index, is_correct, points, pseudo, answered_at, response_ms')
    .eq('session_id', session.id)
    .ilike('pseudo', pseudo)
    .order('answered_at', { ascending: true })

  const found = (rows && rows.length > 0) || false
  const current = roundKey ? (rows || []).find(r => r.round_key === roundKey) : undefined

  let score = 0
  for (const r of rows || []) {
    if (!settled && r.round_key === roundKey) continue
    score += r.points ?? 0
  }

  const hasRound = session.status === 'question' || session.status === 'reveal'
  const revealed = session.status === 'reveal'

  return NextResponse.json({
    found,
    pseudo,
    hasRound,
    hasAnswered: !!current,
    responseMs: current?.response_ms ?? null,
    revealed,
    isCorrect: revealed && current ? current.is_correct : null,
    choiceIndex: revealed && current ? current.choice_index : null,
    choiceLabel: revealed && current && Array.isArray(session.round_choices) ? session.round_choices[current.choice_index] ?? null : null,
    correctIndex: revealed ? session.round_correct_index : null,
    score,
  })
}
