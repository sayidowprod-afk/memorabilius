import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Chiffrement des jetons eBay des membres (AES-256-GCM). La clé (32 octets en base64) vit uniquement dans la
// variable d'environnement EBAY_TOKEN_KEY du serveur : sans elle, un jeton stocké en base est illisible.
// Générer une clé :  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
function key(): Buffer {
  const raw = process.env.EBAY_TOKEN_KEY
  if (!raw) throw new Error('EBAY_TOKEN_KEY manquante')
  const k = Buffer.from(raw, 'base64')
  if (k.length !== 32) throw new Error('EBAY_TOKEN_KEY doit faire 32 octets (base64)')
  return k
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.')
}

export function decryptToken(stored: string): string {
  const [v, iv, tag, ct] = stored.split('.')
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Jeton chiffré invalide')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
}
