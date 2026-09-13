#!/usr/bin/env node
/**
 * Scraper TCDB Soccer — Section International uniquement
 *
 * Usage:
 *   node scripts/scrape-all-years-soccer-international.js
 *   node scripts/scrape-all-years-soccer-international.js --from=2020 --to=2000
 *   node scripts/scrape-all-years-soccer-international.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })

const { openBrowser: launchBrowser, killChrome } = require('./browser-helper')
const fs   = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const TCDB          = 'https://www.tcdb.com'
const CHECKPOINT    = path.join(__dirname, 'checkpoint-all-soccer-international.json')
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
// --gaps : au lieu de ne traiter que les annees pas encore dans doneYears, retraite
// TOUTES les annees de la plage -- mais scrapeSet() saute deja les sets presents
// dans doneTcdbIds (voir plus bas), donc ca ne re-scrape reellement QUE les sets
// qui avaient echoue silencieusement (l'annee entiere etait marquee 'done' meme
// si certains sets dedans avaient rate -- cf. cp.doneYears.push(year) en fin de
// boucle annee, inconditionnel). Fetch de la liste de sets par annee reste rapide
// (une page), donc revisiter des annees deja faites coute peu meme si la plupart
// des sets sont sautes.
const GAPS = !!args.gaps
const SLOT    = args.slot ? parseInt(args.slot) : 1

const rand       = (min, max) => Math.floor(Math.random() * (max - min)) + min
const sleep      = ms => new Promise(r => setTimeout(r, ms))
const delayTeam  = () => sleep(rand(300, 700))
const delaySet   = () => sleep(rand(1500, 3500))
const BREAK_EVERY = 60
const delayBreak = () => {
  const ms = rand(20000, 40000)
  console.log(`\n☕ Pause anti-détection ${Math.round(ms/1000)}s...\n`)
  return sleep(ms)
}

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
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2)) }

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
// Retourne true si la page est réellement chargée (pas un challenge CF/captcha en
// cours) — false si encore bloqué après ~5min. Avant, cette fonction ne retournait
// jamais rien : un appelant continuait à parser une page de challenge CF comme si
// de rien n'était, produisant silencieusement 0 carte (ou un sous-ensemble tronqué)
// à chaque fois que CF bloquait une requête au milieu d'un run — la cause probable
// des "0 alors que les cartes existent" sur les runs avec beaucoup de requêtes
// (soccer international peut faire 50-90 requêtes rien que pour un set).
async function waitCF(page, url) {
  const sol = await solverrGet(url)
  if (sol) {
    for (const c of (sol.cookies || [])) {
      await page.setCookie({ name: c.name, value: c.value, domain: c.domain || '.tcdb.com', path: c.path || '/', expires: typeof c.expiry === 'number' ? c.expiry : -1 }).catch(() => {})
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const t = await page.title().catch(() => '')
    const tl = t.toLowerCase()
    if (!tl.includes('instant') && !tl.includes('moment') && !tl.includes('attention') && !tl.includes('captcha')) return true
    console.log(`  ⚠️  Encore bloqué — chargement HTML FlareSolverr (${sol.response?.length || 0} chars)`)
    if (sol.response) { await page.setContent(sol.response, { waitUntil: 'domcontentloaded' }); return true }
  }
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 150; i++) {
    const t = await page.title().catch(() => '')
    const tl = t.toLowerCase()
    if (!tl.includes('instant') && !tl.includes('moment') && !tl.includes('attention') && !tl.includes('captcha') && !tl.includes('verify') && !tl.includes('checking')) return true
    if (i === 0) console.log('\n⚠️  CAPTCHA dans la fenêtre Chrome — résous-le manuellement (5 min max)...')
    await sleep(2000)
  }
  return false
}

async function fetchSets(page, year) {
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Soccer/year/${year}`)
  await sleep(rand(500, 1000))
  return await page.evaluate(() => {
    const results = []
    const seen = new Set()
    let inSection = false
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
      if (['H3','H2','H4'].includes(tag)) { inSection = /^international$/i.test(text); continue }
      if (!inSection) continue
      if (tag === 'A') {
        const href = el.getAttribute('href') || ''
        const m = href.match(/sid\/(\d+)/)
        if (!m || seen.has(m[1])) continue
        const name = el.textContent?.trim()
        if (!name || name.length < 3) continue
        seen.add(m[1])
        results.push({ tcdb_id: parseInt(m[1]), name, href: el.getAttribute('href') || '' })
      }
    }
    return results
  })
}

async function fetchTeamsOnce(page, url) {
  const ok = await waitCF(page, url)
  await sleep(rand(300, 700))
  if (!ok) return null
  return await page.evaluate(() => {
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="/team/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/team\/(\d+)\/(.+)/)
      if (!m || seen.has(m[1])) return
      seen.add(m[1])
      results.push({ teamId: m[1], teamName: decodeURIComponent(m[2].replace(/\+/g, ' ')), teamSlug: m[2] })
    })
    return results
  })
}

async function fetchTeams(page, sid, year) {
  // Essaie saison 2024-25 puis année seule, avec retry si CF bloque la requête
  const slugs = [`${year}-${String(year + 1).slice(2)}`, String(year), '']
  for (const slug of slugs) {
    const url = slug ? `${TCDB}/ViewTeams.cfm/sid/${sid}/${slug}` : `${TCDB}/ViewTeams.cfm/sid/${sid}`
    for (let attempt = 1; attempt <= 2; attempt++) {
      const teams = await fetchTeamsOnce(page, url)
      if (teams === null) { if (attempt < 2) await sleep(rand(3000, 6000)); continue }
      if (teams.length > 0) return teams
      break
    }
  }
  return []
}

async function fetchTeamCards(page, sid, teamId, teamSlug) {
  const ok = await waitCF(page, `${TCDB}/ViewTeamsIns.cfm/sid/${sid}/team/${teamId}/${teamSlug}`)
  await sleep(rand(250, 600))
  if (!ok) throw new Error('CF bloqué')
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
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z0-9]{1,6}-[A-Z0-9]{1,6}$/i.test(rawText) || /^NNO$/i.test(rawText)
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
  console.log()
  const result = spawnSync('node', [IMPORT_SCRIPT, jsonFile], { stdio: 'inherit' })
  return result.status === 0
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
          const isCardCode = /^\d+[a-zA-Z]?$/.test(rawText) || /^[A-Z0-9]{1,6}-[A-Z0-9]{1,6}$/i.test(rawText) || /^NNO$/i.test(rawText)
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

// Segment "2026-Donruss-FIFA-World-Cup" depuis un href ViewAll — réutilisé pour
// construire les URLs Checklist.cfm/Inserts.cfm.
function slugFromHref(href) {
  const m = (href || '').match(/sid\/\d+\/(.+)/)
  return m ? m[1] : ''
}

// /ViewSet.cfm (page directe) ne montre qu'un aperçu tronqué (10 lignes) du
// checklist de base. /Checklist.cfm/sid/{sid} donne la liste complète, sans pagination.
async function fetchFullChecklist(page, sid, slug) {
  const url = slug ? `${TCDB}/Checklist.cfm/sid/${sid}/${slug}` : `${TCDB}/Checklist.cfm/sid/${sid}`
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ok = await waitCF(page, url)
    await sleep(rand(300, 700))
    if (ok) return await parseCardsFromPage(page)
    if (attempt < 2) await sleep(rand(3000, 6000))
  }
  return []
}

// Pour les sets sans nations structurées, les inserts/autos/parallèles ne sont PAS
// sur la page du set — ce sont des sets TCDB à part entière (sid propre), listés sur
// /Inserts.cfm/sid/{sid} avec un lien vers leur propre Checklist.cfm. Le libellé de
// section varie ("Inserts", "Insert Sets (N)", "Parallel Sets (N)", ...) donc on
// prend directement tous les liens Checklist.cfm de la page (en excluant le lien
// "Checklist" du menu "Set Links" qui pointe vers le set parent lui-même).
async function fetchInsertSets(page, sid) {
  const url = `${TCDB}/Inserts.cfm/sid/${sid}`
  let ok = false
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    ok = await waitCF(page, url)
    await sleep(rand(300, 700))
    if (!ok && attempt < 2) await sleep(rand(3000, 6000))
  }
  if (!ok) return []
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

async function scrapeSet(page, set, year, cp) {
  if (cp.doneTcdbIds.includes(set.tcdb_id)) { console.log(`  ⏭️  tcdb_id:${set.tcdb_id} déjà fait`); return null }

  // Étape 1 : la base — ViewTeams (nations = "équipes" sur TCDB) si le set en a,
  // sinon Checklist.cfm (liste complète, sans la troncature de ViewSet.cfm).
  let baseCards = []
  const teams = await fetchTeams(page, set.tcdb_id, year)
  if (teams.length) {
    console.log(`  📂 ${teams.length} nations`)
    for (let ti = 0; ti < teams.length; ti++) {
      const { teamId, teamName, teamSlug } = teams[ti]
      process.stdout.write(`  [${ti+1}/${teams.length}] ${teamName}... `)
      let ok = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const cards = await fetchTeamCards(page, set.tcdb_id, teamId, teamSlug || encodeURIComponent(teamName))
          baseCards.push(...cards); console.log(cards.length); ok = true; break
        } catch (e) {
          if (attempt < 3) { process.stdout.write(`❌ retry... `); await sleep(rand(3000,6000)*attempt) }
          else { console.log(`❌ abandon: ${e.message}`) }
        }
      }
      if (ok) await delayTeam()
    }
    console.log(`  📊 ${baseCards.length} cartes via nations`)
  }
  if (!baseCards.length) {
    const slug = slugFromHref(set.href)
    baseCards = await fetchFullChecklist(page, set.tcdb_id, slug)
    console.log(`  📄 Checklist de base: ${baseCards.length} cartes`)
  }

  // Étape 2 (TOUJOURS exécutée, même si l'étape 1 a réussi via ViewTeams) : les
  // inserts/autos/parallèles sont catalogués par TCDB comme des sets à part
  // entière, chacun avec son propre sid et son propre Checklist.cfm, listés sur
  // Inserts.cfm — ils ne sont quasiment jamais inclus dans les pages par nation.
  // Les sauter dès que ViewTeams réussissait était le bug empêchant de récupérer
  // le moindre insert/auto sur ce sport.
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
    console.log(`  📊 ${unique.length} cartes uniques au total`)
    return { set, unique, brand: null }
  }

  // Dernier recours : page directe du set (aperçu potentiellement tronqué)
  if (set.href) {
    const setUrl = set.href.startsWith('http') ? set.href : `${TCDB}${set.href.startsWith('/') ? '' : '/'}${set.href}`
    const ok = await waitCF(page, setUrl)
    await sleep(rand(500, 1000))
    const directCards = ok ? await parseCardsFromPage(page) : []
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
  console.log(`⚽ Scraper Soccer International — ${FROM} → ${TO}`)
  console.log(`   Section International | Checkpoint: ${cp.doneYears.length} années déjà faites\n`)
  const ASC = process.argv.includes('--asc')
  const years = []; for (let y = FROM; y >= TO; y--) years.push(y)
  if (ASC) years.reverse()
  const remaining = GAPS ? years : years.filter(y => !cp.doneYears.includes(y))
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
      console.log(`\n${'═'.repeat(60)}\n⚽ Soccer International ${year} (${yi+1}/${remaining.length})\n${'═'.repeat(60)}`)
      if (yi > 0 && yi % 8 === 0) { page = await openBrowser() }
      let sets = []
      try { sets = await fetchSets(page, year); console.log(`   ${sets.length} sets trouvés`) }
      catch (e) { console.log(`   ❌ ${e.message}`); cp.doneYears.push(year); saveCheckpoint(cp); continue }
      if (!sets.length) { cp.doneYears.push(year); saveCheckpoint(cp); continue }
      let fatalRetries = 0
      for (let si = 0; si < sets.length; si++) {
        const set = sets[si]; console.log(`\n  [${si+1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
        try {
          const result = await scrapeSet(page, set, year, cp)
          fatalRetries = 0
          if (result) {
            totalSets++
            if (!DRY_RUN) {
              const jsonFile = path.join(DATA_DIR, `scraped-${set.tcdb_id}.json`)
              fs.writeFileSync(jsonFile, JSON.stringify({ year, sport: 'soccer-international', sets: [result] }, null, 2))
              const ok = importYear(jsonFile)
              if (ok) { cp.doneTcdbIds.push(set.tcdb_id); saveCheckpoint(cp); console.log(`  ✅ Importé`) }
              else { console.log(`  ⚠️  Import échoué`) }
            }
          }
        } catch (e) {
          console.log(`  ❌ ${e.message}`)
          // Un crash navigateur (frame détaché, session fermée...) tuait silencieusement
          // tout le reste de l'année : l'erreur était juste loguée puis l'année entière
          // marquée "faite" en fin de boucle, sans jamais retenter les sets restants.
          // On rouvre Chrome et on retente CE set (jusqu'à 3 fois) au lieu d'abandonner.
          if (/detached|protocol error|target closed|session closed|disconnected/i.test(e.message || '') && fatalRetries < 3) {
            fatalRetries++
            console.log(`  💥 Erreur navigateur — réouverture de Chrome et nouvelle tentative (${fatalRetries}/3)...`)
            page = await openBrowser()
            await sleep(rand(2000, 4000))
            si--
            continue
          }
          fatalRetries = 0
        }
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
