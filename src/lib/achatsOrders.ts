import type { Row } from '@/components/MesAchatsView'

// Une commande eBay peut contenir plusieurs articles du même vendeur : le port et le total payé (remise de lot comprise)
// valent pour toute la commande. On regroupe donc les articles d'une même commande pour ne les compter qu'une fois.
export function groupOrders(rows: Row[]): Row[][] {
  const groups: Row[][] = []
  const byOrder = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r.order_id && r.source !== 'vinted' ? `${r.source || 'ebay'}:${r.order_id}` : null
    if (!key) { groups.push([r]); continue }
    const g = byOrder.get(key)
    if (g) g.push(r)
    else { const n = [r]; byOrder.set(key, n); groups.push(n) }
  }
  return groups
}

export type OrderTotals = { total: number; port: number | null; remise: number | null; extra: number | null }

// Total payé de la commande (donné par eBay ; à défaut somme des prix + port), port compté une fois,
// remise de lot = prix cumulé des annonces + port - total payé (seulement si tous les prix sont connus).
export function orderTotals(g: Row[]): OrderTotals {
  const first = g[0]
  const port = first.frais_port ?? null
  const prices = g.map(r => r.prix)
  const sum = prices.every(p => p != null) ? (prices as number[]).reduce((a, p) => a + p, 0) : null
  const total = first.total_paye ?? (sum !== null ? sum + (port || 0) + (first.autres_frais || 0) : 0)
  const rem = sum !== null && first.total_paye != null ? Math.round((sum + (port || 0) - first.total_paye) * 100) / 100 : null
  return {
    total, port: port && port > 0 ? port : null,
    remise: rem !== null && rem > 0.5 ? rem : null,
    extra: first.autres_frais != null && first.autres_frais > 0 ? first.autres_frais : null,
  }
}
