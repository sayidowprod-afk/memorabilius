import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/shipmentServer'
import { listAnnonces } from '@/lib/ebayVentes'

export const maxDuration = 30

// Annonces eBay en cours du membre (enchères et prix fixe, avec le nombre de personnes qui les suivent). Lecture seule, rien n'est enregistré.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Non connecté.' }, { status: 401 })
  return NextResponse.json(await listAnnonces(user.id))
}
