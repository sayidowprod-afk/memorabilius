import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/shipmentServer'
import { syncVentes } from '@/lib/ebayVentes'

export const maxDuration = 60

// Actualise les ventes eBay du membre. Ouverture de la page : 10 min mini entre deux lectures ; bouton « Actualiser » : 1 min.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 })
  const body = await req.json().catch(() => null) as { force?: boolean } | null
  return NextResponse.json(await syncVentes(user.id, body?.force ? 60000 : 600000))
}
