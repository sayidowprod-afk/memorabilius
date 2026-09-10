// Garde-fou anti-SSRF pour toute URL fournie par un client que le serveur doit
// fetcher lui-même (image de carte potentiellement hébergée n'importe où pour
// les imports CSV, etc.) — sans ça, un serveur pourrait être trompé pour
// fetcher une URL interne/privée arbitraire.
export function isSafeExternalUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (u.port && u.port !== '80' && u.port !== '443') return false
    const host = u.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
    // IPv4 littéral dans une plage privée/loopback/link-local
    const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (m) {
      const [a, b] = m.slice(1).map(Number)
      if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false
    }
    // IPv6 loopback/link-local/ULA (u.hostname garde les crochets pour l'IPv6)
    const h6 = host.replace(/^\[|\]$/g, '')
    if (h6 === '::1' || h6.startsWith('fe80:') || h6.startsWith('fc') || h6.startsWith('fd')) return false
    // IPv4-mappee en IPv6 (::ffff:a.b.c.d, normalisee par l'URL parser en forme
    // hex compressee ::ffff:XXXX:YYYY) -- sans ce decodage, http://[::ffff:127.0.0.1]/
    // contournerait le filtre IPv4 ci-dessus alors qu'il cible bien 127.0.0.1.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(h6)
    if (mapped) {
      const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16)
      const a = (hi >> 8) & 0xff, b = hi & 0xff
      if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false
    }
    return true
  } catch {
    return false
  }
}
