// Prix de vente des cartes « Vente/Trade » (étiquette de prix sur la carte).
// Pas de paiement ni de marketplace pour l'instant : le prix est une indication, l'acheteur contacte le vendeur par message.

// Limite technique de la colonne (numeric(10,2)) : pas de plafond « métier », seulement ce que la base peut stocker.
const DB_MAX_PRICE = 99_999_999.99

// « 25 € », « 24,50 € », « 1 250 € » (espaces entre les milliers, pas de décimales inutiles).
export const fmtPrice = (n: number) => {
  const whole = Number.isInteger(n)
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} €`
}

// Saisie libre (« 25 », « 24,5 », « 24.50 », « 1 250 ») -> nombre arrondi au centime, ou null si vide / non valide (≤ 0).
export function parsePrice(raw: string): number | null {
  const n = Number(raw.trim().replace(/[\s  ]/g, '').replace(',', '.').replace(/€$/, ''))
  if (!raw.trim() || !Number.isFinite(n)) return null
  const cents = Math.round(n * 100) / 100
  return cents > 0 && cents <= DB_MAX_PRICE ? cents : null
}
