#!/usr/bin/env node
/**
 * Import de checklists depuis checklistinsider.com (sets recents que TCDB n'a pas encore, ou cartes manquantes).
 *
 * Source : le fichier Excel « Downloads » de chaque page de set (liste complete, parallèles inclus, une ligne par carte),
 * sinon le texte de la page (cartes de chaque section, sans parallèles).
 *
 * Usage :
 *   node scripts/scrape-checklistinsider.js --url=https://www.checklistinsider.com/2025-26-panini-court-kings-basketball --dry-run
 *   node scripts/scrape-checklistinsider.js --url=https://www.checklistinsider.com/2025-26-panini-court-kings-basketball
 *   node scripts/scrape-checklistinsider.js --season-url=https://www.checklistinsider.com/basketball-cards/2025-26-basketball-cards
 *   node scripts/scrape-checklistinsider.js --sport=basketball --from=2025 --to=2020      (annees de depart de saison)
 *   node scripts/scrape-checklistinsider.js --sport=football --from=2025 --to=2015
 *   options : --dry-run (rien n'est ecrit), --force (retraite meme les pages deja faites), --all (inclut Euroleague, NBL...)
 *
 * Regles d'import (jamais destructif, comme import-tcdb.js) :
 *   - set deja present (meme annee + sport + nom) : on AJOUTE seulement les cartes (numero + joueur) absentes du set, avec tous leurs
 *     parallèles ; une carte deja presente n'est jamais touchee (les noms de parallèles different entre TCDB et Checklist Insider) ;
 *   - set absent : cree (sans tcdb_id), puis toutes ses cartes sont inserees.
 * Conventions de la base : base = variation null ; « Base Ruby » = « Ruby » ; autres = nom de la section (+ couleur).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const axios = require('axios')
const cheerio = require('cheerio')
const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('='); return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)]
}))
const DRY = !!args['dry-run']
const FORCE = !!args.force
const ALL = !!args.all
const CHECKPOINT = path.join(__dirname, 'checkpoint-checklistinsider.json')
const CI = 'https://www.checklistinsider.com'

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!DRY && (!BASE || BASE === '/rest/v1' || !KEY)) { console.error('❌ Variables Supabase manquantes (.env.local)'); process.exit(1) }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }

const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' }

async function retry(fn, n = 4, d = 2000) {
  for (let i = 0; i < n; i++) {
    try { return await fn() } catch (e) { if (i === n - 1) throw e; await sleep(d * (i + 1)) }
  }
}
const getText = url => retry(async () => (await axios.get(url, { headers: UA, responseType: 'text', timeout: 45000 })).data)
const getBuf = url => retry(async () => (await axios.get(url, { headers: UA, responseType: 'arraybuffer', timeout: 60000 })).data)

// ── Checkpoint ────────────────────────────────────────────────────────────────
const loadCp = () => { try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) } catch { return { done: [] } } }
const saveCp = cp => fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))

// ── Lecture du fichier Excel (zip + XML, sans bibliotheque Excel) ─────────────
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf)
  const ssXml = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : ''
  const strs = [...ssXml.matchAll(/<si>(.*?)<\/si>/gs)].map(m => decode([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(t => t[1]).join('')))
  const sheetName = Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0]
  const sh = await zip.file(sheetName).async('string')
  const rows = []
  for (const r of sh.matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
    const o = {}
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const v = /<v>(.*?)<\/v>/s.exec(c[3] || '')
      const is = /<is>.*?<t[^>]*>(.*?)<\/t>/s.exec(c[3] || '')
      o[c[1]] = v ? (/t="s"/.test(c[2]) ? strs[+v[1]] : decode(v[1])) : is ? decode(is[1]) : ''
    }
    rows.push(o)
  }
  return rows
}

// ── Page de set ───────────────────────────────────────────────────────────────
const SPORT_WORDS = /\b(basketball|football|baseball|hockey|soccer|wnba|nba|nfl|mlb|nhl)\b/gi
const BRANDS = ['Panini', 'Topps', 'Upper Deck', 'Leaf', 'Donruss', 'Bowman', 'Fleer', 'Score', 'Sage', 'Futera', 'Onyx']

function textLines(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '\n').split('\n').map(s => decode(s).replace(/ /g, ' ').trim()).filter(Boolean)
}

function parsePage(html, url) {
  const $ = cheerio.load(html)
  let crumb = ''
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const j = JSON.parse($(el).contents().text())
      for (const g of j['@graph'] || []) if (g['@type'] === 'BreadcrumbList') crumb = g.itemListElement?.[1]?.name || crumb
    } catch { /* ignore */ }
  })
  const h1 = ($('h1').first().text() || $('title').text() || '').trim()
  const m = /^(\d{4})/.exec(h1) || /(\d{4})/.exec(url)
  if (!m) return null
  const year = parseInt(m[1])
  // « 2025-26 Panini Court Kings Basketball Checklist Guide » -> « 2025-26 Panini Court Kings »
  let name = h1.replace(/\s+Checklist.*$/i, '').replace(/\s+(Basketball|Football|Baseball|Hockey|Soccer)\s*$/i, '').replace(/\s+Cards\s*$/i, '').trim()
  const rest = name.replace(/^\d{4}(?:-\d{2,4})?\s+/, '')
  const brand = BRANDS.find(b => rest.toLowerCase().startsWith(b.toLowerCase())) || rest.split(/\s+/)[0] || null
  let sport = ({ 'basketball cards': 'nba', 'football cards': 'nfl', 'baseball cards': 'baseball', 'hockey cards': 'hockey', 'soccer cards': 'soccer-international' })[crumb.toLowerCase()]
  if (!sport) sport = crumb ? crumb.toLowerCase().replace(/\s*cards$/, '').replace(/\s+/g, '-') : 'nba'
  if (sport === 'nba' && /wnba/i.test(name + url)) sport = 'wnba'
  const xlsx = $('a[href$=".xlsx"]').map((_, a) => $(a).attr('href')).get()[0] || null

  // categories : « … Autograph Checklist » / « … Relic Checklist » / « … Insert Checklist » regroupent les sections qui suivent
  const lines = textLines(html)
  const cat = {}      // nom de section -> 'auto' | 'memo' | 'insert' | 'base' | 'update'
  const sections = [] // { name, cards:[{card_number,player_name,team}] } (secours sans Excel)
  let curCat = 'base', cur = null
  const HEAD = /^\d{4}(?:-\d{2,4})?\s.*\b(Autograph|Relic|Memorabilia|Insert|Update|Team Set|Player Set|Base)\s+Checklist$/i
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const h = HEAD.exec(l)
    if (h) { curCat = h[1].toLowerCase().replace('memorabilia', 'memo').replace('relic', 'memo').replace('autograph', 'auto'); cur = null; continue }
    const s = /^(.{2,80}?)\s+Checklist$/.exec(l)
    if (s && /^\d+\s+cards?\.?$/i.test(lines[i + 1] || '') || (s && /^\d+\s+cards?\.?$/i.test(lines[i + 2] || '') && !/^\d/.test(s[1]))) {
      cur = { name: s[1].replace(/\s+/g, ' ').trim(), cards: [] }
      sections.push(cur); cat[cur.name] = curCat; continue
    }
    if (cur && curCat !== 'team set' && curCat !== 'player set') {
      const c = /^(\S+)\s+(.+?)\s+-\s+(.+?)(?:\s+\/\d+)?$/.exec(l)
      if (c && !/^(Parallels|Versions)/i.test(l)) cur.cards.push({ card_number: c[1], player_name: c[2].trim(), team: c[3].trim() })
    }
  }
  return { year, name, brand, sport, xlsx, cat, sections, title: h1 }
}

