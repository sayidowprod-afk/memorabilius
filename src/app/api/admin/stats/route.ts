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

function groupByDay(rows: Array<{ created_at: string }>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    const day = (r.created_at || '').slice(0, 10)
    if (day) counts[day] = (counts[day] || 0) + 1
  }
  return counts
}

function daily7(counts: Record<string, number>): Array<{ day: string; count: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    const day = d.toISOString().slice(0, 10)
    return { day, count: counts[day] || 0 }
  })
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const d7Start = new Date(Date.now() - 7 * 86400000).toISOString()

  const [rpcResult, usersWeek, cardsWeek, scansWeek] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.from('profiles').select('created_at').gte('created_at', d7Start),
    admin.from('cartes_manuelles').select('created_at').gte('created_at', d7Start),
    admin.from('ai_scan_events').select('created_at').gte('created_at', d7Start),
  ])

  if (rpcResult.error) return NextResponse.json({ error: rpcResult.error.message }, { status: 500 })

  const last_7_days = {
    users: daily7(groupByDay(usersWeek.data || [])),
    cards: daily7(groupByDay(cardsWeek.data || [])),
    scans: daily7(groupByDay(scansWeek.data || [])),
  }

  return NextResponse.json({ ...rpcResult.data, last_7_days })
}
