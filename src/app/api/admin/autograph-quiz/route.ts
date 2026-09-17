import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin.from('autograph_quiz_cards').select('*').order('position', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cards: data })
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { sourceCardId, playerName, team, imageRecto, cropX, cropY, cropW, cropH, rotationDeg } = body
  if (!playerName || !imageRecto || [cropX, cropY, cropW, cropH].some(v => typeof v !== 'number')) {
    return NextResponse.json({ error: 'champs manquants' }, { status: 400 })
  }
  const rot = typeof rotationDeg === 'number' ? ((rotationDeg % 360) + 360) % 360 : 0

  const { count } = await admin.from('autograph_quiz_cards').select('*', { count: 'exact', head: true })

  const { data, error } = await admin.from('autograph_quiz_cards').insert({
    source_card_id: sourceCardId || null,
    player_name: playerName,
    team: team || null,
    image_recto: imageRecto,
    crop_x: cropX, crop_y: cropY, crop_w: cropW, crop_h: cropH,
    rotation_deg: rot,
    is_horizontal: rot === 90 || rot === 270,
    approved: true,
    position: count ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ card: data })
}

export async function DELETE(req: NextRequest) {
  const adminUser = await requireAdmin(admin, req.headers.get('authorization'))
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 })

  const { error } = await admin.from('autograph_quiz_cards').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
