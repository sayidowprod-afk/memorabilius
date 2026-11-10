import { createServerServiceClient } from '@/lib/supabaseServer'
import { sendPushToUser } from '@/lib/pushNotify'
import { decryptToken } from '@/lib/ebayCrypto'
import { EbayError, getMyActiveListings, type EbayAnnonce } from '@/lib/ebayTrading'
import { loadAlertPrefs, shortTitle } from '@/lib/ebaySync'
import { inQuietHours, type AlertKind, type AlertPrefs } from '@/lib/achatsAlertPrefs'
import { syncVentes } from '@/lib/ebayVentes'

// Alertes sur MES annonces eBay (côté vendeur). Une lecture des annonces actives est comparée à la précédente (table ebay_annonces) :
//   nouvelle enchère · nouvelles personnes qui suivent · fin dans ~1 h · annonce terminée (vendue à qui et à quel prix, ou sans acheteur).
// Plus le rappel « colis à expédier ». Appelé par la tâche planifiée /api/cron/ebay-annonces. Chaque type d'alerte se coupe dans les réglages
// (mêmes préférences et même plage « ne pas déranger » que « Mes achats »). Tout passe par le service role.
const sb = createServerServiceClient(30000)
const MIN = 60000, HOUR = 3600000, DAY = 86400000

async function notifyVente(userId: string, message: string, pushTitle: string, kind: AlertKind, prefs: AlertPrefs) {
  try {
    if (!prefs[kind]) return
    await sb.from('notifications').insert({ user_id: userId, type: 'ebay', message, lien: '/mes-ventes', lu: false })
    if (!inQuietHours(prefs)) await sendPushToUser(userId, { title: pushTitle, body: message, url: '/mes-ventes', channelId: 'trades' })
  } catch { /* notification best-effort : jamais bloquante */ }
}

const money = (v: number | null, devise: string | null) => (v === null ? '' : `${v.toFixed(2).replace('.', ',')} ${!devise || devise === 'EUR' ? '€' : devise}`)
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

type Stored = { item_id: string; titre: string | null; nb_encheres: number | null; nb_suivis: number | null; fin_at: string | null; alerte_fin_envoyee: boolean; devise: string | null }

export type AnnoncesSyncResult =
  | { ok: true; actives: number; terminees: number; alertes: number }
  | { ok: false; error: string; reconnect?: boolean }

