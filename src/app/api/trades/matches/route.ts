import { NextRequest, NextResponse } from 'next/server'
import { computeMatches } from '@/lib/tradeMatches'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 20

const supabase = createServerServiceClient()

// GET /api/trades/matches -- voir computeMatches (src/lib/tradeMatches.ts)
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await computeMatches(supabase, user.id))
}
