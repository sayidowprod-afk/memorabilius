import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { loadAlertPrefs, notifyEbay, shortTitle } from '@/lib/ebaySync'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Toutes les 15 min (vercel.json) : rappel « dernière minute » pour les enchères eBay des membres qui se terminent dans
// moins de ~16 min (la fenêtre couvre l'intervalle entre deux passages, aucune enchère n'est manquée). Ne contacte PAS eBay : s'appuie sur les enchères déjà enregistrées (fin_at, dernier prix connu), donc
// quasi gratuit. Un drapeau évite d'envoyer deux fois le rappel pour la même enchère.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = Date.now()
  const { data, error } = await supabase.from('achats_membre')
    .select('id, user_id, titre, prix_actuel, devise, en_tete, fin_at')
    .eq('source', 'ebay').eq('type', 'enchere').eq('alerte_5min_envoyee', false)
    .gt('fin_at', new Date(now).toISOString()).lte('fin_at', new Date(now + 16 * 60000).toISOString())
    .limit(300)
  // migration 20261104 pas encore appliquée : rien à faire
  if (error) return NextResponse.json({ sent: 0, note: error.message })

  const prefsByUser = new Map<string, Awaited<ReturnType<typeof loadAlertPrefs>>>()
  let sent = 0
  for (const r of data || []) {
    let prefs = prefsByUser.get(r.user_id)
    if (!prefs) { prefs = await loadAlertPrefs(r.user_id); prefsByUser.set(r.user_id, prefs) }
    const min = Math.max(1, Math.round((new Date(r.fin_at).getTime() - now) / 60000))
    const prix = r.prix_actuel !== null ? ` — dernier prix connu ${Number(r.prix_actuel).toFixed(2).replace('.', ',')} ${r.devise === 'EUR' || !r.devise ? '€' : r.devise}` : ''
    const etat = r.en_tete === true ? ' · tu es en tête' : r.en_tete === false ? ' · tu es surenchéri' : ''
    await notifyEbay(r.user_id, `Fin dans ~${min} min : « ${shortTitle(r.titre)} »${prix}${etat}`, 'Dernière minute', 'fin5min', prefs)
    await supabase.from('achats_membre').update({ alerte_5min_envoyee: true }).eq('id', r.id)
    sent++
  }
  return NextResponse.json({ sent })
}