const stripBase = v => { const s = v.replace(/^Base\s+/i, '').trim(); return /^base$/i.test(v.trim()) ? null : s }
function catOf(setName, cat) {
  let best = null
  for (const k of Object.keys(cat)) if ((setName === k || setName.startsWith(k + ' ')) && (!best || k.length > best.length)) best = k
  return best ? cat[best] : null
}

function buildCards(page, rows) {
  const out = []
  if (rows && rows.length > 1) {
    for (const r of rows.slice(1)) {
      if (!r.A || !r.C) continue
      const setName = r.A.trim()
      const c = catOf(setName, page.cat)
      const variation = stripBase(setName)
      out.push({
        card_number: String(r.B ?? '').trim() || null,
        player_name: r.C.trim(),
        team: (r.D || '').trim() || null,
        variation,
        is_rc: /^(Base\s+)?Rookies\b/i.test(setName),
        is_auto: c === 'auto' || /\bautograph/i.test(setName),
      })
    }
    return out
  }
  for (const s of page.sections) {
    const variation = stripBase(s.name)
    for (const c of s.cards) out.push({ ...c, variation, is_rc: /^(Base\s+)?Rookies\b/i.test(s.name), is_auto: page.cat[s.name] === 'auto' })
  }
  return out
}

// ── Base de donnees ───────────────────────────────────────────────────────────
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
const setKey = n => norm(n.replace(/^\d{4}(?:-\d{2,4})?\s+/, '').replace(SPORT_WORDS, ''))
const entryKey = c => `${norm(c.card_number)}|${norm(c.player_name)}|${norm(c.variation)}`
// Cle « carte » sans la variation : TCDB et Checklist Insider nomment les parallèles differemment, on ne compare donc que (numero, joueur)
const cardKey = c => `${norm(c.card_number)}|${norm(c.player_name)}`

