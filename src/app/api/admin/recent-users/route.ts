import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin.rpc('admin_get_recent_users', { p_limit: 25 })
  if (error) {
    console.error('[recent-users]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}
