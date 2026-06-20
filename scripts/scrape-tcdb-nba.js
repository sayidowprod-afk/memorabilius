#!/usr/bin/env node
/**
 * Scraper TCDB NBA → Supabase
 * Pour chaque set : parcourt les 30 équipes via ViewTeamsIns (base + tous les inserts)
 *
 * Usage:
 *   node scripts/scrape-tcdb-nba.js --year=2024 --major-only
 *   node scripts/scrape-tcdb-nba.js --year=2020 --year-end=2024 --major-only
 *   node scripts/scrape-tcdb-nba.js --year=2024 --major-only --limit=2
 */

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TCDB = 'https://www.tcdb.com'
const DELAY = 1200

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const YEAR_START = args.year ? parseInt(args.year) : 2024
const YEAR_END = args['year-end'] ? parseInt(args['year-end']) : YEAR_START
const MAJOR_ONLY = !!args['major-only']
const LIMIT = args.limit ? parseInt(args.limit) : null

const sleep = ms => new Promise(r => setTimeout(r, ms))

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

async function waitCloudflare(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 15; i++) {
    const title = await page.title()
    if (!title.includes('instant') && !title.includes('moment')) break
    await sleep(2000)
  }
}

// ─── 1. Liste des sets pour une année ─────────────────────────────────────
async function fetchSetsForYear(page, year) {
  await waitCloudflare(page, `${TCDB}/ViewAll.cfm/sp/Basketball/year/${year}`)
  await sleep(800)

  return await page.evaluate((tcdb, majorOnly) => {
    const results = []
    const seen = new Set()

    if (majorOnly) {
      // Trouver la section "Major Releases"
      let inMajor = false
      for (const el of document.querySelectorAll('*')) {
        const text = el.textContent?.trim() || ''
        if (el.children.length > 0) continue // ignorer les éléments parents
        if (/^major releases?$/i.test(text)) { inMajor = true; continue }
        if (inMajor && /^(WNBA|College|European|Japanese|Minor|National Basketball League|Oddball|On-Demand|Promo)$/i.test(text)) break
      }

      // Fallback: chercher via anchor #Major
      const majorAnchor = document.querySelector('a[href*="Major"], [id*="Major"]')
      const container = majorAnchor?.closest('div, section, ul') ||
        Array.from(document.querySelectorAll('h2, h3, h4, strong, b')).find(el =>
          /major releases?/i.test(el.textContent)
        )?.nextElementSibling

      if (container) {
        container.querySelectorAll('a[href*="ViewSet"], a[href*="/sid/"]').forEach(a => {
          const href = a.getAttribute('href') || ''
          const sidMatch = href.match(/sid\/(\d+)/)
          if (!sidMatch || seen.has(sidMatch[1])) return
          seen.add(sidMatch[1])
          results.push({ tcdb_id: parseInt(sidMatch[1]), name: a.textContent.trim(), href: tcdb + href })
        })
      }
    }

    // Si toujours vide, prendre tous les sets (ou si pas major-only)
    if (results.length === 0) {
      document.querySelectorAll('a[href*="ViewSet"], a[href*="/sid/"]').forEach(a => {
        const href = a.getAttribute('href') || ''
        const sidMatch = href.match(/sid\/(\d+)/)
        if (!sidMatch || seen.has(sidMatch[1])) return
        const name = a.textContent?.trim()
        if (!name || name.length < 3) return
        // Si major-only, filtrer par marque connue
        if (majorOnly) {
          const isMajor = /(Panini|Topps|Upper Deck|Fleer|Donruss|Hoops|Score|Bowman|Finest)/i.test(name)
          if (!isMajor) return
        }
        seen.add(sidMatch[1])
        results.push({ tcdb_id: parseInt(sidMatch[1]), name, href: tcdb + href })
      })
    }

    return results
  }, TCDB, MAJOR_ONLY)
}

// ─── 2. Liste des équipes d'un set ─────────────────────────────────────────
async function fetchTeamLinks(page, sid, setSlug) {
  const url = `${TCDB}/ViewTeams.cfm/sid/${sid}/${setSlug}`
  await waitCloudflare(page, url)
  await sleep(600)

  return await page.evaluate((tcdb) => {
    const links = []
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m) return
      links.push({
        teamId: m[1],
        teamName: decodeURIComponent(m[2].replace(/%20/g, ' ')),
        href: href.startsWith('http') ? href : tcdb + href,
      })
    })
    return links
  }, TCDB)
}

