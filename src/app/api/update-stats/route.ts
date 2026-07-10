import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats } from '@/lib/csvParse'

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

    // CSV et cartes manuelles sont indépendants → en parallèle
    const [csvText, manuellesRes] = await Promise.all([
      csvUrl ? fetchCsvCapped(csvUrl) : Promise.resolve(null),
      supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', userId),
    ])

    if (csvText) {
      const csvStats = parseCardStats(csvText)
      stats.total += csvStats.total
      stats.rc += csvStats.rc
      stats.auto += csvStats.auto
      stats.num += csvStats.num
      stats.patch += csvStats.patch
    }

    if (manuellesRes.data) {
      manuellesRes.data.forEach((m: any) => {
        stats.total++
        if (m.rc) stats.rc++
        if (m.auto) stats.auto++
        if (m.patch) stats.patch++
        if (m.num) stats.num++
      })
    }

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
