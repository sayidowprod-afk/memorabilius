import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { DEMO_ACCOUNT_EMAIL } from '@/lib/demoAccount'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Genere un lien de connexion a usage unique vers le compte demo (salons de
// cartes) -- le mot de passe du compte demo n'est jamais transmis au client,
// seul un admin authentifie peut declencher cette route (voir requireAdmin).
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: DEMO_ACCOUNT_EMAIL,
  })
  if (error || !data?.properties?.action_link) {
    console.error('[demo-login] generateLink error', error)
    return NextResponse.json({ error: 'Impossible de generer le lien demo' }, { status: 500 })
  }

  return NextResponse.json({ link: data.properties.action_link })
}
