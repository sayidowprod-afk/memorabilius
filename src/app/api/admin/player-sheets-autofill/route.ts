import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { fetchEspnPlayerAutofill } from '@/lib/espnHeadshot'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 20

const admin = createServerServiceClient()

export async function GET(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'missing name' }, { status: 400 })

  const data = await fetchEspnPlayerAutofill(name, 'nba')
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json(data)
}