// ─── 3. Cartes d'une équipe (base + inserts) ───────────────────────────────
async function fetchTeamCards(page, sid, teamId, teamName) {
  const encodedTeam = encodeURIComponent(teamName)
  const url = `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${encodedTeam}`
  await waitCloudflare(page, url)
  await sleep(600)

  return await page.evaluate(() => {
    const cards = []
    let currentVariation = '' // section courante = variation (ex: "Black Wedges", "Gold Press Proof")
    let isBaseSection = true

    // Parcourir tous les éléments du contenu principal
    const content = document.querySelector('#content, main, .container, body')

    const walk = (el) => {
      for (const child of el.children) {
        const tag = child.tagName?.toLowerCase()
        const text = child.textContent?.trim() || ''

        // Détection des sections (headers de sous-sets = variation)
        if (['h2', 'h3', 'h4', 'h5'].includes(tag) || child.classList.contains('set-header')) {
          if (/^base cards?$/i.test(text)) {
            currentVariation = ''
            isBaseSection = true
          } else if (text && text.length < 100 && !text.includes('record') && !text.includes('Cards')) {
            currentVariation = text
            isBaseSection = false
          }
          continue
        }

        // Lignes de table = cartes
        if (tag === 'tr') {
          const cells = child.querySelectorAll('td')
          if (cells.length < 2) continue

          // Trouver le numéro et le nom dans les cellules
          let cardNum = '', playerName = '', team = '', extraFlags = ''

          cells.forEach((cell, i) => {
            const cellText = cell.textContent?.trim() || ''
            // Cellule avec lien = probablement le joueur
            if (cell.querySelector('a') && cellText.length > 2 && i <= 3) {
              // Numéro avant le nom ou dans la cellule précédente
              if (!playerName && cellText.length > 2 && !/^\d+$/.test(cellText)) {
                // Extraire le numéro s'il est en début de cellule
                const numMatch = cellText.match(/^(\d+[a-z]?)\s+(.+)/)
                if (numMatch) {
                  cardNum = numMatch[1]
                  playerName = numMatch[2]
                } else {
                  playerName = cellText
                }
              }
            } else if (/^\d+[a-z]?$/.test(cellText) && i <= 2) {
              cardNum = cellText
            } else if (cellText.includes('Hawks') || cellText.includes('Lakers') || cellText.includes('Heat') ||
                       cellText.includes('Celtics') || cellText.includes('Bulls') || cellText.length < 40 &&
                       /[A-Z]/.test(cellText) && i >= 2 && !team) {
              team = cellText
            }
          })

          // Flags: RC, RR, AU, SN
          const rowText = child.textContent || ''
          const isRc = /\bRC\b|\bRookie Card\b/.test(rowText)
          const isAuto = /\bAU\b|\bAuto\b/i.test(rowText)

          // Extraire SNX (numéro tirage ex: SN1, SN10)
          const snMatch = rowText.match(/\bSN(\d+)\b/)
          const serialNum = snMatch ? `/${snMatch[1]}` : null

          if (!playerName || playerName.length < 2) continue
          // Ignorer les lignes de navigation
          if (/options|checklist|printable|gallery/i.test(playerName)) continue

          cards.push({
            card_number: cardNum || null,
            player_name: playerName,
            team: team || null,
            variation: currentVariation || null,
            serial_number: serialNum,
            is_rc: isRc,
            is_auto: isAuto,
          })
          continue
        }

        // Récursion
        if (child.children?.length > 0) walk(child)
      }
    }

    walk(content || document.body)
    return cards
  })
}

// ─── Supabase ──────────────────────────────────────────────────────────────
async function upsertSet(meta) {
  const { data, error } = await supabase
    .from('card_sets')
    .upsert({
      tcdb_id: meta.tcdb_id,
      name: meta.name,
      year: meta.year,
      brand: meta.brand,
      sport: 'nba',
      total_cards: meta.totalCards,
    }, { onConflict: 'tcdb_id' })
    .select('id').single()
  if (error) throw new Error(`Upsert set: ${error.message}`)
  return data.id
}

