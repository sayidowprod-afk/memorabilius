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

async function fetchVercelCountries(days: number): Promise<{ code: string; visitors: number }[] | null> {
  const token   = process.env.VERCEL_TOKEN
  const team    = process.env.VERCEL_TEAM_SLUG
  const project = process.env.VERCEL_PROJECT_NAME
  if (!token || !team || !project) return null

  let teamId = team
  let projectId = project
  try {
    const teamRes = await fetch(`https://api.vercel.com/v2/teams?slug=${encodeURIComponent(team)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (teamRes.ok) {
      const teamJson = await teamRes.json()
      const found = teamJson.teams?.[0]?.id ?? teamJson.id
      if (found) teamId = found
    }
  } catch { /* keep slug as fallback */ }

  try {
    const projRes = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(project)}?teamId=${encodeURIComponent(teamId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (projRes.ok) {
      const projJson = await projRes.json()
      if (projJson.id) projectId = projJson.id
    }
  } catch { /* keep name as fallback */ }

  try {
    const from = new Date(Date.now() - days * 86400000).getTime()
    const to   = Date.now()
    const url  = `https://api.vercel.com/v1/web-analytics/breakdown?teamId=${encodeURIComponent(teamId)}&projectId=${encodeURIComponent(projectId)}&from=${from}&to=${to}&event=pageview&groupBy=country&limit=100`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[geo] Vercel breakdown API error', res.status, await res.text().catch(() => '').then(t => t.slice(0, 200)))
      return null
    }

    const json = await res.json()
    const rows: unknown[] = json.data ?? json.rows ?? []
    return (rows as Record<string, unknown>[])
      .map(r => ({
        code: String(r.key ?? r.country ?? '').toUpperCase(),
        visitors: Number(r.total ?? r.count ?? 0),
      }))
      .filter(r => r.code.length === 2 && r.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  } catch (e) {
    console.error('[geo] fetchVercelCountries error', e)
    return null
  }
}

async function fetchPageViewsByCountry(days: number): Promise<{ code: string; visitors: number }[]> {
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data } = await admin
      .from('page_views')
      .select('country')
      .gte('created_at', since)
    if (!data) return []
    const counts: Record<string, number> = {}
    for (const row of data as { country: string }[]) {
      const c = (row.country || 'XX').toUpperCase()
      if (c !== 'XX' && c.length === 2) counts[c] = (counts[c] || 0) + 1
    }
    return Object.entries(counts)
      .map(([code, visitors]) => ({ code, visitors }))
      .filter(r => r.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(authToken)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))

  const token   = process.env.VERCEL_TOKEN
  const team    = process.env.VERCEL_TEAM_SLUG
  const project = process.env.VERCEL_PROJECT_NAME
  const varsOk  = !!(token && team && project)

  const countries = varsOk
    ? ((await fetchVercelCountries(days)) ?? await fetchPageViewsByCountry(days))
    : await fetchPageViewsByCountry(days)

  return NextResponse.json({
    countries: countries ?? [],
    available: true,
    varsPresent: varsOk,
  })
}
