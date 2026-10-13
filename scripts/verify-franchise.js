// Repere dans la liste d'une franchise NBA (src/data/franchise/<slug>.json) les joueurs qui n'ont JAMAIS joue pour l'equipe : la liste vient de toutes
// les cartes dont le champ « equipe » porte ce nom, donc une erreur sur une carte (joueur photographie dans un autre maillot, carte d'un autre
// joueur...) suffit a l'y faire apparaitre. Pour chaque joueur peu represente (<= --max-n entrees, 3 par defaut), on lit l'historique d'equipes ESPN ;
// s'il existe et ne contient pas la franchise (ni son ancien nom), le joueur est signale.
// Prudence : un joueur introuvable chez ESPN, ou sans historique, est CONSERVE (jamais exclu sur un doute).
// Usage : node scripts/verify-franchise.js philadelphia-76ers            (affiche seulement)
//         node scripts/verify-franchise.js philadelphia-76ers --write    (ajoute les joueurs signales a src/data/franchise-exclude.json)
const fs = require('fs')
const path = require('path')

// mots-cles (dernier mot du nom d'equipe ESPN) acceptes pour chaque franchise : nom actuel + anciens noms. Large exprès : en cas de doute on garde le joueur.
const ALIASES = {
  'atlanta-hawks': ['hawks', 'blackhawks'], 'boston-celtics': ['celtics'], 'brooklyn-nets': ['nets'], 'charlotte-hornets': ['hornets', 'bobcats'],
  'chicago-bulls': ['bulls'], 'cleveland-cavaliers': ['cavaliers'], 'dallas-mavericks': ['mavericks'], 'denver-nuggets': ['nuggets'],
  'detroit-pistons': ['pistons'], 'golden-state-warriors': ['warriors'], 'houston-rockets': ['rockets'], 'indiana-pacers': ['pacers'],
  'los-angeles-clippers': ['clippers', 'braves'], 'los-angeles-lakers': ['lakers'], 'memphis-grizzlies': ['grizzlies'], 'miami-heat': ['heat'],
  'milwaukee-bucks': ['bucks'], 'minnesota-timberwolves': ['timberwolves'], 'new-orleans-pelicans': ['pelicans', 'hornets'], 'new-york-knicks': ['knicks'],
  'oklahoma-city-thunder': ['thunder', 'supersonics'], 'orlando-magic': ['magic'], 'philadelphia-76ers': ['76ers', 'nationals'], 'phoenix-suns': ['suns'],
  'portland-trail-blazers': ['blazers'], 'sacramento-kings': ['kings', 'royals'], 'san-antonio-spurs': ['spurs'], 'toronto-raptors': ['raptors'],
  'utah-jazz': ['jazz'], 'washington-wizards': ['wizards', 'bullets'],
}
const slug = process.argv[2]
const write = process.argv.includes('--write')
const maxN = Number((process.argv.find(a => a.startsWith('--max-n=')) || '--max-n=3').split('=')[1])
if (!slug || !ALIASES[slug]) { console.error('Usage : node scripts/verify-franchise.js <slug-franchise-NBA> [--write] [--max-n=3]\nFranchises : ' + Object.keys(ALIASES).join(', ')); process.exit(1) }

const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
      if (r.ok) return await r.json()
    } catch { /* retry */ }
    await sleep(600 * (i + 1))
  }
  return null
}

async function check(name, lastCardYear) {
  const s = await getJson(`https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=8&type=player&sport=basketball`)
  const hits = (s?.results || []).flatMap(x => x.contents || []).filter(a => a.displayName && norm(a.displayName) === norm(name) && /~l:46~/.test(a.uid || ''))
  if (!hits.length) return { status: 'inconnu', why: 'pas trouvé chez ESPN' }
  const results = []
  for (const h of hits.slice(0, 3)) {
    const id = (h.uid.match(/~a:(\d+)/) || [])[1]
    if (!id) continue
    const st = await getJson(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/stats`)
    const teams = Object.values(st?.teams || {}).map(t => norm(t.displayName || ''))
    const rows = (st?.categories || []).find(c => c.name === 'averages')?.statistics?.length || 0
    const firstSeason = parseInt(((st?.categories || []).find(c => c.name === 'averages')?.statistics?.[0]?.season?.displayName || '0').slice(0, 4), 10) || 0
    results.push({ id, teams, rows, firstSeason })
  }
  // homonyme : la carte date d'avant les debuts du joueur ESPN trouve (ex. Luke Jackson 1969 / un joueur des annees 2010) -> on ne conclut pas
  const withHistory = results.filter(r => r.teams.length > 0 && r.rows >= 2 && !(lastCardYear && r.firstSeason && lastCardYear < r.firstSeason - 1))
  if (!withHistory.length) return { status: 'inconnu', why: 'pas d’historique ESPN' }
  const ok = withHistory.some(r => r.teams.some(t => ALIASES[slug].includes(t.split(' ').slice(-1)[0])))
  return ok ? { status: 'ok' } : { status: 'absent', teams: withHistory[0].teams.join(', ') }
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(path.join('src', 'data', 'franchise', slug + '.json'), 'utf8'))
  const exFile = path.join('src', 'data', 'franchise-exclude.json')
  const ex = fs.existsSync(exFile) ? JSON.parse(fs.readFileSync(exFile, 'utf8')) : {}
  const already = new Set((ex[slug] || []).map(norm))
  const cand = rows.filter(r => r[3] <= maxN && !already.has(norm(r[0])))
  console.log(`${rows.length} joueurs, ${cand.length} à vérifier (<= ${maxN} entrées)`)
  const absent = [], unknown = []
  let i = 0, done = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < cand.length) {
      const r = cand[i++]
      const res = await check(r[0], r[2])
      if (res.status === 'absent') absent.push([r[0], r[1], r[2], res.teams])
      else if (res.status === 'inconnu') unknown.push([r[0], res.why])
      if (++done % 20 === 0) console.log('...', done, '/', cand.length)
      await sleep(150)
    }
  }))
  absent.sort((a, b) => a[0].localeCompare(b[0]))
  console.log(`\nN'ont jamais joué pour la franchise (${absent.length}) :`)
  for (const a of absent) console.log(`  ${a[0]}  (cartes ${a[1]}–${a[2]})  équipes ESPN : ${a[3]}`)
  console.log(`\nIntrouvables / sans historique, conservés (${unknown.length}) : ${unknown.map(u => u[0]).join(', ')}`)
  if (write && absent.length) {
    ex[slug] = [...new Set([...(ex[slug] || []), ...absent.map(a => a[0])])].sort((a, b) => a.localeCompare(b))
    fs.writeFileSync(exFile, JSON.stringify(ex, null, 2) + '\n')
    console.log(`\n${absent.length} nom(s) ajouté(s) à ${exFile}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
