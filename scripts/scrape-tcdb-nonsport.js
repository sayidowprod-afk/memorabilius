#!/usr/bin/env node
/**
 * Scraper TCDB Non-Sport (Disney / Star Wars / Marvel) → Supabase
 *
 * Contrairement aux sets sport (scrape-tcdb-nba.js), un set non-sport n'a pas
 * de decoupage par equipe : le checklist complet est directement sur
 * /Checklist.cfm/sid/<id>/<slug>, pagine par 100 cartes (?PageIndex=N).
 *
 * Usage:
 *   node scripts/scrape-tcdb-nonsport.js --year=2026
 *   node scripts/scrape-tcdb-nonsport.js --from=1977 --to=2026   (plusieurs annees, une a la fois)
 *   node scripts/scrape-tcdb-nonsport.js --year=2026 --dry-run
 *   node scripts/scrape-tcdb-nonsport.js --year=2026 --limit=3
 *   node scripts/scrape-tcdb-nonsport.js --year=2026 --name="Topps Chrome"
 *   node scripts/scrape-tcdb-nonsport.js --year=2026 --no-inserts     (bases seulement, rapide)
 *   node scripts/scrape-tcdb-nonsport.js --year=2026 --max-inserts=10 (plafonne par set, pour tester)
 *
 * Avec --from/--to : un fichier scraped-data-nonsport-<annee>.json est ecrit
 * des qu'une annee est terminee (pas attendu que tout le intervalle finisse) --
 * on peut lancer l'import au fur et a mesure, et interrompre (Ctrl+C) sans
 * perdre les annees deja faites.
 *
 * Inserts/parallèles : sur TCDB, un insert ou un parallele de couleur NON-SPORT
 * est un set A PART ENTIERE (pas une section embarquee dans le checklist de
 * base comme pour les sets sport) -- un gros set comme "Topps Chrome Star Wars"
 * peut avoir 150+ inserts/parallèles, chacun avec son propre sid et son propre
 * mini-checklist. Scrapes par defaut (1:1 avec TCDB, donc BEAUCOUP plus de
 * requetes et de temps qu'un simple scrape des bases) ; --no-inserts pour
 * desactiver.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
require('dns').setDefaultResultOrder('ipv4first')
const { openBrowser: launchBrowser, killChrome } = require('./browser-helper')
const { createClient } = require('@supabase/supabase-js')
const nodeFetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TCDB = 'https://www.tcdb.com'
const DELAY = 2000
const PAGE_SIZE = 100 // nombre de cartes par page sur Checklist.cfm (constate)

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
const YEAR_FROM = args.from ? parseInt(args.from) : (args.year ? parseInt(args.year) : 2026)
const YEAR_TO = args.to ? parseInt(args.to) : (args.year ? parseInt(args.year) : 2026)
const LIMIT = args.limit ? parseInt(args.limit) : null
const DRY_RUN = !!args['dry-run']
const SKIP_EXISTING = !args['force']
const NAME_FILTER = args.name ? args.name.toLowerCase() : null
const SLOT = args.slot ? parseInt(args.slot) : 1
// Sur TCDB, un insert/parallele non-sport est un SET A PART (pas une section
// embarquee dans le checklist de base comme pour les sets sport) -- ex: "2026
// Topps Chrome Star Wars" a 159 inserts/parallels, chacun avec son propre sid
// et son propre mini-checklist. Scrapes par defaut (1:1 avec TCDB) ; --no-inserts
// pour ne garder que les bases (plus rapide, utile pour tester).
const SCRAPE_INSERTS = !args['no-inserts']
const MAX_INSERTS = args['max-inserts'] ? parseInt(args['max-inserts']) : null

// Themes demandes explicitement -- jamais la totalite des sets Non-Sport.
const THEME_RE = /disney|star wars|marvel/i

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

async function waitCF(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  for (let i = 0; i < 150; i++) {
    const t = await page.title().catch(() => '')
    const tl = t.toLowerCase()
    if (!tl.includes('instant') && !tl.includes('moment') && !tl.includes('attention') && !tl.includes('captcha') && !tl.includes('verify') && !tl.includes('checking')) break
    if (i === 0) console.log('\n⚠️  CAPTCHA dans la fenêtre Chrome — résous-le manuellement (5 min max)...')
    await sleep(2000)
  }
}

async function fetchThemedSets(page, year) {
  await waitCF(page, `${TCDB}/ViewAll.cfm/sp/Non-Sport/year/${year}`)
  await sleep(1500)

  const all = await page.evaluate(() => {
    const results = []
    const seen = new Set()
    document.querySelectorAll('a[href*="ViewSet"], a[href*="/sid/"]').forEach(a => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/sid\/(\d+)/)
      if (!m || seen.has(m[1])) return
      const name = a.textContent?.trim()
      if (!name || name.length < 3) return
      seen.add(m[1])
      results.push({ tcdb_id: parseInt(m[1]), name, href })
    })
    return results
  })
  return all.filter(s => THEME_RE.test(s.name))
}

// Checklist.cfm : une seule table "a plat" (pas de split base/inserts comme les
// sets sport) -- numero de carte + nom du personnage/sujet, parfois un lien vers
// /Person.cfm. Paginee par PAGE_SIZE cartes (?PageIndex=N).
async function fetchChecklistPage(page, sid, slug, pageIndex) {
  const url = `${TCDB}/Checklist.cfm/sid/${sid}/${slug}${pageIndex > 1 ? `?PageIndex=${pageIndex}` : ''}`
  await waitCF(page, url)
  await sleep(1000)

  return await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'))
    const big = tables.filter(t => t.querySelectorAll('tr').length > 1 && t.querySelectorAll('a[href*="ViewCard.cfm"]').length > 0)
    if (!big.length) return { cards: [], totalCards: null }
    const table = big[0]
    const cards = []
    table.querySelectorAll('tr').forEach(tr => {
      const tds = Array.from(tr.querySelectorAll('td'))
      if (tds.length < 2) return
      // Numero : premier <td> avec un lien ViewCard.cfm dont le texte est court (numero/code)
      let cardNum = null, name = null
      for (const td of tds) {
        const a = td.querySelector('a')
        const text = (a ? a.textContent : td.textContent)?.trim() || ''
        if (!text) continue
        if (!cardNum && text.length <= 12 && /^[A-Z0-9][A-Za-z0-9.\-]*$/.test(text) && a?.getAttribute('href')?.includes('ViewCard.cfm')) {
          cardNum = text
          continue
        }
        if (!name && text.length > 1 && cardNum) { name = text; break }
      }
      if (!cardNum || !name) return
      cards.push({ card_number: cardNum, player_name: name })
    })
    const totalMatch = document.body.innerText.match(/Total Cards:\s*([\d,]+)/)
    const totalCards = totalMatch ? parseInt(totalMatch[1].replace(/,/g, '')) : null
    return { cards, totalCards }
  })
}

async function fetchFullChecklist(page, set) {
  const slug = set.href.split('/').pop()
  const first = await fetchChecklistPage(page, set.tcdb_id, slug, 1)
  if (!first.totalCards) return first.cards

  const pageCount = Math.ceil(first.totalCards / PAGE_SIZE)
  const all = [...first.cards]
  for (let p = 2; p <= pageCount; p++) {
    await sleep(DELAY)
    const { cards } = await fetchChecklistPage(page, set.tcdb_id, slug, p)
    all.push(...cards)
  }
  return all
}

// /Inserts.cfm/sid/<id>/<slug> liste chaque insert ET chaque couleur de parallele
// comme un lien direct vers SON PROPRE /Checklist.cfm/sid/<autre-id>/... -- deux
// <a> par ligne (vignette + nom texte), seul le 2e a un texte non-vide.
async function fetchInsertSets(page, baseSid, baseSlug) {
  const url = `${TCDB}/Inserts.cfm/sid/${baseSid}/${baseSlug}`
  await waitCF(page, url)
  await sleep(1000)

  return await page.evaluate((baseSid) => {
    const links = Array.from(document.querySelectorAll('a[href*="Checklist.cfm/sid/"]'))
    const seen = new Set()
    const results = []
    for (const a of links) {
      const text = a.textContent?.trim()
      if (!text) continue // vignette image, pas le lien texte
      const href = a.getAttribute('href') || ''
      const m = href.match(/sid\/(\d+)/)
      if (!m || m[1] === baseSid || seen.has(m[1])) continue
      seen.add(m[1])
      results.push({ tcdb_id: parseInt(m[1]), name: text, href })
    }
    return results
  }, baseSid)
}

const BRAND_RE = /(Topps Chrome Sapphire|Topps Chrome|Topps Now|Topps Mint|Topps|Panini|Upper Deck|Epoch|Lego)/i

// Scrape UN set (base ou insert) et retourne l'entree prete pour le JSON, ou
// null si deja en base / 0 carte / erreur. `indent` sert juste a l'affichage.
async function scrapeOneSet(page, set, indent = '  ') {
  if (SKIP_EXISTING) {
    const { data: existing } = await supabase.from('card_sets').select('id, total_cards').eq('tcdb_id', set.tcdb_id).single()
    if (existing && existing.total_cards > 0) { console.log(`${indent}⏭️  Déjà en base (${existing.total_cards} cartes) — ignoré`); return null }
  }

  const cards = await retry(() => fetchFullChecklist(page, set))
  console.log(`${indent}📊 ${cards.length} cartes scrappées`)
  if (!cards.length) { console.log(`${indent}⚠️  0 carte — ignoré`); return null }

  const seen = new Set()
  const unique = cards.filter(c => {
    const k = `${c.card_number}|${c.player_name}`
    if (seen.has(k)) return false
    seen.add(k); return true
  }).map(c => ({ card_number: c.card_number, player_name: c.player_name, team: null, variation: null, is_rc: false, is_auto: false }))

  const brandMatch = set.name.match(BRAND_RE)
  const brand = brandMatch ? brandMatch[1] : null
  return { set: { tcdb_id: set.tcdb_id, name: set.name }, unique, brand }
}

async function scrapeYear(getPage, year) {
  console.log(`\n${'='.repeat(60)}\n📅 Année ${year}\n${'='.repeat(60)}`)
  let page = await getPage()

  console.log(`📋 Récupération des sets Non-Sport ${year}...`)
  let sets = await fetchThemedSets(page, year)
  console.log(`   ${sets.length} sets Disney/Star Wars/Marvel trouvés`)
  if (NAME_FILTER) {
    sets = sets.filter(s => s.name.toLowerCase().includes(NAME_FILTER))
    console.log(`   Filtre "${NAME_FILTER}" → ${sets.length} sets`)
  }
  if (LIMIT) sets = sets.slice(0, LIMIT)
  if (!sets.length) { console.log('   (rien à scraper cette année)'); return [] }

  console.log(`\nSets à scraper (${sets.length}):`)
  sets.forEach((s, i) => console.log(`  ${i + 1}. [${s.tcdb_id}] ${s.name}`))
  console.log()

  const scraped = []
  let pageLoadsSinceRestart = 0
  const maybeRestart = async () => {
    pageLoadsSinceRestart++
    if (pageLoadsSinceRestart >= 25) { page = await getPage(true); pageLoadsSinceRestart = 0 }
  }

  for (let si = 0; si < sets.length; si++) {
    const set = sets[si]
    console.log(`\n[${si + 1}/${sets.length}] ${set.name} (sid:${set.tcdb_id})`)
    await maybeRestart()

    try {
      const entry = await scrapeOneSet(page, set)
      if (entry) scraped.push(entry)

      if (!SCRAPE_INSERTS) continue
      const baseSlug = set.href.split('/').pop()
      const inserts = await retry(() => fetchInsertSets(page, String(set.tcdb_id), baseSlug))
      if (!inserts.length) continue
      const capped = MAX_INSERTS ? inserts.slice(0, MAX_INSERTS) : inserts
      console.log(`  🧩 ${inserts.length} inserts/parallèles${MAX_INSERTS && inserts.length > MAX_INSERTS ? ` (limité à ${MAX_INSERTS})` : ''}`)

      for (let ii = 0; ii < capped.length; ii++) {
        const insertSet = capped[ii]
        console.log(`  ↳ [${ii + 1}/${capped.length}] ${insertSet.name} (sid:${insertSet.tcdb_id})`)
        await maybeRestart()
        try {
          const entry = await scrapeOneSet(page, insertSet, '    ')
          if (entry) scraped.push(entry)
        } catch (e) {
          console.log(`    ❌ Scraping insert: ${e.message}`)
        }
        await sleep(DELAY)
      }
    } catch (e) {
      console.log(`  ❌ Scraping: ${e.message}`)
    }
  }

  return scraped
}

async function main() {
  const years = []
  for (let y = YEAR_FROM; y <= YEAR_TO; y++) years.push(y)
  console.log(`🏰 Scraper TCDB Non-Sport (Disney / Star Wars / Marvel) — ${years.length > 1 ? `${YEAR_FROM} → ${YEAR_TO} (${years.length} années)` : YEAR_FROM}`)
  if (DRY_RUN) console.log('   Mode: DRY RUN (pas d\'insertion)')
  if (LIMIT) console.log(`   Limite: ${LIMIT} sets/année`)

  let page = null
  const getPage = async (force = false) => {
    if (page && !force) return page
    const result = await launchBrowser(SLOT)
    page = result.page
    await waitCF(page, TCDB)
    await sleep(rand(1500, 3000))
    console.log('✓ Browser OK (webdriver=false)\n')
    return page
  }

  const writtenFiles = []
  try {
    for (const year of years) {
      const valid = await scrapeYear(getPage, year)
      console.log(`\n✓ Année ${year} terminée — ${valid.length} sets scrapés`)

      if (!DRY_RUN && valid.length) {
        const outFile = path.join(__dirname, `scraped-data-nonsport-${year}.json`)
        fs.writeFileSync(outFile, JSON.stringify({ year, sport: 'non-sport', sets: valid }, null, 2))
        writtenFiles.push(outFile)
        console.log(`✅ Sauvegardé dans ${outFile}`)
      }
    }
  } finally {
    killChrome(SLOT)
  }

  console.log(`\n${'='.repeat(60)}`)
  if (DRY_RUN) {
    console.log(`🏁 Dry run terminé pour ${years.length} année(s)`)
  } else if (writtenFiles.length) {
    console.log(`✅ Scraping terminé — ${writtenFiles.length} fichier(s) écrits`)
    console.log(`\n👉 Importe chaque fichier dans une NOUVELLE fenêtre :`)
    for (const f of writtenFiles) console.log(`   node scripts/import-tcdb.js "${f}"`)
    console.log()
  } else {
    console.log('🏁 Terminé — rien de nouveau à importer')
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
