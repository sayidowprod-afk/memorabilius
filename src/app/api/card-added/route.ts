import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST : incrémente lors d'un ajout manuel
// DELETE : décrémente lors d'une suppression (uniquement si la carte a été ajoutée ce mois-ci)
// Maintient monthly_additions + stats_total en sync temps réel, sans attendre la prochaine synchro CSV.

async function verifyOwner(req: NextRequest, userId: string) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const { data: { user } } = await supabase.auth.getUser(token)
  return !!user && user.id === userId
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
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

    await supabase.rpc('increment_stats', { p_user_id: userId, p_delta: 1 })

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

    // Vérifier si la carte a été ajoutée ce mois-ci
    const month = new Date().toISOString().slice(0, 7)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const { data: card } = await supabase
      .from('cartes_manuelles').select('created_at')
      .eq('id', cardId).eq('user_id', userId).single()

    const addedThisMonth = card?.created_at && card.created_at >= startOfMonth

    if (addedThisMonth) {
      const { data: ma } = await supabase
        .from('monthly_additions').select('count')
        .eq('user_id', userId).eq('month', month).maybeSingle()

      const newCount = Math.max(0, (ma?.count || 0) - 1)
      await supabase.from('monthly_additions').upsert(
        { user_id: userId, month, count: newCount },
        { onConflict: 'user_id,month' }
      )
    }

    // Toujours décrémenter stats_total (la carte existe, elle sera supprimée)
    await supabase.rpc('increment_stats', { p_user_id: userId, p_delta: -1 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
