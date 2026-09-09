#!/usr/bin/env node
/**
 * Backfill (une seule fois par sport) : Hall of Fame/legendes + roster actuel
 * -> table sports_birthdays (sport = 'nfl' | 'baseball' | 'hockey' | 'football').
 * Generalisation multi-sport de backfill-nba-allstar-birthdays.js (NBA garde
 * son propre script car ses sources/son repli sont specifiques). Alimente le
 * meme bot anniversaire Discord (voir src/app/api/cron/sports-birthday).
 *
 * Contrairement a la NBA, les rosters actuels ESPN des 4 sports ci-dessous
 * exposent directement dateOfBirth + headshot.href sur chaque athlete -- pas
 * besoin de repli ESPN-search/NBA-CDN pour ces joueurs. Le repli (ESPN
 * search -> Wikidata -> Wikipedia) ne sert que pour les joueurs HOF/legendes
 * absents des rosters actuels.
 *
 * Usage:
 *   node scripts/backfill-sport-birthdays.js --sport=nfl
 *   node scripts/backfill-sport-birthdays.js --sport=baseball --dry-run
 *   node scripts/backfill-sport-birthdays.js --sport=hockey --limit=10
 *   node scripts/backfill-sport-birthdays.js --sport=football --force
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
const SPORT = args.sport
const LIMIT = args.limit ? parseInt(args.limit) : null
const DRY_RUN = !!args['dry-run']
const FORCE = !!args.force

const SPORT_CONFIG = {
  nfl: {
    espnPath: 'football/nfl',
    wikiSearchHint: 'American football player',
    hofUrl: 'https://en.wikipedia.org/wiki/List_of_Pro_Football_Hall_of_Fame_inductees',
    // Pas de <th> sur cette page -- les vraies lignes d'intronise ont exactement
    // 5 cellules (Name/Position/Team(s)/Year Inducted/... selon la table) ;
    // verifie manuellement sur les 2 tables listant les intronises (index 1 et 2).
    hofTableIndexes: [1, 2],
    hofRowMinCells: 5,
    hofNameSelector: 'cells',
  },
  baseball: {
    espnPath: 'baseball/mlb',
    wikiSearchHint: 'baseball player',
    hofUrl: 'https://en.wikipedia.org/wiki/List_of_members_of_the_National_Baseball_Hall_of_Fame',
    hofTableIndexes: [2],
    hofNameSelector: 'th',
  },
  hockey: {
    espnPath: 'hockey/nhl',
    wikiSearchHint: 'ice hockey player',
    hofUrl: 'https://en.wikipedia.org/wiki/List_of_members_of_the_Hockey_Hall_of_Fame',
    hofTableIndexes: [1],
    hofNameSelector: 'th',
  },
  football: {
    // Pas un seul path ESPN -- top 5 ligues europeennes, voir SOCCER_LEAGUES.
    wikiSearchHint: 'footballer',
    hofUrl: "https://en.wikipedia.org/wiki/Ballon_d%27Or",
    hofTableIndexes: [1],
    hofNameSelector: 'lastlink',
  },
}

// Ligues + clubs phares -- limite le pool de joueurs actuels a ~200-250
// (objectif utilisateur "top 200 actuels pour le football, peut-etre") plutot
// que d'ingerer les ~28 clubs x 5 ligues (~700 joueurs) integralement.
const SOCCER_LEAGUES = [
  { slug: 'eng.1', clubs: ['Manchester City', 'Manchester United', 'Liverpool', 'Arsenal', 'Chelsea'] },
  { slug: 'esp.1', clubs: ['Real Madrid', 'Barcelona'] },
  { slug: 'ita.1', clubs: ['Juventus', 'Inter Milan'] },
  { slug: 'ger.1', clubs: ['Bayern Munich'] },
  { slug: 'fra.1', clubs: ['Paris SG'] },
]

if (!SPORT || !SPORT_CONFIG[SPORT]) {
  console.error(`--sport requis, un de: ${Object.keys(SPORT_CONFIG).join(', ')}`)
  process.exit(1)
}
const CFG = SPORT_CONFIG[SPORT]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const UA = 'Memorabilius/1.0 (https://memorabilius.fr; contact via le site)'

// ── HOF / legendes (Wikipedia) ──────────────────────────────────────────────
async function fetchHofList() {
  const r = await nodeFetch(CFG.hofUrl, { headers: { 'User-Agent': UA }, timeout: 15000 })
  if (!r.ok) throw new Error(`Wikipedia HOF ${r.status}`)
  const html = await r.text()
  const $ = cheerio.load(html)
  const players = []
  const seen = new Set()

  for (const idx of CFG.hofTableIndexes) {
    const table = $('table.wikitable').eq(idx)
    table.find('tr').each((i, tr) => {
      if (i === 0) return
      const cells = $(tr).find('td')
      let link
      if (CFG.hofNameSelector === 'th') {
        // MLB/NHL : la cellule identifiante reste un <th> meme au milieu du
        // tableau (survit aux rowspan de continuation, contrairement a un
        // comptage de cellules) -- name link dans ce <th>.
        const th = $(tr).find('th').first()
        if (!th.length) return
        link = th.find('a').first()
      } else if (CFG.hofNameSelector === 'lastlink') {
        // Ballon d'Or : le rowspan sur la colonne "annee" fait que les lignes
        // 2e/3e de chaque annee n'ont pas cette cellule -- l'indice de la
        // colonne joueur glisse donc (2 sur une ligne de 5, 1 sur une ligne de
        // 4). Constante en revanche : joueur = toujours 3e cellule en partant
        // de la fin (rang, club, points suivent un schema fixe). La cellule
        // contient aussi un lien drapeau/federation (texte vide) avant le vrai
        // lien nom -- prendre le lien au texte non-vide, pas .first().
        if (cells.length < 4) return
        const playerCell = $(cells[cells.length - 3])
        const candidates = playerCell.find('a').filter((_, a) => $(a).text().trim().length > 0)
        link = candidates.first()
      } else {
        // NFL : pas de <th>, les vraies lignes d'intronise ont un nombre de
        // cellules fixe (verifie manuellement = 5) ; les lignes de continuation
        // rowspan en ont moins.
        if (cells.length < CFG.hofRowMinCells) return
        link = $(cells[0]).find('a').first()
      }
      if (!link || !link.length) return
      const href = link.attr('href') || ''
      const m = /\/wiki\/([^#]+)$/.exec(href)
      if (!m) return
      const name = decodeURIComponent(m[1]).replace(/_/g, ' ').replace(/\s*\([^)]*\)\s*$/, '').trim()
      if (!name || seen.has(name)) return
      seen.add(name)
      players.push({ name, selections: 0 })
    })
  }
  return players
}

// ── Roster actuel (ESPN) ────────────────────────────────────────────────────
// dateOfBirth/headshot fournis directement -- pas de repli necessaire ici.
function toBirthDate(iso) {
  return iso ? String(iso).slice(0, 10) : null
}

async function fetchLeagueRoster(espnPath, teamFilter) {
  const r = await nodeFetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams`, { timeout: 10000 })
  if (!r.ok) throw new Error(`ESPN teams ${espnPath} ${r.status}`)
  const data = await r.json()
  let teams = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => t.team)
  if (teamFilter) {
    teams = teams.filter(t => teamFilter.some(name => t.displayName?.includes(name) || t.shortDisplayName?.includes(name) || t.name?.includes(name)))
  }

  const players = []
  for (const team of teams) {
    try {
      const rr = await nodeFetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${team.id}/roster`, { timeout: 10000 })
      if (!rr.ok) continue
      const rd = await rr.json()
      const athletesRaw = rd?.athletes || []
      // NFL/MLB/NHL : groupe par position (`[{items:[...]}]`). Soccer : plat
      // (`[{...}]` directement). On detecte via la presence de `.items`.
      const flat = athletesRaw.length && athletesRaw[0].items ? athletesRaw.flatMap(g => g.items || []) : athletesRaw
      for (const a of flat) {
        if (!a.fullName) continue
        players.push({
          name: a.fullName,
          selections: 0,
          birthDate: toBirthDate(a.dateOfBirth),
          headshot: a.headshot?.href || null,
        })
      }
      await sleep(200)
    } catch { /* team roster indisponible -- ignore, pas bloquant */ }
  }
  return players
}

