import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ADMIN_EMAILS = new Set([
  'kikibajkiki@gmail.com',
  'killian.bajoni@hotmail.fr',
  'killianbajoni@hotmail.com',
  'sayidowprod@gmail.com',
  ...(process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : []),
].map(e => e.toLowerCase()))

export async function GET(req: NextRequest) {
  const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(authToken)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now     = new Date()
  const m5      = new Date(now.getTime() - 5  * 60 * 1000).toISOString()
  const m15     = new Date(now.getTime() - 15 * 60 * 1000).toISOString()
  const h1      = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const today   = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z').toISOString()

  const [recentRes, m5Res, m15Res, h1Res, todayRes] = await Promise.all([
    admin.from('page_views')
      .select('path, country, created_at')
      .order('created_at', { ascending: false })
      .limit(30),
    admin.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', m5),
    admin.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', m15),
    admin.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', h1),
    admin.from('page_views').select('id', { count: 'exact', head: true }).gte('created_at', today),
  ])

  return NextResponse.json({
    counts: {
      m5:    m5Res.count    ?? 0,
      m15:   m15Res.count   ?? 0,
      h1:    h1Res.count    ?? 0,
      today: todayRes.count ?? 0,
    },
    recent: recentRes.data ?? [],
  })
}
