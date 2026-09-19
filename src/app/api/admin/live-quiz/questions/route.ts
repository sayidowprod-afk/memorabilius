import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { sessionId, question, choices, correctIndex } = await req.json()
  if (!sessionId || !question || !Array.isArray(choices) || choices.length < 2 || typeof correctIndex !== 'number') {
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 })
  }
  if (correctIndex < 0 || correctIndex >= choices.length) {
    return NextResponse.json({ error: 'correctIndex invalide' }, { status: 400 })
  }

  const { count } = await admin.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('session_id', sessionId)

  const { data, error } = await admin.from('quiz_questions').insert({
    session_id: sessionId, question, choices, correct_index: correctIndex, position: count ?? 0,
  }).select().single()
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
