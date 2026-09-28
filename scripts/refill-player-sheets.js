#!/usr/bin/env node
/**
 * Relance le remplissage automatique (/api/admin/player-sheets-fill) sur les
 * fiches recemment creees : pays manquants, nouvelle description de profil,
 * fiches restees vides. Ne remplace que les champs vides et l'ancienne
 * description automatique -- jamais un texte ecrit a la main.
 *
 * Usage:
 *   node scripts/refill-player-sheets.js                 # fiches creees ces 3 derniers jours
 *   node scripts/refill-player-sheets.js --days=30
 *   node scripts/refill-player-sheets.js --team=LAL
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DAYS = parseInt((process.argv.find(a => a.startsWith('--days=')) || '--days=3').split('=')[1], 10)
const ONLY = (process.argv.find(a => a.startsWith('--team=')) || '').split('=')[1]
const BASE = process.env.SEED_API_BASE || 'https://www.memorabilius.fr'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const since = new Date(Date.now() - DAYS * 86400000).toISOString()
  let q = admin.from('player_sheets').select('id, team_abbr, player_name').gte('created_at', since).order('team_abbr').limit(5000)
  if (ONLY) q = q.eq('team_abbr', ONLY)
  const { data: sheets, error } = await q
  if (error) throw error
  console.log(`${sheets.length} fiches a traiter (creees depuis ${DAYS} j)`)
  if (!sheets.length) return

  const email = `refill-tmp-${Date.now()}@example.invalid`
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
    const token = sess.session.access_token

    const failed = []
    let done = 0
    const queue = [...sheets]
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
            else if (res.status === 404) break
            else await sleep(1500 * attempt)
          } catch { await sleep(1500 * attempt) }
        }
        done++
        if (!ok) failed.push(`${s.team_abbr} ${s.player_name}`)
        if (done % 20 === 0) console.log(`  traitees ${done}/${sheets.length}`)
      }
    }
    await Promise.all([worker(), worker(), worker()])
    console.log(`\nTermine : ${sheets.length - failed.length}/${sheets.length} OK`)
    if (failed.length) console.log('Echecs :\n  ' + failed.join('\n  '))
  } finally {
    await admin.auth.admin.deleteUser(tmpId)
    console.log('Compte temporaire supprime.')
  }
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1) })