async function findSet(year, sport, name) {
  const { data } = await retry(() => axios.get(`${BASE}/card_sets?year=eq.${year}&sport=eq.${sport}&select=id,tcdb_id,name,total_cards&limit=1000`, { headers: H }))
  const k = setKey(name)
  return (data || []).find(s => setKey(s.name) === k) || null
}
async function fetchEntries(setId) {
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data } = await retry(() => axios.get(`${BASE}/card_set_entries?set_id=eq.${setId}&select=card_number,player_name,variation&limit=1000&offset=${from}`, { headers: H }))
    all.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return all
}
async function createSet(p, total) {
  const body = { name: p.name, year: p.year, brand: p.brand, sport: p.sport, total_cards: total }
  const post = b => axios.post(`${BASE}/card_sets?select=id`, b, { headers: { ...H, Prefer: 'return=representation' } })
  try {
    const { data } = await retry(() => post({ ...body, tcdb_id: null }), 2)
    return Array.isArray(data) ? data[0] : data
  } catch (e) {
    // tcdb_id obligatoire ? identifiant negatif synthetique (stable, ne peut pas entrer en conflit avec TCDB)
    let h = 0; for (const ch of p.name + p.year) h = (h * 31 + ch.charCodeAt(0)) | 0
    const { data } = await retry(() => post({ ...body, tcdb_id: -Math.abs(h || 1) }), 2)
    return Array.isArray(data) ? data[0] : data
  }
}

async function importSet(url, cp) {
  if (!FORCE && cp.done.includes(url)) { console.log(`  ⏭️  déjà fait`); return }
  const html = await getText(url)
  const p = parsePage(html, url)
  if (!p) { console.log('  ⚠️  page sans année — ignorée'); return }
  if (!ALL && /euroleague|\bnbl\b|ncaa|college/i.test(url)) { console.log(`  ⏭️  ${p.name} : hors périmètre (--all pour l'inclure)`); return }
  let rows = null
  if (p.xlsx) {
    try { rows = await readXlsx(await getBuf(p.xlsx)) } catch (e) { console.log(`  ⚠️  Excel illisible (${e.message}) — texte de la page`) }
  }
  const cards = buildCards(p, rows)
  // doublons exacts (meme cle) : on n'en garde qu'un
  const seen = new Set(); const unique = []
  for (const c of cards) { const k = entryKey(c); if (seen.has(k)) continue; seen.add(k); unique.push(c) }
  if (!unique.length) { console.log('  ⚠️  aucune carte trouvée — ignorée'); return }
  console.log(`  ${p.name} [${p.sport}, ${p.year}] — ${unique.length} cartes (${rows ? 'Excel' : 'texte de la page'}${p.xlsx && !rows ? ', Excel illisible' : ''})`)

  const existingSet = DRY && !KEY ? null : await findSet(p.year, p.sport, p.name)
  if (DRY) {
    const by = {}; unique.forEach(c => { by[c.variation || '(base)'] = (by[c.variation || '(base)'] || 0) + 1 })
    console.log('  sections :', Object.entries(by).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(', '), '…')
    if (existingSet) {
      const have = new Set((await fetchEntries(existingSet.id)).map(cardKey))
      console.log(`  → set déjà en base (id ${existingSet.id}) : ${unique.filter(c => !have.has(cardKey(c))).length} cartes manquantes seraient ajoutées`)
    } else console.log(`  → nouveau set : ${unique.length} cartes seraient créées`)
    return
  }

  let setRow = existingSet
  let toInsert = unique
  if (setRow) {
    const have = new Set((await fetchEntries(setRow.id)).map(cardKey))
    toInsert = unique.filter(c => !have.has(cardKey(c)))
    console.log(`  set déjà en base (id ${setRow.id}) : ${toInsert.length} cartes manquantes`)
  } else {
    setRow = await createSet(p, unique.length)
    console.log(`  set créé (id ${setRow.id})`)
  }
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500).map(c => ({ set_id: setRow.id, ...c }))
    await retry(() => axios.post(`${BASE}/card_set_entries`, batch, { headers: { ...H, Prefer: 'return=minimal' } }))
    process.stdout.write(`\r  ${Math.min(i + 500, toInsert.length)}/${toInsert.length} insérées...`)
  }
  if (toInsert.length) {
    const total = (existingSet ? (existingSet.total_cards || 0) : 0) + toInsert.length
    await retry(() => axios.patch(`${BASE}/card_sets?id=eq.${setRow.id}`, { total_cards: existingSet ? total : unique.length }, { headers: { ...H, Prefer: 'return=minimal' } }))
  }
  console.log(`\r  ✅ ${toInsert.length} cartes ajoutées`)
  cp.done.push(url); saveCp(cp)
}