async function insertCards(setId, cards) {
  if (!cards.length) return
  // Dédupliquer
  const seen = new Set()
  const unique = cards.filter(c => {
    const k = `${c.card_number}|${c.player_name}|${c.variation}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500).map(c => ({
      set_id: setId,
      card_number: c.card_number,
      player_name: c.player_name,
      team: c.team,
      variation: c.variation,
      is_rc: c.is_rc || false,
    }))
    const { error } = await supabase.from('card_set_entries').insert(batch)
    if (error) throw new Error(`Insert cards: ${error.message}`)
  }
  return unique.length
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('🏀 Scraper TCDB NBA (team-by-team + inserts)')
  console.log(`   Saisons: ${YEAR_START}-${String(YEAR_START+1).slice(2)}${YEAR_END !== YEAR_START ? ' → ' + YEAR_END + '-' + String(YEAR_END+1).slice(2) : ''}`)
  if (MAJOR_ONLY) console.log('   Mode: Major Releases uniquement')
  if (LIMIT) console.log(`   Limite: ${LIMIT} sets`)

  const browser = await puppeteerExtra.launch({
    executablePath: findChrome(),
    headless: false,
    defaultViewport: null,
    args: ['--no-sandbox', '--window-size=1280,900'],
  })
  const page = await browser.newPage()

  try {
    await waitCloudflare(page, TCDB)
    await sleep(2000)
    console.log('✓ Cloudflare passé\n')

    // Collecter les sets
    let allSets = []
    for (let year = YEAR_START; year <= YEAR_END; year++) {
      console.log(`📋 Saison ${year}-${String(year+1).slice(2)}...`)
      const sets = await fetchSetsForYear(page, year)
      console.log(`   ${sets.length} sets trouvés`)
      sets.forEach(s => allSets.push({ ...s, year }))
      await sleep(DELAY)
    }

    if (LIMIT) allSets = allSets.slice(0, LIMIT)
    console.log(`\n✅ ${allSets.length} sets à scraper:`)
    allSets.forEach((s, i) => console.log(`  ${i+1}. ${s.name}`))
    console.log()

    let setsOk = 0, setsErr = 0

    for (let si = 0; si < allSets.length; si++) {
      const set = allSets[si]
      // Extraire le slug du nom pour l'URL
      const slug = set.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
      console.log(`\n[${si+1}/${allSets.length}] ${set.name} (sid:${set.tcdb_id})`)

      try {
        // Récupérer la liste des équipes
        const teamLinks = await fetchTeamLinks(page, set.tcdb_id, slug)
        console.log(`  📂 ${teamLinks.length} équipes trouvées`)

        if (teamLinks.length === 0) {
          console.log('  ⚠️  Aucune équipe, on essaie quand même le scrape direct...')
        }

        // Pour chaque équipe, scraper base + inserts
        const allCards = []
        const teams = teamLinks.length > 0 ? teamLinks : []

        for (let ti = 0; ti < teams.length; ti++) {
          const { teamId, teamName } = teams[ti]
          process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)

          try {
            const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamName)
            allCards.push(...cards)
            console.log(`${cards.length} cartes`)
          } catch (e) {
            console.log(`❌ ${e.message}`)
          }

          await sleep(DELAY)
        }

        if (allCards.length === 0) {
          console.log('  ⚠️  0 cartes au total, set ignoré')
          setsErr++
          continue
        }

        // Détecter la marque
        const brandMatch = set.name.match(/(Panini|Topps|Upper Deck|Fleer|Donruss|Hoops|SkyBox|Score|Bowman)/i)
        const brand = brandMatch ? brandMatch[1] : null

        // Upsert set
        const setId = await upsertSet({ ...set, brand, totalCards: allCards.length })

        // Supprimer anciennes entrées et réinsérer
        await supabase.from('card_set_entries').delete().eq('set_id', setId)
        const inserted = await insertCards(setId, allCards)

        console.log(`  ✅ ${inserted} cartes insérées (${allCards.length} brutes)`)
        setsOk++
      } catch (e) {
        console.log(`  ❌ ${e.message}`)
        setsErr++
      }
    }

    console.log(`\n🏁 Terminé: ${setsOk} sets OK, ${setsErr} erreurs`)
  } finally {
    await browser.close()
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
