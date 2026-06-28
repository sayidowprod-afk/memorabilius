#!/usr/bin/env node
/**
 * Scraper TCDB Hockey — Toutes saisons 2026→1960, Major Releases uniquement
 *
 * Usage:
 *   node scripts/scrape-all-years-hockey.js
 *   node scripts/scrape-all-years-hockey.js --from=2020 --to=2000
 *   node scripts/scrape-all-years-hockey.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin  = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const CHECKPOINT    = path.join(__dirname, 'checkpoint-all-hockey.json')
const DATA_DIR      = path.join(__dirname, 'year-data')
const IMPORT_SCRIPT = path.join(__dirname, 'import-tcdb.js')

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const FROM    = args.from  ? parseInt(args.from)  : 2026
const TO      = args.to    ? parseInt(args.to)    : 1960
const DRY_RUN = !!args['dry-run']

const rand    = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep   = ms => new Promise(r => setTimeout(r, ms))
const delayTeam  = () => sleep(rand(600, 1400))
const delaySet   = () => sleep(rand(3000, 7000))
const BREAK_EVERY = 30
const delayBreak = () => {
  const ms = rand(90000, 150000)
  console.log(`\n☕ Pause anti-détection ${Math.round(ms/1000)}s...\n`)
  return sleep(ms)
}

const NHL_TEAMS = new Set([
  // Équipes actuelles (32)
  'Anaheim Ducks','Boston Bruins','Buffalo Sabres','Calgary Flames',
  'Carolina Hurricanes','Chicago Blackhawks','Colorado Avalanche','Columbus Blue Jackets',
  'Dallas Stars','Detroit Red Wings','Edmonton Oilers','Florida Panthers',
  'Los Angeles Kings','Minnesota Wild','Montreal Canadiens','Nashville Predators',
  'New Jersey Devils','New York Islanders','New York Rangers','Ottawa Senators',
  'Philadelphia Flyers','Pittsburgh Penguins','San Jose Sharks','Seattle Kraken',
  'St. Louis Blues','Tampa Bay Lightning','Toronto Maple Leafs','Utah Hockey Club',
  'Vancouver Canucks','Vegas Golden Knights','Washington Capitals','Winnipeg Jets',
  // Noms historiques
  'Arizona Coyotes','Phoenix Coyotes','Atlanta Thrashers','Hartford Whalers',
  'Quebec Nordiques','Winnipeg Jets','Minnesota North Stars','Atlanta Flames',
  'California Golden Seals','Cleveland Barons','Colorado Rockies',
  'Kansas City Scouts','Oakland Seals','Pittsburgh Penguins',
  'Mighty Ducks of Anaheim','Atlanta Thrashers',
])

const MAJOR_BRANDS = /(Upper Deck|Topps|Panini|O-Pee-Chee|OPC|Parkhurst|Score|Fleer|Donruss|Pinnacle|Pacific|Leaf|Bowman|Ultra|Finest|Chrome|SP Authentic|SP|The Cup|Artifacts|Trilogy|Black Diamond|Be A Player|BAP|In The Game|ITG|Certified|Contenders|National Treasures|Immaculate|Prizm|Select|Mosaic|Chronicles|Revolution|Paramount)/i

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}

function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) }
  catch { return { doneYears: [], doneTcdbIds: [] } }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

async function waitCF(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 15; i++) {
    const t = await page.title()
    if (!t.includes('instant') && !t.includes('moment')) break
    await sleep(2000)
  }
}

async function fetchSets(page, year) {
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Hockey/year/${year}`)
  await sleep(rand(500, 1000))
  return await page.evaluate(() => {
    const results = []
    const seen = new Set()
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
      if (['H3','H2','H4'].includes(tag)) { inMajor = /^major releases?$/i.test(text); continue }
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
  })
}

async function fetchTeams(page, sid, year) {
  // Hockey: saison 2024-25, slug = "2024-25"
  const slugs = [`${year}-${String(year + 1).slice(2)}`, String(year)]
  for (const slug of slugs) {
    await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}/${slug}`)
    await sleep(rand(300, 700))
    const teams = await page.evaluate((NHL_ARR) => {
      const nhlSet = new Set(NHL_ARR)
      const results = []
      const seen = new Set()
      document.querySelectorAll('a[href*="/team/"]').forEach(a => {
        const href = a.getAttribute('href') || ''
        const m = href.match(/\/team\/(\d+)\/(.+)/)
        if (!m || seen.has(m[1])) return
        seen.add(m[1])
        results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')) })
      })
      return results.filter(t => nhlSet.has(t.teamName))
    }, [...NHL_TEAMS])
    if (teams.length > 0) return teams
  }
  await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}`)
  await sleep(rand(300, 700))
  return await page.evaluate((NHL_ARR) => {
    const nhlSet = new Set(NHL_ARR)
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return
      seen.add(m[1])
      results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')) })
    })
    return results.filter(t => nhlSet.has(t.teamName))
  }, [...NHL_TEAMS])
}

async function fetchTeamCards(page, sid, teamId, teamName) {
  const encoded = encodeURIComponent(teamName)
  await waitCF(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${encoded}`)
  await sleep(rand(250, 600))
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
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isPlayerName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isPlayerName) { playerName = linkText; continue }
          if (playerName && !team && isPlayerName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({
          card_number: cardNum, player_name: playerName, team: team || null,
          variation: currentVariation || null,
          is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText),
        })
      }
    }
    return cards
  })
}

function importYear(jsonFile) {
  const result = spawnSync('powershell', [
    '-NoProfile', '-NonInteractive', '-Command',
    `Start-Process -Wait -NoNewWindow -FilePath node -ArgumentList '${IMPORT_SCRIPT}','${jsonFile}'`
  ], { stdio: 'inherit' })
  return result.status === 0
}

async function scrapeSet(page, set, year, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) { console.log(`  ⏭️  tcdb_id:${set.tcdb_id} déjà fait`); return null }
  const teams = await fetchTeams(page, set.tcdb_id, year)
  if (!teams.length) { console.log(`  ⚠️  0 équipes NHL — ignoré`); return null }
  console.log(`  📂 ${teams.length} équipes`)
  const allCards = []
  for (let ti = 0; ti < teams.length; ti++) {
    const { teamId, teamName } = teams[ti]
    process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
    let ok = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamName)
        allCards.push(...cards); console.log(cards.length); ok = true; break
      } catch (e) {
        if (attempt < 3) { const w = rand(3000,6000)*attempt; process.stdout.write(`❌ retry... `); await sleep(w) }
        else { console.log(`❌ abandon: ${e.message}`) }
      }
    }
    if (ok) await delayTeam()
  }
  if (!allCards.length) { console.log(`  ⚠️  0 cartes`); return null }
  const seen = new Set()
  const unique = allCards.filter(c => { const k = `${c.card_number}|${c.player_name}|${c.variation||''}`; if (seen.has(k)) return false; seen.add(k); return true })
  const brandMatch = set.name.match(MAJOR_BRANDS)
  console.log(`  📊 ${unique.length} cartes uniques`)
  return { set, unique, brand: brandMatch ? brandMatch[1] : null }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
  const cp = loadCheckpoint()
  console.log(`🏒 Scraper Hockey — saisons ${FROM}-${String(FROM+1).slice(2)} → ${TO}-${String(TO+1).slice(2)}`)
  console.log(`   Major Releases uniquement | Checkpoint: ${cp.doneYears.length} années déjà faites\n`)
  const years = []; for (let y = FROM; y >= TO; y--) years.push(y)
  const remaining = years.filter(y => !cp.doneYears.includes(y))
  console.log(`   ${remaining.length} années à scraper\n`)
  let browser = null; let totalSets = 0
  const openBrowser = async () => {
    if (browser) { try { await browser.close() } catch {} }
    await sleep(3000)
    browser = await puppeteerExtra.launch({ executablePath: findChrome(), headless: false, defaultViewport: null, args: ['--no-sandbox','--window-size=1280,900'] })
    const page = await browser.newPage()
    await waitCF(page, TCDB); await sleep(rand(2000,4000)); console.log('✓ Browser OK'); return page
  }
  let page = await openBrowser()
  try {
    for (let yi = 0; yi < remaining.length; yi++) {
      const year = remaining[yi]
      const season = `${year}-${String(year+1).slice(2)}`
      console.log(`\n${'═'.repeat(60)}\n📅 Saison Hockey ${season} (${yi+1}/${remaining.length})\n${'═'.repeat(60)}`)
      if (yi > 0 && yi % 8 === 0) { page = await openBrowser() }
      let sets = []
      try { sets = await fetchSets(page, year); console.log(`   ${sets.length} sets trouvés`) }
      catch (e) { console.log(`   ❌ ${e.message}`); cp.doneYears.push(year); saveCheckpoint(cp); continue }
      if (!sets.length) { cp.doneYears.push(year); saveCheckpoint(cp); continue }
      for (let si = 0; si < sets.length; si++) {
        const set = sets[si]; console.log(`\n  [${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
        try {
          const result = await scrapeSet(page, set, year, cp)
          if (result) {
            totalSets++
            if (!DRY_RUN) {
              const jsonFile = path.join(DATA_DIR, `scraped-${set.tcdb_id}.json`)
              fs.writeFileSync(jsonFile, JSON.stringify({ year, sport: 'hockey', sets: [result] }, null, 2))
              const ok = importYear(jsonFile)
              if (ok) { cp.doneTcdbIds.push(set.tcdb_id); saveCheckpoint(cp); console.log(`  ✅ Importé`) }
              else { console.log(`  ⚠️  Import échoué`) }
            }
          }
        } catch (e) { console.log(`  ❌ ${e.message}`) }
        if (totalSets > 0 && totalSets % BREAK_EVERY === 0) await delayBreak()
        else if (si < sets.length - 1) await delaySet()
      }
      cp.doneYears.push(year); saveCheckpoint(cp)
      if (yi < remaining.length - 1) { await sleep(rand(8000, 18000)) }
    }
    console.log(`\n\n🏁 TERMINÉ — ${cp.doneYears.length} années scrapées`)
  } finally { try { await browser.close() } catch {} }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
