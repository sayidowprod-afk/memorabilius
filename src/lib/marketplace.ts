// Prix de vente des cartes « Vente/Trade » (étiquette de prix sur la carte).
// Pas de paiement ni de marketplace pour l'instant : le prix est une indication, l'acheteur contacte le vendeur par message.

export const MARKETPLACE_MIN_PRICE = 3
export const MARKETPLACE_MAX_PRICE = 100000

// « 25 € » ou « 24,50 € » (pas de décimales inutiles sur une étiquette).
export const fmtPrice = (n: number) =>
  Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`

// Saisie libre (« 25 », « 24,5 », « 24.50 ») -> nombre arrondi au centime, ou null si vide / hors limites.
export function parsePrice(raw: string): number | null {
  const n = Number(raw.trim().replace(/\s/g, '').replace(',', '.').replace(/€$/, ''))
  if (!raw.trim() || !Number.isFinite(n) || n < MARKETPLACE_MIN_PRICE || n > MARKETPLACE_MAX_PRICE) return null
  return Math.round(n * 100) / 100
}
