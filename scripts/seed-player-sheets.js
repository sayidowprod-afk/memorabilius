#!/usr/bin/env node
/**
 * Cree les fiches joueurs manquantes des 30 equipes NBA a partir de
 * scripts/data/nba-rosters-2026-27.json (effectifs sous contrat, hors two-way,
 * releves sur Spotrac), puis remplit chaque NOUVELLE fiche (stats, age, poste,
 * pays, experience, historique, description) via /api/admin/player-sheets-fill.
 *
 * Jamais de suppression ni d'ecrasement : les fiches existantes (et leurs cartes,
 * notes, stats) ne sont pas touchees.
 *
 * Usage:
 *   node scripts/seed-player-sheets.js            # simulation (liste ce qui serait cree)
 *   node scripts/seed-player-sheets.js --apply    # cree + remplit
 *   node scripts/seed-player-sheets.js --apply --team=GSW
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const rosters = require('./data/nba-rosters-2026-27.json')

const APPLY = process.argv.includes('--apply')
const INCLUDE_DONE = process.argv.includes('--include-done')
const ONLY = (process.argv.find(a => a.startsWith('--team=')) || '').split('=')[1]
const BASE = process.env.SEED_API_BASE || 'https://www.memorabilius.fr'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Nom compare sans accents / ponctuation / suffixe generationnel (Jr., II, III...).
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/ (jr|sr|ii|iii|iv)$/, '').replace(/ /g, '')

async function main() {
  const { data: existing, error } = await admin.from('player_sheets').select('id, user_id, team_abbr, player_name, sort_order').limit(5000)
  if (error) throw error

  // Proprietaire des nouvelles fiches : l'admin qui possede deja le plus de fiches.
  const counts = {}
  for (const s of existing) counts[s.user_id] = (counts[s.user_id] || 0) + 1
  let ownerId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!ownerId) {
    const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true).limit(1)
    ownerId = admins?.[0]?.id
  }
  if (!ownerId) throw new Error('aucun admin trouve')

  const toCreate = []
  for (const [abbr, names] of Object.entries(rosters)) {
    if (abbr.startsWith('_') || (ONLY && abbr !== ONLY)) continue
    const have = existing.filter(s => s.team_abbr === abbr)
    // Equipe deja commencee/faite : on n'y touche pas (des joueurs ont pu etre
    // ecartes volontairement). --include-done pour completer aussi ces equipes.
    if (have.length > 0 && !INCLUDE_DONE) { console.log(`${abbr}: ${have.length} fiches existantes -> ignoree (equipe deja faite)`); continue }
    const haveKeys = new Set(have.map(s => norm(s.player_name)))
    let order = have.reduce((m, s) => Math.max(m, s.sort_order ?? 0), have.length ? 0 : -1) + 1
    const missing = names.filter(n => !haveKeys.has(norm(n)))
    console.log(`${abbr}: ${have.length} fiches existantes, ${names.length} sous contrat -> ${missing.length} a creer${missing.length ? ' : ' + missing.join(', ') : ''}`)
    for (const n of missing) toCreate.push({ user_id: ownerId, team_abbr: abbr, player_name: n, sort_order: order++ })
  }
  console.log(`\nTotal a creer : ${toCreate.length}`)
  if (!APPLY) { console.log('(simulation -- relance avec --apply)'); return }
  if (!toCreate.length) return

  // 1. Insertion
  const created = []
  for (let i = 0; i < toCreate.length; i += 100) {
    const { data, error: e } = await admin.from('player_sheets').insert(toCreate.slice(i, i + 100)).select('id, player_name, team_abbr')
    if (e) throw e
    created.push(...data)
  }
  console.log(`Fiches creees : ${created.length}`)

  // 2. Remplissage via l'API deployee. Il faut un jeton admin : compte temporaire
  //    (supprime a la fin). Les fiches appartiennent a ownerId, pas a ce compte.
  const email = `seed-tmp-${Date.now()}@example.invalid`
  const password = 'Tmp-' + Math.random().toString(36).slice(2) + 'Aa1!'
  const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (ce) throw ce
  const tmpId = cu.user.id
  try {
    const up = await admin.from('profiles').update({ is_admin: true }).eq('id', tmpId).select('id')
    if (!up.data?.length) await admin.from('profiles').insert({ id: tmpId, is_admin: true })
    const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: sess, error: se } = await anon.auth.signInWithPassword({ email, password })
    if (se) throw se
    let token = sess.session.access_token

    const failed = []
    let done = 0
    const queue = [...created]
    const worker = async () => {
      while (queue.length) {
        const s = queue.shift()
        let ok = false
        for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
          try {
            const res = await fetch(`${BASE}/api/admin/player-sheets-fill`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetId: s.id }), signal: AbortSignal.timeout(60000),
            })
            if (res.ok) ok = true
            else if (res.status === 404) break            // introuvable sur ESPN : inutile de reessayer
            else await sleep(1500 * attempt)
          } catch { await sleep(1500 * attempt) }
        }
        done++
        if (!ok) failed.push(`${s.team_abbr} ${s.player_name}`)
        if (done % 20 === 0) console.log(`  remplies ${done}/${created.length}`)
      }
    }
    await Promise.all([worker(), worker(), worker()])
    console.log(`\nRemplissage termine : ${created.length - failed.length}/${created.length} OK`)
    if (failed.length) console.log('Non remplies (introuvables sur ESPN ou erreur) :\n  ' + failed.join('\n  '))
  } finally {
    await admin.auth.admin.deleteUser(tmpId)
    console.log('Compte temporaire supprime.')
  }
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1) })
