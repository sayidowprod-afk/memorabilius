import { createServerServiceClient } from '@/lib/supabaseServer'
import { sendPushToUser } from '@/lib/pushNotify'
import { decryptToken } from '@/lib/ebayCrypto'
import { EbayError, getMyBuying, type EbayArticle } from '@/lib/ebayTrading'

// Synchronisation d'un membre : lit son compte eBay (GetMyeBayBuying), met à jour `achats_membre` et envoie les alertes
// (surenchère, enchère gagnée / perdue, fin d'enchère proche). Appelée à l'ouverture de « Mes achats », au bouton
// « Actualiser » et par la tâche planifiée /api/cron/ebay-sync. Tout passe par le service role.
const sb = createServerServiceClient(30000)

export type SyncResult =
  | { ok: true; achats: number; encheres: number; suivis: number }
  | { ok: false; skipped?: boolean; error: string; reconnect?: boolean }

const HOUR = 3600000

async function notify(userId: string, message: string, pushTitle: string) {
  try {
    await sb.from('notifications').insert({ user_id: userId, type: 'ebay', message, lien: '/mes-achats', lu: false })
    await sendPushToUser(userId, { title: pushTitle, body: message, url: '/mes-achats', channelId: 'trades' })
  } catch { /* notification best-effort : jamais bloquante */ }
}

const price = (a: { prix_actuel: number | null; devise: string | null }) =>
  a.prix_actuel !== null ? ` (${a.prix_actuel.toFixed(2).replace('.', ',')} ${a.devise === 'EUR' || !a.devise ? '€' : a.devise})` : ''
const short = (t: string | null) => (t && t.length > 60 ? t.slice(0, 57) + '…' : t || 'un article')

export async function syncMember(userId: string, minIntervalMs = 0): Promise<SyncResult> {
  const { data: conn } = await sb.from('ebay_connexions')
    .select('token_chiffre, statut, ebay_user_id, derniere_synchro_at').eq('user_id', userId).maybeSingle()
  if (!conn || conn.statut !== 'connecte' || !conn.token_chiffre) return { ok: false, error: 'Compte eBay non connecté.', reconnect: conn?.statut === 'expire' }
  if (minIntervalMs && conn.derniere_synchro_at && Date.now() - new Date(conn.derniere_synchro_at).getTime() < minIntervalMs) {
    return { ok: false, skipped: true, error: 'Déjà à jour.' }
  }

  let snap
  try {
    snap = await getMyBuying(decryptToken(conn.token_chiffre), conn.ebay_user_id)
  } catch (e) {
    const err = e instanceof EbayError ? e : null
    if (err?.tokenInvalid) {
      await sb.from('ebay_connexions').update({ statut: 'expire', derniere_erreur: 'Jeton expiré', updated_at: new Date().toISOString() }).eq('user_id', userId)
      return { ok: false, error: 'Connexion eBay expirée : reconnecte ton compte.', reconnect: true }
    }
    const msg = err ? `eBay : ${err.message}` : 'Erreur de synchronisation.'
    await sb.from('ebay_connexions').update({ derniere_erreur: msg.slice(0, 300), updated_at: new Date().toISOString() }).eq('user_id', userId)
    return { ok: false, error: msg }
  }

  const now = Date.now(), nowIso = new Date(now).toISOString()
  const { bids, won } = snap
  const wonItemIds = new Set(won.map(w => w.item_id))
  const bidItemIds = new Set(bids.map(b => b.item_id))
  // un article suivi qui est devenu une enchère ou un achat n'a plus à figurer dans les suivis
  const watch = snap.watch.filter(w => !wonItemIds.has(w.item_id) && !bidItemIds.has(w.item_id))

  const { data: prevRows } = await sb.from('achats_membre')
    .select('type, ref, item_id, titre, en_tete, fin_at, prix_actuel, devise, alerte_fin_envoyee')
    .eq('user_id', userId).eq('source', 'ebay').in('type', ['enchere', 'suivi'])
  const prev = new Map((prevRows || []).map(r => [`${r.type}:${r.ref}`, r]))

  // ── Alertes ──
  const alertsDone = new Set<string>()
  for (const b of bids) {
    const before = prev.get(`enchere:${b.ref}`)
    if (before?.en_tete === true && b.en_tete === false && (!b.fin_at || new Date(b.fin_at).getTime() > now)) {
      await notify(userId, `Tu as été surenchéri sur « ${short(b.titre)} »${price(b)}`, 'Surenchère eBay')
    }
  }
  for (const before of prev.values()) {
    if (before.type !== 'enchere' || bidItemIds.has(before.item_id)) continue
    if (wonItemIds.has(before.item_id)) await notify(userId, `Enchère gagnée : « ${short(before.titre)} » 🎉`, 'Enchère gagnée')
    else if (before.fin_at && new Date(before.fin_at).getTime() <= now) await notify(userId, `Enchère terminée : « ${short(before.titre)} » t'a échappé`, 'Enchère perdue')
  }
  for (const a of [...bids, ...watch]) {
    // une enchère en cours est forcément une annonce aux enchères ; pour un article suivi on vérifie le type d'annonce
    if (!a.fin_at || (a.type !== 'enchere' && a.type_annonce !== 'Chinese')) continue
    const left = new Date(a.fin_at).getTime() - now
    const before = prev.get(`${a.type}:${a.ref}`)
    if (left > 0 && left <= HOUR && !before?.alerte_fin_envoyee) {
      const min = Math.max(1, Math.round(left / 60000))
      await notify(userId, `${a.type === 'enchere' ? 'Ton enchère' : 'Un article suivi'} se termine dans ${min} min : « ${short(a.titre)} »${price(a)}`, 'Fin d\'enchère eBay')
      alertsDone.add(`${a.type}:${a.ref}`)
    }
  }

  // ── Écriture ──
  const rows = [...won, ...bids, ...watch].map((a: EbayArticle) => ({
    ...a, user_id: userId, source: 'ebay', updated_at: nowIso,
    ...(alertsDone.has(`${a.type}:${a.ref}`) ? { alerte_fin_envoyee: true } : {}),
  }))
  if (rows.length) {
    const { error } = await sb.from('achats_membre').upsert(rows, { onConflict: 'user_id,source,type,ref' })
    if (error) return { ok: false, error: 'Enregistrement impossible : ' + error.message }
  }

  // les listes d'enchères et de suivis sont des instantanés complets : ce qui a disparu est retiré (l'historique d'achats reste)
  const keep = new Set([...bids.map(b => `enchere:${b.ref}`), ...watch.map(w => `suivi:${w.ref}`)])
  const stale = (prevRows || []).filter(r => !keep.has(`${r.type}:${r.ref}`))
  for (const type of ['enchere', 'suivi'] as const) {
    const refs = stale.filter(r => r.type === type).map(r => r.ref)
    if (refs.length) await sb.from('achats_membre').delete().eq('user_id', userId).eq('source', 'ebay').eq('type', type).in('ref', refs)
  }
  await sb.from('achats_membre').delete().eq('user_id', userId).eq('source', 'ebay').eq('type', 'suivi').in('item_id', [...wonItemIds, ...bidItemIds])

  await sb.from('ebay_connexions').update({ derniere_synchro_at: nowIso, derniere_erreur: null, updated_at: nowIso }).eq('user_id', userId)
  return { ok: true, achats: won.length, encheres: bids.length, suivis: watch.length }
}
