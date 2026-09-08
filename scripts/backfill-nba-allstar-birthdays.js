#!/usr/bin/env node
/**
 * Backfill (une seule fois) : tous les All-Stars NBA de l'histoire (source:
 * table Wikipedia "List of NBA All-Stars", ~467 joueurs) + le Top 500 SLAM
 * des plus grands joueurs de l'histoire (basketball-reference.com, comble
 * les joueurs marquants jamais selectionnes All-Star -- rare mais existe)
 * + date de naissance et photo (ESPN, avec repli NBA stats CDN / Wikipedia
 * pour les tres vieux joueurs absents d'ESPN) -> table nba_allstar_birthdays.
 * Alimente le post anniversaire quotidien du bot Discord (voir
 * src/app/api/cron/nba-birthday).
 *
 * Usage:
 *   node scripts/backfill-nba-allstar-birthdays.js
 *   node scripts/backfill-nba-allstar-birthdays.js --dry-run
 *   node scripts/backfill-nba-allstar-birthdays.js --limit=10
 *   node scripts/backfill-nba-allstar-birthdays.js --force   (re-fetch meme si deja en base)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const nodeFetch = require('node-fetch')
const cheerio = require('cheerio')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local)')
  process.exit(1)
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { global: { fetch: nodeFetch } })

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v ?? true]
  })
)
const LIMIT = args.limit ? parseInt(args.limit) : null
const DRY_RUN = !!args['dry-run']
const FORCE = !!args.force

const sleep = ms => new Promise(r => setTimeout(r, ms))
const UA = 'Memorabilius/1.0 (https://memorabilius.fr; contact via le site)'

const WIKI_LIST_URL = 'https://en.wikipedia.org/wiki/List_of_National_Basketball_Association_All-Stars'
const SLAM_500_URL = 'https://www.basketball-reference.com/awards/slam_500_greatest.html'
const TOP_1000_URL = 'https://www.nbahoopsonline.com/History/articles/Top1000.html'
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// La page liste chaque All-Star une seule fois avec son total de selections
// (colonne "#") -- pas besoin d'agreger par annee, un joueur = une ligne.
async function fetchAllStarList() {
  const r = await nodeFetch(WIKI_LIST_URL, { headers: { 'User-Agent': UA }, timeout: 15000 })
  if (!r.ok) throw new Error(`Wikipedia ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  // Verifie via node scripts/_inspect si la structure change un jour -- a ce
  // jour (verifie manuellement) c'est la 2e table.wikitable de la page.
  const table = $('table.wikitable').eq(1)
  const players = []
  const seen = new Set()
  table.find('tr').each((i, tr) => {
    if (i === 0) return
    const link = $(tr).find('th a, td a').first()
    const href = link.attr('href') || ''
    const m = /\/wiki\/([^#]+)$/.exec(href)
    if (!m) return
    // Wikipedia desambigue les noms courants via un suffixe d'URL, ex.
    // "Joe_Johnson_(basketball)" -- sans le retirer, la recherche ESPN par
    // nom echoue et le joueur finit "sans date de naissance trouvee".
    const name = decodeURIComponent(m[1]).replace(/_/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim()
    if (seen.has(name)) return
    seen.add(name)
    const selectionsText = $(tr).find('td').eq(1).text().trim()
    const selections = parseInt(selectionsText) || 1
    players.push({ name, selections })
  })
  return players
}

// Top 500 SLAM (basketball-reference.com/awards/slam_500_greatest.html) --
// comble les joueurs marquants jamais selectionnes All-Star (rare mais existe,
// ex: certains role players historiques cites pour d'autres raisons). Noms en
// texte brut (data-stat="player"), pas de selections/annees a en tirer.
async function fetchSlam500List() {
  const r = await nodeFetch(SLAM_500_URL, { headers: { 'User-Agent': BROWSER_UA }, timeout: 15000 })
  if (!r.ok) throw new Error(`basketball-reference ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const players = []
  $('table#stats tbody tr').each((_, tr) => {
    const name = $(tr).find('[data-stat="player"]').first().text().trim()
    if (name) players.push({ name, selections: 0 })
  })
  return players
}

// Top 1000 all-time (nbahoopsonline.com) -- simple liste <li> en texte brut,
// tout sur une seule page (20 sections de 50 classees "Ranks X-Y").
async function fetchTop1000List() {
  const r = await nodeFetch(TOP_1000_URL, { headers: { 'User-Agent': BROWSER_UA }, timeout: 15000 })
  if (!r.ok) throw new Error(`nbahoopsonline ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const players = []
  $('li').each((_, li) => {
    const name = $(li).text().trim()
    if (name) players.push({ name, selections: 0 })
  })
  return players
}

// Roster actuel complet (30 franchises via ESPN) -- les 3 sources ci-dessus
// ne couvrent que les joueurs marquants (All-Stars, classements all-time) ;
// beaucoup de joueurs actifs aujourd'hui n'y figurent pas encore. stats.nba.com
// (utilise pour les retraites, voir fetchNbaCdnFallback) timeout de facon
// repetee sur commonallplayers?IsOnlyCurrentSeason=1 dans cet environnement --
// ESPN s'est montre fiable partout ailleurs dans ce script, on l'utilise ici.
async function fetchCurrentRosterList() {
  const r = await nodeFetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams', { timeout: 10000 })
  if (!r.ok) throw new Error(`ESPN teams ${r.status}`)
  const data = await r.json()
  const teamIds = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => t.team.id)

  const rosters = await Promise.all(teamIds.map(async id => {
    try {
      const rr = await nodeFetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/roster`, { timeout: 10000 })
      if (!rr.ok) return []
      const rd = await rr.json()
      return (rd?.athletes || []).map(a => a.fullName).filter(Boolean)
    } catch { return [] }
  }))
  return [...new Set(rosters.flat())].map(name => ({ name, selections: 0 }))
}

// ── ESPN / NBA / Wikipedia — duplique la logique de src/lib/espnHeadshot.ts
// (impossible d'importer ce module TS/ESM depuis ce script CommonJS) ────────
function normName(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '') // "J.R." -> "JR" (pas "J R") -- sinon ne matche jamais le "JR Smith" sans points d'ESPN
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ESPN rate-limite au volume qu'envoie ce script (des joueurs pourtant
// notoirement presents sur ESPN, ex. Jimmy Butler, ressortaient "introuvable"
// en pratique) -- 3 essais avec backoff avant d'abandonner vraiment, plutot
// que de traiter un simple 429/timeout transitoire comme une absence de donnee.
async function fetchJsonRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await nodeFetch(url, { timeout: 10000 })
      if (r.ok) return await r.json()
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue }
      return null // 404 etc. -- pas la peine de retenter
    } catch {
      if (i < attempts - 1) await sleep(1500 * (i + 1))
    }
  }
  return null
}

async function findEspnAthlete(name) {
  const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player&sport=basketball`
  const data = await fetchJsonRetry(url)
  if (!data) return null
  const target = normName(name)
  let exactFallback = null
  let bestGuess = null // 1er resultat NBA quel que soit le nom -- ESPN classe deja par pertinence
  for (const section of data.results ?? []) {
    for (const a of section.contents ?? []) {
      if (!a.displayName || !a.uid) continue
      const m = /a:(\d+)/.exec(a.uid)
      if (!m) continue
      const hit = { id: m[1], photo: a.image?.default || null }
      if (a.defaultLeagueSlug === 'nba' && !bestGuess) bestGuess = hit
      if (normName(a.displayName) !== target) continue
      if (a.defaultLeagueSlug === 'nba') return hit
      if (!exactFallback) exactFallback = hit
    }
  }
  // Surnom vs nom legal (ex. "Rip Hamilton" -> ESPN liste "Richard Hamilton") :
  // aucun nom ne matche exactement, mais le tout premier resultat NBA de la
  // recherche ESPN (deja trie par pertinence pour la requete envoyee) est un
  // bien meilleur pari que d'abandonner et de marquer le joueur "introuvable".
  return exactFallback || bestGuess
}

async function fetchEspnBirthDate(espnId) {
  try {
    const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/athletes/${espnId}?lang=en&region=us`
    const data = await fetchJsonRetry(url)
    return data?.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : null
  } catch { return null }
}

// stats.nba.com s'est montre peu fiable (timeout repete) dans cet environnement
// -- une seule tentative pour tout le run (jamais retentee, meme en echec),
// sinon chaque joueur ancien sans fiche ESPN attendait un nouveau timeout de
// 15s en pure perte (le cache ne se posait jamais puisque l'exception coupait
// avant l'assignation). nbaAllPlayersAttempted distingue "pas encore essaye"
// de "essaye et vide", sans quoi un echec relancerait l'essai a chaque appel.
let nbaAllPlayersCache = null
let nbaAllPlayersAttempted = false
async function fetchNbaCdnFallback(name) {
  if (!nbaAllPlayersAttempted) {
    nbaAllPlayersAttempted = true
    try {
      const r = await nodeFetch('https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.nba.com/', 'Accept': 'application/json, text/plain, */*',
          'x-nba-stats-origin': 'stats', 'x-nba-stats-token': 'true',
        },
        timeout: 6000,
      })
      const data = r.ok ? await r.json() : null
      nbaAllPlayersCache = data?.resultSets?.[0]?.rowSet ?? []
    } catch { nbaAllPlayersCache = [] }
  }
  try {
    const hit = (nbaAllPlayersCache || []).find(row => normName(row[2] || '') === normName(name))
    if (!hit) return null
    return { id: hit[0], photo: `https://cdn.nba.com/headshots/nba/latest/1040x760/${hit[0]}.png` }
  } catch { return null }
}

