import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const cardKey = req.nextUrl.searchParams.get('cardKey')
  if (!cardKey) return NextResponse.json({ points: [] })

  const { data } = await supabase
    .from('card_price_history')
    .select('snapshot_date, median_price, sample_type')
    .eq('card_key', cardKey)
    .order('snapshot_date', { ascending: true })
    .limit(90)

  return NextResponse.json({ points: data || [] })
}
