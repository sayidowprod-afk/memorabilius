import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendPushToUser } from '@/lib/pushNotify'
import { teamJoinRequestPush, genericCollectorName, normalizePushLang } from '@/lib/pushTranslations'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyToken(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.id || null
}

// Appelé juste après l'insertion d'une candidature (team_candidatures) — celle-ci se
// fait côté client car l'utilisateur n'insère que sa propre ligne, mais rien ne
// prévenait jusqu'ici le·s chef·s de la team : ni notification, ni push, ni badge.
// Ce endpoint notifie le créateur de la team + tout membre role='admin', comme
// /api/team-accept les autorise déjà tous les deux à traiter la candidature.
export async function POST(req: NextRequest) {
  const callerId = await verifyToken(req)
  if (!callerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await req.json()
  if (!teamId) return NextResponse.json({ ok: false })

  const [{ data: team }, { data: admins }, { data: candidate }] = await Promise.all([
    supabase.from('teams').select('name, created_by').eq('id', teamId).single(),
    supabase.from('team_members').select('user_id').eq('team_id', teamId).eq('role', 'admin'),
    supabase.from('profiles').select('display_name').eq('id', callerId).single(),
  ])
  if (!team) return NextResponse.json({ ok: false })

  const recipients = new Set<string>([team.created_by, ...(admins || []).map((a: any) => a.user_id)])
  recipients.delete(callerId)

  const teamName = team.name || 'votre team'

  const { data: recipientProfiles } = await supabase
    .from('profiles').select('id, preferred_lang').in('id', [...recipients])
  const langMap = new Map((recipientProfiles || []).map((p: any) => [p.id, normalizePushLang(p.preferred_lang)]))

  await Promise.all([...recipients].map(async uid => {
    const lang = langMap.get(uid) ?? 'fr'
    const candidateName = candidate?.display_name || genericCollectorName(lang)
    const { title, body } = teamJoinRequestPush(lang, candidateName, teamName)
    await Promise.all([
      supabase.from('notifications').insert({ user_id: uid, type: 'team_join_request', lu: false, message: body, lien: `/teams/${teamId}?tab=candidatures` }),
      sendPushToUser(uid, { title, body, url: `/teams/${teamId}?tab=candidatures`, channelId: 'community' }),
    ])
  }))

  return NextResponse.json({ ok: true, notified: recipients.size })
}
