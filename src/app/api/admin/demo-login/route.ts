import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { DEMO_ACCOUNT_EMAIL } from '@/lib/demoAccount'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Genere un token de connexion a usage unique vers le compte demo (salons de
// cartes) -- le mot de passe du compte demo n'est jamais transmis au client,
// seul un admin authentifie peut declencher cette route (voir requireAdmin).
//
// Le client verifie ce token via supabase.auth.verifyOtp() plutot que de
// suivre action_link en redirection : le site utilise flowType: 'pkce'
// (supabase.ts), qui REJETTE les liens magiques classiques generes cote
// serveur (AuthPKCEGrantCodeExchangeError -- callbackUrlType 'implicit' vs
// flowType 'pkce', voir GoTrueClient._initialize()). verifyOtp() etablit la
// session directement via l'API, sans dependre de la detection d'URL.
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEMO_ACCOUNT_EMAIL,
  })
  if (error || !data?.properties?.hashed_token) {
    console.error('[demo-login] generateLink error', error)
    return NextResponse.json({ error: 'Impossible de generer le token demo' }, { status: 500 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token })
}
