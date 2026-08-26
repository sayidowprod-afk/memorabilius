import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { teamJoinRequestPush, genericCollectorName, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Postuler à une team se fait ici (service role), pas côté client comme avant :
// un candidat qui avait déjà été refusé (ou avait rejoint puis quitté) laisse une
// ligne team_candidatures non "en_attente" en base à cause de la contrainte unique
// (team_id, user_id) — la supprimer avant de recréer la candidature exige un DELETE,
// qu'aucune policy RLS n'autorise pour un utilisateur normal sur cette table (testé :
// le DELETE réussit silencieusement sans rien supprimer, puis l'INSERT échoue avec
// "duplicate key value violates unique constraint"). Contourne le problème en passant
// par le serveur plutôt que d'ajouter une policy RLS (pas d'accès direct à la DB ici).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await req.json()
  if (!teamId) return NextResponse.json({ error: 'Missing teamId' }, { status: 400 })

  const { data: team } = await supabase.from('teams').select('name, created_by').eq('id', teamId).single()
  if (!team) return NextResponse.json({ error: 'Team introuvable' }, { status: 404 })

  const { data: existingMember } = await supabase.from('team_members').select('user_id').eq('team_id', teamId).eq('user_id', user.id).maybeSingle()
  if (existingMember) return NextResponse.json({ error: 'Déjà membre de cette team' }, { status: 400 })

  // Anti-spam : sans ça, un candidat refusé pouvait repostuler immédiatement en
  // boucle — chaque tentative renvoie une vraie notif (push + in-app) aux chefs
  // de la team, sans aucune limite de fréquence côté serveur.
  const REAPPLY_COOLDOWN_MS = 24 * 60 * 60 * 1000
  const { data: previousAttempt } = await supabase.from('team_candidatures')
    .select('created_at').eq('team_id', teamId).eq('user_id', user.id).neq('statut', 'en_attente')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (previousAttempt && Date.now() - new Date(previousAttempt.created_at).getTime() < REAPPLY_COOLDOWN_MS) {
    return NextResponse.json({ error: 'Veuillez patienter avant de repostuler' }, { status: 429 })
  }

  await supabase.from('team_candidatures').delete().eq('team_id', teamId).eq('user_id', user.id).neq('statut', 'en_attente')
  const { error: insErr } = await supabase.from('team_candidatures').insert({ team_id: teamId, user_id: user.id, statut: 'en_attente' })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Notifie le·s chef·s de la team (créateur + membres role='admin'), best-effort.
  const [{ data: admins }, { data: candidate }] = await Promise.all([
    supabase.from('team_members').select('user_id').eq('team_id', teamId).eq('role', 'admin'),
    supabase.from('profiles').select('display_name').eq('id', user.id).single(),
  ])
  const recipients = new Set<string>([team.created_by, ...(admins || []).map((a: any) => a.user_id)])
  recipients.delete(user.id)
  if (recipients.size) {
    const { data: recipientProfiles } = await supabase.from('profiles').select('id, preferred_lang').in('id', [...recipients])
    const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))
    const teamName = team.name || 'votre team'
    await Promise.all([...recipients].map(async uid => {
      const lang = langMap.get(uid) ?? 'fr'
      const candidateName = candidate?.display_name || genericCollectorName(lang)
      const { title, body } = teamJoinRequestPush(lang, candidateName, teamName)
      await Promise.all([
        supabase.from('notifications').insert({ user_id: uid, type: 'team_join_request', lu: false, message: body, lien: `/teams/${teamId}?tab=candidatures` }),
        sendPushToUser(uid, { title, body, url: `/teams/${teamId}?tab=candidatures`, channelId: 'community' }),
      ])
    }))
  }

  return NextResponse.json({ ok: true })
}