export async function syncAnnonces(userId: string): Promise<AnnoncesSyncResult> {
  const { data: conn } = await sb.from('ebay_connexions').select('token_chiffre, statut').eq('user_id', userId).maybeSingle()
  if (!conn || conn.statut !== 'connecte' || !conn.token_chiffre) return { ok: false, error: 'Compte eBay non connecté.' }
  let current: EbayAnnonce[]
  try {
    current = await getMyActiveListings(decryptToken(conn.token_chiffre))
  } catch (e) {
    const err = e instanceof EbayError ? e : null
    if (err?.tokenInvalid) return { ok: false, error: 'Connexion eBay expirée.', reconnect: true }
    return { ok: false, error: err ? `eBay : ${err.message}` : 'Lecture des annonces impossible.' }
  }

  const { data: rows, error } = await sb.from('ebay_annonces')
    .select('item_id, titre, nb_encheres, nb_suivis, fin_at, alerte_fin_envoyee, devise').eq('user_id', userId).eq('statut', 'active')
  if (error) return { ok: false, error: 'Migration 20261116 à appliquer dans Supabase.' }
  const stored = new Map<string, Stored>((rows || []).map(r => [r.item_id as string, r as Stored]))
  const prefs = await loadAlertPrefs(userId)
  const now = Date.now(), nowIso = new Date(now).toISOString()
  let alertes = 0

  // 1. annonces toujours en ligne : alertes de changement, puis mise à jour
  const seen = new Set<string>()
  const upserts: Record<string, unknown>[] = []
  for (const a of current) {
    seen.add(a.item_id)
    const prev = stored.get(a.item_id)
    let finSent = prev?.alerte_fin_envoyee ?? false
    if (prev) {
      const t = shortTitle(a.titre)
      if ((a.nb_encheres ?? 0) > (prev.nb_encheres ?? 0)) {
        await notifyVente(userId, `🔨 Nouvelle enchère sur « ${t} » : ${money(a.prix_actuel, a.devise)} (${plural(a.nb_encheres ?? 0, 'enchère', 'enchères')})`, 'Nouvelle enchère', 'vente_enchere', prefs); alertes++
      }
      if (a.nb_suivis !== null && a.nb_suivis > (prev.nb_suivis ?? 0)) {
        const d = a.nb_suivis - (prev.nb_suivis ?? 0)
        await notifyVente(userId, `👁 ${plural(d, 'personne de plus suit', 'personnes de plus suivent')} « ${t} » (${a.nb_suivis} en tout)`, 'Nouveaux suiveurs', 'vente_suivi', prefs); alertes++
      }
      if (!finSent && a.fin_at) {
        const ms = new Date(a.fin_at).getTime() - now
        if (ms > 0 && ms <= 65 * MIN) {
          const prix = a.prix_actuel !== null ? ` · ${money(a.prix_actuel, a.devise)}${a.enchere ? ` (${plural(a.nb_encheres ?? 0, 'enchère', 'enchères')})` : ''}` : ''
          await notifyVente(userId, `⏳ « ${t} » se termine dans ~${Math.max(1, Math.round(ms / MIN))} min${prix}`, 'Fin dans 1 h', 'vente_fin', prefs); finSent = true; alertes++
        }
      }
    }
    upserts.push({
      user_id: userId, item_id: a.item_id, titre: a.titre, photo_url: a.photo_url, enchere: a.enchere, devise: a.devise, prix_actuel: a.prix_actuel,
      nb_encheres: a.nb_encheres, nb_suivis: a.nb_suivis, fin_at: a.fin_at, lien: a.lien, statut: 'active', alerte_fin_envoyee: finSent, vu_at: nowIso, maj_at: nowIso,
    })
  }
  if (upserts.length) await sb.from('ebay_annonces').upsert(upserts, { onConflict: 'user_id,item_id' })

  // 2. annonces qui ont disparu de la liste active : terminées. On cherche la vente correspondante (import des commandes récentes d'abord).
  // (liste lue limitée à 100 annonces : au-delà, une annonce absente de la lecture n'est pas forcément terminée, on ne conclut rien)
  const gone = current.length < 100 ? [...stored.values()].filter(r => !seen.has(r.item_id)) : []
  let terminees = 0
  if (gone.length) {
    await syncVentes(userId, 0)
    const { data: sold, error: se } = await sb.from('ventes_membre').select('item_id, prix, total_encaisse, acheteur, devise')
      .eq('user_id', userId).eq('source', 'ebay').in('item_id', gone.map(g => g.item_id))
    if (!se) {
      const soldBy = new Map<string, { prix: number | null; total: number | null; acheteur: string | null; devise: string | null }>()
      for (const s of sold || []) soldBy.set(s.item_id as string, { prix: s.prix as number | null, total: s.total_encaisse as number | null, acheteur: s.acheteur as string | null, devise: s.devise as string | null })
      for (const g of gone) {
        const t = shortTitle(g.titre)
        const v = soldBy.get(g.item_id)
        if (v) {
          const prix = v.prix ?? v.total
          await sb.from('ebay_annonces').update({ statut: 'vendue', prix_final: prix, acheteur: v.acheteur, maj_at: nowIso }).eq('user_id', userId).eq('item_id', g.item_id)
          await notifyVente(userId, `✅ « ${t} » vendu : ${money(prix, v.devise)}${v.acheteur ? ` à ${v.acheteur}` : ''}`, 'Annonce vendue', 'vente_resultat', prefs); terminees++; alertes++
        } else {
          // des enchères mais pas (encore) de commande visible : on réessaie pendant 24 h avant de conclure « sans acheteur »
          const finMs = g.fin_at ? new Date(g.fin_at).getTime() : 0
          if ((g.nb_encheres ?? 0) > 0 && finMs && now - finMs < DAY) continue
          await sb.from('ebay_annonces').update({ statut: 'invendue', maj_at: nowIso }).eq('user_id', userId).eq('item_id', g.item_id)
          await notifyVente(userId, `« ${t} » s'est terminé sans acheteur. Tu peux la remettre en vente depuis eBay.`, 'Annonce terminée', 'vente_resultat', prefs); terminees++; alertes++
        }
      }
    }
  }

  // 3. ménage : les annonces terminées ne sont gardées que 14 jours
  await sb.from('ebay_annonces').delete().eq('user_id', userId).neq('statut', 'active').lt('maj_at', new Date(now - 14 * DAY).toISOString())
  await sb.from('ebay_connexions').update({ annonces_synchro_at: nowIso }).eq('user_id', userId)
  return { ok: true, actives: current.length, terminees, alertes }
}

// Rappel « colis à expédier » : ventes eBay payées depuis plus de 2 jours et pas expédiées (30 jours au plus), un rappel par jour. Avant de
// rappeler, une lecture eBay vérifie que le colis n'est pas déjà parti (le membre n'ouvre pas forcément « Mes ventes »).
export async function rappelExpedition(userId: string): Promise<number> {
  const prefs = await loadAlertPrefs(userId)
  if (!prefs.vente_expedition) return 0
  const now = Date.now()
  const pending = async () => {
    const { data, error } = await sb.from('ventes_membre').select('id, titre, acheteur, paye_at, alerte_expedition_at')
      .eq('user_id', userId).eq('source', 'ebay').not('paye_at', 'is', null).is('expedie_at', null)
      .lt('paye_at', new Date(now - 2 * DAY).toISOString()).gt('paye_at', new Date(now - 30 * DAY).toISOString())
    if (error) return []
    return (data || []).filter(v => !v.alerte_expedition_at || now - new Date(v.alerte_expedition_at as string).getTime() > 20 * HOUR)
  }
  if (!(await pending()).length) return 0
  await syncVentes(userId, 3 * HOUR)
  const list = await pending()
  if (!list.length) return 0
  const first = shortTitle(list[0].titre as string | null)
  const msg = list.length === 1 ? `📦 À expédier : « ${first} »${list[0].acheteur ? ` pour ${list[0].acheteur}` : ''} (payé depuis plus de 2 jours)` : `📦 ${list.length} colis à expédier, dont « ${first} » (payés depuis plus de 2 jours)`
  await notifyVente(userId, msg, 'Colis à expédier', 'vente_expedition', prefs)
  await sb.from('ventes_membre').update({ alerte_expedition_at: new Date(now).toISOString() }).in('id', list.map(v => v.id as string))
  return list.length
}
