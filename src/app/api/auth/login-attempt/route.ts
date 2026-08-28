import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Anti-bruteforce sur /connexion. Le login lui-meme reste un appel client
// direct a supabase.auth.signInWithPassword (inchange, pour ne pas toucher
// aux flux biometrie/OAuth/retry reseau deja en place) -- cette route ne fait
// que compter les echecs recents et bloquer l'UI avant le prochain essai.
// Contournable en appelant Supabase directement (cle anon publique), mais ca
// releve le niveau pour un script cible sur le formulaire du site, ce qui est
// le scope demande.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 5

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const { count } = await supabaseAdmin
    .from('login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', since)

  const attempts = count || 0
  if (attempts >= MAX_ATTEMPTS) {
    const { data: oldest } = await supabaseAdmin
      .from('login_attempts').select('created_at')
      .eq('email', email).gte('created_at', since)
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    const retryAfterSeconds = oldest
      ? Math.max(0, Math.ceil((new Date(oldest.created_at).getTime() + WINDOW_MINUTES * 60_000 - Date.now()) / 1000))
      : WINDOW_MINUTES * 60
    return NextResponse.json({ locked: true, retryAfterSeconds })
  }
  return NextResponse.json({ locked: false })
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const clean = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!clean) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  await supabaseAdmin.from('login_attempts').insert({ email: clean })
  // Purge opportuniste des lignes de plus de 24h pour cet email -- evite une
  // table qui grossit sans fin sans avoir besoin d'un cron dedie.
  await supabaseAdmin.from('login_attempts').delete()
    .eq('email', clean).lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())

  return NextResponse.json({ ok: true })
}
