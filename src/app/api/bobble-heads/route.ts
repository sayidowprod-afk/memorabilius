import { NextResponse } from 'next/server'
import { bobbleFor } from '@/lib/bobbleheadsServer'

// Têtes seules des bobbleheads validés : GET /api/bobble-heads?names=Joel Embiid|Patrick Mahomes II → { heads: { "Joel Embiid": "/bobbleheads/…-head.webp?v=…" } }
// Sert aux vignettes de la recherche (la tête remplace les initiales). Les joueurs sans figurine sont absents.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('names') || ''
  const names = Array.from(new Set(raw.split('|').map(s => s.trim()).filter(Boolean))).slice(0, 12)
  const heads: Record<string, string> = {}
  const SUF = /\s+(Jr\.?|Sr\.?|II|III|IV)$/i   // « Patrick Mahomes II » (fiche du site) = « Patrick Mahomes » (figurine) ; et l'inverse pour « Jr. »
  for (const name of names) {
    const base = name.replace(SUF, '')
    const fig = bobbleFor(name) || (base !== name ? bobbleFor(base) : null) || bobbleFor(base + ' Jr.') || bobbleFor(base + ' II')
    if (fig?.headSrc) heads[name] = fig.headSrc
  }
  return NextResponse.json({ heads }, { headers: { 'Cache-Control': 'public, max-age=0, must-revalidate, s-maxage=300' } })
}
