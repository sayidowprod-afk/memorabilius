import { NextRequest, NextResponse } from 'next/server'
import { computePartners } from '@/lib/tradePartners'
import { rateLimited } from '@/lib/publicRateLimit'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 30

const supabase = createServerServiceClient()

// GET /api/trades/partners[?refresh=1] — classement des membres avec qui l'échange est le plus intéressant (voir src/lib/tradePartners.ts)
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // une recherche complète parcourt toute la base : on freine les relances (le résultat est aussi gardé 10 min en mémoire)
  const refresh = req.nextUrl.searchParams.get('refresh') === '1'
  if (refresh && rateLimited(req, 'trade-partners', 6, 10 * 60 * 1000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  return NextResponse.json(await computePartners(supabase, user.id, refresh))
}