// Pour un nom trop generique (ex. "Kevin Johnson" -- homme politique ET
// basketteur, page Wikipedia directe = homonymie), la recherche plein-texte
// Wikipedia avec un indice de sport trouve fiablement la bonne page en 1er
// resultat, la ou une simple resolution de titre echoue.
async function searchWikipediaBasketballPage(name) {
  try {
    const q = encodeURIComponent(`${name} basketball player`)
    const r = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r.ok) return null
    const data = await r.json()
    return data.query?.search?.[0]?.title || null
  } catch { return null }
}

// Surnom vs nom legal ESPN (ex. "Rip Hamilton" -> ESPN ne connait que
// "Richard Hamilton") : Wikipedia resout deja ses propres redirections
// (page "Rip Hamilton" -> page "Richard Hamilton (basketball)"), on
// reutilise ce graphe plutot que de maintenir une table d'alias a la main.
// Un nom trop generique retombe sur une page d'homonymie (pas exploitable
// directement) -- on relance alors via la recherche plein-texte ci-dessus.
async function resolveWikipediaCanonicalName(name) {
  try {
    const title = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
    const r = await nodeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    let resolvedTitle = null
    if (r.ok) {
      const data = await r.json()
      if (data.title && data.type !== 'disambiguation') resolvedTitle = data.title
    }
    if (!resolvedTitle) resolvedTitle = await searchWikipediaBasketballPage(name)
    if (!resolvedTitle || resolvedTitle === name) return null
    // Le suffixe de desambiguation ("(basketball)") fait justement toute la
    // difference pour retrouver la bonne page -- le garder ici (contrairement
    // au nettoyage fait ailleurs sur les noms d'AFFICHAGE) : sans lui,
    // "Kevin McHale (basketball)" redeviendrait "Kevin McHale", identique au
    // nom d'origine, et la resolution serait jetee comme "sans changement"
    // alors que la page d'origine etait une homonymie inexploitable.
    return resolvedTitle
  } catch { return null }
}

