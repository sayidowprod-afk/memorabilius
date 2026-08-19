#!/usr/bin/env node
/**
 * Scraper TCDB NBA → Supabase
 * Usage:
 *   node scripts/scrape-tcdb-nba.js --year=2024 --major-only
 *   node scripts/scrape-tcdb-nba.js --year=2024 --major-only --limit=3
 *   node scripts/scrape-tcdb-nba.js --year=2024 --major-only --dry-run
 *   node scripts/scrape-tcdb-nba.js --year=2024 --name="Topps Chrome" --dry-run
 *   node scripts/scrape-tcdb-nba.js --year=2024 --slot=2   (lancer un 2e scraper en parallèle)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
require('dns').setDefaultResultOrder('ipv4first')
const { openBrowser: launchBrowser, killChrome } = require('./browser-helper')
const { createClient } = require('@supabase/supabase-js')
const nodeFetch = require('node-fetch')
const fs = require('fs')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TCDB = 'https://www.tcdb.com'
const DELAY = 2500

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: nodeFetch } })

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const YEAR = args.year ? parseInt(args.year) : 2024
const MAJOR_ONLY = !!args['major-only']
const LIMIT = args.limit ? parseInt(args.limit) : null
const DRY_RUN = !!args['dry-run']
const SKIP_EXISTING = !args['force']
const NAME_FILTER = args.name ? args.name.toLowerCase() : null
const SLOT = args.slot ? parseInt(args.slot) : 1

const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (min, max) => Math.floor(min + Math.random() * (max - min))

async function retry(fn, attempts = 3, delay = 3000) {
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) {
      if (i === attempts - 1) throw e
      console.log(`  ⚠️  Retry ${i + 1}/${attempts - 1}: ${e.message}`)
      await sleep(delay)
    }
  }
}

const NBA_TEAMS = new Set([
  'Atlanta Hawks','Boston Celtics','Brooklyn Nets','Charlotte Hornets','Chicago Bulls',
  'Cleveland Cavaliers','Dallas Mavericks','Denver Nuggets','Detroit Pistons',
  'Golden State Warriors','Houston Rockets','Indiana Pacers','Los Angeles Clippers',
  'Los Angeles Lakers','Memphis Grizzlies','Miami Heat','Milwaukee Bucks',
  'Minnesota Timberwolves','New Orleans Pelicans','New York Knicks',
  'Oklahoma City Thunder','Orlando Magic','Philadelphia 76ers','Phoenix Suns',
  'Portland Trail Blazers','Sacramento Kings','San Antonio Spurs','Toronto Raptors',
  'Utah Jazz','Washington Wizards',
])

const MAJOR_BRANDS = /(Panini|Topps|Upper Deck|Fleer|Donruss|Hoops|SkyBox|Score|Bowman|Finest|Prizm|Select|Mosaic|Chronicles|Revolution|Obsidian|Optic|Immaculate|National Treasures|Contenders|Spectra|Noir|Eminence)/i

let _solverrOk = null
async function solverrGet(url) {
  if (_solverrOk === false) return null
  return new Promise(resolve => {
    const payload = JSON.stringify({ cmd: 'request.get', url, maxTimeout: 60000 })
    const req = require('http').request(
      { hostname: 'localhost', port: 8191, path: '/v1', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
      res => {
        let body = ''
        res.on('data', d => body += d)
        res.on('end', () => {
          _solverrOk = true
          try {
            const d = JSON.parse(body)
            if (d.status === 'ok' && d.solution) return resolve(d.solution)
          } catch {}
          resolve(null)
        })
      }
    )
    req.on('error', () => { _solverrOk = false; resolve(null) })
    req.setTimeout(65000, () => { req.destroy(); resolve(null) })
    req.write(payload); req.end()
  })
}
async function waitCF(page, url) {
  const sol = await solverrGet(url)
  if (sol) {
    for (const c of (sol.cookies || [])) {
      await page.setCookie({ name: c.name, value: c.value, domain: c.domain || '.tcdb.com', path: c.path || '/', expires: typeof c.expiry === 'number' ? c.expiry : -1 }).catch(() => {})
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const t = await page.title().catch(() => '')
    const tl = t.toLowerCase()
    if (!tl.includes('instant') && !tl.includes('moment') && !tl.includes('attention') && !tl.includes('captcha')) return
    console.log(`  ⚠️  Encore bloqué — chargement HTML FlareSolverr (${sol.response?.length || 0} chars)`)
    if (sol.response) { await page.setContent(sol.response, { waitUntil: 'domcontentloaded' }); return }
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 150; i++) {
    const t = await page.title().catch(() => '')
    const tl = t.toLowerCase()
    if (!tl.includes('instant') && !tl.includes('moment') && !tl.includes('attention') && !tl.includes('captcha') && !tl.includes('verify') && !tl.includes('checking')) break
    if (i === 0) console.log('\n⚠️  CAPTCHA dans la fenêtre Chrome — résous-le manuellement (5 min max)...')
    await sleep(2000)
  }
}

async function fetchSets(page, year) {
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Basketball/year/${year}`)
  await sleep(1500)

  return await page.evaluate((majorOnly) => {
    const results = []
    const seen = new Set()

    if (majorOnly) {
      // Trouver la section "Major Releases" et récupérer uniquement ses liens
      let inMajor = false
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          const tag = node.tagName
          if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
          if (['H3','H2','H4','LI','A'].includes(tag)) return NodeFilter.FILTER_ACCEPT
          return NodeFilter.FILTER_SKIP
        }
      })
      while (walker.nextNode()) {
        const el = walker.currentNode
        const tag = el.tagName
        const text = el.textContent?.trim() || ''
        if (['H3','H2','H4'].includes(tag)) {
          inMajor = /^major releases?$/i.test(text)
          continue
        }
        if (!inMajor) continue
        if (tag === 'A') {
          const href = el.getAttribute('href') || ''
          const m = href.match(/sid\/(\d+)/)
          if (!m || seen.has(m[1])) continue
          const name = el.textContent?.trim()
          if (!name || name.length < 3) continue
          seen.add(m[1])
          results.push({ tcdb_id: parseInt(m[1]), name })
        }
      }
      return results
    }

    // Sans --major-only : tout scraper
    document.querySelectorAll('a[href*="ViewSet"], a[href*="/sid/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const sidMatch = href.match(/sid\/(\d+)/)
      if (!sidMatch || seen.has(sidMatch[1])) return
      const name = a.textContent?.trim()
      if (!name || name.length < 3) return
      seen.add(sidMatch[1])
      results.push({ tcdb_id: parseInt(sidMatch[1]), name })
    })
    return results
  }, MAJOR_ONLY)
}

async function fetchTeams(page, sid) {
  const slug = `${YEAR}-${String(YEAR+1).slice(2)}`
  await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}/${slug}`)
  await sleep(1200)

  const teams = await page.evaluate(() => {
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return
      seen.add(m[1])
      results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')) })
    })
    return results
  })

  return teams.filter(t => NBA_TEAMS.has(t.teamName))
}

async function fetchTeamCards(page, sid, teamId, teamName) {
  const encoded = encodeURIComponent(teamName)
  await waitCF(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${encoded}`)
  await sleep(1200)

  return await page.evaluate(() => {
    const cards = []
    let currentVariation = null
    let inInserts = false

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','STRONG','TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })

    while (walker.nextNode()) {
      const el = walker.currentNode
      const tag = el.tagName
      const text = el.textContent?.trim() || ''

      if (tag === 'H3' || tag === 'H2') {
        if (/^base cards?$/i.test(text)) { currentVariation = null; inInserts = false }
        else if (/^inserts and related/i.test(text)) { inInserts = true; currentVariation = null }
        continue
      }

      if (tag === 'STRONG' && inInserts) {
        if (text && text.length < 100 && !/^\d+\s*record/i.test(text)) currentVariation = text
        continue
      }

      if (tag === 'TR') {
        const tds = Array.from(el.querySelectorAll('td'))
        if (tds.length < 2) continue

        let cardNum = null, playerName = null, team = null
        for (const td of tds) {
          const rawText = td.textContent?.trim() || ''
          const linkText = td.querySelector('a')?.textContent?.trim() || null
          // Accepte: "46", "100A" (base) ET "DMA-DUR", "S-BEN", "THR-BEN" (inserts/variations)
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          // Le nom du joueur est un lien avec des espaces (exclut les codes comme "DMA-DUR")
          const isPlayerName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isPlayerName) { playerName = linkText; continue }
          if (playerName && !team && isPlayerName) team = linkText
        }

        if (!cardNum || !playerName) continue

        const rowText = el.textContent || ''
        cards.push({
          card_number: cardNum,
          player_name: playerName,
          team: team || null,
          variation: currentVariation || null,
          is_rc: /\bRC\b/.test(rowText),
          is_auto: /\bAU\b/.test(rowText),
        })
      }
    }
    return cards
  })
}

async function main() {
  console.log(`🏀 Scraper TCDB NBA — saison ${YEAR}-${String(YEAR+1).slice(2)}`)
  if (MAJOR_ONLY) console.log('   Mode: Major Releases uniquement')
  if (DRY_RUN) console.log('   Mode: DRY RUN (pas d\'insertion)')
  if (LIMIT) console.log(`   Limite: ${LIMIT} sets`)

  let browser = null
  const openBrowser = async () => {
    const result = await launchBrowser(SLOT)
    browser = result.browser
    const p = result.page
    await waitCF(p, TCDB)
    await sleep(rand(2000, 4000))
    console.log('✓ Browser OK (webdriver=false)\n')
    return p
  }
  let page = await openBrowser()

  try {
    console.log(`📋 Récupération des sets ${YEAR}-${String(YEAR+1).slice(2)}...`)
    let sets = await fetchSets(page, YEAR)
    console.log(`   ${sets.length} sets trouvés`)
    if (NAME_FILTER) {
      sets = sets.filter(s => s.name.toLowerCase().includes(NAME_FILTER))
      console.log(`   Filtre "${NAME_FILTER}" → ${sets.length} sets`)
    }
    if (LIMIT) sets = sets.slice(0, LIMIT)

    console.log(`\nSets à scraper (${sets.length}):`)
    sets.forEach((s, i) => console.log(`  ${i+1}. [${s.tcdb_id}] ${s.name}`))
    console.log()

    // Phase 1 : scraping complet en mémoire
    const scraped = []
    for (let si = 0; si < sets.length; si++) {
      const set = sets[si]
      console.log(`\n[${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
      if (si > 0 && si % 8 === 0) { page = await openBrowser() }

      try {
        if (SKIP_EXISTING) {
          const { data: existing } = await supabase.from('card_sets').select('id, total_cards').eq('tcdb_id', set.tcdb_id).single()
          if (existing && existing.total_cards > 100) { console.log(`  ⏭️  Déjà en base (${existing.total_cards} cartes) — ignoré`); scraped.push(null); continue }
        }

        const teams = await fetchTeams(page, set.tcdb_id)
        console.log(`  📂 ${teams.length} équipes NBA`)
        if (!teams.length) { console.log('  ⚠️  Aucune équipe — ignoré'); scraped.push(null); continue }

        const allCards = []
        for (let ti = 0; ti < teams.length; ti++) {
          const { teamId, teamName } = teams[ti]
          process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
          try {
            const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamName)
            allCards.push(...cards)
            console.log(`${cards.length}`)
          } catch (e) { console.log(`❌ ${e.message}`) }
          await sleep(DELAY)
        }

        if (!allCards.length) { console.log('  ⚠️  0 cartes — ignoré'); scraped.push(null); continue }

        const seen = new Set()
        const unique = allCards.filter(c => {
          const k = `${c.card_number}|${c.player_name}|${c.variation || ''}`
          if (seen.has(k)) return false
          seen.add(k); return true
        })

        const brandMatch = set.name.match(MAJOR_BRANDS)
        const brand = brandMatch ? brandMatch[1] : null
        console.log(`  📊 ${unique.length} cartes scrappées`)
        scraped.push({ set, unique, brand })
      } catch (e) {
        console.log(`  ❌ Scraping: ${e.message}`)
        scraped.push(null)
      }
    }

    // Phase 2 : fermer le browser, puis spawner un process fresh pour l'import
    killChrome(SLOT)
    const valid = scraped.filter(Boolean)
    console.log(`\n✓ Browser fermé — ${valid.length} sets à importer\n`)

    if (!DRY_RUN && valid.length) {
      const outFile = require('path').join(__dirname, 'scraped-data.json')
      fs.writeFileSync(outFile, JSON.stringify({ year: YEAR, sets: valid }, null, 2))
      console.log(`\n✅ Scraping terminé — ${valid.length} sets, données sauvegardées`)
      console.log(`\n👉 Lance maintenant dans une NOUVELLE fenêtre PowerShell :`)
      console.log(`   node scripts/import-tcdb.js scripts/scraped-data.json\n`)
    } else {
      console.log(`🏁 Dry run terminé: ${valid.length} sets`)
    }
  } finally {
    killChrome(SLOT)
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
