import type { Row } from '@/components/MesAchatsView'

// Aides d'affichage de « Mes achats » : statut d'un achat, suivi de colis, rappels, recherche, doublons avec la collection
// et la wishlist. Fonctions pures, sans réseau.
const DAY = 86400000

// ── Statut ──────────────────────────────────────────────────────────────────
export type Statut = 'apayer' | 'preparation' | 'transit' | 'recu'
export const STATUT_LABEL: Record<Statut, string> = { apayer: 'À payer', preparation: 'En préparation', transit: 'En transit', recu: 'Reçu' }
export const STATUT_COLOR: Record<Statut, string> = { apayer: '#c98a12', preparation: '#3a4577', transit: '#2f6bff', recu: '#1e9e57' }

// Reçu = marqué par le membre, ou expédié il y a plus de 30 jours (on suppose le colis arrivé).
export function statutOf(r: Row, now: number): Statut {
  if (r.recu_at) return 'recu'
  if (!r.paye_at) return 'apayer'
  if (!r.expedie_at) return 'preparation'
  return now - new Date(r.expedie_at).getTime() > 30 * DAY ? 'recu' : 'transit'
}

// ── Suivi de colis ──────────────────────────────────────────────────────────
const CARRIERS: Array<[RegExp, string, (n: string) => string]> = [
  [/colissimo|la ?poste|chronopost.*poste/i, 'La Poste', n => `https://www.laposte.fr/outils/suivre-vos-envois?code=${encodeURIComponent(n)}`],
  [/mondial/i, 'Mondial Relay', n => `https://www.mondialrelay.fr/suivi-de-colis/?numeroExpedition=${encodeURIComponent(n)}`],
  [/chronopost/i, 'Chronopost', n => `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLisibles=${encodeURIComponent(n)}`],
  [/dhl/i, 'DHL', n => `https://www.dhl.com/fr-fr/home/tracking.html?tracking-id=${encodeURIComponent(n)}`],
  [/ups/i, 'UPS', n => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`],
  [/fedex/i, 'FedEx', n => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`],
  [/dpd/i, 'DPD', n => `https://www.dpd.com/fr/fr/recevoir-un-colis/suivi-de-colis/?parcelNumber=${encodeURIComponent(n)}`],
  [/gls/i, 'GLS', n => `https://gls-group.com/FR/fr/suivi-colis?match=${encodeURIComponent(n)}`],
  [/royal ?mail/i, 'Royal Mail', n => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(n)}`],
]
export const CARRIER_NAMES = ['Colissimo', 'Mondial Relay', 'Chronopost', 'DHL', 'UPS', 'FedEx', 'DPD', 'GLS', 'Royal Mail']

// Lien de suivi chez le transporteur (à défaut : un suivi universel qui reconnaît le numéro).
export function trackingUrl(carrier: string | null, number: string): { url: string; label: string } {
  for (const [re, label, f] of CARRIERS) if (carrier && re.test(carrier)) return { url: f(number), label }
  return { url: `https://parcelsapp.com/fr/tracking/${encodeURIComponent(number)}`, label: carrier || 'le colis' }
}

// ── Rappels ─────────────────────────────────────────────────────────────────
export type Rappel = { id: string; kind: 'paiement' | 'nonexp' | 'transit'; texte: string; sous: string; row: Row }

