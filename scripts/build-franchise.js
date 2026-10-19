// Genere src/data/franchise/<team-slug>.json : tous les joueurs ayant une carte recensee pour chaque franchise
// (nom, premiere/derniere saison, nombre d'entrees, au moins une carte auto). La table card_set_entries est trop
// grosse pour un DISTINCT en direct (timeout), donc on la parcourt une fois par plages d'id (pagination par
// curseur) et on ecrit des JSON statiques.
// Usage : node scripts/build-franchise.js   (lit .env.local, cle service-role)
const fs = require('fs')
const path = require('path')
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const slugify = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function retry(fn, n = 6) {
  for (let i = 0; ; i++) {
    const r = await fn()
    if (!r.error) return r
    if (i >= n) throw new Error(r.error.message)
    await new Promise(res => setTimeout(res, 1500 * (i + 1)))
  }
}

// Beaucoup de lignes ont un champ `team` corrompu : pas un nom d'equipe mais
// une description de lot/case-break ("1-10-boxes", "1-134-280-packs", "1-127-
// packs-tier-2-odds-1-675-packs"...) -- source bruitee (vraisemblablement un
// scraper d'annonces eBay de case-break qui a mal rempli ce champ). Un
// premier essai (seul filtre : longueur > 60) a quand meme laisse passer
// ~20 000 "franchises" fantomes, assez pour faire planter le build Vercel
// (OOM pendant la verification TypeScript, trop de fichiers/imports
// dynamiques). Heuristique plus large : on rejette tout ce qui ressemble a
// une description de lot plutot qu'a un nom d'equipe.
const GARBAGE_TEAM_RE = /\b(pack|packs|box|boxes|hobby|blaster|case|cases|break|breaks|odds|tier|hit|hits|retail|single|singles|total|lot)\b/i
function isGarbageTeam(team) {
  if (!team || team.length > 60) return true
  if (GARBAGE_TEAM_RE.test(team) && /\d/.test(team)) return true
  const digitish = (team.match(/[\d\-.,]/g) || []).length
  if (digitish / team.length > 0.35) return true
  return false
}

// Autre corruption frequente : le nom d'equipe est reponce 2-3 fois d'affilee
// sans separateur ("Philadelphia 76ersPhiladelphia 76ers") -- un scraper qui
// concatene plusieurs badges identiques. On replie a une seule occurrence
// avant d'agreger, sinon ces lignes se retrouvent dans un fichier a part au
// lieu de rejoindre la vraie franchise.
function collapseRepeatedTeamName(team) {
  // Cartes multi-joueurs ("dual"/"triple") : team = "Equipe A/Equipe B" (une
  // par joueur de la carte), identiques quand tous les joueurs sont de la
  // meme franchise -- "Philadelphia 76ers/Philadelphia 76ers".
  if (team.includes('/')) {
    const parts = [...new Set(team.split('/').map(p => p.trim()).filter(Boolean))]
    if (parts.length === 1) return parts[0]
  }
  const words = team.split(' ')
  for (const k of [2, 3, 4]) {
    if (words.length % k !== 0) continue
    const chunkLen = words.length / k
    const chunk = words.slice(0, chunkLen).join(' ')
    let same = true
    for (let i = 1; i < k && same; i++) same = words.slice(i * chunkLen, (i + 1) * chunkLen).join(' ') === chunk
    if (same && chunk) return chunk
  }
  return team
}

async function main() {
  // saisons des sets
  const setYear = new Map()
  for (let from = 0; ; from += 1000) {
    const { data } = await retry(() => sb.from('card_sets').select('id,year,sport').order('id').range(from, from + 999))
    data.forEach(s => setYear.set(s.id, s))
    if (data.length < 1000) break
  }
  console.log('sets', setYear.size)
  const { data: lo } = await retry(() => sb.from('card_set_entries').select('id').order('id').limit(1))
  const { data: hi } = await retry(() => sb.from('card_set_entries').select('id').order('id', { ascending: false }).limit(1))
  const min = lo[0].id, max = hi[0].id
  console.log('ids', min, max)
  const W = 8, step = Math.ceil((max - min + 1) / W)
  const agg = new Map() // team -> player -> {y0,y1,n,sport}
  let scanned = 0
  await Promise.all(Array.from({ length: W }, async (_, w) => {
    let cur = min + w * step - 1
    const end = Math.min(max, min + (w + 1) * step - 1)
    while (cur < end) {
      const { data } = await retry(() => sb.from('card_set_entries').select('id,player_name,team,set_id,is_auto').gt('id', cur).lte('id', end).order('id').limit(1000))
      if (!data.length) break
      for (const e of data) {
        cur = e.id
        if (!e.player_name || isGarbageTeam(e.team)) continue
        const team = collapseRepeatedTeamName(e.team)
        const s = setYear.get(e.set_id)
        let t = agg.get(team); if (!t) agg.set(team, t = new Map())
        let p = t.get(e.player_name); if (!p) t.set(e.player_name, p = { y0: 9999, y1: 0, n: 0, sport: s?.sport || '', auto: false })
        p.n++
        if (e.is_auto) p.auto = true
        if (s?.year) { p.y0 = Math.min(p.y0, s.year); p.y1 = Math.max(p.y1, s.year) }
      }
      scanned += data.length
      if (scanned % 20000 < 1000) console.log('scanned', scanned)
    }
  }))
  const dir = path.join('src', 'data', 'franchise')
  fs.mkdirSync(dir, { recursive: true })
  let files = 0
  // Seuil minimum de joueurs distincts : une vraie franchise, meme modeste,
  // en accumule au moins quelques-uns sur l'ensemble des sets scrapes --
  // en dessous, c'est presque toujours un "nom d'equipe" corrompu (SKU de
  // carte, description de lot...) qui n'apparait que sur 1-4 lignes.
  // Sans ce filtre : ~20 500 fichiers generes (dont ~16 000 avec 1 seul
  // joueur), assez pour faire planter le build Vercel par manque de
  // memoire. Avec : ~4 300, toutes de vraies franchises verifiees.
  const MIN_PLAYERS = 5
  for (const [team, players] of agg) {
    if (players.size < MIN_PLAYERS) continue
    const rows = [...players.entries()].map(([name, p]) => [name, p.y0 === 9999 ? 0 : p.y0, p.y1, p.n, p.auto]).sort((a, b) => (a[1] || 9999) - (b[1] || 9999) || a[0].localeCompare(b[0]))
    fs.writeFileSync(path.join(dir, slugify(team) + '.json'), JSON.stringify(rows))
    files++
  }
  console.log('teams', files, 'entries', scanned)
}
main().catch(e => { console.error(e); process.exit(1) })
