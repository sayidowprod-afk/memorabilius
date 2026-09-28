#!/usr/bin/env node
/**
 * Pour tous les joueurs des fiches draftes CETTE ANNEE, remplace le champ
 * "Experience" par "Pick n°X" (numero de choix global, donnees NBA.com).
 *
 * Usage:
 *   node scripts/apply-draft-picks.js            # simulation
 *   node scripts/apply-draft-picks.js --apply
 *   node scripts/apply-draft-picks.js --apply --year=2026
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')
const YEAR = parseInt((process.argv.find(a => a.startsWith('--year=')) || `--year=${new Date().getFullYear()}`).split('=')[1], 10)
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const key = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/ (jr|sr|ii|iii|iv)$/, '').replace(/ /g, '')

async function main() {
  const res = await fetch('https://www.nba.com/players', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' },
  })
  const html = await res.text()
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) throw new Error('NBA.com : donnees introuvables')
  const players = JSON.parse(m[1]).props.pageProps.players
  const byKey = new Map()
  for (const p of players) {
    const k = key(`${p.PLAYER_FIRST_NAME} ${p.PLAYER_LAST_NAME}`)
    const prev = byKey.get(k)
    if (!prev || Number(p.FROM_YEAR) > Number(prev.FROM_YEAR)) byKey.set(k, p)
  }

  const { data: sheets, error } = await admin.from('player_sheets').select('id, team_abbr, player_name, stat_saison').limit(5000)
  if (error) throw error

  const todo = []
  for (const s of sheets) {
    const p = byKey.get(key(s.player_name))
    if (!p || Number(p.DRAFT_YEAR) !== YEAR || !Number(p.DRAFT_NUMBER)) continue
    const label = `Pick n°${Number(p.DRAFT_NUMBER)}`
    if (s.stat_saison !== label) todo.push({ ...s, label })
  }
  todo.sort((a, b) => parseInt(a.label.replace(/\D/g, ''), 10) - parseInt(b.label.replace(/\D/g, ''), 10))
  for (const t of todo) console.log(`${t.team_abbr} ${t.player_name}: "${t.stat_saison ?? ''}" -> "${t.label}"`)
  console.log(`\n${todo.length} fiches (draft ${YEAR})`)
  if (!APPLY || !todo.length) { if (!APPLY) console.log('(simulation -- relance avec --apply)'); return }
  for (const t of todo) {
    const { error: e } = await admin.from('player_sheets').update({ stat_saison: t.label }).eq('id', t.id)
    if (e) console.log('ERREUR', t.player_name, e.message)
  }
  console.log('Termine.')
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1) })
