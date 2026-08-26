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

  const country = req.nextUrl.searchParams.get('country')
  if (!country || country.length !== 2) {
    return NextResponse.json({ error: 'country param required (2 chars)' }, { status: 400 })
  }

  const minutesParam = req.nextUrl.searchParams.get('minutes')
  const pMinutes = minutesParam ? parseInt(minutesParam, 10) : null

  // p_minutes toujours explicite (même null) — voir /api/admin/geo pour le détail
  // de l'ambiguïté de surcharge PostgREST évitée ici.
  const { data, error } = await admin.rpc('get_users_by_country', {
    p_country: country.toUpperCase(),
    p_minutes: pMinutes,
  })
  if (error) {
    console.error('[users-geo] error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
