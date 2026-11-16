import { NextResponse } from 'next/server'
import { bobbleFor } from '@/lib/bobbleheadsServer'

// Figurines bobblehead prêtes (validées) pour une liste de noms de joueurs : GET /api/bobble-figs?names=Joel Embiid|Tyrese Maxey
// Sert à l'en-tête des galeries (joueurs des PCs). Les joueurs sans figurine validée sont simplement absents de la réponse.
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('names') || ''
  const names = Array.from(new Set(raw.split('|').map(s => s.trim()).filter(Boolean))).slice(0, 8)
  const figs = names.flatMap(name => { const fig = bobbleFor(name); return fig ? [{ name, fig }] : [] })
  return NextResponse.json({ figs }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } })
}
