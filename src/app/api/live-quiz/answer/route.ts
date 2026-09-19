import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vote d'un spectateur (pas de compte -- participantId généré et gardé côté
// client en localStorage). is_correct est calculé ici, côté serveur, à partir
// de round_correct_index (jamais envoyé au client tant que status != reveal)
// -- volontairement PAS renvoyé dans la réponse non plus, pour garder le
// suspense jusqu'au clic "Révéler" de l'animateur, comme les votes des autres.
export async function POST(req: NextRequest) {
  const { code, participantId, pseudo, choiceIndex } = await req.json()
  if (!code || !participantId || !pseudo || typeof choiceIndex !== 'number') {
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 })
  }

  const { data: session } = await admin.from('quiz_sessions').select('*').eq('code', String(code).toUpperCase()).maybeSingle()
  if (!session) return NextResponse.json({ error: 'session introuvable' }, { status: 404 })
  if (session.status !== 'question' || !session.round_key) {
    return NextResponse.json({ error: 'aucune question en cours' }, { status: 409 })
  }
  // Le minuteur est optionnel (voir migration 20260919b) -- l'animateur garde
  // toujours le contrôle manuel du démarrage/de la révélation, ceci ferme
  // juste le vote plus tôt côté serveur si une durée a été fixée pour cette
  // question (le client se ferme déjà visuellement à 0, mais un vote posté
  // juste après ne doit pas compter).
  if (session.round_duration_seconds && session.round_started_at) {
    const elapsed = (Date.now() - new Date(session.round_started_at).getTime()) / 1000
    if (elapsed > session.round_duration_seconds) {
      return NextResponse.json({ error: 'temps écoulé' }, { status: 409 })
    }
  }
  const choices = session.round_choices as any[]
  if (choiceIndex < 0 || choiceIndex >= (choices?.length ?? 0)) {
    return NextResponse.json({ error: 'choix invalide' }, { status: 400 })
  }

  const isCorrect = choiceIndex === session.round_correct_index

  const { error } = await admin.from('quiz_answers').upsert({
    session_id: session.id,
    round_key: session.round_key,
    participant_id: String(participantId).slice(0, 100),
    pseudo: String(pseudo).slice(0, 40),
    choice_index: choiceIndex,
    is_correct: isCorrect,
  }, { onConflict: 'round_key,participant_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
