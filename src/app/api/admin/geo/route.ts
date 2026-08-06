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

  // Résoudre le slug équipe en teamId réel via l'API Vercel
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
    const url  = `https://vercel.com/api/web/analytics/breakdown?teamId=${teamId}&projectId=${projectId}&from=${from}&to=${to}&event=pageview&groupBy=country&limit=100`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[geo] Vercel breakdown API error', res.status, errText.slice(0, 200))
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

export async function GET(req: NextRequest) {
  const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(authToken)
  if (!user || !ADMIN_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const token   = process.env.VERCEL_TOKEN
  const team    = process.env.VERCEL_TEAM_SLUG
  const project = process.env.VERCEL_PROJECT_NAME
  const varsOk  = !!(token && team && project)

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const countries = varsOk ? await fetchVercelCountries(days) : null

  return NextResponse.json({
    countries: countries ?? [],
    available: varsOk && countries !== null,
    varsPresent: varsOk,
  })
}
