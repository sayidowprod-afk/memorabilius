import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// guide_translations n'a volontairement aucune policy RLS insert/update (voir
// supabase/migrations/20260823_guide_translations.sql) — les écritures doivent
// passer par ici (service role). L'admin page appelait auparavant .update()
// directement depuis le client anon, qui réussissait silencieusement (0 ligne
// affectée, pas d'erreur) sans jamais changer l'image — même classe de bug que
// le DELETE silencieux sur team_candidatures.
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { guideId, lang, coverImage } = await req.json()
  if (!guideId || !lang || !coverImage) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  if (lang !== 'en' && lang !== 'de') return NextResponse.json({ error: 'Langue invalide' }, { status: 400 })

  const { error, data } = await supabase
    .from('guide_translations')
    .update({ cover_image: coverImage })
    .eq('guide_id', guideId)
    .eq('lang', lang)
    .select('lang')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Traduction introuvable' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