async function fetchWikipediaHeadshot(name) {
  try {
    const title = encodeURIComponent(name.trim().replace(/\s+/g, '_'))
    const r = await nodeFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (r.ok) {
      const data = await r.json()
      const img = data.thumbnail?.source || data.originalimage?.source || null
      if (img) return img
    }
    // Repli pageimages -- trouve parfois l'image d'infobox alors que l'API
    // REST summary ci-dessus renvoie thumbnail:null pour la meme page.
    const r2 = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&pithumbsize=500&format=json`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r2.ok) return null
    const data2 = await r2.json()
    const page = Object.values(data2.query?.pages || {})[0]
    return page?.thumbnail?.source || null
  } catch { return null }
}

// Dernier recours pour la date de naissance quand ESPN n'a pas de fiche
// (surtout les tres vieux joueurs BAA/NBA 1940-60 du Top 1000) -- Wikidata
// (donnee structuree P569 "date de naissance") couvre quasiment tout ce qui
// a une page Wikipedia, meme les joueurs les plus obscurs.
async function fetchWikidataBirthDate(name) {
  try {
    const title = encodeURIComponent(name.trim())
    const r = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageprops&ppprop=wikibase_item&format=json`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r.ok) return null
    const data = await r.json()
    const page = Object.values(data.query?.pages || {})[0]
    const qid = page?.pageprops?.wikibase_item
    if (!qid) return null
    const r2 = await nodeFetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r2.ok) return null
    const wd = await r2.json()
    const time = wd.entities?.[qid]?.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time
    if (!time) return null
    // Format Wikidata : "+1930-04-05T00:00:00Z" -- garde juste AAAA-MM-JJ.
    // Precision "annee seulement" possible (jour/mois a 00-00 ou 01-01
    // fictifs) -- on filtre les entrees clairement non-datees (00-00).
    const m = /^\+(\d{4})-(\d{2})-(\d{2})/.exec(time)
    if (!m || m[2] === '00' || m[3] === '00') return null
    return `${m[1]}-${m[2]}-${m[3]}`
  } catch { return null }
}

