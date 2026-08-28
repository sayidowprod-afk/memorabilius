import { NextResponse } from 'next/server'

// Toujours lu en direct sur le serveur qui repond (jamais mis en cache) --
// sert a comparer face au SHA inline dans le JS deja charge cote client
// (NEXT_PUBLIC_APP_VERSION, voir next.config.js) pour detecter qu'un nouveau
// deploy a eu lieu depuis le chargement de la page.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
