import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats, isAllowedCsvUrl } from '@/lib/csvParse'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Caller must be authenticated as the user being recalculated
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user: caller } } = await supabase.auth.getUser(token)
    if (!caller || caller.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, lien_csv')
      .eq('id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

    const hasCsv = !!(profile.lien_csv && isAllowedCsvUrl(profile.lien_csv))
    const csvText = hasCsv
      ? await fetchCsvCapped(profile.lien_csv, { cache: 'no-store', signal: AbortSignal.timeout(12000) })
      : null

    // Un CSV configure dont la recuperation echoue ne doit jamais etre traite comme
    // "pas de CSV" -- sinon stats_total est ecrase avec un total tronque (voir
    // recalcul-stats/route.ts pour le detail, meme bug confirme en prod).
    if (hasCsv && !csvText) {
      return NextResponse.json({ error: 'CSV fetch failed, stats not updated' }, { status: 502 })
    }
    if (csvText) {
      const s = parseCardStats(csvText)
      stats.total += s.total
      stats.rc += s.rc
      stats.auto += s.auto
      stats.num += s.num
      stats.patch += s.patch
    }

    // Pagination pour bypasser le max_rows=1000 de Supabase (identique à la galerie).
    // Une page en erreur (ex: instabilité réseau/Supabase) NE DOIT PAS être confondue
    // avec "plus de cartes" — sinon on écrase stats_total en base avec un total tronqué
    // (c'est exactement ce qui est arrivé pendant la panne Supabase du 14/08 : plein
    // de profils bloqués à exactement 1000 alors qu'ils avaient 3000+ cartes).
    // .order('id') obligatoire -- sans tri explicite, l'ordre entre deux .range()
    // successifs n'est pas garanti par Postgres/PostgREST, ce qui peut faire sauter
    // des lignes entre les pages et sous-compter (voir recalcul-stats/route.ts).
    for (let from = 0; ; from += 1000) {
      const { data: batch, error: batchError } = await supabase
        .from('cartes_manuelles')
        .select('rc, auto, patch, num')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (batchError) return NextResponse.json({ error: batchError.message }, { status: 502 })
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
