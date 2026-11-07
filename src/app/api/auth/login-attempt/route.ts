import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { clientIp, rateLimited } from '@/lib/publicRateLimit'

// Anti-bruteforce sur /connexion. Le login lui-meme reste un appel client
// direct a supabase.auth.signInWithPassword (inchange, pour ne pas toucher
// aux flux biometrie/OAuth/retry reseau deja en place) -- cette route ne fait
// que compter les echecs recents et bloquer l'UI avant le prochain essai.
// Contournable en appelant Supabase directement (cle anon publique), mais ca
// releve le niveau pour un script cible sur le formulaire du site, ce qui est
// le scope demande. Pour bloquer le contournement : activer la protection anti-bots
// (CAPTCHA) et les limites de connexion dans Supabase (Authentication > Attack Protection).
//
// Verrouillage : par couple (e-mail, adresse IP). Avant, n'importe qui pouvait verrouiller le formulaire de connexion
// d'un autre membre en envoyant 5 faux echecs avec son e-mail. Maintenant, seules les adresses qui ont echoue sont bloquees ;
// un grand nombre d'echecs venant de plusieurs adresses bloque aussi l'e-mail (attaque repartie). La colonne `ip` vient de la
// migration 20261112 ; sans elle, on retombe sur l'ancien comptage par e-mail seul.
const supabaseAdmin = createServerServiceClient()

const WINDOW_MINUTES = 15
const MAX_ATTEMPTS = 5          // par adresse IP
const MAX_ATTEMPTS_ALL = 25     // toutes adresses confondues

const validEmail = (v: unknown): string => (typeof v === 'string' && v.length <= 254 ? v.trim().toLowerCase() : '')

export async function GET(req: NextRequest) {
  const email = validEmail(req.nextUrl.searchParams.get('email'))
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })
  const ip = clientIp(req)

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
  const base = () => supabaseAdmin.from('login_attempts').select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since)
  const mine = await base().eq('ip', ip)
  let attempts: number, total: number
  if (mine.error) { // colonne ip absente : ancien comportement
    const all = await base()
    attempts = total = all.count || 0
  } else {
    attempts = mine.count || 0
    total = (await base()).count || 0
  }

  if (attempts >= MAX_ATTEMPTS || total >= MAX_ATTEMPTS_ALL) {
    const q = supabaseAdmin.from('login_attempts').select('created_at').eq('email', email).gte('created_at', since)
    const { data: oldest } = await (mine.error || total >= MAX_ATTEMPTS_ALL ? q : q.eq('ip', ip)).order('created_at', { ascending: true }).limit(1).maybeSingle()
    const retryAfterSeconds = oldest
      ? Math.max(0, Math.ceil((new Date(oldest.created_at).getTime() + WINDOW_MINUTES * 60_000 - Date.now()) / 1000))
      : WINDOW_MINUTES * 60
    return NextResponse.json({ locked: true, retryAfterSeconds })
  }
  return NextResponse.json({ locked: false })
}

export async function POST(req: NextRequest) {
  // une meme adresse ne peut pas remplir la table (ni verrouiller des comptes en rafale)
  if (rateLimited(req, 'login-attempt', 20, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const body = await req.json().catch(() => ({}))
  const clean = validEmail(body?.email)
  if (!clean) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

  const ip = clientIp(req)
  const ins = await supabaseAdmin.from('login_attempts').insert({ email: clean, ip })
  if (ins.error) await supabaseAdmin.from('login_attempts').insert({ email: clean }) // colonne ip absente
  // Purge opportuniste des lignes de plus de 24h pour cet email -- evite une
  // table qui grossit sans fin sans avoir besoin d'un cron dedie.
  await supabaseAdmin.from('login_attempts').delete()
    .eq('email', clean).lt('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())

  return NextResponse.json({ ok: true })
}
