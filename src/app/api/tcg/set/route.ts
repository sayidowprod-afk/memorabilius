import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 15

// Taille officielle d'une extension Pokémon (TCGdex) pour afficher « 42 / 165 » dans la progression. Mis en cache 24 h.
const RATE = new Map<string, { n: number; reset: number }>()
function allowed(ip: string) {
  const now = Date.now(), e = RATE.get(ip)
  if (!e || now > e.reset) { RATE.set(ip, { n: 1, reset: now + 60_000 }); return true }
  if (e.n >= 60) return false
  e.n++; return true
}
const LANGS: Record<string, string> = { FR: 'fr', EN: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt' }

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!allowed(ip)) return NextResponse.json({ total: null }, { status: 429 })
  const sp = req.nextUrl.searchParams
  const id = (sp.get('id') || '').trim().slice(0, 40)
  const lang = LANGS[(sp.get('lang') || 'FR').toUpperCase()] || 'fr'
  if (!/^[A-Za-z0-9.\-]+$/.test(id)) return NextResponse.json({ total: null })
  try {
    const r = await fetch(`https://api.tcgdex.net/v2/${lang}/sets/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return NextResponse.json({ total: null })
    const j = await r.json() as { name?: string; cardCount?: { total?: number; official?: number } }
    return NextResponse.json({ name: j.name || null, total: j.cardCount?.official ?? j.cardCount?.total ?? null }, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800' } })
  } catch { return NextResponse.json({ total: null }) }
}
