import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'
import { getSessionId, signInUrl } from '@/lib/ebayTrading'

export const maxDuration = 30

// Étape 1 de « Connecter eBay » : ouvre une session chez eBay et renvoie l'adresse de la page de connexion d'eBay
// (le membre s'y identifie lui-même : on ne voit jamais son mot de passe). `etat` est un jeton à usage unique qui
// ramène le membre sur /ebay/connexion et prouve que le retour correspond bien à cette demande.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })

    const etat = randomBytes(24).toString('base64url')
    const sessionId = await getSessionId()
    const { error } = await supabaseAdmin.from('ebay_connexions').upsert({
      user_id: user.id, etat, session_id: sessionId, session_cree_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })

    return NextResponse.json({ url: signInUrl(sessionId, etat) })
  } catch {
    return NextResponse.json({ error: 'Impossible de joindre eBay pour le moment.' }, { status: 502 })
  }
}
