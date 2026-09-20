import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Enregistre qu'un spectateur a rejoint (pseudo choisi), indépendamment de
// toute réponse -- avant, seul quiz_answers permettait de savoir "qui joue",
// donc le sélecteur "overlays individuels" du panel admin ne proposait
// personne tant qu'aucune question n'avait été lancée. Appelé une fois au
// clic "Rejoindre" (voir /quiz/[code]/page.tsx).
export async function POST(req: NextRequest) {
  const { code, participantId, pseudo } = await req.json()
  if (!code || !participantId || !pseudo) return NextResponse.json({ error: 'champs manquants' }, { status: 400 })

  const { data: session } = await admin.from('quiz_sessions').select('id').eq('code', String(code).toUpperCase()).maybeSingle()
  if (!session) return NextResponse.json({ error: 'session introuvable' }, { status: 404 })

  const { error } = await admin.from('quiz_participants').upsert({
    session_id: session.id,
    participant_id: String(participantId).slice(0, 100),
    pseudo: String(pseudo).slice(0, 40),
    joined_at: new Date().toISOString(),
  }, { onConflict: 'session_id,participant_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
