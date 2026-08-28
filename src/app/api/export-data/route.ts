import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Export RGPD (droit a la portabilite) : renvoie un JSON de toutes les
// donnees personnelles de l'utilisateur connecte. Service role car certaines
// tables (messages recus) referencent l'utilisateur sans que ses propres
// policies RLS ne couvrent la lecture "recu par moi" dans tous les cas.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id

  const [profile, cards, wishlist, badges, sentMessages, receivedMessages, binders] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('cartes_manuelles').select('*').eq('user_id', userId),
    supabaseAdmin.from('wishlist').select('*').eq('user_id', userId),
    supabaseAdmin.from('badges').select('*').eq('user_id', userId),
    supabaseAdmin.from('messages').select('*').eq('from_user_id', userId),
    supabaseAdmin.from('messages').select('*').eq('to_user_id', userId),
    supabaseAdmin.from('binders').select('*').eq('user_id', userId),
  ])

  const exportPayload = {
    export_date: new Date().toISOString(),
    account_email: user.email,
    profile: profile.data,
    cartes: cards.data || [],
    wishlist: wishlist.data || [],
    badges: badges.data || [],
    messages_envoyes: sentMessages.data || [],
    messages_recus: receivedMessages.data || [],
    classeurs: binders.data || [],
  }

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="memorabilius-mes-donnees.json"`,
    },
  })
}
