#!/usr/bin/env node
/**
 * Import Pokémon TCG via l'API officielle pokemontcg.io
 * Docs : https://docs.pokemontcg.io
 *
 * Usage:
 *   node scripts/import-pokemon-tcg.js              # Tous les sets
 *   node scripts/import-pokemon-tcg.js --from=2020  # À partir de 2020
 *   node scripts/import-pokemon-tcg.js --set=base1  # Un set précis par ID
 *   node scripts/import-pokemon-tcg.js --dry-run
 *
 * API key optionnelle (augmente la limite de requêtes) :
 *   POKEMON_TCG_API_KEY=xxxx dans .env.local
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const axios = require('axios')
const fs    = require('fs')
const path  = require('path')

const BASE_SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1'
const KEY_SUPA  = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_KEY   = process.env.POKEMON_TCG_API_KEY || ''
const CHECKPOINT = path.join(__dirname, 'checkpoint-all-pokemon.json')

if (!BASE_SUPA || BASE_SUPA === '/rest/v1' || !KEY_SUPA) {
  console.error('❌ Variables Supabase manquantes'); process.exit(1)
}

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const FROM_YEAR = args.from ? parseInt(args.from) : null
const ONLY_SET  = args.set  || null
const DRY_RUN   = !!args['dry-run']

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function retry(fn, n = 4, d = 2000) {
  for (let i = 0; i < n; i++) {
    try { return await fn() } catch (e) {
      if (i === n - 1) throw e
      console.log(`  ⚠️  Retry ${i+1}: ${e.message}`); await sleep(d)
    }
  }
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const supa = axios.create()
const supaHeaders = {
  apikey: KEY_SUPA,
  Authorization: 'Bearer ' + KEY_SUPA,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

// ID synthétique déterministe pour éviter collision avec les TCDB IDs (< 500000)
function syntheticId(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (Math.abs(h) % 4000000) + 1000000  // range 1_000_000 – 5_000_000
}

async function upsertSet(tcdbId, name, year, brand, totalCards) {
  const { data } = await supa.post(
    `${BASE_SUPA}/card_sets?on_conflict=tcdb_id&select=id`,
    { tcdb_id: tcdbId, name, year, brand, sport: 'pokemon', total_cards: totalCards },
    { headers: { ...supaHeaders, Prefer: 'resolution=merge-duplicates,return=representation' } }
  )
  return Array.isArray(data) ? data[0] : data
}

async function deleteEntries(setId) {
  await supa.delete(`${BASE_SUPA}/card_set_entries?set_id=eq.${setId}`, { headers: supaHeaders })
}

async function insertBatch(batch) {
  await supa.post(`${BASE_SUPA}/card_set_entries`, batch, {
    headers: { ...supaHeaders, Prefer: 'return=minimal' }
  })
}

// ── Pokemon TCG API ───────────────────────────────────────────────────────────

const ptcgHeaders = API_KEY ? { 'X-Api-Key': API_KEY } : {}

async function fetchAllSets() {
  const { data } = await axios.get('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250', { headers: ptcgHeaders })
  return data.data || []
}

async function fetchCardsForSet(setId) {
  const cards = []
  let page = 1
  while (true) {
    const { data } = await axios.get(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250&page=${page}`,
      { headers: ptcgHeaders }
    )
    cards.push(...(data.data || []))
    if (cards.length >= data.totalCount) break
    page++
    await sleep(300)
  }
  return cards
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) }
  catch { return { doneSetIds: [] } }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cp = loadCheckpoint()
  console.log(`🎴 Import Pokémon TCG\n   API key: ${API_KEY ? '✓ configurée' : '⚠️  absente (rate-limit 1000/h)'}`)
  console.log(`   Checkpoint: ${cp.doneSetIds.length} sets déjà importés\n`)

  console.log('📋 Récupération de la liste des sets...')
  let allSets = await fetchAllSets()
  console.log(`   ${allSets.length} sets trouvés`)

  // Filtres
  if (ONLY_SET) {
    allSets = allSets.filter(s => s.id === ONLY_SET)
    if (!allSets.length) { console.error(`❌ Set "${ONLY_SET}" introuvable`); process.exit(1) }
  }
  if (FROM_YEAR) {
    allSets = allSets.filter(s => {
      const y = parseInt(s.releaseDate?.slice(0, 4) || '0')
      return y >= FROM_YEAR
    })
    console.log(`   → ${allSets.length} sets après filtre depuis ${FROM_YEAR}`)
  }

  const remaining = allSets.filter(s => !cp.doneSetIds.includes(s.id))
  console.log(`   ${remaining.length} sets à importer\n`)

  let ok = 0, err = 0
  for (let i = 0; i < remaining.length; i++) {
    const set = remaining[i]
    const year = parseInt(set.releaseDate?.slice(0, 4) || '0') || null
    const tcdbId = syntheticId(`pokemon:${set.id}`)
    console.log(`\n[${i+1}/${remaining.length}] ${set.name} (${set.id}) — ${year || '?'}`)

    if (DRY_RUN) { console.log(`  [DRY-RUN] ${set.total} cartes`); ok++; continue }

    try {
      // Récupérer les cartes
      process.stdout.write(`  Récupération des cartes... `)
      const cards = await retry(() => fetchCardsForSet(set.id))
      console.log(`${cards.length} cartes`)
      await sleep(200)

      // Upsert set
      const setData = await retry(() => upsertSet(tcdbId, set.name, year, 'Pokémon TCG', cards.length))
      await retry(() => deleteEntries(setData.id))

      // Insérer les cartes
      const entries = cards.map(c => ({
        set_id: setData.id,
        card_number: c.number || '',
        player_name: c.name || '',
        team: null,
        variation: c.subtypes?.join(', ') || null,
        is_rc: false,
        is_auto: c.subtypes?.includes('Autograph') || false,
      }))

      for (let j = 0; j < entries.length; j += 500) {
        await retry(() => insertBatch(entries.slice(j, j + 500)))
        process.stdout.write(`\r  ${Math.min(j + 500, entries.length)}/${entries.length} cartes insérées...`)
      }
      console.log(`\r  ✅ ${entries.length} cartes insérées (id: ${setData.id})`)

      cp.doneSetIds.push(set.id)
      saveCheckpoint(cp)
      ok++
    } catch (e) {
      console.log(`  ❌ ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`)
      err++
    }

    // Respect du rate limit (100ms entre sets avec API key, 500ms sans)
    await sleep(API_KEY ? 100 : 500)
  }

  console.log(`\n🏁 Terminé : ${ok} sets importés, ${err} erreurs`)
  console.log(`   Total Pokémon en DB: ${cp.doneSetIds.length} sets`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
