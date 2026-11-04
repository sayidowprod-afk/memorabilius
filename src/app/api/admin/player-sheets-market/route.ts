import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { buildCardMarket } from '@/lib/playerCardMarket'
import { createServerServiceClient } from '@/lib/supabaseServer'

export const maxDuration = 45

const admin = createServerServiceClient()

// Fiches calculées par appel en lot : chacune = lecture TCDB + 5 recherches eBay.
const BATCH = 6
const CONCURRENCY = 3

// POST { sheetId, refresh? } : renvoie les stats « cartes » mises en cache sur la fiche ; les recalcule (TCDB + 5 recherches eBay)
// seulement si elles n'existent pas encore ou si refresh est demandé. Admin uniquement.
export async function POST(req: NextRequest) {
  const user = await requireAdmin(admin, req.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { sheetId, refresh, team, all } = await req.json().catch(() => ({}))

  // En lot : { team: 'LAL' } ou { all: true } -> calcule les fiches qui n'ont pas encore de stats (quelques-unes par appel,
  // le client rappelle tant que « remaining » > 0). Colonne absente (migration pas passée) -> 409, sans rien calculer.
  // Seules les équipes cochées sur la page « Fiches joueurs » sont calculées (table player_sheet_market_teams) :
  // on étale ainsi le calcul sur plusieurs jours pour ménager le quota eBay. Table absente -> wanted = null.
  const { data: wantedRows, error: wantedErr } = await admin.from('player_sheet_market_teams').select('team_abbr')
  const wanted: string[] | null = wantedErr ? null : (wantedRows ?? []).map(r => r.team_abbr)

  if (team || all) {
    if (!wanted) return NextResponse.json({ error: 'migration' }, { status: 409 })
    const teams = team ? wanted.filter(t => t === team) : wanted
    if (!teams.length) return NextResponse.json({ processed: 0, done: 0, remaining: 0, skipped: true })
    const q = admin.from('player_sheets').select('id, player_name').is('card_market', null).neq('player_name', '').in('team_abbr', teams).order('created_at')
    const { data: todo, error: e2 } = await q.limit(400)
    if (e2) return NextResponse.json({ error: 'migration' }, { status: 409 })
    const batch = (todo || []).slice(0, BATCH)
    let done = 0
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const res = await Promise.all(batch.slice(i, i + CONCURRENCY).map(async s => {
        const market = await buildCardMarket(admin, s.player_name)
        const { error } = await admin.from('player_sheets').update({ card_market: market, card_market_at: market.at }).eq('id', s.id)
        return !error
      }).map(p => p.catch(() => false)))
      done += res.filter(Boolean).length
    }
    return NextResponse.json({ processed: batch.length, done, remaining: Math.max(0, (todo?.length ?? 0) - batch.length) })
  }

  if (!sheetId) return NextResponse.json({ error: 'missing sheetId' }, { status: 400 })

  // Migration 20261107 pas encore passée (colonne absente) : on calcule quand même, simplement sans mise en cache.
  let sheet: { id: string; player_name: string; team_abbr: string; card_market?: unknown } | null = null
  let canCache = true
  const first = await admin.from('player_sheets').select('id, player_name, team_abbr, card_market').eq('id', sheetId).single()
  if (first.error?.message?.includes('card_market')) {
    canCache = false
    sheet = (await admin.from('player_sheets').select('id, player_name, team_abbr').eq('id', sheetId).single()).data
  } else sheet = first.data
  if (!sheet) return NextResponse.json({ error: 'not found' }, { status: 404 })

  if (sheet.card_market && !refresh) return NextResponse.json({ market: sheet.card_market, cached: true })
  // Équipe non cochée : pas de calcul automatique à l'ouverture de la fiche (le bouton « Calculer » de la fiche reste possible).
  if (!refresh && wanted && !wanted.includes(sheet.team_abbr)) return NextResponse.json({ market: null, notWanted: true })
  if (!sheet.player_name?.trim()) return NextResponse.json({ error: 'no name' }, { status: 400 })

  const market = await buildCardMarket(admin, sheet.player_name)
  if (canCache) await admin.from('player_sheets').update({ card_market: market, card_market_at: market.at }).eq('id', sheet.id)
  return NextResponse.json({ market, cached: false, notCached: !canCache })
}
