// Contrôle des photos DÉJÀ enregistrées sur les lignes de setlist (card_set_entries.image_url et entry_images) :
// chaque photo doit venir d'une carte qui est EXACTEMENT cette ligne (règles de lib/setMatcher.ts). Sinon c'est une photo « d'un autre set ».
//   npx tsx scripts/audit-setlist-images.ts            -> simulation (n'écrit rien)
//   npx tsx scripts/audit-setlist-images.ts --apply    -> retire les photos fausses (sauvegarde d'abord dans scripts/year-data/)
import fs from 'fs'
import path from 'path'
import { matchesEntryExact, norm, type MEntry, type MSet } from '../src/lib/setMatcher'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const U = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
const APPLY = process.argv.includes('--apply')
const chunk = <T,>(a: T[], n: number) => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o }
const get = async (q: string) => { const r = await fetch(U + q, { headers: H }); const d = await r.json(); if (!Array.isArray(d)) throw new Error(q.slice(0, 80) + ' → ' + JSON.stringify(d).slice(0, 150)); return d as any[] }

type Card = { nom: string; annee: string | null; marque: string | null; collection: string | null; collection_tag: string | null; variation: string | null; card_number: string | null; image_recto: string }
const setCache = new Map<number, MSet>()
async function setsOf(ids: number[]) {
  const need = [...new Set(ids)].filter(i => !setCache.has(i))
  for (const part of chunk(need, 100)) for (const s of await get('card_sets?select=id,name,year,brand&id=in.(' + part.join(',') + ')')) setCache.set(s.id, s)
}
async function cardsOf(urls: string[]) {
  const m = new Map<string, Card>()
  for (const part of chunk([...new Set(urls)], 30)) for (const c of await get('cartes_manuelles?select=nom,annee,marque,collection,collection_tag,variation,card_number,image_recto&image_recto=in.(' + part.map(u => '"' + u + '"').join(',') + ')')) m.set(c.image_recto, c)
  return m
}
async function privateOf(urls: string[]) {
  const s = new Set<string>()
  for (const part of chunk([...new Set(urls)], 30)) for (const r of await get('cartes_privees?select=card_key&card_key=in.(' + part.map(u => '"' + u + '"').join(',') + ')')) s.add(r.card_key)
  return s
}

type Row = { entry_id: number; user_id?: string; image_url: string }
async function check(rows: Row[]) {
  const entries = new Map<number, any>()
  for (const part of chunk([...new Set(rows.map(r => r.entry_id))], 100)) for (const e of await get('card_set_entries?select=id,set_id,player_name,card_number,variation&id=in.(' + part.join(',') + ')')) entries.set(e.id, e)
  await setsOf([...entries.values()].map(e => e.set_id))
  const cards = await cardsOf(rows.map(r => r.image_url)), priv = await privateOf(rows.map(r => r.image_url))
  const bad: (Row & { why: string })[] = []
  for (const r of rows) {
    const e = entries.get(r.entry_id), c = cards.get(r.image_url)
    if (!e) { bad.push({ ...r, why: 'ligne introuvable' }); continue }
    if (priv.has(r.image_url)) { bad.push({ ...r, why: 'carte privée' }); continue }
    if (!c) { bad.push({ ...r, why: 'carte d’origine introuvable' }); continue }
    const set = setCache.get(e.set_id)
    if (!set) { bad.push({ ...r, why: 'set introuvable' }); continue }
    const me: MEntry = { id: e.id, player_name: e.player_name, card_number: e.card_number, variation: e.variation, set_id: e.set_id }
    if (norm(c.nom) !== norm(e.player_name)) bad.push({ ...r, why: 'autre joueur' })
    else if (!matchesEntryExact(c, me, set)) bad.push({ ...r, why: 'autre set ou autre parallèle (' + [c.annee, c.collection, c.variation].filter(Boolean).join(' · ') + ' ≠ ' + set.name + ' · ' + (e.variation || 'Base') + ')' })
  }
  return bad
}

async function main() {
  const report: Record<string, { total: number; bad: (Row & { why: string })[] }> = {}
  // 1) photo « publique » d'une ligne
  let total = 0
  const bad1: (Row & { why: string })[] = []
  // la colonne n'est pas indexée : on passe set par set (rapide), plusieurs sets en parallèle
  const setIds: number[] = []
  for (let o = 0; ; o += 1000) { const page = await get('card_sets?select=id&order=id&limit=1000&offset=' + o); setIds.push(...page.map(x => x.id)); if (page.length < 1000) break }
  let done = 0
  const found: Row[] = []
  const worker = async (ids: number[]) => {
    for (const id of ids) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try { const rows = await get('card_set_entries?select=id,image_url&set_id=eq.' + id + '&image_url=not.is.null&limit=2000'); found.push(...rows.map(r => ({ entry_id: r.id, image_url: r.image_url }))); break } catch { /* nouvel essai */ }
      }
      if (++done % 500 === 0) process.stdout.write('\r  sets parcourus : ' + done + ' / ' + setIds.length + ' · photos trouvées : ' + found.length)
    }
  }
  const lanes = 8
  await Promise.all(Array.from({ length: lanes }, (_, i) => worker(setIds.filter((_, k) => k % lanes === i))))
  total = found.length
  for (const part of chunk(found, 300)) bad1.push(...await check(part))
  report.card_set_entries = { total, bad: bad1 }
  // 2) photos par membre
  const all2: any[] = []
  for (let o = 0; ; o += 1000) { const page = await get('entry_images?select=entry_id,user_id,image_url&order=entry_id&limit=1000&offset=' + o); all2.push(...page); if (page.length < 1000) break }
  const bad2: (Row & { why: string })[] = []
  for (const part of chunk(all2 as Row[], 300)) bad2.push(...await check(part))
  report.entry_images = { total: all2.length, bad: bad2 }

  console.log('\n')
  for (const [k, v] of Object.entries(report)) {
    console.log(k + ' : ' + v.bad.length + ' fausses sur ' + v.total + ' (' + (v.total ? Math.round(v.bad.length / v.total * 100) : 0) + ' %)')
    const why: Record<string, number> = {}
    for (const b of v.bad) { const w = b.why.split(' (')[0]; why[w] = (why[w] || 0) + 1 }
    console.log('   raisons :', JSON.stringify(why))
    v.bad.slice(0, 4).forEach(b => console.log('   · ligne ' + b.entry_id + ' : ' + b.why.slice(0, 150)))
  }
  if (!APPLY) { console.log('\nSimulation : rien n’a été modifié. Relance avec --apply pour retirer les photos fausses.'); return }

  const file = path.join('scripts', 'year-data', 'audit-images-sauvegarde-' + Date.now() + '.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(report, null, 1))
  console.log('\nSauvegarde (pour revenir en arrière) : ' + file)
  for (const part of chunk(report.card_set_entries.bad, 100)) await fetch(U + 'card_set_entries?id=in.(' + part.map(b => b.entry_id).join(',') + ')', { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ image_url: null }) })
  for (const b of report.entry_images.bad) await fetch(U + 'entry_images?entry_id=eq.' + b.entry_id + '&user_id=eq.' + b.user_id, { method: 'DELETE', headers: H })
  console.log('Terminé : ' + report.card_set_entries.bad.length + ' photos de lignes retirées, ' + report.entry_images.bad.length + ' photos par membre retirées.')
}
main().catch(e => { console.error('\nÉchec : ' + e.message); process.exit(1) })
