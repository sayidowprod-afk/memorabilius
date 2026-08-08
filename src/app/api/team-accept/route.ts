import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { candidatureId, teamId, userId, action } = await req.json()
  if (!candidatureId || !teamId || !userId) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  // Vérifier que l'appelant est chef ou admin de la team
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user: caller } } = await supabase.auth.getUser(token)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: team } = await supabase.from('teams').select('created_by').eq('id', teamId).single()
  const { data: callerMember } = await supabase.from('team_members').select('role').eq('team_id', teamId).eq('user_id', caller.id).single()
  const isChef = team?.created_by === caller.id
  const isAdmin = callerMember?.role === 'admin'
  if (!isChef && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // La candidature doit réellement correspondre à cette team/cet utilisateur et être
  // encore en attente — sinon un chef pourrait ajouter n'importe quel userId comme
  // membre, ou manipuler la candidature d'une autre team en réutilisant son id.
  const { data: candidature } = await supabase.from('team_candidatures')
    .select('id, team_id, user_id, statut').eq('id', candidatureId).single()
  if (!candidature || candidature.team_id !== teamId || candidature.user_id !== userId || candidature.statut !== 'en_attente') {
    return NextResponse.json({ error: 'Candidature invalide' }, { status: 400 })
  }

  if (action === 'accept') {
    // L'ajout au team_members doit réussir AVANT de marquer la candidature comme acceptée,
    // sinon on se retrouve avec une candidature "acceptée" mais personne n'est membre.
    const { error: memberError } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
    // 23505 = violation de contrainte unique → déjà membre, on continue (idempotent)
    if (memberError && memberError.code !== '23505') {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    const { error: candError } = await supabase.from('team_candidatures').update({ statut: 'accepte' }).eq('id', candidatureId)
    if (candError) return NextResponse.json({ error: candError.message }, { status: 500 })

    // Notification au candidat (best-effort, ne bloque pas la réponse)
    await supabase.from('notifications').insert({
      user_id: userId, type: 'team_join', lu: false,
      message: 'Votre candidature a été acceptée ! Vous êtes maintenant membre de la team.',
      lien: `/teams/${teamId}`,
    })
  } else {
    const { error: candError } = await supabase.from('team_candidatures').update({ statut: 'refuse' }).eq('id', candidatureId)
    if (candError) return NextResponse.json({ error: candError.message }, { status: 500 })
    await supabase.from('notifications').insert({
      user_id: userId, type: 'system', lu: false,
      message: 'Votre candidature à la team n\'a pas été retenue.',
      lien: `/teams`,
    })
  }

  return NextResponse.json({ ok: true })
}
