import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { fetchEspnPlayerAutofill } from '@/lib/espnHeadshot'

export const maxDuration = 20

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'missing name' }, { status: 400 })

  const data = await fetchEspnPlayerAutofill(name, 'nba')
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json(data)
}
