import { createServerServiceClient } from '@/lib/supabaseServer'
import { sendPushToUser } from '@/lib/pushNotify'
import { decryptToken } from '@/lib/ebayCrypto'
import { EbayError, getMyBuying, type EbayArticle } from '@/lib/ebayTrading'
import { inQuietHours, normPrefs, type AlertKind, type AlertPrefs } from '@/lib/achatsAlertPrefs'

// Synchronisation d'un membre : lit son compte eBay (GetMyeBayBuying), met à jour `achats_membre` et envoie les alertes
// (surenchère, enchère gagnée / perdue, fin d'enchère proche, limite perso approchée, prix sous le seuil). Appelée à
// l'ouverture de « Mes achats », au bouton « Actualiser » et par la tâche planifiée /api/cron/ebay-sync. Tout passe par le service role.
const sb = createServerServiceClient(30000)

export type SyncResult =
  | { ok: true; achats: number; encheres: number; suivis: number }
  | { ok: false; skipped?: boolean; error: string; reconnect?: boolean }

const HOUR = 3600000

export async function loadAlertPrefs(userId: string): Promise<AlertPrefs> {
  try {
    const { data } = await sb.from('alertes_achats_prefs').select('prefs').eq('user_id', userId).maybeSingle()
    return normPrefs(data?.prefs)
  } catch { return normPrefs(null) }
}

// Alerte d'un membre : respecte ses préférences (type d'alerte coupé = rien) et la plage « ne pas déranger » (cloche
// conservée, push coupé).
export async function notifyEbay(userId: string, message: string, pushTitle: string, kind: AlertKind, prefs?: AlertPrefs) {
  try {
    const p = prefs || await loadAlertPrefs(userId)
    if (!p[kind]) return
    await sb.from('notifications').insert({ user_id: userId, type: 'ebay', message, lien: '/mes-achats', lu: false })
    if (!inQuietHours(p)) await sendPushToUser(userId, { title: pushTitle, body: message, url: '/mes-achats', channelId: 'trades' })
  } catch { /* notification best-effort : jamais bloquante */ }
}

const price = (a: { prix_actuel: number | null; devise: string | null }) =>
  a.prix_actuel !== null ? ` (${a.prix_actuel.toFixed(2).replace('.', ',')} ${a.devise === 'EUR' || !a.devise ? '€' : a.devise})` : ''
export const shortTitle = (t: string | null) => (t && t.length > 60 ? t.slice(0, 57) + '…' : t || 'un article')

