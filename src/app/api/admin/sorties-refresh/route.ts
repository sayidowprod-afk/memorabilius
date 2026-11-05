import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'
import { refreshSorties } from '@/lib/sortiesRefresh'

export const maxDuration = 30

const admin = createServerServiceClient()

// POST : actualise le calendrier des sorties tout de suite (bouton de la page Administration). Admin uniquement.
export async function POST(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const r = await refreshSorties(admin)
  return r.ok ? NextResponse.json({ ok: true, read: r.read }) : NextResponse.json({ error: r.error }, { status: r.status })
}
