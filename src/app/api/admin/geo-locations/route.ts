import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { createServerServiceClient } from '@/lib/supabaseServer'

const admin = createServerServiceClient()

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: ucData } = await admin
    .from('user_countries')
    .select('lat, lon, user_id')
    .not('lat', 'is', null)
    .not('lon', 'is', null)

  if (!ucData?.length) return NextResponse.json({ locations: [] })

  const userIds = ucData.map(r => r.user_id)
  const { data: profileData } = await admin
    .from('profiles')
    .select('id, display_name, slug')
    .in('id', userIds)

  const profileMap = new Map((profileData ?? []).map(p => [p.id, p]))

  const locations = ucData.map((r: any) => ({
    lat: r.lat as number,
    lon: r.lon as number,
    name: profileMap.get(r.user_id)?.display_name || 'Utilisateur',
    slug: profileMap.get(r.user_id)?.slug || r.user_id,
  }))

  return NextResponse.json({ locations })
}
