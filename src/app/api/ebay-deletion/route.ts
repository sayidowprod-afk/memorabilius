import { NextRequest, NextResponse } from 'next/server'
import { createServerServiceClient } from '@/lib/supabaseServer'

const ENDPOINT_URL = 'https://www.memorabilius.fr/api/ebay-deletion'

const supabase = createServerServiceClient()

// eBay envoie un GET pour valider l'endpoint
export async function GET(req: NextRequest) {
  const VERIFICATION_TOKEN = process.env.EBAY_VERIFICATION_TOKEN
  if (!VERIFICATION_TOKEN) return NextResponse.json({ error: 'EBAY_VERIFICATION_TOKEN not configured' }, { status: 500 })

  const challengeCode = req.nextUrl.searchParams.get('challenge_code')
  if (!challengeCode) return NextResponse.json({ error: 'missing challenge_code' }, { status: 400 })

  // Hash requis : SHA-256 de (challengeCode + verificationToken + endpoint)
  const data = challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const challengeResponse = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return NextResponse.json({ challengeResponse })
}

// eBay envoie un POST quand un utilisateur supprime son compte eBay : on efface ses données eBay chez nous
// (compte relié dans « Mes achats » : jeton chiffré, achats, enchères, suivis).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { notification?: { data?: { username?: string } } } | null
  const username = body?.notification?.data?.username
  if (username) {
    const { data: rows } = await supabase.from('ebay_connexions').select('user_id').ilike('ebay_user_id', username)
    for (const r of rows || []) {
      await supabase.from('achats_membre').delete().eq('user_id', r.user_id).eq('source', 'ebay')
      await supabase.from('ebay_connexions').delete().eq('user_id', r.user_id)
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
