#!/usr/bin/env node
/**
 * Petit programme interactif : tu colles l'adresse d'un set TCDB, il lit la checklist (cartes, parallèles, inserts) et l'ajoute au site.
 *
 *   Double-clic sur RUN_ajouter_set_tcdb.bat, ou :  node scripts/ajouter-set-tcdb.js [adresse]
 *
 * Étapes : 1) ouvre Chrome (visible, au cas où TCDB demande un captcha) 2) lit la page et propose le nom, l'année et le sport
 *          3) lit toutes les cartes (pages multiples + inserts) 4) te montre le résultat, puis importe seulement si tu confirmes.
 * Jamais destructif : on utilise le même import que les autres scripts (import-tcdb.js) : les cartes déjà présentes ne sont jamais touchées ni supprimées.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const readline = require('readline')
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const { spawnSync } = require('child_process')
const { openBrowser, killChrome } = require('./browser-helper')

const TCDB = 'https://www.tcdb.com'
const MAJOR_BRANDS = /(Panini|Topps|Upper Deck|Fleer|Donruss|Hoops|SkyBox|Score|Bowman|Finest|Prizm|Select|Mosaic|Chronicles|Revolution|Obsidian|Optic|Immaculate|National Treasures|Contenders|Spectra|Noir|Eminence)/i
// sport TCDB -> identifiant de sport du site
const SPORTS = {
  basketball: 'nba', football: 'nfl', baseball: 'baseball', hockey: 'hockey', soccer: 'soccer-international', racing: 'racing',
  tennis: 'tennis', wrestling: 'wrestling', mma: 'mma', 'non-sport': 'non-sport', nonsport: 'non-sport', pokemon: 'pokemon', magic: 'mtg',
}
const SITE_SPORTS = ['nba', 'wnba', 'euro-basketball', 'nfl', 'baseball', 'hockey', 'soccer-international', 'racing', 'tennis', 'wrestling', 'mma', 'non-sport']

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = q => new Promise(res => rl.question(q, a => res(a.trim())))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = (a, b) => a + Math.floor(Math.random() * (b - a))
const nk = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

const SB = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DB = { apikey: KEY, Authorization: 'Bearer ' + KEY }

// Attend la fin de la vérification anti-robot de TCDB (captcha à résoudre dans la fenêtre Chrome si besoin)
async function load(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  for (let i = 0; i < 150; i++) {
    const tl = (await page.title().catch(() => '')).toLowerCase()
    if (!/instant|moment|attention|captcha|verify|checking/.test(tl)) return
    if (i === 0) console.log('\n⚠️  TCDB vérifie que tu es humain : résous le captcha dans la fenêtre Chrome (5 min max)...')
    await sleep(2000)
  }
  throw new Error('La vérification de TCDB n’a pas abouti.')
}

async function parseCards(page) {
  return await page.evaluate(() => {
    const cards = []; let currentVariation = null; let inInserts = false
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tag = node.tagName
        if (['SCRIPT', 'STYLE', 'NAV', 'HEADER', 'FOOTER'].includes(tag)) return NodeFilter.FILTER_REJECT
        if (['H3', 'H2', 'STRONG', 'TR'].includes(tag)) return NodeFilter.FILTER_ACCEPT
        return NodeFilter.FILTER_SKIP
      },
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
        cards.push({ card_number: cardNum, player_name: playerName, team: team || null, variation: currentVariation || null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU(TO)?\b/.test(rowText) })
      }
    }
    {
      // lecture par la STRUCTURE de la page (valable pour tous les sets et inserts) : chaque ligne de carte contient un lien /ViewCard.cfm/ dont le texte
      // est le numéro (« 12 », « DEB-01 », « AD »…, même sans chiffre, même répété), un ou plusieurs liens /Person.cfm/ (le ou les joueurs) et un lien /Team.cfm/.
      // Elle ne s'ajoute qu'aux lignes que la lecture ci-dessus n'a pas déjà trouvées (même numéro + même nom : jamais de doublon).
      const have = new Set(cards.map(c => c.card_number + '|' + c.player_name))
      document.querySelectorAll('tr').forEach(tr => {
        const numLink = Array.from(tr.querySelectorAll('a[href*="ViewCard.cfm"]')).find(a => a.textContent.trim().length > 0)
        if (!numLink) return
        const num = numLink.textContent.trim()
        if (num.length > 14) return
        const people = Array.from(tr.querySelectorAll('a[href*="Person.cfm"]')).map(a => a.textContent.trim()).filter(Boolean)
        let name = people.join(' / ')
        const teamLink = tr.querySelector('a[href*="Team.cfm"]')
        let team = teamLink ? teamLink.textContent.trim() : null
        if (!name) {
          // cartes sans joueur (ex. « FTT-01 GER 0-2 FRA » + « Germany / France ») : le titre est le texte qui suit le numéro, sinon la case suivante
          const cell = numLink.closest('td')
          const rest = cell ? cell.textContent.replace(num, '').replace(/\s+/g, ' ').trim() : ''
          const others = Array.from(tr.querySelectorAll('td')).filter(td => td !== cell).map(td => td.textContent.replace(/\s+/g, ' ').trim()).filter(t => t.length >= 2 && !/^\d+$/.test(t))
          name = rest || others[0] || ''
          if (!team) team = (rest ? others[0] : others[1]) || null
        }
        if (!name) return
        const key = num + '|' + name
        if (have.has(key)) return
        // carte à deux joueurs déjà lue avec le premier joueur seulement (« Kylian Mbappé » / « Kylian Mbappé / Antoine Griezmann ») : même carte, on ne la double pas
        if (cards.some(c => c.card_number === num && name.startsWith(c.player_name + ' / '))) return
        const rowText = tr.textContent || ''
        cards.push({ card_number: num, player_name: name, team, variation: null, is_rc: /\bRC\b/.test(rowText), is_auto: /\bAU(TO)?\b/.test(rowText) })
        have.add(key)
      })
    }
    return cards
  })
}

const maxPage = page => page.evaluate(() => {
  let max = 1
  document.querySelectorAll('a[href*="PageIndex="]').forEach(a => { const m = (a.getAttribute('href') || '').match(/PageIndex=(\d+)/); if (m) max = Math.max(max, parseInt(m[1])) })
  return max
})

async function checklist(page, sid, slug) {
  const base = TCDB + '/Checklist.cfm/sid/' + sid + (slug ? '/' + slug : '')
  await load(page, base)
  await sleep(rand(300, 700))
  const cards = await parseCards(page)
  const pages = await maxPage(page)
  for (let p = 2; p <= pages; p++) {
    process.stdout.write('   page ' + p + '/' + pages + '\r')
    await load(page, base + '?PageIndex=' + p)
    await sleep(rand(300, 700))
    cards.push(...await parseCards(page))
  }
  return cards
}

async function insertSets(page, sid) {
  await load(page, TCDB + '/Inserts.cfm/sid/' + sid)
  await sleep(rand(300, 700))
  return await page.evaluate(parent => {
    const seen = new Set(); const out = []
    document.querySelectorAll('a[href*="Checklist.cfm/sid/"]').forEach(a => {
      const m = (a.getAttribute('href') || '').match(/Checklist\.cfm\/sid\/(\d+)\/(.+)/)
      const name = a.textContent.trim()
      if (!m || !name || name === 'Checklist' || m[1] === parent || seen.has(m[1])) return
      seen.add(m[1]); out.push({ sid: m[1], slug: m[2], name })
    })
    return out
  }, String(sid))
}

async function main() {
  if (!KEY || !SB || SB === '/rest/v1') { console.error('❌ Les clés Supabase manquent dans .env.local'); process.exit(1) }
  console.log('\n=== Ajouter un set TCDB au site ===\n')
  let url = process.argv[2] || await ask('Adresse du set TCDB (ex : https://www.tcdb.com/Checklist.cfm/sid/2517/1996-97-Skybox-Autographics) :\n> ')
  const m = url.match(/sid\/(\d+)(?:\/([^?#\s]+))?/i)
  if (!m) { console.error('❌ Je ne trouve pas l’identifiant du set (le « sid/NNNN ») dans cette adresse.'); process.exit(1) }
  const sid = parseInt(m[1]); const slug = m[2] || ''
  console.log('\nOuverture de Chrome (une fenêtre va s’ouvrir : ne la ferme pas)...')
  process.env.SHOW_BROWSER = '1'
  const { page } = await openBrowser(1)
  try {
    await load(page, TCDB + '/Checklist.cfm/sid/' + sid + (slug ? '/' + slug : ''))
    const info = await page.evaluate(() => {
      // le titre de l'onglet (« 1991-92 Score Rookie and Traded | TCDB… ») est le plus fiable ; un titre de bloc comme « Set Links » est écarté
      const fromTitle = document.title.replace(/\s*[|–-]\s*(Trading Card Database|TCDB).*$/i, '').trim()
      const heads = Array.from(document.querySelectorAll('h1, h2')).map(h => h.textContent.trim()).filter(t => t.length > 3 && !/^(set links|cards|overview|checklist|your collection)$/i.test(t))
      const h1 = fromTitle.length > 3 ? fromTitle : (heads[0] || document.title)
      // sport et année : UNIQUEMENT depuis le fil d'Ariane de la page (ex. « Hockey / Sets / 1991-92 / Overview »).
      // Le menu de recherche de TCDB contient aussi des liens /sp/ (et affiche « Baseball » par défaut) : on ne s'en sert pas.
      const crumbs = Array.from(document.querySelectorAll('.breadcrumb a, nav[aria-label*="readcrumb"] a, ol.breadcrumb a'))
      let sp = ''
      for (const a of crumbs) { const m = (a.getAttribute('href') || '').match(/\/sp\/([^/?#]+)/); if (m) { sp = m[1]; break } }
      if (!sp) for (const a of crumbs) { const t = a.textContent.trim(); if (/^(Basketball|Football|Baseball|Hockey|Soccer|Racing|Tennis|Wrestling|MMA|Non-?Sport|Pokemon|Magic)$/i.test(t)) { sp = t; break } }
      let yr = ''
      for (const a of crumbs) { const m = (a.getAttribute('href') || '').match(/\/year\/(\d{4})/) || a.textContent.trim().match(/^(\d{4})(?:-\d{2})?$/); if (m) { yr = m[1]; break } }
      return { h1, sp, yr }
    })
    // tout est déduit de la page : nom (titre de l'onglet), année (dans le nom, sinon le fil d'Ariane) et sport (fil d'Ariane)
    const name = info.h1.replace(/\s*[-|–]\s*TCDB.*$/i, '').replace(/\s+Checklist.*$/i, '').replace(/\s+(Basketball|Football|Baseball|Hockey|Soccer|Racing|Tennis|Wrestling|MMA)(\s+Cards?)?$/i, '').trim()
    let year = parseInt((name.match(/\b(19|20)\d\d\b/) || [])[0] || info.yr)
    let sport = SPORTS[String(info.sp).toLowerCase()]
    if (sport === 'nba' && /wnba/i.test(name)) sport = 'wnba'
    // on ne pose une question que si la page ne permet vraiment pas de deviner
    if (!year) year = parseInt(await ask('Année de départ du set (1996 pour « 1996-97 ») :\n> '))
    if (!sport) sport = await ask('Sport du site (' + SITE_SPORTS.join(', ') + ') :\n> ')
    if (!year || !SITE_SPORTS.includes(sport)) { console.error('❌ Année ou sport introuvable.'); return }
    console.log('\nSet détecté : ' + name + ' · ' + year + ' · ' + sport)

    // un set très proche existe-t-il déjà ? (les cartes qui manquent seront ajoutées, rien n'est supprimé)
    const sets = (await axios.get(SB + '/card_sets?select=id,name,year,sport,tcdb_id&year=eq.' + year + '&limit=500', { headers: DB })).data
    const same = sets.find(s => s.tcdb_id === sid) || sets.find(s => s.sport === sport && nk(s.name) === nk(name))
    if (same) console.log('ℹ️  Ce set existe déjà sur le site (« ' + same.name + ' », #' + same.id + ') : seules les cartes qui manquent seront ajoutées.')

    console.log('\nLecture des cartes...')
    const cards = await checklist(page, sid, slug)
    console.log('   ' + cards.length + ' cartes (base)')
    const inserts = await insertSets(page, sid)
    if (inserts.length) console.log('   ' + inserts.length + ' sets d’inserts / autos trouvés')
    for (let i = 0; i < inserts.length; i++) {
      process.stdout.write('   [' + (i + 1) + '/' + inserts.length + '] ' + inserts[i].name + '... ')
      const c = (await checklist(page, inserts[i].sid, inserts[i].slug)).map(x => ({ ...x, variation: inserts[i].name }))
      cards.push(...c); console.log(c.length)
      if (c.length === 0) {
        try {
          const f = path.join(__dirname, 'year-data', 'debug-insert-' + inserts[i].sid + '.html')
          fs.mkdirSync(path.dirname(f), { recursive: true })
          fs.writeFileSync(f, await page.content())
          console.log('      (0 carte : page gardée dans ' + f + ')')
        } catch { /* copie de diagnostic impossible : sans importance */ }
      }
      await sleep(rand(300, 700))
    }
    const seen = new Set()
    const unique = cards.filter(c => { const k = c.card_number + '|' + c.player_name + '|' + (c.variation || ''); if (seen.has(k)) return false; seen.add(k); return true })
    if (unique.length < 3) { console.error('\n❌ Aucune carte lue. La page a-t-elle changé, ou TCDB t’a-t-il bloqué ?'); return }

    console.log('\n--- Résultat ---')
    console.log(name + ' (' + year + ', ' + sport + ') : ' + unique.length + ' cartes')
    console.log('Exemples : ' + unique.slice(0, 5).map(c => '#' + c.card_number + ' ' + c.player_name + (c.variation ? ' [' + c.variation + ']' : '')).join(' · '))
    const file = path.join(__dirname, 'year-data', 'set-' + sid + '.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ year, sport, sets: [{ set: { tcdb_id: sid, name, href: '/Checklist.cfm/sid/' + sid + (slug ? '/' + slug : '') }, unique, brand: (name.match(MAJOR_BRANDS) || [])[1] || null, complete: true }] }))
    console.log('')
    const r = spawnSync('node', [path.join(__dirname, 'import-tcdb.js'), file], { stdio: 'inherit' })
    if (r.status !== 0) { console.log('\n❌ L’import a rencontré une erreur (voir au-dessus).'); return }
    console.log('\n✅ Terminé. Le set est sur le site.')
    try {
      const row = (await axios.get(SB + '/card_sets?select=id&tcdb_id=eq.' + sid, { headers: DB })).data[0]
      if (row) {
        const lien = 'https://www.memorabilius.fr/setlist/' + row.id
        console.log('\n==============================================')
        console.log('   ID DU SET : ' + row.id)
        console.log('   Adresse   : ' + lien)
        // copié dans le presse-papiers : il suffit de coller dans l'admin (« Demandes de setlist »)
        try { spawnSync('clip', { input: lien, shell: true }); console.log('   (l’adresse est copiée : colle-la dans l’admin)') } catch { /* copie impossible : le numéro est affiché au-dessus */ }
        console.log('==============================================')
      }
    } catch { /* l’identifiant est aussi visible dans la liste des setlists */ }
  } finally {
    killChrome(1)
    rl.close()
  }
}

main().catch(e => { console.error('\n❌ ' + e.message); try { killChrome(1) } catch {} ; process.exit(1) })
