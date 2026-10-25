import { NextRequest, NextResponse } from 'next/server'
import { recalcAndSaveUserStats } from '@/lib/recalcStats'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 30

const supabase = createServerServiceClient()

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Caller must be authenticated as the user being recalculated
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user: caller } } = await supabase.auth.getUser(token)
    if (!caller || caller.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, lien_csv')
      .eq('id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const result = await recalcAndSaveUserStats(supabase, userId, profile.lien_csv, { csvTimeoutMs: 12000 })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 })

    return NextResponse.json({ ok: true, stats: result.stats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
