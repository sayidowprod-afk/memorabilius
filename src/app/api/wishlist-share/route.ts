import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createServerServiceClient } from '@/lib/supabaseServer'

const supabase = createServerServiceClient()

async function userFrom(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// GET : lien de partage actuel de la wishlist du membre (ou null). 409 si la migration n'est pas encore passée.
export async function GET(req: NextRequest) {
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { data, error } = await supabase.from('wishlist_shares').select('token').eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'migration' }, { status: 409 })
  return NextResponse.json({ token: data?.token ?? null })
}

// POST { action: 'enable' | 'regenerate' | 'disable' }
export async function POST(req: NextRequest) {
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { action } = await req.json().catch(() => ({}))
  if (action === 'disable') {
    const { error } = await supabase.from('wishlist_shares').delete().eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'migration' }, { status: 409 })
    return NextResponse.json({ token: null })
  }
  if (action !== 'enable' && action !== 'regenerate') return NextResponse.json({ error: 'bad action' }, { status: 400 })
  if (action === 'enable') {
    const { data: existing, error: e0 } = await supabase.from('wishlist_shares').select('token').eq('user_id', user.id).maybeSingle()
    if (e0) return NextResponse.json({ error: 'migration' }, { status: 409 })
    if (existing?.token) return NextResponse.json({ token: existing.token })
  }
  const token = randomBytes(18).toString('base64url')
  const { error } = await supabase.from('wishlist_shares').upsert({ user_id: user.id, token }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'migration' }, { status: 409 })
  return NextResponse.json({ token })
}
