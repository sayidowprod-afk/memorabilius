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

  try {
    const from = new Date(Date.now() - days * 86400000).getTime()
    const to   = Date.now()
    // Vercel Web Analytics breakdown by country
    const url  = `https://vercel.com/api/web/analytics/breakdown?teamId=${team}&projectId=${project}&from=${from}&to=${to}&event=pageview&groupBy=country&limit=100`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const rows: unknown[] = json.data ?? json.rows ?? []
    return (rows as Record<string, unknown>[])
      .map(r => ({
        code: String(r.key ?? r.country ?? '').toUpperCase(),
        visitors: Number(r.total ?? r.count ?? 0),
      }))
      .filter(r => r.code.length === 2 && r.visitors > 0)
      .sort((a, b) => b.visitors - a.visitors)
  } catch {
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

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)))
  const countries = await fetchVercelCountries(days)

  return NextResponse.json({
    countries: countries ?? [],
    available: countries !== null,
  })
}