async function fetchCurrentRosterList() {
  if (SPORT === 'football') {
    const perLeague = await Promise.all(SOCCER_LEAGUES.map(l => fetchLeagueRoster(`soccer/${l.slug}`, l.clubs).catch(e => { console.error(`soccer/${l.slug}:`, e.message); return [] })))
    return perLeague.flat()
  }
  return fetchLeagueRoster(CFG.espnPath, null)
}

// ── Repli generique (ESPN search / Wikidata / Wikipedia) pour les joueurs HOF
// absents des rosters actuels -- duplique src/lib/espnHeadshot.ts (impossible
// d'importer ce module TS/ESM depuis ce script CommonJS), generalise par sport
// (chemin ESPN + indice de recherche Wikipedia) par rapport a la version NBA. ─
function normName(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fetchJsonRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await nodeFetch(url, { timeout: 10000 })
      if (r.ok) return await r.json()
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (i + 1)); continue }
      return null
    } catch {
      if (i < attempts - 1) await sleep(1500 * (i + 1))
    }
  }
  return null
}

const ESPN_SEARCH_SPORT = { nfl: 'football', baseball: 'baseball', hockey: 'hockey', football: 'soccer' }
const ESPN_LEAGUE_SLUG = { nfl: 'nfl', baseball: 'mlb', hockey: 'nhl' } // football (soccer) n'a pas une ligue unique, voir findEspnAthlete

