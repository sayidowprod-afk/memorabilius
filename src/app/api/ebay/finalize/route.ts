import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'
import { fetchToken, getEbayUserId } from '@/lib/ebayTrading'
import { encryptToken } from '@/lib/ebayCrypto'
import { syncMember } from '@/lib/ebaySync'

export const maxDuration = 60

// Étape 2 : le membre revient de chez eBay sur /ebay/connexion?etat=… ; on échange la session contre le jeton,
// on le stocke chiffré, puis on lance la première synchronisation.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
    const body = await req.json().catch(() => null) as { etat?: string } | null
    const etat = typeof body?.etat === 'string' ? body.etat : ''
    if (!etat) return NextResponse.json({ error: 'Retour eBay invalide.' }, { status: 400 })

    const { data: row } = await supabaseAdmin.from('ebay_connexions')
      .select('session_id, session_cree_at').eq('user_id', user.id).eq('etat', etat).maybeSingle()
    const fresh = row?.session_cree_at && Date.now() - new Date(row.session_cree_at).getTime() < 30 * 60000
    if (!row?.session_id || !fresh) return NextResponse.json({ error: 'Demande de connexion expirée : recommence.' }, { status: 400 })

    const { token, expiresAt } = await fetchToken(row.session_id)
    const ebayUserId = await getEbayUserId(token)
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin.from('ebay_connexions').update({
      token_chiffre: encryptToken(token), token_expire_at: expiresAt, ebay_user_id: ebayUserId || null, statut: 'connecte',
      connecte_at: now, session_id: null, etat: null, session_cree_at: null, derniere_erreur: null, updated_at: now,
    }).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })

    const sync = await syncMember(user.id)
    return NextResponse.json({ ok: true, sync })
  } catch {
    return NextResponse.json({ error: 'La connexion à eBay a échoué : recommence dans un instant.' }, { status: 502 })
  }
}
