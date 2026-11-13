import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()
const STATUSES = ['planned', 'ready', 'posted', 'skipped']
const DAY = /^\d{4}-\d{2}-\d{2}$/

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD : les statuts du calendrier de publication.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(admin, req.headers.get('authorization')))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const from = req.nextUrl.searchParams.get('from') || '', to = req.nextUrl.searchParams.get('to') || ''
  if (!DAY.test(from) || !DAY.test(to)) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { data, error } = await admin.from('pub_calendar').select('day, slot, status, note').gte('day', from).lte('day', to)
  if (error) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  return NextResponse.json(data || [])
}

// POST { day, slot, status } : change l'état d'un créneau (« none » le retire).
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(admin, req.headers.get('authorization')))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const day = String(b?.day || ''), slot = String(b?.slot || '').slice(0, 40), status = String(b?.status || '')
  if (!DAY.test(day) || !slot) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  if (status === 'none') {
    const { error } = await admin.from('pub_calendar').delete().eq('day', day).eq('slot', slot)
    return error ? NextResponse.json({ error: 'unavailable' }, { status: 503 }) : NextResponse.json({ ok: true })
  }
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { error } = await admin.from('pub_calendar').upsert({ day, slot, status, updated_at: new Date().toISOString() }, { onConflict: 'day,slot' })
  return error ? NextResponse.json({ error: 'unavailable' }, { status: 503 }) : NextResponse.json({ ok: true })
}
