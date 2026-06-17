import { NextRequest, NextResponse } from 'next/server'

const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN || 'memorabilius-ebay-2026'
const ENDPOINT_URL = 'https://www.memorabilius.fr/api/ebay-deletion'

// eBay envoie un GET pour valider l'endpoint
export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get('challenge_code')
  if (!challengeCode) return NextResponse.json({ error: 'missing challenge_code' }, { status: 400 })

  // Hash requis : SHA-256 de (challengeCode + verificationToken + endpoint)
  const data = challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return NextResponse.json({ challengeResponse })
}

// eBay envoie un POST quand un compte est supprimé
export async function POST(req: NextRequest) {
  // On accuse réception — on ne stocke pas de données eBay donc rien à supprimer
  return NextResponse.json({ ok: true }, { status: 200 })
}
