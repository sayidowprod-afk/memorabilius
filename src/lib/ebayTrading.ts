import { load, type CheerioAPI } from 'cheerio'
import type { Cheerio } from 'cheerio'
import type { AnyNode } from 'domhandler'

// Client minimal de l'API Trading d'eBay (SOAP/XML historique), la seule qui donne à un acheteur l'accès à ses propres
// enchères, achats et articles suivis (les API REST « Buy » correspondantes sont réservées aux partenaires d'eBay).
// Tout est isolé ici : si eBay retire cette API, seul ce fichier est à remplacer.
//
// Jeton : Auth'n'Auth. Le membre se connecte chez eBay (jamais de mot de passe chez nous), on échange la session
// contre un jeton valable ~18 mois. Variables d'environnement : EBAY_APP_ID, EBAY_DEV_ID, EBAY_CERT_ID, EBAY_RUNAME.
const ENDPOINT = 'https://api.ebay.com/ws/api.dll'
const SITE_FRANCE = '71'

export class EbayError extends Error {
  constructor(public code: string, message: string) { super(message) }
  // 931/932 : jeton invalide ou expiré -> le membre doit se reconnecter
  get tokenInvalid() { return this.code === '931' || this.code === '932' || this.code === '17470' }
}

function env(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} manquante`)
  return v
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function trading(call: string, inner: string, token?: string): Promise<CheerioAPI> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<${call}Request xmlns="urn:ebay:apis:eBLBaseComponents">${token ? `<RequesterCredentials><eBayAuthToken>${esc(token)}</eBayAuthToken></RequesterCredentials>` : ''}${inner}</${call}Request>`
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'X-EBAY-API-SITEID': SITE_FRANCE,
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
      'X-EBAY-API-CALL-NAME': call,
      'X-EBAY-API-APP-NAME': env('EBAY_APP_ID'),
      'X-EBAY-API-DEV-NAME': env('EBAY_DEV_ID'),
      'X-EBAY-API-CERT-NAME': env('EBAY_CERT_ID'),
      'Content-Type': 'text/xml',
    },
    body,
    signal: AbortSignal.timeout(25000),
    cache: 'no-store',
  })
  const $ = load(await res.text(), { xmlMode: true })
  const ack = $('Ack').first().text()
  if (ack !== 'Success' && ack !== 'Warning') {
    const err = $('Errors').first()
    throw new EbayError(err.children('ErrorCode').first().text() || String(res.status), err.children('ShortMessage').first().text() || 'Réponse eBay invalide')
  }
  return $
}

// ── Connexion du compte ───────────────────────────────────────────────────────────────────────────────────────────

export async function getSessionId(): Promise<string> {
  const $ = await trading('GetSessionID', `<RuName>${esc(env('EBAY_RUNAME'))}</RuName>`)
  const id = $('SessionID').first().text()
  if (!id) throw new EbayError('0', 'SessionID absent')
  return id
}

// Page de connexion eBay (le membre s'y identifie lui-même). `etat` revient tel quel dans l'adresse d'acceptation.
export function signInUrl(sessionId: string, etat: string): string {
  return `https://signin.ebay.fr/ws/eBayISAPI.dll?SignIn&RuName=${encodeURIComponent(env('EBAY_RUNAME'))}&SessID=${encodeURIComponent(sessionId)}&ruparams=${encodeURIComponent('etat=' + etat)}`
}

export async function fetchToken(sessionId: string): Promise<{ token: string; expiresAt: string | null }> {
  const $ = await trading('FetchToken', `<SessionID>${esc(sessionId)}</SessionID>`)
  const token = $('eBayAuthToken').first().text()
  if (!token) throw new EbayError('0', 'Jeton absent')
  const exp = $('HardExpirationTime').first().text()
  return { token, expiresAt: exp ? new Date(exp).toISOString() : null }
}

export async function getEbayUserId(token: string): Promise<string> {
  const $ = await trading('GetUser', '', token)
  return $('User > UserID').first().text()
}

export async function revokeToken(token: string): Promise<void> {
  await trading('RevokeToken', '', token)
}

