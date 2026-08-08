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


// Résout VERCEL_TEAM_SLUG → teamId et VERCEL_PROJECT_NAME → projectId
async function resolveVercelIds(token: string, teamSlug: string, projectName: string) {
  let teamId = teamSlug
  let projectId = projectName
  try {
    const r = await fetch(`https://api.vercel.com/v2/teams?slug=${encodeURIComponent(teamSlug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (r.ok) {
      const j = await r.json()
      const id = j.teams?.[0]?.id ?? j.id
      if (id) teamId = id
    }
  } catch { /* keep slug */ }
  try {
    const r = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?teamId=${encodeURIComponent(teamId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (r.ok) {
      const j = await r.json()
      if (j.id) projectId = j.id
    }
  } catch { /* keep name */ }
  return { teamId, projectId }
}

// Pages vues depuis Vercel Analytics API (public API v1)
// Nécessite VERCEL_TOKEN + VERCEL_TEAM_SLUG + VERCEL_PROJECT_NAME en env vars
async function getVercelPageviews(d7Start: string): Promise<Record<string, number> | null> {
  const token   = process.env.VERCEL_TOKEN
  const team    = process.env.VERCEL_TEAM_SLUG
  const project = process.env.VERCEL_PROJECT_NAME
  if (!token || !team || !project) return null

  try {
    const { teamId, projectId } = await resolveVercelIds(token, team, project)
    const from = new Date(d7Start + 'T00:00:00.000Z').getTime()
    const to   = Date.now()
    const url  = `https://api.vercel.com/v1/web-analytics/timeseries?teamId=${encodeURIComponent(teamId)}&projectId=${encodeURIComponent(projectId)}&from=${from}&to=${to}&granularity=day&event=pageview`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[stats] Vercel timeseries error', res.status, await res.text().catch(() => ''))
      return null
    }

    const json = await res.json()
    const result: Record<string, number> = {}
    for (const point of json.data || []) {
      const day = typeof point.key === 'string' ? point.key.slice(0, 10) : ''
      if (day) result[day] = (result[day] || 0) + (point.total ?? 0)
    }
    return result
  } catch (e) {
    console.error('[stats] getVercelPageviews error', e)
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

  const d7Start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const [rpcResult, signinsResult, pageviewsByDay] = await Promise.all([
    admin.rpc('admin_stats'),
    admin.rpc('get_signins_by_day'),
    getVercelPageviews(d7Start),
  ])

  if (rpcResult.error) return NextResponse.json({ error: rpcResult.error.message }, { status: 500 })

  const rpcData = rpcResult.data as any

  const signinsByDay: Record<string, number> = Object.fromEntries(
    ((signinsResult.data ?? []) as { day: string; count: number }[]).map(r => [r.day, r.count])
  )

  const last_7_days = {
    users:     last7FromSeries(rpcData.user_daily ?? []),
    cards:     last7FromSeries(rpcData.card_daily ?? []),
    active:    daily7(signinsByDay),
    pageviews: pageviewsByDay ? daily7(pageviewsByDay) : null,
  }

  return NextResponse.json({ ...rpcData, last_7_days })
}
