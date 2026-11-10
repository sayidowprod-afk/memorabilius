import type { Row, Rates } from '@/components/MesAchatsView'
import { groupOrders, orderTotals } from '@/lib/achatsOrders'
import { norm } from '@/lib/achatsUi'

// Calculs de « Mes ventes » : net encaissé, profit réalisé (vente − coût d'achat), rendement, lien automatique avec « Mes achats ».
// Fonctions pures, tout en euros.
// Annonce eBay terminée (table ebay_annonces) : vendue (à qui, à quel prix) ou terminée sans acheteur
export type AnnonceTerminee = {
  item_id: string; titre: string | null; photo_url: string | null; statut: 'vendue' | 'invendue'
  prix_final: number | null; acheteur: string | null; devise: string | null; lien: string | null; maj_at: string
}

export type Vente = {
  id: string; source: 'ebay' | 'vinted' | 'autre'; ref: string; titre: string | null; photo_url: string | null; acheteur: string | null
  devise: string | null; prix: number | null; port_facture: number | null; total_encaisse: number | null
  frais: number | null; cout_port: number | null; cout_achat: number | null; achat_id: string | null; notes: string | null
  vendu_at: string | null; paye_at: string | null; expedie_at: string | null; lien: string | null; lien_commande: string | null
}

const toEur = (v: number, devise: string | null, rates: Rates): number => {
  if (!devise || devise === 'EUR') return v
  const r = rates?.[devise]
  return r ? v * r : v
}

// Ce que l'acheteur a payé (à défaut : articles + port)
export const encaisse = (v: Vente, rates: Rates): number | null => {
  const raw = v.total_encaisse ?? (v.prix !== null ? v.prix + (v.port_facture || 0) : null)
  return raw === null ? null : toEur(raw, v.devise, rates)
}
// Net = encaissé − frais de la plateforme − port réellement payé
export const netOf = (v: Vente, rates: Rates): number | null => {
  const e = encaisse(v, rates)
  return e === null ? null : e - toEur(v.frais || 0, v.devise, rates) - toEur(v.cout_port || 0, v.devise, rates)
}
// Profit réalisé : seulement si on connaît ce que la carte avait coûté
export const profitOf = (v: Vente, rates: Rates): number | null => {
  const n = netOf(v, rates)
  return n === null || v.cout_achat === null || v.cout_achat === undefined ? null : n - toEur(v.cout_achat, v.devise, rates)
}

// Coût d'un achat de « Mes achats » : total payé pour un achat seul ; pour une commande de plusieurs articles, le prix de
// l'article + sa part du port et des frais.
export function achatCosts(achats: Row[], rates: Rates): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of groupOrders(achats.filter(a => a.type === 'achat'))) {
    const t = g.length > 1 ? orderTotals(g) : null
    for (const r of g) {
      const cur = r.devise
      let raw: number
      if (!t) raw = r.total_paye ?? ((r.prix || 0) + (r.frais_port || 0) + (r.autres_frais || 0))
      else raw = (r.prix ?? (t.total - (t.port || 0)) / g.length) + (((t.port || 0) + (t.extra || 0)) / g.length)
      out.set(r.id, Math.round(toEur(raw, cur, rates) * 100) / 100)
    }
  }
  return out
}

const STOP = new Set(['card', 'cards', 'carte', 'panini', 'topps', 'the', 'and', 'des', 'les', 'basketball', 'football', 'baseball', 'lot', 'nba', 'nfl', 'mlb', 'psa', 'bgs', 'rookie', 'silver'])
const tok = (s: string | null) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t))

// Achat qui ressemble à la vente (mêmes mots du titre), acheté avant la vente et pas déjà relié à une autre vente.
export function suggestAchat(v: Vente, achats: Row[], taken: Set<string>): { achat: Row; score: number } | null {
  const a = tok(v.titre)
  if (a.length < 2) return null
  const sa = new Set(a)
  let best: { achat: Row; score: number } | null = null
  for (const r of achats) {
    if (r.type !== 'achat' || taken.has(r.id)) continue
    if (v.vendu_at && r.achete_at && r.achete_at > v.vendu_at) continue
    const b = tok(r.titre)
    if (b.length < 2) continue
    const shared = b.filter(t => sa.has(t)).length
    const score = shared / Math.min(a.length, b.length)
    if (shared >= 2 && score >= 0.6 && (!best || score > best.score)) best = { achat: r, score }
  }
  return best
}

export type VentesStats = { n: number; encaisse: number; frais: number; net: number; profit: number; cout: number; avecCout: number; sansCout: number; roi: number | null }

export function statsOf(list: Vente[], rates: Rates): VentesStats {
  const s: VentesStats = { n: list.length, encaisse: 0, frais: 0, net: 0, profit: 0, cout: 0, avecCout: 0, sansCout: 0, roi: null }
  for (const v of list) {
    const e = encaisse(v, rates), n = netOf(v, rates), p = profitOf(v, rates)
    if (e !== null) s.encaisse += e
    s.frais += toEur((v.frais || 0) + (v.cout_port || 0), v.devise, rates)
    if (n !== null) s.net += n
    if (p !== null) { s.profit += p; s.cout += toEur(v.cout_achat || 0, v.devise, rates); s.avecCout++ } else s.sansCout++
  }
  s.roi = s.cout > 0 ? s.profit / s.cout : null
  return s
}
