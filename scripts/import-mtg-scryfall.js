#!/usr/bin/env node
/**
 * Import Magic: The Gathering via l'API Scryfall
 * Docs : https://scryfall.com/docs/api
 *
 * Usage:
 *   node scripts/import-mtg-scryfall.js              # Tous les sets
 *   node scripts/import-mtg-scryfall.js --from=2020  # À partir de 2020
 *   node scripts/import-mtg-scryfall.js --set=dsk    # Un set précis par code
 *   node scripts/import-mtg-scryfall.js --type=expansion  # Filtrer par type
 *   node scripts/import-mtg-scryfall.js --dry-run
 *
 * Types de sets Scryfall disponibles :
 *   expansion, core, masters, draft_innovation, commander,
 *   starter, box, funny, memorabilia, promo, token
 *   Par défaut : expansion + core + masters (sets jouables principaux)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const axios = require('axios')
const fs    = require('fs')
const path  = require('path')

const BASE_SUPA  = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1'
const KEY_SUPA   = process.env.SUPABASE_SERVICE_ROLE_KEY
const CHECKPOINT = path.join(__dirname, 'checkpoint-all-mtg.json')

if (!BASE_SUPA || BASE_SUPA === '/rest/v1' || !KEY_SUPA) {
  console.error('❌ Variables Supabase manquantes'); process.exit(1)
}

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const FROM_YEAR  = args.from ? parseInt(args.from) : null
const ONLY_SET   = args.set  || null
const FILTER_TYPE = args.type || null
const DRY_RUN    = !!args['dry-run']

// Types de sets à importer par défaut (les "vrais" sets jouables)
const DEFAULT_TYPES = new Set(['expansion', 'core', 'masters', 'draft_innovation', 'commander', 'starter'])

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

function syntheticId(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i)
  return (Math.abs(h) % 4000000) + 5000000  // range 5_000_000 – 9_000_000 (distinct de Pokemon)
}

async function upsertSet(tcdbId, name, year, brand, totalCards) {
  const { data } = await supa.post(
    `${BASE_SUPA}/card_sets?on_conflict=tcdb_id&select=id`,
    { tcdb_id: tcdbId, name, year, brand, sport: 'mtg', total_cards: totalCards },
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

// ── Scryfall API ──────────────────────────────────────────────────────────────
// Rate limit : max 10 req/s — on attend 110ms entre chaque appel

async function scryfallGet(url) {
  await sleep(110)  // respect rate limit
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Memorabilius/1.0 (contact: kikibajkiki@gmail.com)' }
  })
  return data
}

async function fetchAllSets() {
  const data = await scryfallGet('https://api.scryfall.com/sets')
  return data.data || []
}

async function fetchCardsForSet(setCode) {
  const cards = []
  let url = `https://api.scryfall.com/cards/search?q=set:${setCode}&order=collector_number&unique=prints`
  while (url) {
    const data = await scryfallGet(url)
    cards.push(...(data.data || []))
    url = data.has_more ? data.next_page : null
  }
  return cards
}

// ── Checkpoint ────────────────────────────────────────────────────────────────

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) }
  catch { return { doneSetCodes: [] } }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cp = loadCheckpoint()
  console.log(`🧙 Import MTG via Scryfall`)
  console.log(`   Checkpoint: ${cp.doneSetCodes.length} sets déjà importés\n`)

  console.log('📋 Récupération de la liste des sets Scryfall...')
  let allSets = await fetchAllSets()
  console.log(`   ${allSets.length} sets trouvés au total`)

  // Filtres
  if (ONLY_SET) {
    allSets = allSets.filter(s => s.code === ONLY_SET)
    if (!allSets.length) { console.error(`❌ Set "${ONLY_SET}" introuvable`); process.exit(1) }
  } else {
    // Filtrer par type (expansion, core, masters, etc.)
    const allowedTypes = FILTER_TYPE ? new Set([FILTER_TYPE]) : DEFAULT_TYPES
    allSets = allSets.filter(s => allowedTypes.has(s.set_type))
    console.log(`   → ${allSets.length} sets après filtre de type (${[...allowedTypes].join(', ')})`)
  }

  if (FROM_YEAR) {
    allSets = allSets.filter(s => {
      const y = parseInt(s.released_at?.slice(0, 4) || '0')
      return y >= FROM_YEAR
    })
    console.log(`   → ${allSets.length} sets après filtre depuis ${FROM_YEAR}`)
  }

  // Trier du plus récent au plus ancien
  allSets.sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''))

  const remaining = allSets.filter(s => !cp.doneSetCodes.includes(s.code))
  console.log(`   ${remaining.length} sets à importer\n`)

  let ok = 0, err = 0
  for (let i = 0; i < remaining.length; i++) {
    const set = remaining[i]
    const year = parseInt(set.released_at?.slice(0, 4) || '0') || null
    const tcdbId = syntheticId(`mtg:${set.code}`)
    console.log(`\n[${i+1}/${remaining.length}] ${set.name} (${set.code}) — ${year || '?'} — ${set.set_type}`)

    if (DRY_RUN) { console.log(`  [DRY-RUN] ~${set.card_count} cartes`); ok++; continue }

    try {
      // Récupérer les cartes
      process.stdout.write(`  Récupération des cartes... `)
      const cards = await retry(() => fetchCardsForSet(set.code))
      console.log(`${cards.length} cartes`)

      if (!cards.length) { console.log(`  ⚠️  0 cartes — ignoré`); continue }

      // Upsert set
      const setData = await retry(() => upsertSet(tcdbId, set.name, year, 'Wizards of the Coast', cards.length))
      await retry(() => deleteEntries(setData.id))

      // Insérer les cartes
      const entries = cards.map(c => ({
        set_id: setData.id,
        card_number: c.collector_number || '',
        player_name: c.name || '',
        team: c.type_line || null,      // "type_line" = "Creature — Dragon", utile pour filtrer
        variation: c.rarity || null,    // common, uncommon, rare, mythic
        is_rc: false,
        is_auto: c.frame_effects?.includes('foil') || false,
      }))

      for (let j = 0; j < entries.length; j += 500) {
        await retry(() => insertBatch(entries.slice(j, j + 500)))
        process.stdout.write(`\r  ${Math.min(j + 500, entries.length)}/${entries.length} cartes insérées...`)
      }
      console.log(`\r  ✅ ${entries.length} cartes insérées (id: ${setData.id})`)

      cp.doneSetCodes.push(set.code)
      saveCheckpoint(cp)
      ok++
    } catch (e) {
      console.log(`  ❌ ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`)
      err++
    }
  }

  console.log(`\n🏁 Terminé : ${ok} sets importés, ${err} erreurs`)
  console.log(`   Total MTG en DB: ${cp.doneSetCodes.length} sets`)
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
