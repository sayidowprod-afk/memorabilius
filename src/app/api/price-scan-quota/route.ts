import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parisWeekStart } from '@/lib/discordContest'

export const maxDuration = 15

const WEEKLY_LIMIT_NON_MEMBER = 10

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verifie et decompte le quota hebdomadaire du scanner de prix (page /scanner
// uniquement -- pas le prix eBay affiche sur une carte en galerie, qui reste
// illimite pour tout le monde) : illimite pour les membres Federation de la
// carte, 10 utilisations/semaine sinon. Appele juste avant chaque appel a
// /api/ebay-sold depuis le scanner.
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: fed } = await supabaseAdmin.from('teams').select('id').ilike('name', 'Fédération de la carte').limit(1)
    const fedId = fed?.[0]?.id
    if (fedId) {
      const { data: mem } = await supabaseAdmin.from('team_members').select('user_id').eq('team_id', fedId).eq('user_id', user.id).limit(1)
      if (mem?.length) return NextResponse.json({ ok: true, unlimited: true })
    }

    const weekStart = parisWeekStart()
    const { data: usage } = await supabaseAdmin.from('price_scan_usage').select('count').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle()
    const current = usage?.count || 0
    if (current >= WEEKLY_LIMIT_NON_MEMBER) {
      return NextResponse.json({ ok: false, error: 'limit_reached', limit: WEEKLY_LIMIT_NON_MEMBER, used: current }, { status: 403 })
    }

    await supabaseAdmin.from('price_scan_usage').upsert(
      { user_id: user.id, week_start: weekStart, count: current + 1 },
      { onConflict: 'user_id,week_start' }
    )
    return NextResponse.json({ ok: true, unlimited: false, remaining: WEEKLY_LIMIT_NON_MEMBER - current - 1 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
