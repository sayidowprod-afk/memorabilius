#!/usr/bin/env node
/**
 * Scraper TCDB Wrestling — Major Releases uniquement
 * Usage: node scripts/scrape-all-years-wrestling.js [--from=2020] [--to=2000] [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { openBrowser: launchBrowser, killChrome } = require('./browser-helper')
const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const SPORT_SLUG    = 'Wrestling'
const SPORT_NAME    = 'wrestling'
const CHECKPOINT    = path.join(__dirname, `checkpoint-all-${SPORT_NAME}.json`)
const DATA_DIR      = path.join(__dirname, 'year-data')
const IMPORT_SCRIPT = path.join(__dirname, 'import-tcdb.js')

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('='); return [k, v ?? true]
  })
)
const FROM    = args.from ? parseInt(args.from) : 2026
const TO      = args.to   ? parseInt(args.to)   : 1980
const DRY_RUN = !!args['dry-run']
const SLOT    = args.slot ? parseInt(args.slot) : 1

const rand       = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep      = ms => new Promise(r => setTimeout(r, ms))
const delayTeam  = () => sleep(rand(300, 700))
const delaySet   = () => sleep(rand(1500, 3500))
const BREAK_EVERY = 60
const delayBreak = () => { const ms = rand(20000,40000); console.log(`\n☕ Pause ${Math.round(ms/1000)}s...\n`); return sleep(ms) }

function findChrome() {
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ]) { try { if (fs.existsSync(p)) return p } catch {} }
}
function loadCheckpoint() { try { return JSON.parse(fs.readFileSync(CHECKPOINT,'utf8')) } catch { return { doneYears:[], doneTcdbIds:[] } } }
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp,null,2)) }

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
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/${SPORT_SLUG}/year/${year}`)
  await sleep(rand(500, 1000))
  return await page.evaluate(() => {
    const results = []; const seen = new Set()
    const headings = Array.from(document.querySelectorAll('h2,h3,h4')).map(el => el.textContent.trim()).filter(t => t && t.length < 80)
    // Les années à faible volume n'ont pas de section "Major Releases" du tout —
    // TCDB liste alors tout sous un intitulé générique ("Select a set:", "Oddball",
    // "On-Demand"...). On ne se limite à "Major Releases" QUE si cette section
    // existe réellement sur la page ; sinon on prend tout sauf les catégories
    // clairement indésirables (promos, tests, non-licencié...).
    const hasMajorSection = headings.some(h => /^major releases?$/i.test(h))
    const JUNK = /^(promo|test issues?|unlicensed|cancelled|food issues?|box sets?)$/i
    let currentHeading = ''
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT','STYLE','NAV','HEADER','FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3','H2','H4','LI','A'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      }
    })
    while (walker.nextNode()) {
      const el = walker.currentNode; const tag = el.tagName; const text = el.textContent?.trim() || ''
      if (['H3','H2','H4'].includes(tag)) { currentHeading = text; continue }
      if (tag !== 'A') continue
      const include = hasMajorSection ? /^major releases?$/i.test(currentHeading) : !JUNK.test(currentHeading)
      if (!include) continue
      const href = el.getAttribute('href') || ''; const m = href.match(/sid\/(\d+)/)
      if (!m || seen.has(m[1])) continue
      const name = el.textContent?.trim(); if (!name || name.length < 3) continue
      seen.add(m[1]); results.push({ tcdb_id: parseInt(m[1]), name, href: el.getAttribute('href') || '' })
    }
    return results
  })
}

async function fetchTeams(page, sid) {
  await waitCF(page, `${TCDB}/ViewTeams.cfm/sid/${sid}`)
  await sleep(rand(300, 700))
  return await page.evaluate(() => {
    const results = []; const seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''; const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return; seen.add(m[1])
      results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g,' ')), teamSlug: m[2] })
    })
    return results
  })
}

async function fetchTeamCards(page, sid, teamId, teamSlug) {
  await waitCF(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${teamSlug}`)
  await sleep(rand(250, 600))
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
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText) || /^NNO$/i.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isName) { playerName = linkText; continue }
          if (playerName && !team && isName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({ card_number: cardNum, player_name: playerName, team: team||null, variation: currentVariation||null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText) })
      }
    }
    return cards
  })
}

function importYear(jsonFile) {
  return spawnSync('node', [IMPORT_SCRIPT, jsonFile], { stdio: 'inherit' }).status === 0
}

// Segment "2022-Panini-Chronicles-WWE" depuis un href ViewSet — réutilisé pour
// construire les URLs Checklist.cfm/Inserts.cfm.
function slugFromHref(href) {
  const m = (href || '').match(/sid\/\d+\/(.+)/)
  return m ? m[1] : ''
}

// /ViewSet.cfm ne montre qu'un aperçu tronqué (10 lignes) du checklist de base.
// /Checklist.cfm/sid/{sid} donne la liste complète, sans pagination.
async function fetchFullChecklist(page, sid, slug) {
  const url = slug ? `${TCDB}/Checklist.cfm/sid/${sid}/${slug}` : `${TCDB}/Checklist.cfm/sid/${sid}`
  await waitCF(page, url)
  await sleep(rand(300, 700))
  return await parseCardsFromPage(page)
}

// Pour les sports sans équipes, les inserts/autos/parallèles ne sont PAS sur la page
// du set — ce sont des sets TCDB à part entière (sid propre), listés sur
// /Inserts.cfm/sid/{sid} avec un lien vers leur propre Checklist.cfm. Le libellé de
// section varie ("Inserts", "Insert Sets (N)", "Parallel Sets (N)", ...) donc on
// prend directement tous les liens Checklist.cfm de la page (en excluant le lien
// "Checklist" du menu "Set Links" qui pointe vers le set parent lui-même).
async function fetchInsertSets(page, sid) {
  await waitCF(page, `${TCDB}/Inserts.cfm/sid/${sid}`)
  await sleep(rand(300, 700))
  return await page.evaluate((parentSid) => {
    const seen = new Set(); const out = []
    document.querySelectorAll('a[href*="Checklist.cfm/sid/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/Checklist\.cfm\/sid\/(\d+)\/(.+)/)
      const name = a.textContent.trim()
      if (!m || !name || name === 'Checklist' || m[1] === parentSid || seen.has(m[1])) return
      seen.add(m[1])
      out.push({ insertSid: m[1], slug: m[2], name })
    })
    return out
  }, String(sid))
}

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
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z]{1,5}-[A-Z0-9]{2,6}$/.test(rawText) || /^NNO$/i.test(rawText)
          if (!cardNum && isCardCode && rawText.length <= 12) { cardNum = rawText; continue }
          const isName = linkText && linkText.length > 3 && /[a-zA-Z]{2}/.test(linkText) && !/^\d/.test(linkText) && linkText.includes(' ')
          if (!playerName && isName) { playerName = linkText; continue }
          if (playerName && !team && isName) team = linkText
        }
        if (!cardNum || !playerName) continue
        const rowText = el.textContent || ''
        cards.push({ card_number: cardNum, player_name: playerName, team: team||null, variation: currentVariation||null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU\b/.test(rowText) })
      }
    }
    return cards
  })
}

async function scrapeSet(page, set, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) { console.log(`  ⏭️  déjà fait`); return null }

  // Essai 1 : ViewTeams.cfm — même les sports "individuels" utilisent cette structure (athlètes = équipes)
  const teams = await fetchTeams(page, set.tcdb_id)
  if (teams.length) {
    console.log(`  📂 ${teams.length} entrées`)
    const allCards = []
    for (let ti = 0; ti < teams.length; ti++) {
      const { teamId, teamName, teamSlug } = teams[ti]
      process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
      let ok = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamSlug || encodeURIComponent(teamName)); allCards.push(...cards); console.log(cards.length); ok = true; break }
        catch (e) { if (attempt < 3) { process.stdout.write(`❌ retry... `); await sleep(rand(3000,6000)*attempt) } else console.log(`❌ abandon: ${e.message}`) }
      }
      if (ok) await delayTeam()
    }
    if (allCards.length) {
      const seen = new Set()
      const unique = allCards.filter(c => { const k=`${c.card_number}|${c.player_name}|${c.variation||''}`; if(seen.has(k)) return false; seen.add(k); return true })
      console.log(`  📊 ${unique.length} cartes uniques`)
      return { set, unique, brand: null }
    }
    console.log(`  ℹ️  0 cartes via équipes — fallback checklist complet...`)
  }

  // Essai 2 : Checklist.cfm (base complète, sans troncature) + Inserts.cfm (autos/parallèles,
  // chacun son propre sid TCDB avec son propre Checklist.cfm)
  const slug = slugFromHref(set.href)
  const baseCards = await fetchFullChecklist(page, set.tcdb_id, slug)
  console.log(`  📄 Checklist de base: ${baseCards.length} cartes`)
  const insertSets = await fetchInsertSets(page, set.tcdb_id)
  if (insertSets.length) console.log(`  🎯 ${insertSets.length} sets d'inserts/autos trouvés`)
  const insertCards = []
  for (let ii = 0; ii < insertSets.length; ii++) {
    const { insertSid, slug: insertSlug, name } = insertSets[ii]
    process.stdout.write(`  [insert ${ii+1}/${insertSets.length}] ${name}... `)
    let ok = false
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const cards = (await fetchFullChecklist(page, insertSid, insertSlug)).map(c => ({ ...c, variation: name }))
        insertCards.push(...cards); console.log(cards.length); ok = true; break
      } catch (e) { if (attempt < 3) { process.stdout.write(`❌ retry... `); await sleep(rand(3000,6000)*attempt) } else console.log(`❌ abandon: ${e.message}`) }
    }
    if (ok) await delayTeam()
  }
  if (baseCards.length || insertCards.length) {
    const seen = new Set()
    const unique = [...baseCards, ...insertCards].filter(c => { const k=`${c.card_number}|${c.player_name}|${c.variation||''}`; if(seen.has(k)) return false; seen.add(k); return true })
    console.log(`  📊 ${unique.length} cartes uniques (base + inserts)`)
    return { set, unique, brand: null }
  }

  // Essai 3 : page directe du set (dernier recours — aperçu potentiellement tronqué)
  if (set.href) {
    const setUrl = set.href.startsWith('http') ? set.href : `${TCDB}${set.href.startsWith('/') ? '' : '/'}${set.href}`
    await waitCF(page, setUrl)
    await sleep(rand(500, 1000))
    const directCards = await parseCardsFromPage(page)
    if (directCards.length) {
      const seen = new Set()
      const unique = directCards.filter(c => { const k=`${c.card_number}|${c.player_name}|${c.variation||''}`; if(seen.has(k)) return false; seen.add(k); return true })
      console.log(`  📊 ${unique.length} cartes (page directe)`)
      return { set, unique, brand: null }
    }
  }

  console.log(`  ⚠️  0 cartes`)
  return null
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)
  const cp = loadCheckpoint()
  console.log(`🤼 Scraper Wrestling Major Releases — ${FROM} → ${TO}\n   Checkpoint: ${cp.doneYears.length} années faites\n`)
  const ASC = process.argv.includes('--asc')
  const years = []; for (let y = FROM; y >= TO; y--) years.push(y)
  if (ASC) years.reverse()
  const remaining = years.filter(y => !cp.doneYears.includes(y))
  console.log(`   ${remaining.length} années à scraper\n`)
  let browser = null; let totalSets = 0
  const openBrowser = async () => {
    const result = await launchBrowser(SLOT)
    browser = result.browser
    const page = result.page
    await waitCF(page, TCDB); await sleep(rand(2000,4000)); console.log('✓ Browser OK (webdriver=false)'); return page
  }
  let page = await openBrowser()
  try {
    for (let yi = 0; yi < remaining.length; yi++) {
      const year = remaining[yi]
      console.log(`\n${'═'.repeat(60)}\n🤼 Wrestling ${year} (${yi+1}/${remaining.length})\n${'═'.repeat(60)}`)
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
  } finally { killChrome(SLOT) }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
