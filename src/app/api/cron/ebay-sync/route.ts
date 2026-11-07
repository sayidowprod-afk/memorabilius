import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { syncMember } from '@/lib/ebaySync'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Toutes les 15 min (vercel.json) : synchronise les membres qui ont une enchère ou un article suivi qui se termine dans
// les prochaines 24 h (ou s'est terminé il y a moins de 2 h, pour annoncer « gagné » / « perdu »), puis, à défaut, les
// membres pas synchronisés depuis 6 h. Chaque exécution est plafonnée pour rester sous la durée maximale.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const now = Date.now()

  const { data: conns } = await supabase.from('ebay_connexions').select('user_id, derniere_synchro_at').eq('statut', 'connecte')
  if (!conns?.length) return NextResponse.json({ synced: 0 })

  const { data: soon } = await supabase.from('achats_membre').select('user_id')
    .eq('source', 'ebay').in('type', ['enchere', 'suivi'])
    .gte('fin_at', new Date(now - 2 * 3600000).toISOString()).lte('fin_at', new Date(now + 24 * 3600000).toISOString())
  const urgent = new Set((soon || []).map(r => r.user_id))

  const age = (c: { derniere_synchro_at: string | null }) => (c.derniere_synchro_at ? now - new Date(c.derniere_synchro_at).getTime() : Infinity)
  const due = conns
    .filter(c => (urgent.has(c.user_id) && age(c) > 14 * 60000) || age(c) > 6 * 3600000)
    .sort((a, b) => age(b) - age(a))
    .slice(0, 40)

  let ok = 0, failed = 0
  for (let i = 0; i < due.length && Date.now() - started < 45000; i += 4) {
    const results = await Promise.all(due.slice(i, i + 4).map(c => syncMember(c.user_id)))
    for (const r of results) r.ok ? ok++ : failed++
  }
  return NextResponse.json({ due: due.length, synced: ok, failed })
}
