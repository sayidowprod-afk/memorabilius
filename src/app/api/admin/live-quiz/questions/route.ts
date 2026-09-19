import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function validateChoices(choices: unknown, correctIndex: unknown): choices is string[] {
  return Array.isArray(choices) && choices.length >= 2 && typeof correctIndex === 'number' && correctIndex >= 0 && correctIndex < choices.length
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId, question, choices, correctIndex } = await req.json()
  if (!sessionId || !question || !validateChoices(choices, correctIndex)) {
    return NextResponse.json({ error: 'champs manquants ou invalides' }, { status: 400 })
  }

  const { count } = await admin.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)

  const { data, error } = await admin.from('quiz_questions').insert({
    session_id: sessionId, question, choices, correct_index: correctIndex, position: count ?? 0,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

// Le minuteur n'est plus fixé à la création -- l'animateur le choisit au
// moment de lancer la manche (voir /api/admin/live-quiz, action start_round),
// pour pouvoir varier la durée d'une diffusion à l'autre sans dupliquer la
// question. duration_seconds reste en base pour compat mais n'est plus écrit
// ici.
export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, question, choices, correctIndex } = await req.json()
  if (!id || !question || !validateChoices(choices, correctIndex)) {
    return NextResponse.json({ error: 'champs manquants ou invalides' }, { status: 400 })
  }

  const { data, error } = await admin.from('quiz_questions').update({
    question, choices, correct_index: correctIndex,
  }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

export async function DELETE(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await admin.from('quiz_questions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
