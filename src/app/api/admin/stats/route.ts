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

function last7FromSeries(series: Array<{ day: string; count: number }>): Array<{ day: string; count: number }> {
  const map = new Map((series || []).map((p) => [p.day.slice(0, 10), p.count]))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - (6 - i))
    const day = d.toISOString().slice(0, 10)
    return { day, count: map.get(day) ?? 0 }
  })
}

// Pages vues depuis Vercel Analytics API
// Nécessite VERCEL_TOKEN + VERCEL_TEAM_SLUG + VERCEL_PROJECT_NAME en env vars
async function getVercelPageviews(d7Start: string): Promise<Record<string, number> | null> {
  const token   = process.env.VERCEL_TOKEN
  const team    = process.env.VERCEL_TEAM_SLUG
  const project = process.env.VERCEL_PROJECT_NAME
  if (!token || !team || !project) return null

  try {
    const from = new Date(d7Start + 'T00:00:00.000Z').getTime()
    const to   = Date.now()
    const url  = `https://vercel.com/api/web/analytics/timeseries?teamId=${team}&projectId=${project}&from=${from}&to=${to}&granularity=1d&event=pageview`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const result: Record<string, number> = {}
    for (const point of json.data || []) {
      const day = typeof point.key === 'string' ? point.key.slice(0, 10) : ''
      if (day) result[day] = (result[day] || 0) + (point.total ?? 0)
    }
    return result
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const d7Start   = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const d7StartTs = d7Start + 'T00:00:00.000Z'

  const [rpcResult, activityCards, activityScans, pageviewsByDay] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.from('cartes_manuelles').select('user_id, created_at').gte('created_at', d7StartTs),
    admin.from('ai_scan_events').select('user_id, created_at').gte('created_at', d7StartTs),
    getVercelPageviews(d7Start),
  ])

  if (rpcResult.error) return NextResponse.json({ error: rpcResult.error.message }, { status: 500 })

  const rpcData    = rpcResult.data as any
  const allActivity = [...(activityCards.data || []), ...(activityScans.data || [])]

  const last_7_days = {
    users:     last7FromSeries(rpcData.user_daily ?? []),
    cards:     last7FromSeries(rpcData.card_daily ?? []),
    active:    daily7(distinctByDay(allActivity)),
    pageviews: pageviewsByDay ? daily7(pageviewsByDay) : null,
  }

  return NextResponse.json({ ...rpcData, last_7_days })
}