// Paiement à faire, colis pas expédié après 5 jours, colis en transit depuis plus de 12 jours. Une commande de
// plusieurs articles ne donne qu'un rappel.
export function rappels(rows: Row[], now: number): Rappel[] {
  const out: Rappel[] = [], seen = new Set<string>()
  for (const r of rows) {
    if (r.type !== 'achat' || r.recu_at) continue
    const key = r.order_id && r.source !== 'vinted' ? `${r.source}:${r.order_id}` : r.id
    if (seen.has(key)) continue
    const title = r.titre || 'Achat'
    const days = (iso: string | null) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : 0)
    if (!r.paye_at && r.achete_at && days(r.achete_at) <= 14) {
      seen.add(key); out.push({ id: r.id, kind: 'paiement', texte: 'Paiement à faire', sous: title, row: r })
    } else if (r.paye_at && !r.expedie_at && days(r.paye_at) >= 5 && days(r.paye_at) <= 45) {
      seen.add(key); out.push({ id: r.id, kind: 'nonexp', texte: `Pas encore expédié depuis ${days(r.paye_at)} jours`, sous: `${title}${r.vendeur ? ' · ' + r.vendeur : ''}`, row: r })
    } else if (r.expedie_at && days(r.expedie_at) >= 12 && days(r.expedie_at) <= 30) {
      seen.add(key); out.push({ id: r.id, kind: 'transit', texte: `En transit depuis ${days(r.expedie_at)} jours`, sous: `${title}${r.transporteur ? ' · ' + r.transporteur : ''}`, row: r })
    }
  }
  return out
}

// ── Recherche ───────────────────────────────────────────────────────────────
export const norm = (s: string | null | undefined) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function matchesQuery(r: Row, q: string): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = norm(`${r.titre || ''} ${r.vendeur || ''} ${(r.tags || []).join(' ')} ${r.notes || ''}`)
  return words.every(w => hay.includes(w))
}

// ── Doublons collection / wishlist ──────────────────────────────────────────
export type CarteLite = { id: string | number; nom: string | null; annee?: string | null; collection?: string | null; variation?: string | null }
type Indexed<T extends CarteLite> = { c: T; nom: string[]; annee: string | null; coll: string[] }

const tokens = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean)
const STOP = new Set(['card', 'cards', 'carte', 'panini', 'topps', 'the', 'and', 'des', 'les', 'basketball', 'football', 'baseball', 'hockey', 'soccer', 'nba', 'nfl', 'mlb', 'nhl'])

export function indexCartes<T extends CarteLite>(cartes: T[]): Indexed<T>[] {
  const out: Indexed<T>[] = []
  for (const c of cartes) {
    const nom = tokens(c.nom).filter(t => t.length > 1)
    if (nom.length < 2 && !(nom.length === 1 && nom[0].length >= 7)) continue
    const y = (c.annee || '').match(/\d{4}/)?.[0] || null
    const coll = tokens(`${c.collection || ''} ${c.variation || ''}`).filter(t => t.length > 3 && !STOP.has(t))
    out.push({ c, nom, annee: y, coll })
  }
  return out
}

// Une carte correspond à un titre d'annonce si tous les mots de son nom y sont ET qu'un second indice concorde (l'année
// ou un mot du set / de la variation) : un nom seul donne trop de faux positifs. `needContext: false` = nom seul suffit.
// `needContext: 'auto'` : le contexte n'est exigé que si la carte en a un (wishlist : un nom seul suffit si rien d'autre n'est renseigné).
export function findMatch<T extends CarteLite>(title: string | null, index: Indexed<T>[], needContext: boolean | 'auto' = true): T | null {
  if (!title) return null
  const set = new Set(tokens(title))
  const yearsInTitle = new Set((title.match(/\b(19|20)\d{2}/g) || []))
  let best: { c: T; score: number } | null = null
  for (const it of index) {
    if (!it.nom.every(t => set.has(t))) continue
    let score = 0
    if (it.annee && yearsInTitle.has(it.annee)) score += 2
    const hits = it.coll.filter(t => set.has(t)).length
    if (hits) score += 1 + Math.min(2, hits - 1)
    const must = needContext === 'auto' ? !!(it.annee || it.coll.length) : needContext
    if (must && score === 0) continue
    if (!best || score > best.score) best = { c: it.c, score }
  }
  return best ? best.c : null
}

// ── Partage Android ─────────────────────────────────────────────────────────
// Texte partagé qui ressemble à une confirmation de commande (e-mail Vinted / eBay) : plusieurs lignes, un montant en euros
// et un mot de commande. Les liens d'annonce Vinted sont traités à part.
export function looksLikeOrderText(text: string | null | undefined): boolean {
  const t = text || ''
  return t.length > 80 && /(commande|order|achat|vinted)/i.test(t) && /\d+[,.]\d{2}\s?(€|eur)/i.test(t)
}
