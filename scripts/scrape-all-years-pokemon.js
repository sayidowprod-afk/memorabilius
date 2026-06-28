#!/usr/bin/env node
/**
 * Scraper TCDB Pokemon — Toutes années 2025→1996, Major Releases uniquement
 * Pas d'équipes : scraping direct depuis la page du set (ViewSet.cfm)
 *
 * Usage:
 *   node scripts/scrape-all-years-pokemon.js
 *   node scripts/scrape-all-years-pokemon.js --from=2010 --to=2000
 *   node scripts/scrape-all-years-pokemon.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const puppeteerExtra = require('puppeteer-extra')
const StealthPlugin  = require('puppeteer-extra-plugin-stealth')
puppeteerExtra.use(StealthPlugin())
const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const CHECKPOINT    = path.join(__dirname, 'checkpoint-all-pokemon.json')
const DATA_DIR      = path.join(__dirname, 'year-data')
const IMPORT_SCRIPT = path.join(__dirname, 'import-tcdb.js')

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const FROM    = args.from  ? parseInt(args.from)  : 2025
const TO      = args.to    ? parseInt(args.to)    : 1996
const DRY_RUN = !!args['dry-run']

const rand    = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep   = ms => new Promise(r => setTimeout(r, ms))
const delaySet   = () => sleep(rand(3000, 7000))
const BREAK_EVERY = 30
const delayBreak = () => {
  const ms = rand(90000, 150000)
  console.log(`\n☕ Pause anti-détection ${Math.round(ms/1000)}s...\n`)
  return sleep(ms)
}

const MAJOR_BRANDS = /(Wizards|Nintendo|Pokemon Company|Pokémon Company|TPCI|Game Freak|Scarlet|Violet|Sword|Shield|Sun|Moon|XY|BW|Black|White|HeartGold|SoulSilver|Platinum|Diamond|Pearl|EX|Team Rocket|Base Set|Jungle|Fossil|Gym|Neo|Legendary|e-Card|POP|Promo|Special)/i

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
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Pokemon/year/${year}`)
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
      if (['H3','H2','H4'].includes(tag)) {
        // Pour Pokémon, on prend aussi tous les sets (pas seulement Major Releases)
        inMajor = /^major releases?$/i.test(text) || /^sets?$/i.test(text) || !results.length
        continue
      }
      if (!inMajor && results.length > 0) continue
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

// Pokémon : scrape toutes les cartes directement depuis la page du set
async function fetchSetCards(page, sid) {
  await waitCF(page, `${TCDB}/ViewSet.cfm/sid/${sid}`)
  await sleep(rand(300, 700))

  return await page.evaluate(() => {
    const cards = []
    let currentVariation = null
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
      if (tag === 'STRONG') {
        if (text && text.length < 100) currentVariation = text
        continue
      }
      if (tag === 'TR') {
        const tds = Array.from(el.querySelectorAll('td'))
        if (tds.length < 2) continue
        let cardNum = null, cardName = null
        for (const td of tds) {
          const rawText = td.textContent?.trim() || ''
          const linkText = td.querySelector('a')?.textContent?.trim() || null
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{1,6}$/.test(rawText) || /^[A-Z]+\d+$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          if (!cardName && linkText && linkText.length > 1) { cardName = linkText; continue }
        }
        if (!cardNum || !cardName) continue
        const rowText = el.textContent || ''
        cards.push({
          card_number: cardNum,
          player_name: cardName,  // "player_name" = nom de la carte Pokémon
          team: null,
          variation: currentVariation || null,
          is_rc: false,
          is_auto: /\bAU\b|\bAutograph\b/i.test(rowText),
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

async function scrapeSet(page, set, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) { console.log(`  ⏭️  tcdb_id:${set.tcdb_id} déjà fait`); return null }
  let cards = []
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { cards = await fetchSetCards(page, set.tcdb_id); break }
    catch (e) {
      if (attempt < 3) { await sleep(rand(3000, 6000) * attempt) }
      else { console.log(`  ❌ abandon: ${e.message}`); return null }
    }
  }
  if (!cards.length) { console.log(`  ⚠️  0 cartes`); return null }
  const seen = new Set()
  const unique = cards.filter(c => {
    const k = `${c.card_number}|${c.player_name}|${c.variation||''}`
    if (seen.has(k)) return false; seen.add(k); return true
  })
  const brandMatch = set.name.match(MAJOR_BRANDS)
  console.log(`  📊 ${unique.length} cartes`)
  return { set, unique, brand: brandMatch ? brandMatch[1] : null }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
  const cp = loadCheckpoint()
  console.log(`🎴 Scraper Pokémon — années ${FROM} → ${TO}`)
  console.log(`   Checkpoint: ${cp.doneYears.length} années déjà faites\n`)
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
      console.log(`\n${'═'.repeat(60)}\n📅 Année Pokémon ${year} (${yi+1}/${remaining.length})\n${'═'.repeat(60)}`)
      if (yi > 0 && yi % 8 === 0) { page = await openBrowser() }
      let sets = []
      try { sets = await fetchSets(page, year); console.log(`   ${sets.length} sets trouvés`) }
      catch (e) { console.log(`   ❌ ${e.message}`); cp.doneYears.push(year); saveCheckpoint(cp); continue }
      if (!sets.length) { cp.doneYears.push(year); saveCheckpoint(cp); continue }
      for (let si = 0; si < sets.length; si++) {
        const set = sets[si]; console.log(`\n  [${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
        try {
          const result = await scrapeSet(page, set, cp)
          if (result) {
            totalSets++
            if (!DRY_RUN) {
              const jsonFile = path.join(DATA_DIR, `scraped-${set.tcdb_id}.json`)
              fs.writeFileSync(jsonFile, JSON.stringify({ year, sport: 'pokemon', sets: [result] }, null, 2))
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
      if (yi < remaining.length - 1) await sleep(rand(8000, 18000))
    }
    console.log(`\n\n🏁 TERMINÉ — ${cp.doneYears.length} années scrapées`)
  } finally { try { await browser.close() } catch {} }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
