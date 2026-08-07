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

  // Single query with JOIN — replaces the sequential pagination loop + N+1 card_sets fetch.
  // Requires the trigram index on player_name (see 20260807_performance_indexes.sql).
  const { data: entries, error } = await admin
    .from('card_set_entries')
    .select('id, set_id, card_number, variation, is_rc, card_sets(id, name, year, brand, sport)')
    .ilike('player_name', `${firstName}%`)
    .ilike('player_name', `%${lastName}%`)
    .order('set_id')
    .order('card_number')
    .limit(5000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: entries || [] })
}
