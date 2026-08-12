#!/usr/bin/env node
/**
 * Scraper TCDB MMA — Major Releases uniquement
 * Usage: node scripts/scrape-all-years-mma.js [--from=2020] [--to=2000] [--dry-run]
 *
 * Stratégie CF: lance Chrome SANS --enable-automation → navigator.webdriver=false → CF ne détecte pas le bot
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const puppeteerExtra = require('puppeteer-extra')  // puppeteer-extra supporte aussi connect()
const fs             = require('fs')
const path           = require('path')
const { spawnSync, spawn } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const SPORT_SLUG    = 'MMA'
const SPORT_NAME    = 'mma'
const CHECKPOINT    = path.join(__dirname, `checkpoint-all-${SPORT_NAME}.json`)
const DATA_DIR      = path.join(__dirname, 'year-data')
const IMPORT_SCRIPT = path.join(__dirname, 'import-tcdb.js')
const DEBUG_PORT    = 9222

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('='); return [k, v ?? true]
  })
)
const FROM    = args.from ? parseInt(args.from) : 2026
const TO      = args.to   ? parseInt(args.to)   : 2000
const DRY_RUN = !!args['dry-run']

const rand       = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep      = ms => new Promise(r => setTimeout(r, ms))
const delayTeam  = () => sleep(rand(600, 1400))
const delaySet   = () => sleep(rand(3000, 7000))
const BREAK_EVERY = 30
const delayBreak = () => { const ms = rand(90000, 150000); console.log(`\n☕ Pause ${Math.round(ms/1000)}s...\n`); return sleep(ms) }

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}
function loadCheckpoint() { try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) } catch { return { doneYears: [], doneTcdbIds: [] } } }
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2)) }

// Attend que CF auto-résout (vrai Chrome = challenge JS silencieux), ou invite au solve manuel
async function waitCF(page) {
  for (let i = 0; i < 150; i++) {
    const t = await page.title().catch(() => '')
    if (!/instant|moment|rif|captcha|verify|checking|attente|curit/i.test(t)) return true
    if (i === 0) process.stdout.write('  ⏳ CF challenge...')
    else if (i === 10) console.log('\n⚠️  Résous le CAPTCHA dans Chrome (5 min max)...')
    await sleep(2000)
  }
  return false
}

async function navigate(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  } catch (e) {
    if (e.message.includes('net::ERR') || e.message.includes('timeout')) {
      console.log(`  ⚠️  ${e.message.slice(0, 60)}`)
      return false
    }
    throw e
  }
  const ok = await waitCF(page)
  return ok
}

async function fetchSets(page, year) {
  const ok = await navigate(page, `${TCDB}/ViewAll.cfm/sp/${SPORT_SLUG}/year/${year}`)
  await sleep(rand(500, 1000))
  if (!ok) { console.log('  ⚠️  CF non résolu'); return [] }
  const { results, headings } = await page.evaluate(() => {
    const results = [], seen = new Set()
    let inMajor = false
    const headings = Array.from(document.querySelectorAll('h2,h3,h4')).map(el => el.textContent.trim()).filter(t => t && t.length < 80)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','H4','LI','A'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode, tag = el.tagName, text = el.textContent?.trim() || ''
      if (['H3','H2','H4'].includes(tag)) { inMajor = /^major releases?$/i.test(text); continue }
      if (!inMajor || tag !== 'A') continue
      const href = el.getAttribute('href') || ''; const m = href.match(/sid\/(\d+)/)
      if (!m || seen.has(m[1])) continue
      const name = el.textContent?.trim(); if (!name || name.length < 3) continue
      seen.add(m[1]); results.push({ tcdb_id: parseInt(m[1]), name, href })
    }
    return { results, headings }
  })
  if (!results.length) console.log(`  🏷️  Headings: ${headings.slice(0, 6).join(' | ')}`)
  return results
}

async function fetchTeams(page, sid) {
  const ok = await navigate(page, `${TCDB}/ViewTeams.cfm/sid/${sid}`)
  await sleep(rand(300, 700))
  if (!ok) return []
  const { teams, pageTitle, trCount, linkSample } = await page.evaluate(() => {
    const results = [], seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''; const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return; seen.add(m[1])
      // Garde le slug brut pour la construction d'URL (évite double-encodage)
      results.push({ teamId: m[1], teamName: m[2].replace(/\+/g, ' '), teamSlug: m[2] })
    })
    const trCount = document.querySelectorAll('tr').length
    const linkSample = Array.from(document.querySelectorAll('a[href*=".cfm"]'))
      .map(a => a.getAttribute('href')).filter(Boolean).slice(0, 5)
    return { teams: results, pageTitle: document.title, trCount, linkSample }
  })
  console.log(`  🔍 ViewTeams: "${pageTitle}" | ${teams.length} équipes | ${trCount} TR | ex-liens: ${linkSample.slice(0,2).join(' ')}`)
  return teams
}

// Pour les sports sans équipes (MMA) : parse les cartes directement depuis la page déjà chargée
async function parseCardsFromPage(page) {
  return await page.evaluate(() => {
    const cards = []; let currentVariation = null; let inInserts = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','STRONG','TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode; const tag = el.tagName; const text = el.textContent?.trim() || ''
      if (tag === 'H3' || tag === 'H2') {
        if (/^base cards?$/i.test(text)) { currentVariation = null; inInserts = false }
        else if (/^inserts and related/i.test(text)) { inInserts = true; currentVariation = null }
        continue
      }
      if (tag === 'STRONG' && inInserts) { if (text && text.length < 100 && !/^\d+\s*record/i.test(text)) currentVariation = text; continue }
      if (tag === 'TR') {
        const tds = Array.from(el.querySelectorAll('td')); if (tds.length < 2) continue
        let cardNum = null, playerName = null, team = null
        for (const td of tds) {
          const rawText = td.textContent?.trim() || ''; const linkText = td.querySelector('a')?.textContent?.trim() || null
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isName) { playerName = linkText; continue }
          if (playerName && !team && isName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({ card_number: cardNum, player_name: playerName, team: team || null, variation: currentVariation || null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText) })
      }
    }
    return cards
  })
}

async function fetchTeamCards(page, sid, teamId, teamSlug) {
  // teamSlug est le segment brut de l'URL (avec + pour espaces), pas encodeURIComponent
  const ok = await navigate(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${teamSlug}`)
  await sleep(rand(250, 600))
  if (!ok) return []
  return await page.evaluate(() => {
    const cards = []; let currentVariation = null; let inInserts = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','STRONG','TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode; const tag = el.tagName; const text = el.textContent?.trim() || ''
      if (tag === 'H3' || tag === 'H2') {
        if (/^base cards?$/i.test(text)) { currentVariation = null; inInserts = false }
        else if (/^inserts and related/i.test(text)) { inInserts = true; currentVariation = null }
        continue
      }
      if (tag === 'STRONG' && inInserts) { if (text && text.length < 100 && !/^\d+\s*record/i.test(text)) currentVariation = text; continue }
      if (tag === 'TR') {
        const tds = Array.from(el.querySelectorAll('td')); if (tds.length < 2) continue
        let cardNum = null, playerName = null, team = null
        for (const td of tds) {
          const rawText = td.textContent?.trim() || ''; const linkText = td.querySelector('a')?.textContent?.trim() || null
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isName) { playerName = linkText; continue }
          if (playerName && !team && isName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({ card_number: cardNum, player_name: playerName, team: team || null, variation: currentVariation || null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText) })
      }
    }
    return cards
  })
}

function importYear(jsonFile) {
  return spawnSync('node', [IMPORT_SCRIPT, jsonFile], { stdio: 'inherit' }).status === 0
}

async function scrapeSet(page, set, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) { console.log(`  ⏭️  déjà fait`); return null }

  // Essai 1 : page directe du set (href depuis ViewAll) — marche pour les sports sans équipes
  if (set.href) {
    const setUrl = set.href.startsWith('http') ? set.href : `${TCDB}${set.href.startsWith('/') ? '' : '/'}${set.href}`
    console.log(`  🔗 Page directe: ${setUrl}`)
    const ok = await navigate(page, setUrl)
    await sleep(rand(500, 1000))
    if (ok) {
      const cards = await parseCardsFromPage(page)
      if (cards.length) {
        const seen = new Set()
        const unique = cards.filter(c => { const k = `${c.card_number}|${c.player_name}|${c.variation||''}`; if (seen.has(k)) return false; seen.add(k); return true })
        console.log(`  📊 ${unique.length} cartes (page directe)`)
        return { set, unique, brand: null }
      }
      console.log(`  ℹ️  0 cartes sur la page directe — essai via équipes...`)
    }
  }

  const teams = await fetchTeams(page, set.tcdb_id)

  // Sport sans équipes : page ViewTeams déjà chargée, parse directement
  if (!teams.length) {
    console.log(`  🥊 Pas d'équipes — lecture directe des cartes (ViewTeams)...`)
    const cards = await parseCardsFromPage(page)
    if (!cards.length) { console.log(`  ⚠️  0 cartes`); return null }
    const seen = new Set()
    const unique = cards.filter(c => { const k = `${c.card_number}|${c.player_name}|${c.variation||''}`; if (seen.has(k)) return false; seen.add(k); return true })
    console.log(`  📊 ${unique.length} cartes uniques`)
    return { set, unique, brand: null }
  }

  console.log(`  📂 ${teams.length} entrées`)
  const allCards = []
  for (let ti = 0; ti < teams.length; ti++) {
    const { teamId, teamName, teamSlug } = teams[ti]
    process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
    let ok = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamSlug || teamName); allCards.push(...cards); console.log(cards.length); ok = true; break }
      catch (e) { if (attempt < 3) { process.stdout.write(`❌ retry... `); await sleep(rand(3000, 6000) * attempt) } else console.log(`❌ abandon: ${e.message}`) }
    }
    if (ok) await delayTeam()
  }
  if (!allCards.length) { console.log(`  ⚠️  0 cartes`); return null }
  const seen = new Set()
  const unique = allCards.filter(c => { const k = `${c.card_number}|${c.player_name}|${c.variation||''}`; if (seen.has(k)) return false; seen.add(k); return true })
  console.log(`  📊 ${unique.length} cartes uniques`)
  return { set, unique, brand: null }
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
  const cp = loadCheckpoint()
  console.log(`🥊 Scraper MMA Major Releases — ${FROM} → ${TO}\n   Checkpoint: ${cp.doneYears.length} années faites\n`)
  const years = []; for (let y = FROM; y >= TO; y--) years.push(y)
  const remaining = years.filter(y => !cp.doneYears.includes(y))
  console.log(`   ${remaining.length} années à scraper\n`)

  let browser = null
  let chromeProcess = null
  let totalSets = 0

  const openBrowser = async () => {
    if (browser) { try { await browser.disconnect() } catch {} }
    if (chromeProcess) { try { chromeProcess.kill() } catch {}; await sleep(3000) }

    const chromePath = findChrome()
    const userDataDir = path.join(process.env.LOCALAPPDATA || 'C:\\Users\\killi\\AppData\\Local', 'Google\\Chrome\\User Data')

    // Lance Chrome SANS --enable-automation → navigator.webdriver reste false → CF ne détecte pas le bot
    chromeProcess = spawn(chromePath, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--profile-directory=Default',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--window-size=1280,900',
      'about:blank'
    ], { detached: false, stdio: 'ignore' })

    await sleep(3000)

    browser = await puppeteerExtra.connect({
      browserURL: `http://localhost:${DEBUG_PORT}`,
      defaultViewport: null
    })

    const pages = await browser.pages()
    const page = pages[0] || await browser.newPage()

    console.log('🌐 Ouverture TCDB (navigator.webdriver=false)...')
    await page.goto(TCDB, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    const ok = await waitCF(page)
    if (ok) console.log('✓ Chrome prêt — CF auto-résolu ou homepage passée')
    else console.log('✓ Chrome prêt (homepage CF — le script continue)')
    return page
  }

  let page = await openBrowser()

  try {
    for (let yi = 0; yi < remaining.length; yi++) {
      const year = remaining[yi]
      console.log(`\n${'═'.repeat(60)}\n🥊 MMA ${year} (${yi+1}/${remaining.length})\n${'═'.repeat(60)}`)
      if (yi > 0 && yi % 8 === 0) { page = await openBrowser() }
      let sets = []
      try { sets = await fetchSets(page, year); console.log(`   ${sets.length} sets trouvés`) }
      catch (e) { console.log(`   ❌ ${e.message}`); cp.doneYears.push(year); saveCheckpoint(cp); continue }
      if (!sets.length) { cp.doneYears.push(year); saveCheckpoint(cp); continue }
      for (let si = 0; si < sets.length; si++) {
        const set = sets[si]; console.log(`\n  [${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
        try {
          const result = await scrapeSet(page, set, cp)
          if (result && !DRY_RUN) {
            totalSets++
            const jsonFile = path.join(DATA_DIR, `scraped-${set.tcdb_id}.json`)
            fs.writeFileSync(jsonFile, JSON.stringify({ year, sport: SPORT_NAME, sets: [result] }, null, 2))
            const ok = importYear(jsonFile)
            if (ok) { cp.doneTcdbIds.push(set.tcdb_id); saveCheckpoint(cp); console.log(`  ✅ Importé`) }
            else console.log(`  ⚠️  Import échoué`)
          }
        } catch (e) { console.log(`  ❌ ${e.message}`) }
        if (totalSets > 0 && totalSets % BREAK_EVERY === 0) await delayBreak()
        else if (si < sets.length - 1) await delaySet()
      }
      cp.doneYears.push(year); saveCheckpoint(cp)
      if (yi < remaining.length - 1) await sleep(rand(8000, 18000))
    }
    console.log(`\n\n🏁 TERMINÉ — ${cp.doneYears.length} années scrapées`)
  } finally {
    try { await browser.disconnect() } catch {}
    try { chromeProcess.kill() } catch {}
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
