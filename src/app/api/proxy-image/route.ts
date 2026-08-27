import { NextRequest, NextResponse } from 'next/server'

// Proxy tres restreint : ne sert qu'a recharger cote client (via <img> same-origin,
// pour lire les pixels en canvas sans probleme CORS) une photo de carte deja
// enregistree dans NOTRE bucket Supabase Storage -- jamais une URL arbitraire.
// Necessaire car un <img crossOrigin="anonymous"> direct vers le storage Supabase
// echoue en pratique (bloque cote CDN), alors qu'un <img> simple sans CORS passe.
const SUPABASE_STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/cartes/`

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url || !url.startsWith(SUPABASE_STORAGE_PREFIX)) {
    return NextResponse.json({ error: 'URL non autorisee' }, { status: 400 })
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'Image introuvable' }, { status: 502 })
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=60',
    },
  })
}
