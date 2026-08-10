import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const runtime = 'edge'

export async function GET() {
  const { count } = await supabase
    .from('binders')
    .select('*', { count: 'exact', head: true })
    .neq('is_public', false)
    .gte('page_count', 1)

  if (!count) return NextResponse.json({ error: 'No binders' }, { status: 404 })

  const offset = Math.floor(Math.random() * count)
  const { data } = await supabase
    .from('binders')
    .select('id, user_id')
    .neq('is_public', false)
    .gte('page_count', 1)
    .range(offset, offset)
    .single()

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ userId: data.user_id, binderId: data.id })
}
