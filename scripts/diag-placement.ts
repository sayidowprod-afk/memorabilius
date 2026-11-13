// Diagnostic (lecture seule) : pourquoi des cartes d'un membre ne se rangent pas toutes seules dans les setlists ?
//   npx tsx scripts/diag-placement.ts <pseudo> [nombre de cartes à tester]
import fs from 'fs'
import { candidatesForCard, pickEntry, setCouldMatchCard, norm, type MCard, type MEntry, type MSet } from '../src/lib/setMatcher'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const U = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
const get = async (q: string) => { const r = await fetch(U + q, { headers: H }); const d = await r.json(); if (!Array.isArray(d)) throw new Error(q.slice(0, 90) + ' → ' + JSON.stringify(d).slice(0, 140)); return d as any[] }

async function main() {
  const pseudo = process.argv[2] || 'GKNNN'
  const N = parseInt(process.argv[3] || '300')
  const prof = (await get('profiles?select=id,display_name&display_name=ilike.' + encodeURIComponent(pseudo + '*') + '&limit=3'))[0]
  if (!prof) throw new Error('membre introuvable')
  const cards: any[] = []
  for (let o = 0; o < 20000; o += 1000) { const p = await get('cartes_manuelles?select=nom,annee,marque,collection,collection_tag,variation,card_number,jeu&user_id=eq.' + prof.id + '&order=created_at.desc&limit=1000&offset=' + o); cards.push(...p); if (p.length < 1000) break }
  const sport = cards.filter(c => !c.jeu)
  console.log(prof.display_name + ' : ' + cards.length + ' cartes (' + sport.length + ' de sport)')
  const sample = sport.sort(() => Math.random() - 0.5).slice(0, N)

  const cat: Record<string, number> = { 'placée toute seule': 0, 'sans collection': 0, 'sans année': 0, 'aucun set ne correspond (année / marque / produit)': 0, 'set trouvé mais ligne introuvable ou ambiguë': 0 }
  const ex: Record<string, string[]> = {}
  const note = (k: string, c: any, more = '') => { cat[k]++; (ex[k] = ex[k] || []).length < 6 && ex[k].push([c.nom, c.annee, c.marque, c.collection, c.variation, c.card_number].filter(Boolean).join(' · ') + more) }
  const setCache = new Map<string, MSet[]>()
  for (const c of sample as MCard[]) {
    const coll = (c.collection || c.collection_tag || '').trim()
    if (!coll) { note('sans collection', c); continue }
    const yr = parseInt(String(c.annee || '').slice(0, 4))
    if (!yr) { note('sans année', c); continue }
    const w = coll.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2)[0] || ''
    const key = yr + '|' + w
    if (!setCache.has(key)) setCache.set(key, await get('card_sets?select=id,name,year,brand&year=eq.' + yr + (w ? '&name=ilike.' + encodeURIComponent('*' + w + '*') : '') + '&limit=40'))
    const sets = setCache.get(key)!.filter(s => setCouldMatchCard(c, s))
    if (!sets.length) { note('aucun set ne correspond (année / marque / produit)', c); continue }
    let ok = false
    for (const s of sets) {
      const es = await get('card_set_entries?select=id,player_name,card_number,variation,set_id&set_id=eq.' + s.id + '&player_name=ilike.' + encodeURIComponent(String(c.nom).trim()) + '&limit=400')
      const m = new Map<number, MSet>([[s.id, s]])
      const e = pickEntry(candidatesForCard(c, es.filter(x => norm(x.player_name) === norm(c.nom)) as MEntry[], m))
      if (e) { ok = true; break }
    }
    if (ok) cat['placée toute seule']++
    else note('set trouvé mais ligne introuvable ou ambiguë', c, ' → ' + sets.map(s => s.name).join(' | '))
  }
  console.log('\nSur ' + sample.length + ' cartes de sport tirées au hasard :')
  for (const [k, v] of Object.entries(cat)) console.log('  ' + String(Math.round(v / sample.length * 100)).padStart(3) + ' %  ' + k + ' (' + v + ')')
  for (const [k, list] of Object.entries(ex)) { console.log('\nExemples — ' + k + ' :'); list.forEach(l => console.log('   · ' + l)) }
}
main().catch(e => { console.error('Échec : ' + e.message); process.exit(1) })
