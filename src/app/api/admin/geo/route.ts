import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const minutesParam = req.nextUrl.searchParams.get('minutes')
  const pMinutes = minutesParam ? parseInt(minutesParam, 10) : null

  // p_minutes toujours passé explicitement (même null) : un appel sans aucun
  // argument est ambigu côté PostgREST s'il existe plusieurs signatures de la
  // fonction (ex: une variante sans paramètre coexistant avec p_minutes DEFAULT
  // NULL) — l'appel "Toujours" (period=all, p_minutes omis) échouait avec
  // PGRST203 "Could not choose the best candidate function".
  const { data, error } = await admin.rpc('get_users_country_breakdown', {
    p_minutes: pMinutes,
  })
  if (error) console.error('[geo] get_users_country_breakdown error', error)

  const countries = ((data ?? []) as { country: string; count: number }[])
    .map(r => ({ code: r.country, visitors: Number(r.count) }))

  return NextResponse.json({ countries, available: true })
}
