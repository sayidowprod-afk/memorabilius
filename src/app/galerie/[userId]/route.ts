import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const userId = params.userId
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1. Récupérer l'utilisateur actuellement connecté (celui qui regarde la page)
  const { data: { session } } = await supabase.auth.getSession()
  const currentUserId = session?.user?.id || null
  const isOwner = currentUserId === userId

  try {
    // 2. Récupérer le profil pour avoir le lien CSV
    const { data: profile } = await supabase
      .from('profiles')
      .select('lien_csv')
      .eq('id', userId)
      .single()

    if (!profile || !profile.lien_csv) {
      return NextResponse.json({ cards: [] })
    }

    // 3. Récupérer les clés des cartes privées
    const { data: privateData } = await supabase
      .from('cartes_privees')
      .select('card_key')
      .eq('user_id', userId)

    const privateKeys = new Set(privateData?.map((d) => d.card_key) || [])

    // 4. Charger et parser le CSV (côté serveur !)
    const r = await fetch(profile.lien_csv + '&t=' + Date.now())
    const t = await r.text()
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
          g: c[12] || 'Raw',
        }
      })
      .filter(Boolean) as Card[]

    // 5. LE FILTRAGE DE SÉCURITÉ
    // Si ce n'est pas le propriétaire, on supprime STRICTEMENT les cartes privées du tableau
    const filteredCards = parsed.filter((card) => {
      if (!isOwner && privateKeys.has(card.f)) {
        return false // La carte est privée et le visiteur n'est pas le propriétaire -> Poubelle
      }
      return true
    })

    return NextResponse.json({ cards: filteredCards })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}