import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/trades/reputation?userId=... -- reputation publique d'un membre :
// echanges termines + note moyenne des avis recus. Tolere l'absence de la
// migration v2 (renvoie des zeros).
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: 'userId invalide' }, { status: 400 })

  const [{ count: completed }, { data: reviews }] = await Promise.all([
    supabase.from('trade_offers').select('id', { count: 'exact', head: true })
      .eq('status', 'completed').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
    supabase.from('trade_reviews').select('rating, comment, created_at, reviewer_id').eq('reviewed_id', userId)
      .order('created_at', { ascending: false }).limit(200),
  ])

  const ratings = (reviews || []).map(r => r.rating as number)
  const average = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null

  return NextResponse.json(
    { completed: completed || 0, reviewCount: ratings.length, average },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
  )
}
