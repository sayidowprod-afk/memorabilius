import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats } from '@/lib/csvParse'

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
    .not('lien_csv', 'is', null)
    .neq('lien_csv', '')

  if (!profiles) return NextResponse.json({ error: 'No profiles' })

  const results = []

  for (const p of profiles) {
    try {
      const text = await fetchCsvCapped(p.lien_csv)
      if (!text) { results.push({ id: p.id, error: 'fetch failed' }); continue }

      const stats = parseCardStats(text)

      // monthly_additions n'est pas touché ici : un CSV n'a pas de date d'ajout
      // par ligne, donc comparer à l'ancien stats_total ne dit pas QUAND ces
      // cartes ont été ajoutées (a déjà causé un faux "+358 ce mois-ci" pour un
      // compte dont le CSV n'avait jamais été comptabilisé avant). Seul
      // /api/card-added (ajout manuel en temps réel) alimente le classement mensuel.
      await supabase.from('profiles').update({
        stats_total: stats.total,
        stats_rc: stats.rc,
        stats_auto: stats.auto,
        stats_num: stats.num,
        stats_patch: stats.patch,
        stats_updated_at: new Date().toISOString(),
      }).eq('id', p.id)

      results.push({ id: p.id, stats })
    } catch (e) {
      results.push({ id: p.id, error: String(e) })
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
