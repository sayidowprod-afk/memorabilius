// Marketplace -- constantes et calculs partagés (client + serveur).
// Étape 0 : annonces avec prix, contact par la messagerie, aucun paiement.

export const MARKETPLACE_MIN_PRICE = 3
export const MARKETPLACE_MAX_PRICE = 100000

// Commission prévue (à valider) : 5 % du prix de la carte, minimum 0,50 €.
// Sous ~15-20 € les frais de paiement (≈ 1,5 % + 0,25 € du total) mangent la marge, d'où le minimum.
export const COMMISSION_RATE = 0.05
export const MIN_COMMISSION = 0.5

export function commissionFor(price: number): number {
  return Math.round(Math.max(price * COMMISSION_RATE, MIN_COMMISSION) * 100) / 100
}

export const fmtEur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

export interface Listing {
  id: string
  user_id: string
  nom: string
  equipe: string | null
  annee: string | null
  collection: string | null
  marque: string | null
  variation: string | null
  grade: string | null
  num: string | null
  rc: boolean | null
  auto: boolean | null
  patch: boolean | null
  image_recto: string | null
  prix_vente: number
  created_at: string
  cert_number: string | null
}

export interface ListingSeller { id: string; display_name: string | null; avatar_url: string | null; slug: string | null }
