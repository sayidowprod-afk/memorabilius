// Livraison entre membres (aucun paiement sur le site) : types, transporteurs, validation de la demande.
// Utilisé côté serveur (routes /api/shipments) ET côté client (formulaire) pour que les règles soient identiques.

export type Carrier = 'laposte_lettre_suivie' | 'laposte_colissimo' | 'mondial_relay'
export type DeliveryMode = 'home' | 'relay'
export type ShipmentStatus = 'requested' | 'shipped' | 'delivered' | 'cancelled'

export interface ShipmentCardSnapshot { id: string; nom: string; annee?: string | null; marque?: string | null; image?: string | null; prix?: number | null }

export interface Shipment {
  id: string
  buyer_id: string
  seller_id: string
  cards: ShipmentCardSnapshot[]
  note: string | null
  declared_value: number | null
  carrier: Carrier
  delivery_mode: DeliveryMode
  recipient_name: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  phone: string | null
  relay_label: string | null
  status: ShipmentStatus
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

export const SHIPMENT_PREFIX = '[[shipment:'
export const isShipmentMsg = (c: unknown): c is string => typeof c === 'string' && c.startsWith(SHIPMENT_PREFIX) && c.endsWith(']]')
export const shipmentIdOf = (c: string) => c.slice(SHIPMENT_PREFIX.length, -2)

// Adresses des sites des transporteurs : regroupées ici pour être corrigées facilement (liens non vérifiés en profondeur :
// en cas de page déplacée, il suffit de changer la valeur). Pas de lien direct de création d'étiquette : le vendeur la crée
// lui-même chez le transporteur (c'est lui qui la paie).
export const CARRIERS: Record<Carrier, {
  label: string; short: string; modes: DeliveryMode[]; hint: string
  createUrl: string; createLabel: string; trackUrl: (n: string, postal: string | null) => string; steps: string[]
}> = {
  laposte_lettre_suivie: {
    label: 'La Poste — Lettre suivie', short: 'Lettre suivie', modes: ['home'],
    hint: 'Dans la boîte aux lettres, sans signature. Pour une carte de faible valeur.',
    createUrl: 'https://www.laposte.fr/', createLabel: 'Ouvrir le site de La Poste',
    trackUrl: n => `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(n)}`,
    steps: [
      'Protège la carte (sleeve rigide + top loader, enveloppe cartonnée rigide).',
      'Sur laposte.fr, prends une Lettre suivie en ligne (ou achète-la au bureau de poste) et saisis l’adresse ci-dessous.',
      'Dépose l’envoi à La Poste, puis note le numéro de suivi plus bas.',
    ],
  },
  laposte_colissimo: {
    label: 'La Poste — Colissimo', short: 'Colissimo', modes: ['home', 'relay'],
    hint: 'À domicile ou en point de retrait, avec suivi. Pour une carte de valeur.',
    createUrl: 'https://www.laposte.fr/', createLabel: 'Ouvrir le site de La Poste',
    trackUrl: n => `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(n)}`,
    steps: [
      'Protège la carte (sleeve rigide + top loader, petit carton rigide).',
      'Sur laposte.fr, crée ton envoi Colissimo en ligne avec l’adresse (ou le point de retrait) ci-dessous, et imprime l’étiquette — ou dépose le colis en bureau de poste.',
      'Pour une carte de valeur, regarde l’option d’assurance du transporteur.',
      'Dépose le colis, puis note le numéro de suivi plus bas.',
    ],
  },
  mondial_relay: {
    label: 'Mondial Relay', short: 'Mondial Relay', modes: ['relay'],
    hint: 'Livraison dans un point relais choisi par l’acheteur.',
    createUrl: 'https://www.mondialrelay.fr/', createLabel: 'Ouvrir le site de Mondial Relay',
    trackUrl: (n, postal) => `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${encodeURIComponent(n)}${postal ? `&codePostal=${encodeURIComponent(postal)}` : ''}`,
    steps: [
      'Protège la carte (sleeve rigide + top loader, petit carton rigide).',
      'Sur mondialrelay.fr, crée ton envoi vers le point relais ci-dessous et imprime l’étiquette (ou utilise l’option sans étiquette si elle est proposée).',
      'Dépose le colis dans un point relais, puis note le numéro d’expédition plus bas.',
    ],
  },
}

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  requested: 'Demande envoyée', shipped: 'Expédié', delivered: 'Reçu ✓', cancelled: 'Annulé',
}

