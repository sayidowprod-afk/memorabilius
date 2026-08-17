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
    // IPv6 loopback/link-local/ULA
    if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return false
    return true
  } catch {
    return false
  }
}
