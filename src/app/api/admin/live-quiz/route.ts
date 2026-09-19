import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans 0/O/1/I, moins d'erreurs de lecture à l'oral
function randomCode(len = 5): string {
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Gestion des sessions de quiz en direct (voir /quiz/[code] côté spectateur).
// Toute la logique de contrôle de manche (démarrer/révéler une question) est
// volontairement ici plutôt que côté client : le client public n'a jamais
// accès à la clé service role, donc round_correct_index ne peut fuiter avant
// 'reveal' que si CETTE route le décide.
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const [{ data: session, error }, { data: questions }] = await Promise.all([
      admin.from('quiz_sessions').select('*').eq('id', id).single(),
      admin.from('quiz_questions').select('*').eq('session_id', id).order('position', { ascending: true }),
    ])
    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    const { count: participantCount } = session.round_key
      ? await admin.from('quiz_answers').select('*', { count: 'exact', head: true }).eq('round_key', session.round_key)
      : { count: 0 }
    return NextResponse.json({ session, questions, participantCount: participantCount ?? 0 })
  }

  const { data: sessions, error } = await admin.from('quiz_sessions').select('*').order('created_at', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title } = await req.json()

  let code = ''
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomCode()
    const { data: existing } = await admin.from('quiz_sessions').select('id').eq('code', candidate).maybeSingle()
    if (!existing) { code = candidate; break }
  }
  if (!code) return NextResponse.json({ error: 'Impossible de générer un code unique' }, { status: 500 })

  const { data, error } = await admin.from('quiz_sessions').insert({
    code, title: title || 'Quiz en direct', status: 'lobby', created_by: adminUser.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

const ACTIONS = ['start_round', 'reveal', 'end_round', 'end_session'] as const

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId, action, questionId, cardId, durationSeconds } = await req.json()
  if (!sessionId || !ACTIONS.includes(action)) return NextResponse.json({ error: 'champs invalides' }, { status: 400 })
  // Choisi par l'animateur au moment de lancer (pas à la création de la
  // question/carte) -- voir /api/admin/live-quiz/questions, qui ne stocke
  // plus de durée : ça permet de relancer la même question avec un minuteur
  // différent d'une diffusion à l'autre.
  const duration = typeof durationSeconds === 'number' && durationSeconds > 0 ? Math.round(durationSeconds) : null

  if (action === 'start_round') {
    if (cardId) {
      // Manche "quiz autographes" : signature d'une carte deja validee dans
      // /admin/autograph-quiz, lancee ici comme un QCM classique (4 noms,
      // dont 3 pioches parmi les autres cartes) -- sans passer par la tier
      // list, qui reste un outil separe (voir presenter/tierlist).
      const { data: card, error: cardErr } = await admin.from('autograph_quiz_cards').select('*').eq('id', cardId).single()
      if (cardErr || !card) return NextResponse.json({ error: 'carte introuvable' }, { status: 404 })

      const { data: others } = await admin.from('autograph_quiz_cards').select('player_name').neq('id', cardId)
      const otherNames = [...new Set((others || []).map(o => o.player_name))].filter(n => n !== card.player_name)
      const wrongs = shuffle(otherNames).slice(0, 3)
      const roundChoices = shuffle([card.player_name, ...wrongs])
      const correctIndex = roundChoices.indexOf(card.player_name)

      const { data, error } = await admin.from('quiz_sessions').update({
        status: 'question',
        round_type: 'autograph',
        round_key: card.id,
        round_question: null,
        round_prompt_image: {
          url: card.image_recto, cropX: card.crop_x, cropY: card.crop_y, cropW: card.crop_w, cropH: card.crop_h, rotationDeg: card.rotation_deg,
        },
        round_choices: roundChoices,
        round_correct_index: correctIndex,
        round_duration_seconds: duration,
        round_started_at: new Date().toISOString(),
      }).eq('id', sessionId).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ session: data })
    }

    if (!questionId) return NextResponse.json({ error: 'questionId ou cardId manquant' }, { status: 400 })
    const { data: question, error: qErr } = await admin.from('quiz_questions').select('*').eq('id', questionId).eq('session_id', sessionId).single()
    if (qErr || !question) return NextResponse.json({ error: 'question introuvable' }, { status: 404 })

    const { data, error } = await admin.from('quiz_sessions').update({
      status: 'question',
      round_type: 'qcm',
      round_key: question.id,
      round_question: question.question,
      round_prompt_image: null,
      round_choices: question.choices,
      round_correct_index: question.correct_index,
      round_duration_seconds: duration,
      round_started_at: new Date().toISOString(),
    }).eq('id', sessionId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await admin.from('quiz_questions').update({ used: true }).eq('id', questionId)
    return NextResponse.json({ session: data })
  }

  if (action === 'reveal') {
    const { data, error } = await admin.from('quiz_sessions').update({ status: 'reveal' }).eq('id', sessionId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  }

  if (action === 'end_round') {
    const { data, error } = await admin.from('quiz_sessions').update({
      status: 'lobby', round_type: null, round_key: null, round_question: null, round_prompt_image: null,
      round_choices: null, round_correct_index: null, round_started_at: null, round_duration_seconds: null,
    }).eq('id', sessionId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ session: data })
  }

  // end_session
  const { data, error } = await admin.from('quiz_sessions').update({ status: 'ended' }).eq('id', sessionId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: data })
}

export async function DELETE(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId } = await req.json()
  if (!sessionId) return NextResponse.json({ error: 'sessionId manquant' }, { status: 400 })

  const { error } = await admin.from('quiz_sessions').delete().eq('id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
