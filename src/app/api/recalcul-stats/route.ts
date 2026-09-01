import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats, isAllowedCsvUrl } from '@/lib/csvParse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 300

// Avec des milliers de profils, recalculer TOUT LE MONDE chaque nuit depassait
// systematiquement la limite de temps de la fonction serverless -- les profils
// traites en dernier (ordre arbitraire) ne recevaient donc jamais leur mise a
// jour et restaient bloques indefiniment sur un total obsolete (ex: annuaire
// affichant 1022 cartes pour un profil qui en a reellement 4446). On traite
// desormais en priorite les profils les plus perimes, avec un plafond par
// execution pour garantir que ca termine dans les temps.
const STALE_AFTER_H = 24
const MAX_PER_RUN = 1500

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const staleBefore = new Date(Date.now() - STALE_AFTER_H * 3600_000).toISOString()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, lien_csv')
    .not('display_name', 'is', null)
    .neq('display_name', '')
    .or(`stats_updated_at.is.null,stats_updated_at.lt.${staleBefore}`)
    .order('stats_updated_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN)

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

      // Pagination pour bypasser le max_rows=1000 de Supabase. Une page en erreur
      // (réseau/instabilité Supabase) ne doit jamais être confondue avec "plus de
      // cartes" — sinon stats_total est écrasé en base avec un total tronqué (c'est
      // ce qui est arrivé pour de nombreux profils pendant la panne Supabase du 14/08,
      // ce cron tournant chaque nuit à 3h UTC sur tous les profils).
      // .order('id') est OBLIGATOIRE ici : sans tri explicite, Postgres/PostgREST ne
      // garantit aucun ordre stable entre deux appels .range() successifs -- des lignes
      // peuvent glisser entre les pages (surtout si des cartes sont ajoutees pendant le
      // recalcul), causant un sous-comptage silencieux (confirme en prod : un profil de
      // 4446 cartes recalcule a 1022 a cause de ca).
      for (let from = 0; ; from += 1000) {
        const { data: batch, error: batchError } = await supabase
          .from('cartes_manuelles')
          .select('rc, auto, patch, num')
          .eq('user_id', p.id)
          .order('id', { ascending: true })
          .range(from, from + 999)
        if (batchError) return { id: p.id, error: batchError.message }
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
