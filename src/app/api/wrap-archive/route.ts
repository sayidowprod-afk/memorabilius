import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signWrapUrl } from '@/lib/wrapSign'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Liste les Wraps mensuels passés d'un utilisateur, avec leurs URLs signées
// (memes que celles envoyees par email/cron -- signWrapUrl n'a pas de date
// d'expiration, un Wrap reste donc valable indefiniment). Permet d'afficher
// une archive dans le profil au lieu de dependre d'un email qu'on a
// peut-etre supprime.
function monthName(date: Date) {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('created_at').eq('id', user.id).single()
  const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date()

  const now = new Date()
  // Dernier mois complet (le mois en cours n'a pas encore de Wrap envoye)
  const lastFullMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const months: { year: number; month: number; label: string; squareUrl: string; storyUrl: string }[] = []
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.memorabilius.fr'
  const cursor = new Date(lastFullMonth)
  const MAX_MONTHS = 24
  while (cursor >= new Date(createdAt.getFullYear(), createdAt.getMonth(), 1) && months.length < MAX_MONTHS) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth() + 1
    months.push({
      year: y,
      month: m,
      label: monthName(cursor),
      squareUrl: `${baseUrl}/api/wrap-image-public?uid=${user.id}&y=${y}&m=${m}&format=square&sig=${signWrapUrl(user.id, y, m, 'square')}`,
      storyUrl: `${baseUrl}/api/wrap-image-public?uid=${user.id}&y=${y}&m=${m}&format=story&sig=${signWrapUrl(user.id, y, m, 'story')}`,
    })
    cursor.setMonth(cursor.getMonth() - 1)
  }

  return NextResponse.json({ months })
}
