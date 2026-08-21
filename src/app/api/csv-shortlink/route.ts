import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Crée (ou réutilise) un id court pour une carte CSV, identifiée par
// (userId, imageUrl) — voir supabase/migrations/20260821_csv_card_links.sql.
// Sert à raccourcir les liens partagés (/c/{id} au lieu de
// /galerie/{userId}?card={url complète encodée}).
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId, imageUrl } = await req.json()
  if (!userId || !imageUrl) return NextResponse.json({ error: 'Missing userId or imageUrl' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('csv_card_links').select('id').eq('user_id', userId).eq('image_url', imageUrl).maybeSingle()
  if (existing) return NextResponse.json({ id: existing.id })

  const { data: created, error } = await supabaseAdmin
    .from('csv_card_links').insert({ user_id: userId, image_url: imageUrl }).select('id').single()
  if (error) {
    // Course avec une autre requête concurrente sur le même (user_id, image_url) : relit.
    const { data: retry } = await supabaseAdmin
      .from('csv_card_links').select('id').eq('user_id', userId).eq('image_url', imageUrl).maybeSingle()
    if (retry) return NextResponse.json({ id: retry.id })
    return NextResponse.json({ error: 'Failed to create short link' }, { status: 500 })
  }
  return NextResponse.json({ id: created.id })
}
