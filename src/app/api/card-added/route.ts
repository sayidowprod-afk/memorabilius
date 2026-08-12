import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST : incrémente lors d'un ajout manuel
// DELETE : décrémente lors d'une suppression (uniquement si la carte a été ajoutée ce mois-ci)
// Maintient monthly_additions + stats_total + stats_rc/auto/patch/num en sync temps réel.

async function verifyOwner(req: NextRequest, userId: string) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const { data: { user } } = await supabase.auth.getUser(token)
  return !!user && user.id === userId
}

export async function POST(req: NextRequest) {
  try {
    const { userId, rc = false, auto = false, patch = false, num = false } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    if (!(await verifyOwner(req, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const month = new Date().toISOString().slice(0, 7)

    const { data: ma } = await supabase
      .from('monthly_additions').select('count')
      .eq('user_id', userId).eq('month', month).maybeSingle()

    await supabase.from('monthly_additions').upsert(
      { user_id: userId, month, count: (ma?.count || 0) + 1 },
      { onConflict: 'user_id,month' }
    )

    await supabase.rpc('increment_stats', {
      p_user_id: userId,
      p_delta:   1,
      p_rc:      rc    ? 1 : 0,
      p_auto:    auto  ? 1 : 0,
      p_patch:   patch ? 1 : 0,
      p_num:     num   ? 1 : 0,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, cardId } = await req.json()
    if (!userId || !cardId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    if (!(await verifyOwner(req, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const month = new Date().toISOString().slice(0, 7)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // Fetch card info + monthly count in parallel (independent queries)
    const [{ data: card }, { data: ma }] = await Promise.all([
      supabase.from('cartes_manuelles').select('created_at, rc, auto, patch, num')
        .eq('id', cardId).eq('user_id', userId).single(),
      supabase.from('monthly_additions').select('count')
        .eq('user_id', userId).eq('month', month).maybeSingle(),
    ])

    if (card?.created_at && card.created_at >= startOfMonth) {
      const newCount = Math.max(0, (ma?.count || 0) - 1)
      await supabase.from('monthly_additions').upsert(
        { user_id: userId, month, count: newCount },
        { onConflict: 'user_id,month' }
      )
    }

    // Décrémente stats_total + sous-stats de la carte supprimée
    await supabase.rpc('increment_stats', {
      p_user_id: userId,
      p_delta:   -1,
      p_rc:      card?.rc    ? -1 : 0,
      p_auto:    card?.auto  ? -1 : 0,
      p_patch:   card?.patch ? -1 : 0,
      p_num:     (card?.num && card.num !== '') ? -1 : 0,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
