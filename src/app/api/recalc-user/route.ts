import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped, parseCardStats } from '@/lib/csvParse'

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

    const [csvText, manuellesRes] = await Promise.all([
      profile.lien_csv ? fetchCsvCapped(profile.lien_csv) : Promise.resolve(null),
      supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', userId).limit(10000),
    ])

    if (csvText) {
      const s = parseCardStats(csvText)
      stats.total += s.total
      stats.rc += s.rc
      stats.auto += s.auto
      stats.num += s.num
      stats.patch += s.patch
    }

    if (manuellesRes.data) {
      for (const m of manuellesRes.data) {
        stats.total++
        if (m.rc) stats.rc++
        if (m.auto) stats.auto++
        if (m.patch) stats.patch++
        if (m.num) stats.num++
      }
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
