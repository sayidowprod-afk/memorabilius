// Prix de vente des cartes « Vente/Trade » (étiquette de prix sur la carte).
// Pas de paiement ni de marketplace pour l'instant : le prix est une indication, l'acheteur contacte le vendeur par message.

export const MARKETPLACE_MIN_PRICE = 3
export const MARKETPLACE_MAX_PRICE = 100000

// « 25 € » ou « 24,50 € » (pas de décimales inutiles sur une étiquette).
export const fmtPrice = (n: number) =>
  Number.isInteger(n) ? `${n} €` : `${n.toFixed(2).replace('.', ',')} €`
