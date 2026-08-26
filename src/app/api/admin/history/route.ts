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

  const { data, error } = await admin
    .from('stats_snapshots')
    .select('day, total_users, total_cards, active_users, total_scans')
    .order('day', { ascending: false })
    .limit(400)

  if (error) {
    console.error('[history] error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ snapshots: data ?? [] })
}
