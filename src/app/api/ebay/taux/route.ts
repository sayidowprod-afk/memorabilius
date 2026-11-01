import { NextResponse } from 'next/server'

// Taux de change du jour (Banque centrale européenne, via frankfurter.app, gratuit et sans clé) pour afficher en euros
// les achats eBay faits en dollars, livres, etc. Réponse : { rates: { USD: 0.92, GBP: 1.17, … } } = euros pour 1 unité.
// Mis en cache 12 h : les taux ne bougent qu'une fois par jour ouvré.
export async function GET() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=EUR', { next: { revalidate: 43200 }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const json = await res.json() as { rates?: Record<string, number> }
    const rates: Record<string, number> = {}
    for (const [cur, perEur] of Object.entries(json.rates || {})) if (perEur > 0) rates[cur] = 1 / perEur
    return NextResponse.json({ rates }, { headers: { 'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=86400' } })
  } catch {
    return NextResponse.json({ rates: null }, { status: 200, headers: { 'Cache-Control': 'public, s-maxage=300' } })
  }
}
