import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/shipmentServer'

// Notifications de suppression de compte eBay (obligatoires pour toute application eBay) :
//  - GET  ?challenge_code=…  : eBay vérifie que l'adresse nous appartient ; on répond avec le hachage attendu.
//  - POST : un utilisateur a fermé son compte eBay -> on efface ses données eBay chez nous.
// Variables : EBAY_VERIFICATION_TOKEN (32 à 80 caractères, saisi aussi dans le portail eBay) et, si l'adresse publique
// change, EBAY_SUPPRESSION_ENDPOINT (doit être identique à celle déclarée dans le portail).
const ENDPOINT = () => process.env.EBAY_SUPPRESSION_ENDPOINT || 'https://www.memorabilius.fr/api/ebay/suppression'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('challenge_code')
  const token = process.env.EBAY_VERIFICATION_TOKEN
  if (!code || !token) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const challengeResponse = createHash('sha256').update(code).update(token).update(ENDPOINT()).digest('hex')
  return NextResponse.json({ challengeResponse })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { notification?: { data?: { username?: string } } } | null
  const username = body?.notification?.data?.username
  if (username) {
    const { data: rows } = await supabaseAdmin.from('ebay_connexions').select('user_id').ilike('ebay_user_id', username)
    for (const r of rows || []) {
      await supabaseAdmin.from('achats_membre').delete().eq('user_id', r.user_id).eq('source', 'ebay')
      await supabaseAdmin.from('ebay_connexions').delete().eq('user_id', r.user_id)
    }
  }
  return new NextResponse(null, { status: 204 })
}
