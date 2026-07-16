import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats } from '@/lib/csvParse'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, lien_csv')
      .eq('id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

    const csvText = profile.lien_csv
      ? await fetchCsvCapped(profile.lien_csv, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
      : null

    if (csvText) {
      const s = parseCardStats(csvText)
      stats.total += s.total
      stats.rc += s.rc
      stats.auto += s.auto
      stats.num += s.num
      stats.patch += s.patch
    }

    // Pagination pour bypasser le max_rows=1000 de Supabase (identique à la galerie)
    for (let from = 0; ; from += 1000) {
      const { data: batch } = await supabase
        .from('cartes_manuelles')
        .select('rc, auto, patch, num')
        .eq('user_id', userId)
        .range(from, from + 999)
      if (!batch || batch.length === 0) break
      for (const m of batch) {
        stats.total++
        if (m.rc) stats.rc++
        if (m.auto) stats.auto++
        if (m.patch) stats.patch++
        if (m.num) stats.num++
      }
      if (batch.length < 1000) break
    }

    await supabase.from('profiles').update({
      stats_total: stats.total,
      stats_rc: stats.rc,
      stats_auto: stats.auto,
      stats_num: stats.num,
      stats_patch: stats.patch,
      stats_updated_at: new Date().toISOString(),
    }).eq('id', userId)

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
