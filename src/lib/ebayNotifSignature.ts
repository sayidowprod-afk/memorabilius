import { createPublicKey, createVerify } from 'node:crypto'

// Vérification de la signature d'une notification eBay (suppression de compte).
// Sans elle, n'importe qui pouvait poster une fausse notification et faire effacer les données eBay d'un membre.
// eBay signe chaque notification : l'en-tête X-EBAY-SIGNATURE contient (en base64) un JSON { alg, kid, signature, digest }.
// La clé publique correspondante se récupère via l'API Notification d'eBay avec un jeton d'application ;
// la signature porte sur le corps brut de la requête.
type Key = { pem: string; digest: string }
const keyCache = new Map<string, Key>()

async function appToken(): Promise<string> {
  const id = process.env.EBAY_APP_ID, secret = process.env.EBAY_CERT_ID
  if (!id || !secret) throw new Error('EBAY_APP_ID / EBAY_CERT_ID manquantes')
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('jeton eBay refusé')
  return (await res.json()).access_token as string
}

async function fetchKey(kid: string): Promise<Key> {
  const hit = keyCache.get(kid)
  if (hit) return hit
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(kid)) throw new Error('kid invalide')
  const res = await fetch(`https://api.ebay.com/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`, {
    headers: { Authorization: `Bearer ${await appToken()}` }, signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error('clé publique introuvable')
  const j = await res.json() as { key?: string; digest?: string }
  if (!j.key) throw new Error('clé publique vide')
  // eBay renvoie la clé avec ou sans les lignes d'en-tête PEM : on la reconstruit proprement
  const body = j.key.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '')
  const pem = `-----BEGIN PUBLIC KEY-----\n${body.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`
  const out = { pem, digest: (j.digest || 'SHA1').toUpperCase() }
  keyCache.set(kid, out)
  return out
}

// Vrai seulement si l'en-tête de signature correspond exactement au corps reçu. getKey est injectable pour les tests.
export async function verifyEbaySignature(rawBody: string, header: string | null, getKey: (kid: string) => Promise<Key> = fetchKey): Promise<boolean> {
  if (!header) return false
  try {
    const sig = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as { kid?: string; signature?: string }
    if (!sig.kid || !sig.signature) return false
    const { pem, digest } = await getKey(sig.kid)
    const v = createVerify(digest === 'SHA256' ? 'SHA256' : 'SHA1')
    v.update(rawBody)
    return v.verify(createPublicKey(pem), Buffer.from(sig.signature, 'base64'))
  } catch { return false }
}
