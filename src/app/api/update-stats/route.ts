import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats, isAllowedCsvUrl } from '@/lib/csvParse'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, csvUrl } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user || user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (csvUrl && !csvUrl.startsWith('https://docs.google.com/spreadsheets/')) {
      return NextResponse.json({ error: 'Invalid CSV URL' }, { status: 400 })
    }

    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }
    const hasCsv = !!(csvUrl && isAllowedCsvUrl(csvUrl))

    // CSV en parallèle avec la première page de cartes manuelles.
    // .order('id') obligatoire -- sans tri explicite, l'ordre entre deux .range()
    // successifs n'est pas garanti par Postgres/PostgREST, ce qui peut faire sauter
    // des lignes entre les pages et sous-compter (confirme en prod sur un profil
    // recalcule a 1022 au lieu de 4446 reelles).
    const [csvText, firstPage] = await Promise.all([
      hasCsv ? fetchCsvCapped(csvUrl) : Promise.resolve(null),
      supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', userId).order('id', { ascending: true }).range(0, 999),
    ])

    // Un CSV configure dont la recuperation echoue (timeout, rate-limit Google
    // Sheets...) ne doit jamais etre traite comme "pas de CSV" -- sinon
    // stats_total est ecrase avec le seul compte de cartes manuelles, et cet
    // endpoint etant appele a CHAQUE sauvegarde de profil (pas seulement un
    // changement de lien CSV, voir profil/page.tsx), la valeur fausse repart
    // avec un stats_updated_at frais qui bloque le cron de rattrapage pendant
    // 24h (meme bug que celui deja corrige dans recalcStats.ts/recalcul-stats).
    if (hasCsv && !csvText) {
      return NextResponse.json({ error: 'csv fetch failed' }, { status: 502 })
    }

    if (csvText) {
      const csvStats = parseCardStats(csvText)
      stats.total += csvStats.total
      stats.rc += csvStats.rc
      stats.auto += csvStats.auto
      stats.num += csvStats.num
      stats.patch += csvStats.patch
    }

    // Une page en erreur (reseau/instabilite Supabase) ne doit jamais etre
    // confondue avec "plus de cartes" -- sinon stats_total est ecrase avec un
    // total tronque a un multiple de 1000 (bug distinct de celui du CSV
    // ci-dessus, touche aussi les comptes sans CSV des qu'ils depassent 1000
    // cartes manuelles). Meme protection que recalcStats.ts/recalcul-stats.ts.
    if (firstPage.error) {
      return NextResponse.json({ error: firstPage.error.message }, { status: 502 })
    }
    const manuelles: any[] = [...(firstPage.data || [])]
    for (let page = 1; manuelles.length === page * 1000; page++) {
      const { data, error } = await supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', userId).order('id', { ascending: true }).range(page * 1000, page * 1000 + 999)
      if (error) return NextResponse.json({ error: error.message }, { status: 502 })
      if (!data || data.length === 0) break
      manuelles.push(...data)
    }

    manuelles.forEach((m: any) => {
      stats.total++
      if (m.rc) stats.rc++
      if (m.auto) stats.auto++
      if (m.patch) stats.patch++
      if (m.num) stats.num++
    })

    // Le compteur mensuel (monthly_additions) n'est PAS mis à jour ici.
    // Un CSV n'a pas de date d'ajout par ligne : comparer le total actuel à
    // l'ancien stats_total ne dit pas QUAND ces cartes ont été ajoutées — juste
    // que le compte a changé (première synchro CSV, lien CSV modifié, etc.).
    // Ça avait déjà causé un faux "+358 ce mois-ci" pour un compte dont le CSV
    // n'avait jamais été comptabilisé avant. Seul /api/card-added (ajout manuel
    // en temps réel, horodatage fiable) alimente le classement mensuel.

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
