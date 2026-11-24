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
  await dedupeVentesAncienneRef(userId).catch(() => { /* le ménage est facultatif : une erreur ne bloque pas la synchro */ })
  await sb.from('ebay_connexions').update({ ventes_synchro_at: nowIso }).eq('user_id', userId)
  return { ok: true, ventes: ventes.length }
}

// eBay change la référence d'une commande quand l'acheteur paie : elle passe de « <article>-<transaction> » (ex. 336887408860-10086333995403, enregistrée
// dès la vente, non payée) à un numéro de commande (ex. 21-15420-47230). Comme les ventes sont enregistrées PAR référence, la même vente apparaissait deux fois.
// Ici : pour un même article, un même acheteur et un même prix, chaque ancienne ligne NON payée est rapprochée de la ligne au numéro de commande :
// ce que le membre y avait noté (notes, coût d'achat, carte liée…) est reporté sur la nouvelle ligne, puis l'ancienne est supprimée.
// On ne le fait que si les deux listes ont exactement la même taille (une vente en deux exemplaires identiques n'est jamais fusionnée au hasard).
async function dedupeVentesAncienneRef(userId: string) {
  type V = { id: string; ref: string; item_id: string | null; acheteur: string | null; prix: number | null; vendu_at: string | null; paye_at: string | null; notes: string | null; cout_achat: number | null; cout_port: number | null; achat_id: string | null; carte_id: string | null }
  const { data, error } = await sb.from('ventes_membre').select('id, ref, item_id, acheteur, prix, vendu_at, paye_at, notes, cout_achat, cout_port, achat_id, carte_id')
    .eq('user_id', userId).eq('source', 'ebay').not('item_id', 'is', null).order('vendu_at', { ascending: true }).limit(2000)
  if (error || !data) return
  const groups = new Map<string, V[]>()
  for (const v of data as V[]) { const k = `${v.item_id}|${v.acheteur}|${v.prix}`; groups.set(k, [...(groups.get(k) || []), v]) }
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const legacy = list.filter(v => v.item_id && v.ref.startsWith(v.item_id + '-') && /^\d+-\d+$/.test(v.ref) && !v.paye_at)
    const modern = list.filter(v => !legacy.includes(v))
    if (!legacy.length || legacy.length !== modern.length) continue
    for (let i = 0; i < legacy.length; i++) {
      const old = legacy[i], cur = modern[i]
      const carry: Record<string, unknown> = {}
      for (const f of ['notes', 'cout_achat', 'cout_port', 'achat_id', 'carte_id'] as const) if (old[f] != null && cur[f] == null) carry[f] = old[f]
      if (Object.keys(carry).length) await sb.from('ventes_membre').update(carry).eq('id', cur.id)
      await sb.from('ventes_membre').delete().eq('id', old.id).eq('user_id', userId)
    }
  }
}
