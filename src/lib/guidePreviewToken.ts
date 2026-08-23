import crypto from 'crypto'

// Jeton signé et à durée limitée pour prévisualiser un guide non publié sans
// exposer /guides/[slug]/preview à n'importe qui — pas de session/cookie à
// faire voyager entre l'éditeur admin (client) et cette page (serveur), juste
// une signature HMAC vérifiable. Réutilise la service role key comme secret :
// déjà privée, déjà server-only, pas besoin d'une variable d'env dédiée.
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createPreviewToken(guideId: number, ttlMs = 30 * 60 * 1000): string {
  const expires = Date.now() + ttlMs
  const payload = `${guideId}.${expires}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyPreviewToken(token: string, guideId: number): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [idStr, expStr, sig] = decoded.split('.')
    if (!idStr || !expStr || !sig) return false
    if (Number(idStr) !== guideId) return false
    if (Date.now() > Number(expStr)) return false
    const expected = crypto.createHmac('sha256', SECRET).update(`${idStr}.${expStr}`).digest('hex')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
