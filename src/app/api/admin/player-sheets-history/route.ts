import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { fetchEspnPlayerAutofill } from '@/lib/espnHeadshot'

export const maxDuration = 30

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Nombre de fiches traitees par appel : les requetes ESPN sont lentes (2 par
// joueur) -- le client rappelle tant qu'il en reste ("remaining").
const BATCH = 8
const CONCURRENCY = 4

// Toujours ecrit un tableau (vide si ESPN ne connait pas le joueur) : evite de
// re-tenter indefiniment les introuvables (team_history reste null seulement
// pour les fiches jamais traitees).
async function fillOne(sheet: { id: string; player_name: string }): Promise<unknown[]> {
  const d = await fetchEspnPlayerAutofill(sheet.player_name, 'nba')
  const history = d?.teamHistory ?? []
  const { error } = await admin.from('player_sheets').update({ team_history: history }).eq('id', sheet.id)
  if (error) throw error
  return history
}

// POST { sheetId }            -> (re)calcule l'historique d'une fiche
// POST { team: 'LAL' }        -> complete les fiches de l'equipe qui n'en ont pas encore
export async function POST(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))

  try {
    if (body.sheetId) {
      const { data: sheet, error } = await admin.from('player_sheets').select('id, player_name').eq('id', body.sheetId).single()
      if (error || !sheet) return NextResponse.json({ error: 'not found' }, { status: 404 })
      const history = await fillOne(sheet)
      if (!history.length) return NextResponse.json({ error: 'espn' }, { status: 404 })
      return NextResponse.json({ history })
    }

    if (body.team) {
      // Colonne absente (migration pas encore passee) -> erreur explicite, sans planter.
      const { data: missing, error } = await admin.from('player_sheets')
        .select('id, player_name').eq('team_abbr', body.team).is('team_history', null).limit(200)
      if (error) return NextResponse.json({ error: 'migration' }, { status: 409 })
      const todo = missing || []
      const batch = todo.slice(0, BATCH)
      let updated = 0
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        const res = await Promise.all(batch.slice(i, i + CONCURRENCY).map(s => fillOne(s).catch(() => null)))
        updated += res.filter(r => r && r.length > 0).length
      }
      return NextResponse.json({ processed: batch.length, updated, remaining: Math.max(0, todo.length - batch.length) })
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  return NextResponse.json({ error: 'missing sheetId or team' }, { status: 400 })
}
