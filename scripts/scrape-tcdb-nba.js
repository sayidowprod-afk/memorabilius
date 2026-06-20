#!/usr/bin/env node
/**
 * Scraper TCDB NBA → Supabase
 * Usage: node scripts/scrape-tcdb-nba.js
 * Options:
 *   --year=2024        scraper seulement cette année
 *   --limit=50         limiter à N sets (test)
 *   --start-page=3     reprendre à la page N de la liste
 */

const cheerio = require('cheerio')
const { createClient } = require('@supabase/supabase-js')

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DELAY_MS = 1200 // 1.2s entre chaque requête
const TCDB_BASE = 'https://www.tcdb.com'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  console.error('   Lancez avec: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/scrape-tcdb-nba.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Parse args
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const [k, v] = a.replace('--', '').split('=')
  return [k, v]
}))

const FILTER_YEAR = args.year ? parseInt(args.year) : null
const LIMIT_SETS = args.limit ? parseInt(args.limit) : null
const START_PAGE = args['start-page'] ? parseInt(args['start-page']) : 1

// ─── Helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`)
  return res.text()
}

// ─── Step 1: Liste des sets NBA ─────────────────────────────────────────────
async function fetchSetList() {
  console.log('📋 Récupération de la liste des sets NBA...')
  const sets = []
  let page = START_PAGE
  let hasMore = true

  while (hasMore) {
    const url = `${TCDB_BASE}/ViewSets.cfm?sport=Basketball&page=${page}`
    console.log(`  Page ${page}: ${url}`)

    let html
    try {
      html = await fetchHtml(url)
    } catch (e) {
      console.error(`  ❌ Erreur page ${page}: ${e.message}`)
      break
    }

    const $ = cheerio.load(html)

    // TCDB affiche les sets dans un tableau avec des liens /ViewSet.cfm/sid/XXXX
    const rows = $('table.set-list tr, table tr').filter((i, el) => {
      return $(el).find('a[href*="ViewSet.cfm"]').length > 0
    })

    if (rows.length === 0) {
      // Essayer un sélecteur alternatif
      const links = $('a[href*="ViewSet.cfm/sid/"]')
      if (links.length === 0) {
        console.log(`  ✓ Plus de sets trouvés à la page ${page}`)
        hasMore = false
        break
      }

      links.each((i, el) => {
        const href = $(el).attr('href')
        const tcdbId = href?.match(/sid\/(\d+)/)?.[1]
        const name = $(el).text().trim()
        if (!tcdbId || !name) return

        // Extraire l'année depuis le texte de la ligne parente
        const rowText = $(el).closest('tr').text()
        const yearMatch = rowText.match(/\b(19[5-9]\d|20\d{2})\b/)
        const year = yearMatch ? parseInt(yearMatch[1]) : null

        if (FILTER_YEAR && year !== FILTER_YEAR) return

        sets.push({ tcdb_id: parseInt(tcdbId), name, year, sport: 'nba' })
      })
    } else {
      rows.each((i, el) => {
        const link = $(el).find('a[href*="ViewSet.cfm"]').first()
        const href = link.attr('href')
        const tcdbId = href?.match(/sid\/(\d+)/)?.[1]
        const name = link.text().trim()
        if (!tcdbId || !name) return

        const rowText = $(el).text()
        const yearMatch = rowText.match(/\b(19[5-9]\d|20\d{2})\b/)
        const year = yearMatch ? parseInt(yearMatch[1]) : null

        if (FILTER_YEAR && year !== FILTER_YEAR) return

        sets.push({ tcdb_id: parseInt(tcdbId), name, year, sport: 'nba' })
      })
    }

    // Vérifier s'il y a une page suivante
    const nextLink = $('a').filter((i, el) => {
      const text = $(el).text().trim().toLowerCase()
      return text === 'next' || text === 'suivant' || text === '>'
    })
    hasMore = nextLink.length > 0

    if (sets.length > 0) {
      console.log(`  ✓ ${sets.length} sets trouvés jusqu'ici`)
    }

    if (LIMIT_SETS && sets.length >= LIMIT_SETS) {
      console.log(`  ⚠️  Limite de ${LIMIT_SETS} sets atteinte`)
      hasMore = false
    }

    page++
    await sleep(DELAY_MS)
  }

  return LIMIT_SETS ? sets.slice(0, LIMIT_SETS) : sets
}

