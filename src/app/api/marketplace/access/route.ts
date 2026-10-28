import { NextRequest, NextResponse } from 'next/server'
import { getMarketplaceUser } from '@/lib/marketplaceAccess'

// Indique si l'utilisateur connecté a accès à la marketplace (bêta privée). Ne renvoie jamais la liste des adresses.
export async function GET(req: NextRequest) {
  const user = await getMarketplaceUser(req)
  return NextResponse.json({ allowed: !!user })
}