async function findEspnAthlete(name) {
  const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player&sport=${ESPN_SEARCH_SPORT[SPORT]}`
  const data = await fetchJsonRetry(url)
  if (!data) return null
  const target = normName(name)
  let exactFallback = null
  let bestGuess = null
  for (const section of data.results ?? []) {
    for (const a of section.contents ?? []) {
      if (!a.displayName || !a.uid) continue
      const m = /a:(\d+)/.exec(a.uid)
      if (!m) continue
      const hit = { id: m[1], leagueSlug: a.defaultLeagueSlug, photo: a.image?.default || null }
      const leagueOk = SPORT === 'football' || a.defaultLeagueSlug === ESPN_LEAGUE_SLUG[SPORT]
      if (leagueOk && !bestGuess) bestGuess = hit
      if (normName(a.displayName) !== target) continue
      if (leagueOk) return hit
      if (!exactFallback) exactFallback = hit
    }
  }
  return exactFallback || bestGuess
}

async function fetchEspnBirthDate(athlete) {
  try {
    const leagueSlug = SPORT === 'football' ? (athlete.leagueSlug || 'eng.1') : ESPN_LEAGUE_SLUG[SPORT]
    const sportPath = SPORT === 'football' ? 'soccer' : ESPN_SEARCH_SPORT[SPORT]
    const url = `https://sports.core.api.espn.com/v2/sports/${sportPath}/leagues/${leagueSlug}/athletes/${athlete.id}?lang=en&region=us`
    const data = await fetchJsonRetry(url)
    return data?.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : null
  } catch { return null }
}

async function searchWikipediaPage(name) {
  try {
    const q = encodeURIComponent(`${name} ${CFG.wikiSearchHint}`)
    const r = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}&format=json&srlimit=3`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r.ok) return null
    const data = await r.json()
    return data.query?.search?.[0]?.title || null
  } catch { return null }
}

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
    if (!resolvedTitle) resolvedTitle = await searchWikipediaPage(name)
    if (!resolvedTitle || resolvedTitle === name) return null
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
    const r2 = await nodeFetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&pithumbsize=500&format=json`, {
      headers: { 'User-Agent': UA }, timeout: 8000,
    })
    if (!r2.ok) return null
    const data2 = await r2.json()
    const page = Object.values(data2.query?.pages || {})[0]
    return page?.thumbnail?.source || null
  } catch { return null }
}

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
    const m = /^\+(\d{4})-(\d{2})-(\d{2})/.exec(time)
    if (!m || m[2] === '00' || m[3] === '00') return null
    return `${m[1]}-${m[2]}-${m[3]}`
  } catch { return null }
}