// ─── Step 2: Checklist d'un set ─────────────────────────────────────────────
async function fetchSetCards(tcdbId) {
  const url = `${TCDB_BASE}/ViewSet.cfm/sid/${tcdbId}`
  const html = await fetchHtml(url)
  const $ = cheerio.load(html)

  const cards = []

  // Les cartes sont généralement dans un tableau avec des colonnes: #, Joueur, Équipe, Type
  $('table tr').each((i, el) => {
    const cells = $(el).find('td')
    if (cells.length < 2) return

    const firstCell = $(cells[0]).text().trim()
    const secondCell = $(cells[1]).text().trim()

    // La première colonne est généralement le numéro de carte (peut être vide, numérique, ou "SP")
    // La deuxième est le nom du joueur
    if (!secondCell || secondCell.length < 2) return

    // Filtrer les lignes d'en-tête
    if (secondCell.toLowerCase() === 'player' || secondCell.toLowerCase() === 'card') return

    const cardNum = firstCell || ''
    const playerName = secondCell
    const team = cells.length > 2 ? $(cells[2]).text().trim() : ''
    const variation = cells.length > 3 ? $(cells[3]).text().trim() : ''

    // Détecter RC basé sur du texte ou symboles
    const rowText = $(el).text()
    const isRc = rowText.includes('RC') || rowText.includes('Rookie') || rowText.includes('(R)')

    cards.push({
      card_number: cardNum,
      player_name: playerName,
      team: team || null,
      variation: variation || null,
      is_rc: isRc,
    })
  })

  // Extraire aussi le nom du set et la marque depuis la page
  const setTitle = $('h1, .set-title, .page-title').first().text().trim()
  const brandMatch = setTitle.match(/^(Panini|Topps|Upper Deck|Fleer|Donruss|Score|Bowman|Stadium Club|SkyBox|Hoops|NBA Hoops)/i)
  const brand = brandMatch ? brandMatch[1] : null
  const totalCards = cards.length

  return { cards, brand, totalCards, setTitle }
}

// ─── Step 3: Insertion Supabase ──────────────────────────────────────────────
async function upsertSet(setMeta) {
  const { data, error } = await supabase
    .from('card_sets')
    .upsert({
      tcdb_id: setMeta.tcdb_id,
      name: setMeta.name,
      year: setMeta.year,
      brand: setMeta.brand || null,
      sport: 'nba',
      total_cards: setMeta.totalCards,
    }, { onConflict: 'tcdb_id' })
    .select('id')
    .single()

  if (error) throw new Error(`Upsert set ${setMeta.tcdb_id}: ${error.message}`)
  return data.id
}

async function insertCards(setId, cards) {
  if (cards.length === 0) return

  // Insérer par batch de 500
  const BATCH = 500
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH).map(c => ({
      set_id: setId,
      card_number: c.card_number || null,
      player_name: c.player_name,
      team: c.team || null,
      variation: c.variation || null,
      is_rc: c.is_rc || false,
    }))

    const { error } = await supabase.from('card_set_entries').insert(batch)
    if (error) throw new Error(`Insert cards set ${setId}: ${error.message}`)
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏀 Scraper TCDB NBA → Supabase')
  console.log(`   Délai: ${DELAY_MS}ms entre requêtes`)
  if (FILTER_YEAR) console.log(`   Filtre année: ${FILTER_YEAR}`)
  if (LIMIT_SETS) console.log(`   Limite: ${LIMIT_SETS} sets`)
  console.log()

  // 1. Récupérer la liste des sets
  const sets = await fetchSetList()
  console.log(`\n✅ ${sets.length} sets NBA trouvés\n`)

  if (sets.length === 0) {
    console.log('❌ Aucun set trouvé. Vérifiez les sélecteurs CSS ou la connexion à TCDB.')
    return
  }

  // 2. Pour chaque set, récupérer la checklist
  let ok = 0
  let errors = 0

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i]
    const progress = `[${i + 1}/${sets.length}]`

    try {
      process.stdout.write(`${progress} ${set.name} (tcdb:${set.tcdb_id})... `)

      const { cards, brand, totalCards } = await fetchSetCards(set.tcdb_id)

      if (cards.length === 0) {
        console.log(`⚠️  0 cartes trouvées, skip`)
        errors++
        await sleep(DELAY_MS)
        continue
      }

      // Upsert set
      const setId = await upsertSet({ ...set, brand, totalCards })

      // Supprimer les anciennes cartes si ré-import
      await supabase.from('card_set_entries').delete().eq('set_id', setId)

      // Insérer les cartes
      await insertCards(setId, cards)

      console.log(`✅ ${cards.length} cartes${brand ? ' · ' + brand : ''}`)
      ok++
    } catch (e) {
      console.log(`❌ ${e.message}`)
      errors++
    }

    await sleep(DELAY_MS)
  }

  console.log(`\n🏁 Terminé: ${ok} sets importés, ${errors} erreurs`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
