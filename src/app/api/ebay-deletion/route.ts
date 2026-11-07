import { NextRequest, NextResponse } from 'next/server'
import { verifyEbaySignature } from '@/lib/ebayNotifSignature'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

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

// Échappe les jokers de LIKE : un pseudo « % » ne doit jamais correspondre à tout le monde.
const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => `\\${c}`)

// eBay envoie un POST quand un utilisateur supprime son compte eBay : on efface ses données eBay chez nous
// (compte relié dans « Mes achats » : jeton chiffré, achats, enchères, suivis).
// Sans vérification de signature, n'importe qui pouvait faire effacer les données eBay d'un membre (voire de tous).
export async function POST(req: NextRequest) {
  const raw = await req.text()
  // Signature absente ou invalide : on répond 200 (comme eBay l'attend) mais sans rien supprimer.
  if (!(await verifyEbaySignature(raw, req.headers.get('x-ebay-signature')))) {
    console.warn('[ebay-deletion] notification ignorée : signature absente ou invalide')
    return NextResponse.json({ ok: true }, { status: 200 })
  }
  let body: { notification?: { data?: { username?: unknown } } } | null = null
  try { body = JSON.parse(raw) } catch { body = null }
  const username = body?.notification?.data?.username
  if (typeof username === 'string' && /^[\w.@-]{1,64}$/.test(username)) {
    // pseudo eBay insensible à la casse, mais sans aucun joker
    const { data: rows } = await supabase.from('ebay_connexions').select('user_id').ilike('ebay_user_id', escapeLike(username))
    for (const r of rows || []) {
      await supabase.from('achats_membre').delete().eq('user_id', r.user_id).eq('source', 'ebay')
      await supabase.from('ventes_membre').delete().eq('user_id', r.user_id).eq('source', 'ebay')
      await supabase.from('ebay_connexions').delete().eq('user_id', r.user_id)
    }
  }
  return NextResponse.json({ ok: true }, { status: 200 })
}
