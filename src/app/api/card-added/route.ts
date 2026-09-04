import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { awardXP, checkAndAwardBadgeXP, xpForCard } from '@/lib/xp'
import { recalcAndSaveUserStats } from '@/lib/recalcStats'

const cardAddedPostSchema = z.object({
  userId: z.string().uuid(),
  rc: z.boolean().optional(),
  auto: z.boolean().optional(),
  patch: z.boolean().optional(),
  num: z.boolean().optional(),
})
const cardAddedDeleteSchema = z.object({
  userId: z.string().uuid(),
  cardId: z.string().min(1),
  createdAt: z.string().nullable().optional(),
})

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
    const parsed = cardAddedPostSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    const { userId, rc = false, auto = false, patch = false, num = false } = parsed.data
    if (!(await verifyOwner(req, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const month = new Date().toISOString().slice(0, 7)

    const { data: ma } = await supabase
      .from('monthly_additions').select('count')
      .eq('user_id', userId).eq('month', month).maybeSingle()

    await supabase.from('monthly_additions').upsert(
      { user_id: userId, month, count: (ma?.count || 0) + 1 },
      { onConflict: 'user_id,month' }
    )

    // Recompte complet plutot qu'un increment delta -- un delta qui echoue
    // silencieusement (timeout, erreur reseau cote client sur ce fetch fire-
    // and-forget) cree une derive permanente entre le vrai nombre de cartes
    // et stats_total, jamais corrigee toute seule. Un recompte est
    // auto-reparant : meme si CET appel echoue, le prochain ajout/suppression
    // ou le cron nightly remet le bon chiffre.
    const { data: profile } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
    const recalc = await recalcAndSaveUserStats(supabase, userId, profile?.lien_csv, { csvTimeoutMs: 8000 })
    if ('error' in recalc) console.error('[card-added POST] recalc failed:', recalc.error)

    await awardXP(supabase, userId, 'card_added', xpForCard({ rc, auto, patch, num }))
    await checkAndAwardBadgeXP(supabase, userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const parsed = cardAddedDeleteSchema.safeParse(await req.json())
    if (!parsed.success) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    const { userId, createdAt } = parsed.data
    if (!(await verifyOwner(req, userId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const month = new Date().toISOString().slice(0, 7)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    // createdAt vient du caller (etat local, avant suppression) plutot que
    // d'un fetch serveur ici -- la carte a deja ete supprimee de
    // cartes_manuelles au moment ou ce endpoint est appele (voir GalerieClient),
    // donc un SELECT par id ne la trouverait plus.
    const { data: ma } = await supabase
      .from('monthly_additions').select('count')
      .eq('user_id', userId).eq('month', month).maybeSingle()

    if (createdAt && createdAt >= startOfMonth) {
      const newCount = Math.max(0, (ma?.count || 0) - 1)
      await supabase.from('monthly_additions').upsert(
        { user_id: userId, month, count: newCount },
        { onConflict: 'user_id,month' }
      )
    }

    // Recompte complet plutot qu'un decrement delta -- voir le meme
    // commentaire dans POST. Le caller (GalerieClient) attend que la carte
    // soit bien supprimee de cartes_manuelles avant d'appeler ce endpoint,
    // donc le recompte ci-dessous ne la voit plus.
    const { data: profile } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
    const recalc = await recalcAndSaveUserStats(supabase, userId, profile?.lien_csv, { csvTimeoutMs: 8000 })
    if ('error' in recalc) console.error('[card-added DELETE] recalc failed:', recalc.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
