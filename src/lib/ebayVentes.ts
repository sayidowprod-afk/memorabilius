import { createServerServiceClient } from '@/lib/supabaseServer'
import { decryptToken } from '@/lib/ebayCrypto'
import { EbayError, getItemPhoto, getMySales, getMyActiveListings, type EbayAnnonce } from '@/lib/ebayTrading'

// Lecture des ventes eBay d'un membre (GetOrders, rôle vendeur) -> table `ventes_membre`. Appelée à l'ouverture de
// « Mes ventes » et au bouton « Actualiser », jamais par une tâche planifiée : les ventes bougent peu et le quota d'appels
// eBay est partagé par tous les membres. Les champs saisis à la main (coût d'achat, notes, port réel…) ne sont jamais écrasés.
const sb = createServerServiceClient(30000)

// Annonces eBay en cours (enchères, prix fixe) : lues à la demande, jamais enregistrées (elles bougent sans cesse). Cache de 60 s par membre
// pour ne pas multiplier les appels (le quota eBay est partagé par tous les membres).
const annoncesCache = new Map<string, { at: number; annonces: EbayAnnonce[] }>()
export type AnnoncesResult = { ok: true; annonces: EbayAnnonce[] } | { ok: false; error: string; reconnect?: boolean }

export async function listAnnonces(userId: string): Promise<AnnoncesResult> {
  const hit = annoncesCache.get(userId)
  if (hit && Date.now() - hit.at < 60000) return { ok: true, annonces: hit.annonces }
  const { data: conn } = await sb.from('ebay_connexions').select('token_chiffre, statut').eq('user_id', userId).maybeSingle()
  if (!conn || conn.statut !== 'connecte' || !conn.token_chiffre) return { ok: false, error: 'Compte eBay non connecté.', reconnect: conn?.statut === 'expire' }
  try {
    const annonces = await getMyActiveListings(decryptToken(conn.token_chiffre))
    annoncesCache.set(userId, { at: Date.now(), annonces })
    return { ok: true, annonces }
  } catch (e) {
    const err = e instanceof EbayError ? e : null
    if (err?.tokenInvalid) return { ok: false, error: 'Connexion eBay expirée : reconnecte ton compte.', reconnect: true }
    return { ok: false, error: err ? `eBay : ${err.message}` : 'Lecture des annonces impossible.' }
  }
}

export type VentesSyncResult =
  | { ok: true; ventes: number }
  | { ok: false; skipped?: boolean; error: string; reconnect?: boolean }

export async function syncVentes(userId: string, minIntervalMs = 0): Promise<VentesSyncResult> {
  const { data: conn } = await sb.from('ebay_connexions').select('token_chiffre, statut, ventes_synchro_at').eq('user_id', userId).maybeSingle()
  if (!conn || conn.statut !== 'connecte' || !conn.token_chiffre) return { ok: false, error: 'Compte eBay non connecté.', reconnect: conn?.statut === 'expire' }
  if (minIntervalMs && conn.ventes_synchro_at && Date.now() - new Date(conn.ventes_synchro_at).getTime() < minIntervalMs) return { ok: false, skipped: true, error: 'Déjà à jour.' }

  const { count } = await sb.from('ventes_membre').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('source', 'ebay')
  const token = decryptToken(conn.token_chiffre)
  let ventes
  try {
    // première lecture : un an d'historique ; ensuite, les 45 derniers jours suffisent
    ventes = await getMySales(token, count ? 45 : 360)
  } catch (e) {
    const err = e instanceof EbayError ? e : null
    if (err?.tokenInvalid) return { ok: false, error: 'Connexion eBay expirée : reconnecte ton compte.', reconnect: true }
    return { ok: false, error: err ? `eBay : ${err.message}` : 'Erreur de synchronisation.' }
  }

  const nowIso = new Date().toISOString()
  if (ventes.length) {
    // photos : seulement pour les ventes pas encore connues (un appel eBay chacune), 20 au maximum par lecture
    const { data: known } = await sb.from('ventes_membre').select('ref, photo_url').eq('user_id', userId).eq('source', 'ebay')
    const have = new Map((known || []).map(k => [k.ref, k.photo_url as string | null]))
    const photos = new Map<string, string>()
    let budget = 20
    for (const v of ventes) {
      if (budget <= 0) break
      if (!v.item_id || have.get(v.ref)) continue
      const p = await getItemPhoto(token, v.item_id)
      budget--
      if (p) photos.set(v.ref, p)
    }
    const rows = ventes.map(v => ({
      user_id: userId, source: 'ebay', updated_at: nowIso, ...v,
      ...(photos.has(v.ref) ? { photo_url: photos.get(v.ref) } : {}),
      devise: v.devise || 'EUR',
    }))
    let { error } = await sb.from('ventes_membre').upsert(rows, { onConflict: 'user_id,source,ref' })
    // item_id : colonne ajoutée par la migration 20261116 (la table d'origine ne l'avait pas) ; tant qu'elle manque, on enregistre sans elle
    if (error && /item_id/.test(error.message)) {
      ;({ error } = await sb.from('ventes_membre').upsert(rows.map(r => { const { item_id: _ignore, ...rest } = r; void _ignore; return rest }), { onConflict: 'user_id,source,ref' }))
    }
    if (error) return { ok: false, error: /ventes_membre/.test(error.message) ? 'Migration 20261105 à appliquer dans Supabase.' : 'Enregistrement impossible : ' + error.message }
  }
  await sb.from('ebay_connexions').update({ ventes_synchro_at: nowIso }).eq('user_id', userId)
  return { ok: true, ventes: ventes.length }
}
