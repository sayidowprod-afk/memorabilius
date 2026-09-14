import { NextRequest, NextResponse } from 'next/server'
import dns from 'node:dns/promises'
import net from 'node:net'

// Proxy image : recharge cote client (via <img> same-origin, pour lire les
// pixels en canvas sans probleme CORS) soit une photo de NOTRE bucket
// Supabase Storage, soit une image externe (cartes importees via un CSV
// externe -- lien_csv, voir src/lib/csvCards.ts -- dont l'hebergeur n'est pas
// sous notre controle). Necessaire car un <img crossOrigin="anonymous">
// direct vers le storage Supabase echoue en pratique (bloque cote CDN), et
// une image hors-storage n'a de toute facon aucune garantie CORS.
//
// Ouvrir ce proxy a une URL arbitraire cree un risque de SSRF classique
// (notre serveur ferait une requete pour l'attaquant vers un service interne,
// ex. 169.254.169.254 metadata cloud, ou un port interne) -- on limite donc :
// - protocole http/https uniquement (jamais file:, data:, etc.)
// - l'hote ne doit resoudre vers AUCUNE IP privee/loopback/link-local
//   (verifie juste avant le fetch -- protection contre le DNS rebinding
//   partielle seulement, suffisante pour ce cas d'usage : reperer des
//   fournisseurs d'images grand public, pas des cibles internes ciblees)
// - la reponse doit avoir un Content-Type image/*
// - taille de reponse plafonnee
const SUPABASE_STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/cartes/`
const MAX_BYTES = 25 * 1024 * 1024

function isPrivateIp(ip: string): boolean {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 127) return true // loopback
    if (a === 10) return true // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true // RFC1918
    if (a === 192 && b === 168) return true // RFC1918
    if (a === 169 && b === 254) return true // link-local (metadata cloud incl.)
    if (a === 0) return true
    return false
  }
  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1') return true // loopback
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique local
    if (lower.startsWith('::ffff:')) return isPrivateIp(lower.slice(7)) // IPv4-mapped
    return false
  }
  return true // ni v4 ni v6 valide -> refuse par prudence
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

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'URL manquante' }, { status: 400 })

  let url: URL
  try { url = new URL(raw) } catch { return NextResponse.json({ error: 'URL invalide' }, { status: 400 }) }

  const isOwnStorage = raw.startsWith(SUPABASE_STORAGE_PREFIX)
  if (!isOwnStorage && !(await isSafeExternalUrl(url))) {
    return NextResponse.json({ error: 'URL non autorisee' }, { status: 400 })
  }

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000), redirect: 'follow' })
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 502 })
  }
  const contentType = res.headers.get('content-type') || ''
  if (!isOwnStorage && !contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Ce lien ne pointe pas vers une image' }, { status: 415 })
  }
  const contentLength = Number(res.headers.get('content-length') || 0)
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Image trop volumineuse' }, { status: 413 })
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
