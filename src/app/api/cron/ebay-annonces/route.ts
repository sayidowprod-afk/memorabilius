import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { syncAnnonces, rappelExpedition } from '@/lib/ebayAnnonces'
import { parisHour } from '@/lib/achatsAlertPrefs'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Toutes les heures (vercel.json) : lit les annonces eBay des membres connectés et envoie les alertes de vente (nouvelle enchère, suiveurs, fin
// dans 1 h, résultat). Un membre qui a des annonces en cours est lu à chaque passage ; les autres toutes les 6 h (le quota d'appels eBay est
// partagé par tous les membres). Chaque exécution est plafonnée pour rester sous la durée maximale. À 17 h (Paris) : rappel « colis à expédier ».
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const started = Date.now(), now = started

  const { data: conns, error: connErr } = await supabase.from('ebay_connexions').select('user_id, annonces_synchro_at').eq('statut', 'connecte')
  // colonne annonces_synchro_at absente = migration 20261116 pas encore appliquée : rien à faire
  if (connErr) return NextResponse.json({ synced: 0, note: connErr.message })
  if (!conns?.length) return NextResponse.json({ synced: 0 })

  // table pas encore créée (migration 20261116) : rien à faire
  const { data: act, error } = await supabase.from('ebay_annonces').select('user_id').eq('statut', 'active')
  if (error) return NextResponse.json({ synced: 0, note: error.message })
  const withListings = new Set((act || []).map(r => r.user_id as string))

  const age = (c: { annonces_synchro_at?: string | null }) => (c.annonces_synchro_at ? now - new Date(c.annonces_synchro_at).getTime() : Infinity)
  const due = conns
    .filter(c => withListings.has(c.user_id) ? age(c) > 40 * 60000 : age(c) > 6 * 3600000)
    .sort((a, b) => age(b) - age(a))
    .slice(0, 40)

  let ok = 0, failed = 0, alertes = 0
  for (let i = 0; i < due.length && Date.now() - started < 40000; i += 4) {
    const results = await Promise.all(due.slice(i, i + 4).map(c => syncAnnonces(c.user_id)))
    for (const r of results) { if (r.ok) { ok++; alertes += r.alertes } else failed++ }
  }

  // rappel d'expédition, une fois par jour
  let colis = 0
  if (parisHour() === 17 && Date.now() - started < 40000) {
    const { data: pend } = await supabase.from('ventes_membre').select('user_id').eq('source', 'ebay').not('paye_at', 'is', null).is('expedie_at', null)
      .lt('paye_at', new Date(now - 2 * 86400000).toISOString()).gt('paye_at', new Date(now - 30 * 86400000).toISOString()).limit(500)
    const users = [...new Set((pend || []).map(r => r.user_id as string))].slice(0, 30)
    for (let i = 0; i < users.length && Date.now() - started < 50000; i += 3) {
      const r = await Promise.all(users.slice(i, i + 3).map(u => rappelExpedition(u).catch(() => 0)))
      colis += r.reduce((a, b) => a + b, 0)
    }
  }
  return NextResponse.json({ due: due.length, synced: ok, failed, alertes, colis })
}
