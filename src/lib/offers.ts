// Offres de prix entre membres (aucun paiement sur le site) : types et règles communes au serveur (routes /api/offers) et au client.

export type OfferStatus = 'pending' | 'countered' | 'accepted' | 'refused' | 'cancelled'

export interface OfferCardSnapshot { id: string; nom: string; annee?: string | null; marque?: string | null; image?: string | null; prix?: number | null }

export interface Offer {
  id: string
  buyer_id: string
  seller_id: string
  card_id: string
  card: OfferCardSnapshot
  price: number
  counter_price: number | null
  message: string | null
  status: OfferStatus
  expires_at: string
  created_at: string
  updated_at: string
}

export const OFFER_PREFIX = '[[offer:'
export const isOfferMsg = (c: unknown): c is string => typeof c === 'string' && c.startsWith(OFFER_PREFIX) && c.endsWith(']]')
export const offerIdOf = (c: string) => c.slice(OFFER_PREFIX.length, -2)
export const offerBubble = (id: string) => `${OFFER_PREFIX}${id}]]`

export const OFFER_TTL_HOURS = 48
export const MAX_OPEN_OFFERS = 3
export const MAX_PRICE = 100000

// Une offre en attente dont l'échéance est passée est considérée comme expirée (aucun traitement serveur nécessaire).
export const isOpen = (o: Pick<Offer, 'status' | 'expires_at'>, now = Date.now()) =>
  (o.status === 'pending' || o.status === 'countered') && new Date(o.expires_at).getTime() > now

export const parsePrice = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PRICE) return null
  return Math.round(n * 100) / 100
}

export const cleanMessage = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim().slice(0, 300) : ''
  return s || null
}

export const hoursLeft = (expires: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(expires).getTime() - now) / 3600000))
