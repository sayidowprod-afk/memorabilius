import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserFromRequest } from '@/lib/shipmentServer'
import { decryptToken } from '@/lib/ebayCrypto'
import { revokeToken } from '@/lib/ebayTrading'

export const maxDuration = 30

// Déconnecte le compte eBay : le jeton est révoqué chez eBay (au mieux) puis effacé ici. `deleteData` efface aussi
// l'historique importé.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const body = await req.json().catch(() => null) as { deleteData?: boolean } | null

  const { data: conn } = await supabaseAdmin.from('ebay_connexions').select('token_chiffre').eq('user_id', user.id).maybeSingle()
  if (conn?.token_chiffre) {
    try { await revokeToken(decryptToken(conn.token_chiffre)) } catch { /* déjà révoqué ou expiré : sans importance */ }
  }
  await supabaseAdmin.from('ebay_connexions').delete().eq('user_id', user.id)
  if (body?.deleteData) await supabaseAdmin.from('achats_membre').delete().eq('user_id', user.id).eq('source', 'ebay')
  else await supabaseAdmin.from('achats_membre').delete().eq('user_id', user.id).eq('source', 'ebay').in('type', ['enchere', 'suivi'])
  return NextResponse.json({ ok: true })
}
