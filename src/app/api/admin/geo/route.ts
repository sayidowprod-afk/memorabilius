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

  const minutesParam = req.nextUrl.searchParams.get('minutes')
  const pMinutes = minutesParam ? parseInt(minutesParam, 10) : null

  const { data, error } = await admin.rpc('get_users_country_breakdown', {
    ...(pMinutes ? { p_minutes: pMinutes } : {}),
  })
  if (error) console.error('[geo] get_users_country_breakdown error', error)

  const countries = ((data ?? []) as { country: string; count: number }[])
    .map(r => ({ code: r.country, visitors: Number(r.count) }))

  return NextResponse.json({ countries, available: true })
}