async function backfillOne(name) {
  let birthDate = null
  let headshot = null
  let canonical = null // nom resolu via Wikipedia (surnom/nom generique -> nom legal/page precise)

  let espn = await findEspnAthlete(name)
  if (!espn) {
    canonical = await resolveWikipediaCanonicalName(name)
    if (canonical) espn = await findEspnAthlete(canonical)
  }
  if (espn) {
    headshot = espn.photo
    birthDate = await fetchEspnBirthDate(espn.id)
  }
  // Photo/date encore manquante malgre ESPN (trouve mais sans image, ou
  // date absente de sa fiche) -- resout le nom canonique meme si ESPN a
  // repondu, au lieu de le faire seulement quand ESPN echoue completement.
  if ((!headshot || !birthDate) && !canonical) canonical = await resolveWikipediaCanonicalName(name)

  if (!headshot) {
    const nba = await fetchNbaCdnFallback(name)
    if (nba) headshot = nba.photo
    if (!headshot && canonical) {
      const nba2 = await fetchNbaCdnFallback(canonical)
      if (nba2) headshot = nba2.photo
    }
  }
  if (!headshot) headshot = await fetchWikipediaHeadshot(name)
  if (!headshot && canonical) headshot = await fetchWikipediaHeadshot(canonical)
  if (!birthDate) birthDate = await fetchWikidataBirthDate(name)
  if (!birthDate && canonical) birthDate = await fetchWikidataBirthDate(canonical)

  return { birthDate, headshot }
}

// Fusionne les 3 sources en dedupliquant par nom normalise (accents/casse/
// ponctuation ignores) -- garde le nombre de selections All-Star le plus
// eleve rencontre pour un meme joueur (les 2 autres sources n'en fournissent
// pas, donc n'ecrasent jamais une vraie valeur Wikipedia par 0).
function mergeSources(lists) {
  const byKey = new Map()
  for (const list of lists) {
    for (const p of list) {
      const key = normName(p.name)
      if (!key) continue
      const existing = byKey.get(key)
      if (!existing) byKey.set(key, p)
      else if (p.selections > existing.selections) byKey.set(key, { ...existing, selections: p.selections })
    }
  }
  return [...byKey.values()]
}

