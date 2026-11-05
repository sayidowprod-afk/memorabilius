import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { parseSorties, SORTIES_SOURCE } from '@/lib/sortiesProduits'

export const maxDuration = 30

const supabase = createServerServiceClient()

// Une fois par semaine : relit le calendrier public des sorties de cartes de basket et met à jour la table card_releases.
// Une seule requête HTTP, aucun appel payant. Si la page change de forme et que rien n'est lu, on n'écrase rien.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let html = ''
  try {
    const r = await fetch(SORTIES_SOURCE.url, { headers: { 'User-Agent': 'MemorabiliusBot/1.0 (+https://www.memorabilius.fr)' }, cache: 'no-store', signal: AbortSignal.timeout(20000) })
    if (!r.ok) return NextResponse.json({ error: `source ${r.status}` }, { status: 502 })
    html = await r.text()
  } catch (e: any) {
    return NextResponse.json({ error: 'source injoignable', detail: e?.message }, { status: 502 })
  }

  const sorties = parseSorties(html)
  if (sorties.length === 0) return NextResponse.json({ error: 'aucune sortie lue (page modifiée ?)', read: 0 }, { status: 422 })

  const rows = sorties.map(s => ({ name: s.name, release_date: s.date, formats: s.formats, source: SORTIES_SOURCE.id, source_url: s.url, updated_at: new Date().toISOString() }))
  const { error } = await supabase.from('card_releases').upsert(rows, { onConflict: 'name,release_date' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ménage : les sorties passées depuis plus de 60 jours ne servent plus
  const limit = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  await supabase.from('card_releases').delete().lt('release_date', limit)
  return NextResponse.json({ ok: true, read: sorties.length })
}
