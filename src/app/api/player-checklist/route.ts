import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role bypasses RLS on card_set_entries (anon key is blocked by RLS policy)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const firstName = req.nextUrl.searchParams.get('firstName')?.trim()
  const lastName  = req.nextUrl.searchParams.get('lastName')?.trim()

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const rawEntries: { id: number; set_id: number; card_number: string | null; variation: string | null; is_rc: boolean }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from('card_set_entries')
      .select('id, set_id, card_number, variation, is_rc')
      .ilike('player_name', `${firstName}%`)
      .ilike('player_name', `%${lastName}%`)
      .order('set_id')
      .order('card_number')
      .range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    rawEntries.push(...data)
    if (data.length < PAGE) break
  }

  const uniqueSetIds = [...new Set(rawEntries.map(e => e.set_id))]
  const setsById = new Map<number, { id: number; name: string; year: number | null; brand: string | null; sport: string }>()
  if (uniqueSetIds.length > 0) {
    const CHUNK = 200
    for (let i = 0; i < uniqueSetIds.length; i += CHUNK) {
      const { data: setsData } = await admin
        .from('card_sets')
        .select('id, name, year, brand, sport')
        .in('id', uniqueSetIds.slice(i, i + CHUNK))
      if (setsData) for (const s of setsData) setsById.set(s.id, s)
    }
  }

  const entries = rawEntries.map(e => ({
    ...e,
    card_sets: setsById.get(e.set_id) ?? null,
  }))

  return NextResponse.json({ entries })
}