// ── Liste des sets d'une saison ───────────────────────────────────────────────
const NAV = new Set(['about', 'contact', 'feed', 'privacy', 'terms', 'release-calendar', 'baseball-cards', 'basketball-cards', 'football-cards', 'golf-cards', 'hockey-cards', 'mma-cards', 'multi-sport-cards', 'non-sport-cards', 'racing-cards', 'soccer-cards', 'tennis-cards', 'wrestling-cards'])
async function seasonSets(seasonUrl) {
  const found = new Set()
  for (let pg = 1; pg <= 10; pg++) {
    let html
    try { html = await getText(pg === 1 ? seasonUrl : `${seasonUrl.replace(/\/$/, '')}/page/${pg}`) } catch { break }
    const $ = cheerio.load(html)
    let added = 0
    $('a[href]').each((_, a) => {
      const m = /^https:\/\/www\.checklistinsider\.com\/([a-z0-9-]+)\/?$/.exec($(a).attr('href') || '')
      if (!m || NAV.has(m[1]) || !/^\d{4}/.test(m[1]) || /-cards$/.test(m[1])) return
      const u = `${CI}/${m[1]}`
      if (!found.has(u)) { found.add(u); added++ }
    })
    if (!added) break
    await sleep(rand(1500, 3000))
  }
  return [...found]
}

function seasonUrlFor(sport, y) {
  const yy = String(y + 1).slice(2)
  if (sport === 'basketball') return `${CI}/basketball-cards/${y}-${yy}-basketball-cards`
  if (sport === 'hockey') return `${CI}/hockey-cards/${y}-${yy}-hockey-cards`
  return `${CI}/${sport}-cards/${y}-${sport}-cards`
}

async function main() {
  const cp = loadCp()
  let urls = []
  if (args.url) urls = [args.url]
  else if (args['season-url']) urls = await seasonSets(args['season-url'])
  else if (args.sport) {
    const from = parseInt(args.from || new Date().getFullYear()), to = parseInt(args.to || from)
    for (let y = from; y >= to; y--) {
      console.log(`📅 Liste ${args.sport} ${y}…`)
      urls.push(...await seasonSets(seasonUrlFor(args.sport, y)))
    }
  } else { console.error('Usage : --url=<page de set> | --season-url=<page de saison> | --sport=basketball --from=2025 --to=2020  [--dry-run] [--force] [--all]'); process.exit(1) }
  urls = [...new Set(urls)]
  console.log(`\n${DRY ? '🔍 DRY-RUN — ' : ''}${urls.length} page(s) de set\n`)
  let ok = 0, err = 0
  for (let i = 0; i < urls.length; i++) {
    console.log(`[${i + 1}/${urls.length}] ${urls[i]}`)
    try { await importSet(urls[i], cp); ok++ } catch (e) {
      const d = e.response?.data
      console.log(`  ❌ ${typeof d === 'object' ? JSON.stringify(d) : (d || e.message)}`); err++
    }
    if (i < urls.length - 1) await sleep(rand(2000, 4500))
  }
  console.log(`\n🏁 Terminé : ${ok} traitées, ${err} erreurs`)
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
