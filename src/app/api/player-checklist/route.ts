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

  // Paginate through all entries — no hard limit, handles any player size.
  const PAGE = 1000
  const all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await admin
      .from('card_set_entries')
      .select('id, set_id, card_number, variation, is_rc, card_sets(id, name, year, brand, sport)')
      .ilike('player_name', `${firstName}%`)
      .ilike('player_name', `%${lastName}%`)
      .order('set_id')
      .order('card_number')
      .range(from, from + PAGE - 1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return NextResponse.json({ entries: all })
}
