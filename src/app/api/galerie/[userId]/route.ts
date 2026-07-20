import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchCsvCapped } from '@/lib/csvParse'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Only allow Google Sheets CSV exports — blocks SSRF to internal metadata endpoints
function isAllowedCsvUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && (
      u.hostname === 'docs.google.com' ||
      u.hostname === 'sheets.googleapis.com'
    )
  } catch { return false }
}

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params

  if (!userId) {
    return NextResponse.json({ error: 'User ID manquant' }, { status: 400 })
  }

  try {
    // Identify current user via Bearer token — required to serve private cards to owner
    let isOwner = false
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      isOwner = user?.id === userId
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('lien_csv')
      .eq('id', userId)
      .single()

    if (!profile || !profile.lien_csv) {
      return NextResponse.json({ cards: [] })
    }

    if (!isAllowedCsvUrl(profile.lien_csv)) {
      return NextResponse.json({ error: 'URL CSV non autorisée' }, { status: 400 })
    }

    const { data: privateData } = await supabaseAdmin
      .from('cartes_privees')
      .select('card_key')
      .eq('user_id', userId)

    const privateKeys = new Set(privateData?.map((d) => d.card_key) || [])

    const t = await fetchCsvCapped(profile.lien_csv, { cache: 'no-store' })
    if (!t) return NextResponse.json({ cards: [] })

    const rows = t.split(/\r?\n/).slice(4)

    const parsed: Card[] = rows
      .map((row) => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0] || !c[0].includes('http')) return null
        return {
          f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
          n: c[2] || '', t: c[3] || '', y: c[4] || '',
          br: c[5] || '', s: c[6] || '', v: c[7] || '',
          num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
          rc: c[10]?.toLowerCase().includes('oui') || false,
          patch: c[11]?.toLowerCase().includes('oui') || false,
          g: c[12] || 'Raw', card_number: c[13]?.trim() || '',
        }
      })
      .filter(Boolean) as Card[]

    const filteredCards = parsed.filter((card) => {
      if (!isOwner && privateKeys.has(card.f)) return false
      return true
    })

    return NextResponse.json({ cards: filteredCards })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
