#!/usr/bin/env node
/**
 * Backfill ponctuel (une seule fois) de death_date pour TOUTES les lignes deja
 * presentes dans sports_birthdays (tous sports confondus), via Wikidata (P570
 * "date de deces"). Le bot anniversaire Discord (src/lib/discordBirthday.ts)
 * s'en sert pour distinguer "c'est l'anniversaire de X" de "X aurait eu Y ans
 * aujourd'hui" pour un joueur decede -- sans cette colonne remplie, tout le
 * monde est traite comme vivant.
 *
 * Necessite d'avoir d'abord execute scripts/sql-birthdays-death-date.sql
 * (ajoute la colonne death_date) dans le Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/backfill-death-dates.js --dry-run
 *   node scripts/backfill-death-dates.js --sport=nba --limit=20
 *   node scripts/backfill-death-dates.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const nodeFetch = require('node-fetch')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: nodeFetch } })

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const SPORT = args.sport || null
const LIMIT = args.limit ? parseInt(args.limit) : null
const DRY_RUN = !!args['dry-run']

const UA = 'Memorabilius/1.0 (https://www.memorabilius.fr; contact@memorabilius.fr)'
const sleep = ms => new Promise(r => setTimeout(r, ms))

function parseWikidataTime(time) {
  if (!time) return null
  const m = /^\+(\d{4})-(\d{2})-(\d{2})/.exec(time)
  if (!m || m[2] === '00' || m[3] === '00') return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

async function resolveWikipediaCanonicalName(name) {
  try {
    const title = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
    const r = await nodeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, { headers: { 'User-Agent': UA }, timeout: 8000 })
    if (r.ok) {
      const data = await r.json()
      if (data.title && data.type !== 'disambiguation') return data.title
    }
    const q = encodeURIComponent(`${name} athlete`)
    const r2 = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3`, { headers: { 'User-Agent': UA }, timeout: 8000 })
    if (!r2.ok) return null
    const data2 = await r2.json()
    return data2.query?.search?.[0]?.title || null
  } catch { return null }
}

async function fetchWikidataDeathDate(name) {
  try {
    const title = encodeURIComponent(name.trim())
    const r = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageprops&ppprop=wikibase_item&format=json`, { headers: { 'User-Agent': UA }, timeout: 8000 })
    if (!r.ok) return null
    const data = await r.json()
    const page = Object.values(data.query?.pages || {})[0]
    const qid = page?.pageprops?.wikibase_item
    if (!qid) return null
    const r2 = await nodeFetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, { headers: { 'User-Agent': UA }, timeout: 8000 })
    if (!r2.ok) return null
    const wd = await r2.json()
    return parseWikidataTime(wd.entities?.[qid]?.claims?.P570?.[0]?.mainsnak?.datavalue?.value?.time)
  } catch { return null }
}

async function main() {
  let q = supabase.from('sports_birthdays').select('id, player_name, sport').is('death_date', null)
  if (SPORT) q = q.eq('sport', SPORT)
  const { data: rows, error } = await q
  if (error) { console.error('Erreur lecture:', error.message); process.exit(1) }

  let players = rows || []
  if (LIMIT) players = players.slice(0, LIMIT)
  console.log(`${players.length} joueur(s) sans death_date a verifier${SPORT ? ` (sport=${SPORT})` : ''}.`)

  let found = 0
  for (const [i, p] of players.entries()) {
    process.stdout.write(`[${i + 1}/${players.length}] ${p.player_name} (${p.sport})... `)
    let deathDate = await fetchWikidataDeathDate(p.player_name)
    if (!deathDate) {
      const canonical = await resolveWikipediaCanonicalName(p.player_name)
      if (canonical && canonical !== p.player_name) deathDate = await fetchWikidataDeathDate(canonical)
    }
    if (deathDate) {
      found++
      console.log(`DECEDE (${deathDate})`)
      if (!DRY_RUN) {
        const { error: upErr } = await supabase.from('sports_birthdays').update({ death_date: deathDate }).eq('id', p.id)
        if (upErr) console.log(`   -> erreur DB: ${upErr.message}`)
      }
    } else {
      console.log('vivant/non trouve')
    }
    await sleep(600) // courtoisie Wikipedia/Wikidata
  }

  console.log(`\nTermine. ${found} joueur(s) decede(s) trouve(s) sur ${players.length}.${DRY_RUN ? ' (dry-run, rien ecrit)' : ''}`)
}

main()
