import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/adminAuth'
import { computeSheetFill } from '@/lib/playerSheetFill'

export const maxDuration = 30

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const isEmpty = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

// POST { sheetId, force? } -- remplit une fiche (stats, age, poste, pays,
// experience, historique des equipes, description dans les notes) depuis ESPN.
// Par defaut ne touche QUE les champs vides : rien de ce que l'admin a saisi
// n'est ecrase. force=true remplace tout.
export async function POST(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { sheetId, force } = await req.json().catch(() => ({}))
  if (!sheetId) return NextResponse.json({ error: 'missing sheetId' }, { status: 400 })

  const { data: sheet, error } = await admin.from('player_sheets').select('*').eq('id', sheetId).single()
  if (error || !sheet) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const fill = await computeSheetFill(sheet.player_name)
  if (!fill) return NextResponse.json({ error: 'espn' }, { status: 404 })

  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fill.fields)) {
    if (force || isEmpty(sheet[k])) update[k] = v
  }
  // Notes : remplacees seulement si vides ou si c'est l'ancienne description
  // automatique (qui recitait les stats) -- jamais un texte ecrit a la main.
  const oldAuto = typeof sheet.notes === 'string' && /\d+([.,]\d+)? pts/.test(sheet.notes) && /rbs/.test(sheet.notes)
  if (fill.notes && (force || isEmpty(sheet.notes) || oldAuto)) update.notes = fill.notes

  if (Object.keys(update).length) {
    update.updated_at = new Date().toISOString()
    const { error: upErr } = await admin.from('player_sheets').update(update).eq('id', sheetId)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  // Historique : ecriture separee -- la colonne n'existe qu'apres la migration v4,
  // son absence ne doit pas empecher le reste du remplissage.
  if ((force || sheet.team_history == null) && fill.team_history.length) {
    await admin.from('player_sheets').update({ team_history: fill.team_history }).eq('id', sheetId)
  }

  return NextResponse.json({ ok: true, filled: Object.keys(update) })
}