async function main() {
  console.log('Recuperation des 4 listes sources...')
  const [allStars, slam500, top1000, currentRoster] = await Promise.all([
    fetchAllStarList().catch(e => { console.error('Wikipedia All-Stars:', e.message); return [] }),
    fetchSlam500List().catch(e => { console.error('SLAM 500:', e.message); return [] }),
    fetchTop1000List().catch(e => { console.error('Top 1000:', e.message); return [] }),
    fetchCurrentRosterList().catch(e => { console.error('Roster actuel (ESPN):', e.message); return [] }),
  ])
  console.log(`Wikipedia All-Stars: ${allStars.length} | SLAM 500: ${slam500.length} | Top 1000: ${top1000.length} | Roster actuel: ${currentRoster.length}`)
  let players = mergeSources([allStars, slam500, top1000, currentRoster])
  console.log(`${players.length} joueurs uniques apres fusion/dedoublonnage des 4 listes.`)

  let existingByName = new Map()
  if (!FORCE) {
    const { data: existing } = await supabase.from('nba_allstar_birthdays').select('player_name, birth_date, headshot_url')
    existingByName = new Map((existing || []).map(r => [r.player_name, r]))
    // Retente un joueur deja en base seulement s'il lui manque encore la
    // photo (birth_date est NOT NULL en base -- une ligne existante l'a
    // forcement deja) -- sans quoi les centaines de joueurs deja complets
    // seraient reinterroges pour rien a chaque relance du script.
    const before = players.length
    players = players.filter(p => {
      const ex = existingByName.get(p.name)
      return !ex || !ex.headshot_url
    })
    console.log(`${players.length}/${before} a traiter (nouveaux + deja-presents sans photo).`)
  }
  if (LIMIT) players = players.slice(0, LIMIT)

  let ok = 0
  const missing = []
  for (const [i, p] of players.entries()) {
    process.stdout.write(`[${i + 1}/${players.length}] ${p.name}... `)
    const existingRow = existingByName.get(p.name)
    const { birthDate, headshot } = await backfillOne(p.name)
    // Ne jamais ecraser une date deja connue par un echec transitoire de cette
    // passe -- birth_date est NOT NULL en base, un upsert a null echouerait
    // de toute facon, mais autant garder la vraie valeur explicitement.
    const finalBirthDate = birthDate || existingRow?.birth_date || null
    const finalHeadshot = headshot || existingRow?.headshot_url || null
    if (!finalBirthDate) {
      missing.push(p.name)
      console.log('SANS date de naissance trouvee (skip)')
    } else {
      const [y, m, d] = finalBirthDate.split('-').map(Number)
      console.log(`OK (${finalBirthDate}${finalHeadshot ? ', photo trouvee' : ', SANS photo'})`)
      if (!DRY_RUN) {
        const { error } = await supabase.from('nba_allstar_birthdays').upsert({
          player_name: p.name,
          birth_date: finalBirthDate,
          birth_month: m,
          birth_day: d,
          all_star_count: p.selections,
          headshot_url: finalHeadshot,
        }, { onConflict: 'player_name' })
        if (error) console.log(`   -> erreur DB: ${error.message}`)
      }
      ok++
    }
    await sleep(700) // courtoisie envers ESPN / stats.nba.com / Wikipedia -- ESPN rate-limite au-dela
  }

  console.log(`\nTermine. ${ok} inseres/mis a jour, ${missing.length} toujours sans date de naissance.`)
  if (missing.length > 0) console.log('Joueurs sans date (a completer manuellement si besoin) :\n' + missing.join(', '))
}

main().catch(e => { console.error(e); process.exit(1) })
