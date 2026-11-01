import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/shipmentServer'
import { syncMember } from '@/lib/ebaySync'

export const maxDuration = 60

// Actualise les achats / enchères / suivis du membre. `force` (bouton « Actualiser ») laisse seulement 20 s entre deux
// synchronisations ; l'ouverture automatique de la page attend 2 min, pour ne pas épuiser le quota d'appels eBay.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const body = await req.json().catch(() => null) as { force?: boolean } | null
  const result = await syncMember(user.id, body?.force ? 20000 : 120000)
  return NextResponse.json(result)
}
