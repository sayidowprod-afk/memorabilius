import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats, isAllowedCsvUrl } from '@/lib/csvParse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, lien_csv')
    .not('display_name', 'is', null)
    .neq('display_name', '')
    .limit(10000)

  if (!profiles) return NextResponse.json({ error: 'No profiles' })

  const processProfile = async (p: { id: string; lien_csv: string | null }) => {
    try {
      const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

      if (p.lien_csv && isAllowedCsvUrl(p.lien_csv)) {
        const text = await fetchCsvCapped(p.lien_csv)
        if (text) {
          const csvStats = parseCardStats(text)
          stats.total += csvStats.total
          stats.rc += csvStats.rc
          stats.auto += csvStats.auto
          stats.num += csvStats.num
          stats.patch += csvStats.patch
        }
      }

      // Pagination pour bypasser le max_rows=1000 de Supabase
      for (let from = 0; ; from += 1000) {
        const { data: batch } = await supabase
          .from('cartes_manuelles')
          .select('rc, auto, patch, num')
          .eq('user_id', p.id)
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
      }).eq('id', p.id)

      return { id: p.id, stats }
    } catch (e) {
      return { id: p.id, error: String(e) }
    }
  }

  // Traitement en batches de 20 profils en parallèle
  const BATCH = 20
  const results = []
  for (let i = 0; i < profiles.length; i += BATCH) {
    const batch = profiles.slice(i, i + BATCH)
    const batchResults = await Promise.all(batch.map(processProfile))
    results.push(...batchResults)
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
