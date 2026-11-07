import { NextRequest, NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cronAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { refreshSorties } from '@/lib/sortiesRefresh'

export const maxDuration = 60

const supabase = createServerServiceClient()

// Une fois par semaine : met à jour le calendrier des sorties de cartes de basket (voir lib/sortiesRefresh.ts).
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'CRON_SECRET manquant' }, { status: 500 })
  if (!cronAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const r = await refreshSorties(supabase)
  return r.ok ? NextResponse.json({ ok: true, read: r.read, linked: r.linked, imported: r.imported }) : NextResponse.json({ error: r.error }, { status: r.status })
}
