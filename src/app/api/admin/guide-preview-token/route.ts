import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createPreviewToken } from '@/lib/guidePreviewToken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { guideId } = await req.json()
  if (!guideId) return NextResponse.json({ error: 'guideId manquant' }, { status: 400 })
  const { data: guide } = await supabase.from('guides').select('id').eq('id', guideId).single()
  if (!guide) return NextResponse.json({ error: 'Guide introuvable' }, { status: 404 })

  return NextResponse.json({ token: createPreviewToken(guideId) })
}
