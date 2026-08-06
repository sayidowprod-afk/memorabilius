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

function distinctByDay(rows: Array<{ user_id?: string | null; created_at: string }>): Record<string, number> {
  const sets: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (!r.user_id) continue
    const day = r.created_at.slice(0, 10)
    if (!sets[day]) sets[day] = new Set()
    sets[day].add(r.user_id)
  }
  return Object.fromEntries(Object.entries(sets).map(([d, s]) => [d, s.size]))
}

function daily7(counts: Record<string, number>): Array<{ day: string; count: number }> {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    const day = d.toISOString().slice(0, 10)
    return { day, count: counts[day] || 0 }
  })
}

// Pagine tous les users pour compter les dernières connexions par jour
async function getSigninsByDay(d7Start: string): Promise<Record<string, number>> {
  const signins: Record<string, number> = {}
  let page = 1
  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (!data?.users?.length) break
    for (const u of data.users) {
      if (!u.last_sign_in_at) continue
      const day = u.last_sign_in_at.slice(0, 10)
      if (day >= d7Start) signins[day] = (signins[day] || 0) + 1
    }
    if (!(data as any).nextPage) break
    page++
  }
  return signins
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const d7Start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const d7StartTs = d7Start + 'T00:00:00.000Z'

  const [rpcResult, activityCards, activityScans, signinsByDay] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.from('cartes_manuelles').select('user_id, created_at').gte('created_at', d7StartTs),
    admin.from('ai_scan_events').select('user_id, created_at').gte('created_at', d7StartTs),
    getSigninsByDay(d7Start),
  ])

  if (rpcResult.error) return NextResponse.json({ error: rpcResult.error.message }, { status: 500 })

  const rpcData = rpcResult.data as any

  // Extraire les 7 derniers jours depuis les séries du RPC (même source que les graphiques)
  function last7FromSeries(series: Array<{ day: string; count: number }>): Array<{ day: string; count: number }> {
    const map = new Map((series || []).map((p: { day: string; count: number }) => [p.day.slice(0, 10), p.count]))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - (6 - i))
      const day = d.toISOString().slice(0, 10)
      return { day, count: map.get(day) ?? 0 }
    })
  }

  const allActivity = [
    ...(activityCards.data || []),
    ...(activityScans.data || []),
  ]

  const last_7_days = {
    users:   last7FromSeries(rpcData.user_daily ?? []),
    cards:   last7FromSeries(rpcData.card_daily ?? []),
    signins: daily7(signinsByDay),
    active:  daily7(distinctByDay(allActivity)),
  }

  return NextResponse.json({ ...rpcData, last_7_days })
}
