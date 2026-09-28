import dns from 'node:dns/promises'
import net from 'node:net'

// Meme garde-fou SSRF que /api/proxy-image (voir son commentaire pour le
// detail des risques) -- reutilise ici pour telecharger cote serveur une
// image hebergee ailleurs (ex: lien_csv) avant de la re-heberger sur notre
// storage. Duplique volontairement les memes fonctions plutot que d'importer
// depuis la route (une route n'exporte que GET/POST, pas des helpers).
const MAX_BYTES = 25 * 1024 * 1024

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
    return false
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7))
    return false
  }
  return true
}

async function isSafeExternalUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  try {
    const { address } = await dns.lookup(url.hostname)
    return !isPrivateIp(address)
  } catch {
    return false
  }
}

export async function fetchExternalImage(rawUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  let url: URL
  try { url = new URL(rawUrl) } catch { return null }
  if (!(await isSafeExternalUrl(url))) return null
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000), redirect: 'follow' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    const contentLength = Number(res.headers.get('content-length') || 0)
    if (contentLength > MAX_BYTES) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.byteLength > MAX_BYTES) return null
    return { buffer, contentType }
  } catch {
    return null
  }
}

export function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  return 'jpg'
}
