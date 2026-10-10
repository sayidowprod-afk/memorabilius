import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rootEntryIds } from '@/lib/setFamilies'

export const maxDuration = 30
export const revalidate = 3600

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Entrees "racines" d'un set (une par carte, paralleles ecartes) : voir lib/setFamilies.ts.
// Reponse : { rootIds, variations: [{ variation, count }] } -- les variations ne comptent que les racines.
export async function GET(req: NextRequest) {
  const setId = parseInt(req.nextUrl.searchParams.get('setId') || '', 10)
  if (!setId) return NextResponse.json({ error: 'setId' }, { status: 400 })
  const entries: { id: number; player_name: string | null; variation: string | null; card_number: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('card_set_entries').select('id, player_name, variation, card_number').eq('set_id', setId).order('id').range(from, from + 999)
    if (!data?.length) break
    entries.push(...(data as any[]))
    if (data.length < 1000) break
  }
  const roots = rootEntryIds(entries)
  const counts = new Map<string, number>()
  for (const e of entries) if (roots.has(e.id)) counts.set(e.variation || 'Base', (counts.get(e.variation || 'Base') || 0) + 1)
  return NextResponse.json(
    { rootIds: [...roots], total: entries.length, variations: [...counts.entries()].map(([variation, count]) => ({ variation, count })) },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
