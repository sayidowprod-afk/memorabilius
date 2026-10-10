// Genere src/data/franchise/<team-slug>.json : tous les joueurs ayant une carte recensee pour chaque franchise
// (nom, premiere/derniere saison, nombre d'entrees). La table card_set_entries est trop grosse pour un DISTINCT en direct
// (timeout), donc on la parcourt une fois par plages d'id (pagination par curseur) et on ecrit des JSON statiques.
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
      const { data } = await retry(() => sb.from('card_set_entries').select('id,player_name,team,set_id').gt('id', cur).lte('id', end).order('id').limit(1000))
      if (!data.length) break
      for (const e of data) {
        cur = e.id
        if (!e.team || !e.player_name) continue
        const s = setYear.get(e.set_id)
        let t = agg.get(e.team); if (!t) agg.set(e.team, t = new Map())
        let p = t.get(e.player_name); if (!p) t.set(e.player_name, p = { y0: 9999, y1: 0, n: 0, sport: s?.sport || '' })
        p.n++
        if (s?.year) { p.y0 = Math.min(p.y0, s.year); p.y1 = Math.max(p.y1, s.year) }
      }
      scanned += data.length
      if (scanned % 20000 < 1000) console.log('scanned', scanned)
    }
  }))
  const dir = path.join('src', 'data', 'franchise')
  fs.mkdirSync(dir, { recursive: true })
  let files = 0
  for (const [team, players] of agg) {
    const rows = [...players.entries()].map(([name, p]) => [name, p.y0 === 9999 ? 0 : p.y0, p.y1, p.n]).sort((a, b) => (a[1] || 9999) - (b[1] || 9999) || a[0].localeCompare(b[0]))
    fs.writeFileSync(path.join(dir, slugify(team) + '.json'), JSON.stringify(rows))
    files++
  }
  console.log('teams', files, 'entries', scanned)
}
main().catch(e => { console.error(e); process.exit(1) })