async function backfillOne(name) {
  let birthDate = null
  let headshot = null
  let canonical = null

  let espn = await findEspnAthlete(name)
  if (!espn) {
    canonical = await resolveWikipediaCanonicalName(name)
    if (canonical) espn = await findEspnAthlete(canonical)
  }
  if (espn) {
    headshot = espn.photo
    birthDate = await fetchEspnBirthDate(espn)
  }
  if ((!headshot || !birthDate) && !canonical) canonical = await resolveWikipediaCanonicalName(name)

  if (!headshot) headshot = await fetchWikipediaHeadshot(name)
  if (!headshot && canonical) headshot = await fetchWikipediaHeadshot(canonical)
  if (!birthDate) birthDate = await fetchWikidataBirthDate(name)
  if (!birthDate && canonical) birthDate = await fetchWikidataBirthDate(canonical)

  return { birthDate, headshot }
}

function mergeSources(lists) {
  const byKey = new Map()
  for (const list of lists) {
    for (const p of list) {
      const key = normName(p.name)
      if (!key) continue
      const existing = byKey.get(key)
      if (!existing) byKey.set(key, p)
      // Le roster actuel fournit deja birthDate/headshot -- ne jamais laisser
      // une entree HOF (sans ces champs) ecraser une entree roster complete.
      else if (!existing.birthDate && p.birthDate) byKey.set(key, p)
    }
  }
  return [...byKey.values()]
}

async function main() {
  console.log(`[${SPORT}] Recuperation HOF/legendes (Wikipedia) + roster actuel (ESPN)...`)
  const [hof, roster] = await Promise.all([
    fetchHofList().catch(e => { console.error('HOF Wikipedia:', e.message); return [] }),
    fetchCurrentRosterList().catch(e => { console.error('Roster ESPN:', e.message); return [] }),
  ])
  console.log(`HOF/legendes: ${hof.length} | Roster actuel: ${roster.length}`)
  let players = mergeSources([hof, roster])
  console.log(`${players.length} joueurs uniques apres fusion/dedoublonnage.`)

  let existingByName = new Map()
  if (!FORCE) {
    const { data: existing } = await supabase.from('sports_birthdays').select('player_name, birth_date, headshot_url').eq('sport', SPORT)
    existingByName = new Map((existing || []).map(r => [r.player_name, r]))
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

    let birthDate = p.birthDate || null
    let headshot = p.headshot || null
    // Roster actuel fournit deja les 2 -- le repli complet (lent, plusieurs
    // appels HTTP) ne sert que pour les entrees HOF sans ces champs.
    if (!birthDate || !headshot) {
      const filled = await backfillOne(p.name)
      birthDate = birthDate || filled.birthDate
      headshot = headshot || filled.headshot
      await sleep(700) // courtoisie ESPN/Wikipedia -- uniquement quand on appelle vraiment ces API
    }

    const finalBirthDate = birthDate || existingRow?.birth_date || null
    const finalHeadshot = headshot || existingRow?.headshot_url || null
    if (!finalBirthDate) {
      missing.push(p.name)
      console.log('SANS date de naissance trouvee (skip)')
    } else {
      const [y, m, d] = finalBirthDate.split('-').map(Number)
      console.log(`OK (${finalBirthDate}${finalHeadshot ? ', photo trouvee' : ', SANS photo'})`)
      if (!DRY_RUN) {
        const { error } = await supabase.from('sports_birthdays').upsert({
          player_name: p.name,
          sport: SPORT,
          birth_date: finalBirthDate,
          birth_month: m,
          birth_day: d,
          all_star_count: p.selections,
          headshot_url: finalHeadshot,
        }, { onConflict: 'player_name,sport' })
        if (error) console.log(`   -> erreur DB: ${error.message}`)
      }
      ok++
    }
  }

  console.log(`\n[${SPORT}] Termine. ${ok} inseres/mis a jour, ${missing.length} toujours sans date de naissance.`)
  if (missing.length > 0) console.log('Joueurs sans date (a completer manuellement si besoin) :\n' + missing.join(', '))
}

main().catch(e => { console.error(e); process.exit(1) })