// colonnes ajoutées par 20261104_achats_ameliorations.sql : absentes tant que la migration n'est pas appliquée
const NEW_COLS = /suivi_numero|transporteur|alerte_|limite_perso|seuil_alerte|recu_at|carte_id/

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

  // select('*') : marche avec ou sans les colonnes de la migration 20261104 (limite perso, seuil, drapeaux d'alerte)
  const { data: prevRows } = await sb.from('achats_membre').select('*')
    .eq('user_id', userId).eq('source', 'ebay').in('type', ['enchere', 'suivi'])
  const prev = new Map((prevRows || []).map(r => [`${r.type}:${r.ref}`, r]))
  const prefs = await loadAlertPrefs(userId)

  // ── Alertes ──
  const alertsDone = new Set<string>()
  const limitFlags: string[] = [], seuilOn: string[] = [], seuilOff: string[] = []
  for (const b of bids) {
    const before = prev.get(`enchere:${b.ref}`)
    if (before?.en_tete === true && b.en_tete === false && (!b.fin_at || new Date(b.fin_at).getTime() > now)) {
      await notifyEbay(userId, `Tu as été surenchéri sur « ${shortTitle(b.titre)} »${price(b)}`, 'Surenchère eBay', 'surenchere', prefs)
    }
    // limite perso (notée à la main dans « Mes achats ») : alerte à 90 %
    const limite = before?.limite_perso != null ? Number(before.limite_perso) : null
    if (limite && limite > 0 && b.prix_actuel !== null && b.prix_actuel >= limite * 0.9 && !before?.alerte_limite_envoyee && (!b.fin_at || new Date(b.fin_at).getTime() > now)) {
      const pct = Math.round((b.prix_actuel / limite) * 100)
      await notifyEbay(userId, `« ${shortTitle(b.titre)} » est à ${pct} % de ta limite${price(b)}`, 'Limite approchée', 'limite', prefs)
      limitFlags.push(b.ref)
    }
  }
  for (const before of prev.values()) {
    if (before.type !== 'enchere' || bidItemIds.has(before.item_id)) continue
    if (wonItemIds.has(before.item_id)) await notifyEbay(userId, `Enchère gagnée : « ${shortTitle(before.titre)} » 🎉`, 'Enchère gagnée', 'resultat', prefs)
    else if (before.fin_at && new Date(before.fin_at).getTime() <= now) await notifyEbay(userId, `Enchère terminée : « ${shortTitle(before.titre)} » t'a échappé`, 'Enchère perdue', 'resultat', prefs)
  }
  for (const a of [...bids, ...watch]) {
    // une enchère en cours est forcément une annonce aux enchères ; pour un article suivi on vérifie le type d'annonce
    if (!a.fin_at || (a.type !== 'enchere' && a.type_annonce !== 'Chinese')) continue
    const left = new Date(a.fin_at).getTime() - now
    const before = prev.get(`${a.type}:${a.ref}`)
    if (left > 0 && left <= HOUR && !before?.alerte_fin_envoyee) {
      const min = Math.max(1, Math.round(left / 60000))
      await notifyEbay(userId, `${a.type === 'enchere' ? 'Ton enchère' : 'Un article suivi'} se termine dans ${min} min : « ${shortTitle(a.titre)} »${price(a)}`, 'Fin d\'enchère eBay', 'fin1h', prefs)
      alertsDone.add(`${a.type}:${a.ref}`)
    }
  }
  // seuil de prix sur un article suivi (« m'alerter sous X € »)
  for (const w of watch) {
    const before = prev.get(`suivi:${w.ref}`)
    const seuil = before?.seuil_alerte != null ? Number(before.seuil_alerte) : null
    if (!seuil || seuil <= 0 || w.prix_actuel === null) continue
    if (w.prix_actuel <= seuil && !before?.alerte_seuil_envoyee) {
      await notifyEbay(userId, `Bonne nouvelle : « ${shortTitle(w.titre)} » est passé sous ton seuil de ${seuil.toFixed(2).replace('.', ',')} €${price(w)}`, 'Prix sous ton seuil', 'seuil', prefs)
      seuilOn.push(w.ref)
    } else if (w.prix_actuel > seuil && before?.alerte_seuil_envoyee) seuilOff.push(w.ref)
  }

  // ── Écriture ──
  const rows = [...won, ...bids, ...watch].map((a: EbayArticle) => {
    const { suivi_numero, transporteur, ...rest } = a
    return {
      ...rest, user_id: userId, source: 'ebay', updated_at: nowIso,
      // on ne remplace jamais un numéro de suivi saisi à la main par du vide
      ...(suivi_numero ? { suivi_numero, transporteur } : {}),
      ...(alertsDone.has(`${a.type}:${a.ref}`) ? { alerte_fin_envoyee: true } : {}),
    }
  })
  if (rows.length) {
    let { error } = await sb.from('achats_membre').upsert(rows, { onConflict: 'user_id,source,type,ref' })
    // migrations 20261102 / 20261104 pas encore appliquées : on enregistre le reste sans ces colonnes
    if (error && (/total_paye|autres_frais/.test(error.message) || NEW_COLS.test(error.message))) {
      ;({ error } = await sb.from('achats_membre').upsert(
        rows.map(({ total_paye: _t, autres_frais: _a, suivi_numero: _s, transporteur: _tr, ...rest }: Record<string, unknown>) => rest), { onConflict: 'user_id,source,type,ref' }))
    }
    if (error) return { ok: false, error: 'Enregistrement impossible : ' + error.message }
  }
  const setFlag = async (type: 'enchere' | 'suivi', refs: string[], patch: Record<string, boolean>) => {
    if (!refs.length) return
    try { await sb.from('achats_membre').update(patch).eq('user_id', userId).eq('source', 'ebay').eq('type', type).in('ref', refs) } catch { /* colonnes absentes */ }
  }
  await setFlag('enchere', limitFlags, { alerte_limite_envoyee: true })
  await setFlag('suivi', seuilOn, { alerte_seuil_envoyee: true })
  await setFlag('suivi', seuilOff, { alerte_seuil_envoyee: false })

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
