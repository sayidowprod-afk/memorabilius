import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Enregistre une connexion reussie (appele par le client juste apres
// signInWithPassword). L'IP est lue cote serveur (jamais fournie par le
// client) pour ne pas pouvoir etre falsifiee.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = req.headers.get('user-agent') || null

  await supabaseAdmin.from('login_history').insert({ user_id: user.id, ip, user_agent: userAgent })
  // Purge best-effort au-dela de 90 jours pour cet utilisateur.
  await supabaseAdmin.from('login_history').delete()
    .eq('user_id', user.id).lt('created_at', new Date(Date.now() - 90 * 24 * 3600_000).toISOString())

  return NextResponse.json({ ok: true })
}