export interface ShipmentInput {
  sellerId: string
  cardIds: string[]
  note: string
  carrier: Carrier
  deliveryMode: DeliveryMode
  recipientName: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  city: string
  phone: string
  relayLabel: string
}

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Valide et nettoie une demande de livraison (même règles côté formulaire et côté serveur).
export function validateShipmentInput(raw: unknown): { ok: true; value: ShipmentInput } | { ok: false; error: string } {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const carrier = b.carrier as Carrier
  if (!(carrier in CARRIERS)) return { ok: false, error: 'Choisis un transporteur.' }
  const deliveryMode = b.deliveryMode as DeliveryMode
  if (deliveryMode !== 'home' && deliveryMode !== 'relay') return { ok: false, error: 'Choisis le mode de livraison.' }
  if (!CARRIERS[carrier].modes.includes(deliveryMode)) return { ok: false, error: 'Ce transporteur ne propose pas ce mode de livraison.' }

  const sellerId = trim(b.sellerId)
  const cardIds = Array.isArray(b.cardIds) ? b.cardIds.filter((x): x is string => typeof x === 'string').slice(0, 30) : []
  const note = trim(b.note).slice(0, 300)
  if (!sellerId) return { ok: false, error: 'Vendeur manquant.' }
  if (cardIds.length === 0 && note.length < 3) return { ok: false, error: 'Choisis au moins une carte ou décris ce que tu achètes.' }

  const recipientName = trim(b.recipientName).slice(0, 80)
  const addressLine1 = trim(b.addressLine1).slice(0, 120)
  const addressLine2 = trim(b.addressLine2).slice(0, 120)
  const postalCode = trim(b.postalCode)
  const city = trim(b.city).slice(0, 60)
  const phone = trim(b.phone).slice(0, 20)
  const relayLabel = trim(b.relayLabel).slice(0, 200)

  if (recipientName.length < 2) return { ok: false, error: 'Indique le nom du destinataire.' }
  if (!/^\d{5}$/.test(postalCode)) return { ok: false, error: 'Code postal à 5 chiffres (France uniquement pour le moment).' }
  if (city.length < 2) return { ok: false, error: 'Indique la ville.' }
  if (deliveryMode === 'home' && addressLine1.length < 3) return { ok: false, error: 'Indique l’adresse de livraison.' }
  if (deliveryMode === 'relay' && relayLabel.length < 3) return { ok: false, error: 'Indique le point relais / point de retrait choisi (nom et adresse).' }
  if (phone && !/^[0-9+ .()-]{6,20}$/.test(phone)) return { ok: false, error: 'Numéro de téléphone non valide.' }

  return { ok: true, value: { sellerId, cardIds, note, carrier, deliveryMode, recipientName, addressLine1, addressLine2, postalCode, city, phone, relayLabel } }
}

export const validTracking = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9 -]{4,40}$/.test(t.trim())

// Conseil de transporteur selon la valeur déclarée (somme des prix des cartes) -- simple indication.
export function carrierAdvice(value: number | null): string | null {
  if (value == null) return null
  if (value >= 100) return 'Carte de valeur : privilégie un envoi suivi avec assurance (Colissimo ou Mondial Relay).'
  if (value >= 30) return 'Un envoi suivi (Colissimo, Mondial Relay ou Lettre suivie) est recommandé.'
  return null
}