// ── Lecture des achats / enchères / suivis ────────────────────────────────────────────────────────────────────────

export type EbayArticle = {
  type: 'achat' | 'enchere' | 'suivi'
  ref: string
  item_id: string
  transaction_id: string | null
  order_id: string | null
  titre: string | null
  photo_url: string | null
  photo_mini: string | null
  site: string | null
  type_annonce: string | null
  vendeur: string | null
  vendeur_note: number | null
  devise: string | null
  prix: number | null
  frais_port: number | null
  total_paye: number | null        // total de la commande tel que payé (articles + port + taxes)
  autres_frais: number | null      // écart déduit : total - sous-total - port (douane, taxes, frais de service)
  prix_actuel: number | null
  ma_mise_max: number | null
  en_tete: boolean | null
  nb_encheres: number | null
  fin_at: string | null
  achete_at: string | null
  paye_at: string | null
  expedie_at: string | null
  statut_commande: string | null
  lien: string
  lien_commande: string | null
}

type El = Cheerio<AnyNode>

// Lit un chemin « A/B/C » parmi les enfants directs (insensible aux autres branches).
function at(el: El, path: string): El {
  return path.split('/').reduce<El>((cur, name) => cur.children(name).first() as El, el)
}
const text = (el: El, path: string): string | null => {
  const t = at(el, path).text().trim()
  return t || null
}
const num = (el: El, path: string): number | null => {
  const t = text(el, path)
  if (t === null) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const iso = (el: El, path: string): string | null => {
  const t = text(el, path)
  const d = t ? new Date(t) : null
  return d && !isNaN(d.getTime()) ? d.toISOString() : null
}
const cur = (el: El, path: string): string | null => at(el, path).attr('currencyID') || null

// eBay fournit une miniature (s-l140, s-l225...) : la même image existe en grand en changeant la taille dans l'adresse.
export function bigPhoto(url: string | null): string | null {
  if (!url) return null
  return url.replace('/thumbs/images/', '/images/').replace(/\/s-l\d+\.(jpg|png|webp)/i, '/s-l1600.$1')
}

const TLD: Record<string, string> = {
  France: 'fr', US: 'com', Germany: 'de', UK: 'co.uk', Italy: 'it', Spain: 'es', Belgium_French: 'be', Belgium_Dutch: 'be',
  Netherlands: 'nl', Canada: 'ca', Ireland: 'ie', Austria: 'at', Switzerland: 'ch', Poland: 'pl', Australia: 'com.au',
}
const tld = (site: string | null) => (site && TLD[site]) || 'com'

const itemLink = (itemId: string, site: string | null) => `https://www.ebay.${tld(site)}/itm/${itemId}`
const orderLink = (itemId: string, transactionId: string | null, site: string | null) =>
  transactionId ? `https://www.ebay.${tld(site)}/vod/FetchOrderDetails?itemid=${itemId}&transid=${transactionId}` : null

function baseFromItem(item: El, type: EbayArticle['type']): EbayArticle | null {
  const itemId = text(item, 'ItemID')
  if (!itemId) return null
  const site = text(item, 'Site')
  const mini = text(item, 'PictureDetails/GalleryURL')
  return {
    type, ref: itemId, item_id: itemId, transaction_id: null, order_id: null,
    titre: text(item, 'Title'), photo_url: bigPhoto(mini), photo_mini: mini, site,
    type_annonce: text(item, 'ListingType'),
    vendeur: text(item, 'Seller/UserID'), vendeur_note: num(item, 'Seller/FeedbackScore'),
    devise: cur(item, 'SellingStatus/CurrentPrice') || cur(item, 'BuyItNowPrice'),
    prix: null, frais_port: num(item, 'ShippingDetails/ShippingServiceOptions/ShippingServiceCost'), total_paye: null, autres_frais: null,
    prix_actuel: num(item, 'SellingStatus/CurrentPrice'),
    ma_mise_max: null, en_tete: null, nb_encheres: num(item, 'SellingStatus/BidCount'),
    fin_at: iso(item, 'ListingDetails/EndTime'),
    achete_at: null, paye_at: null, expedie_at: null, statut_commande: null,
    lien: itemLink(itemId, site), lien_commande: null,
  }
}

export type BuyingSnapshot = { bids: EbayArticle[]; won: EbayArticle[]; watch: EbayArticle[] }

// Transforme la réponse XML de GetMyeBayBuying. Séparée de l'appel réseau pour pouvoir être testée sur un exemple.
export function parseBuying($: CheerioAPI, myEbayId?: string | null): BuyingSnapshot {
  const root = $('GetMyeBayBuyingResponse').first() as El

  const bids: EbayArticle[] = []
  at(root, 'BidList/ItemArray').children('Item').each((_, n) => {
    const item = $(n) as El
    const a = baseFromItem(item, 'enchere')
    if (!a) return
    a.ma_mise_max = num(item, 'BiddingDetails/MaxBid')
    const winning = text(item, 'BiddingDetails/Winning')
    const high = text(item, 'SellingStatus/HighBidder/UserID')
    a.en_tete = winning !== null ? winning === 'true' : (high && myEbayId ? high.toLowerCase() === myEbayId.toLowerCase() : null)
    bids.push(a)
  })

  const won: EbayArticle[] = []
  at(root, 'WonList').children('OrderTransaction').each((_, n) => {
    const ot = $(n) as El
    const order = at(ot, 'Order')
    const orderId = order.length ? text(order, 'OrderID') : null
    const orderStatus = order.length ? text(order, 'OrderStatus') : null
    const orderShipping = order.length ? num(order, 'ShippingDetails/ShippingServiceOptions/ShippingServiceCost') : null
    const transactions = order.length ? at(order, 'TransactionArray').children('Transaction') : at(ot, 'Transaction')
    transactions.each((__, tn) => {
      const tr = $(tn) as El
      const a = baseFromItem(at(tr, 'Item'), 'achat')
      if (!a) return
      const transId = text(tr, 'TransactionID')
      a.transaction_id = transId
      a.order_id = orderId
      a.ref = transId && transId !== '0' ? `${a.item_id}-${transId}` : a.item_id
      a.prix = num(tr, 'TransactionPrice')
      a.devise = cur(tr, 'TransactionPrice') || a.devise
      if (orderShipping !== null) a.frais_port = orderShipping
      // total / sous-total : seulement pour une commande à un seul article (sinon impossible de répartir les frais)
      const orderTotal = order.length && transactions.length === 1 ? num(order, 'Total') : null
      const orderSub = order.length && transactions.length === 1 ? num(order, 'Subtotal') : null
      if (orderTotal !== null) {
        a.total_paye = orderTotal
        if (orderSub !== null && orderShipping !== null) {
          const extra = Math.round((orderTotal - orderSub - orderShipping) * 100) / 100
          if (extra > 0.009) a.autres_frais = extra
        }
      }
      a.achete_at = iso(tr, 'CreatedDate')
      a.paye_at = iso(tr, 'PaidTime')
      a.expedie_at = iso(tr, 'ShippedTime')
      a.statut_commande = orderStatus || text(tr, 'Status/PaymentHoldStatus')
      a.prix_actuel = null
      a.lien_commande = orderLink(a.item_id, transId, a.site)
      won.push(a)
    })
  })

  const watch: EbayArticle[] = []
  at(root, 'WatchList/ItemArray').children('Item').each((_, n) => {
    const a = baseFromItem($(n) as El, 'suivi')
    if (a) watch.push(a)
  })

  return { bids, won, watch }
}

export async function getMyBuying(token: string, myEbayId?: string | null): Promise<BuyingSnapshot> {
  const page = `<Include>true</Include><Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>1</PageNumber></Pagination>`
  // WonList : exactement la requête validée sur un vrai compte (avec la pagination, la liste revenait vide)
  const $ = await trading('GetMyeBayBuying',
    `<BidList>${page}</BidList><WonList><Include>true</Include><DurationInDays>60</DurationInDays></WonList><WatchList>${page}</WatchList>`, token)
  return parseBuying($, myEbayId)
}
