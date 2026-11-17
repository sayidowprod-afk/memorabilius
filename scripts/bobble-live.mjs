// Données « en direct » des bobbleheads validés (OK) pour les pages joueurs : public/bobbleheads/live.json
// Usage : node scripts/bobble-live.mjs          (une fois)   |   node scripts/bobble-live.mjs --watch   (toutes les 10 s)
import fs from 'node:fs'
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) } catch { return d } }
function build() {
  const list = read('scripts/players-nba.json', []), flags = read('scripts/bobble-flags.json', {}), heads = read('public/bobbleheads/heads.json', {}), teams = read('public/bobbleheads/teams.json', {})
  const players = {}
  for (const p of list) {
    if (!flags[p.id]?.ok || !heads[p.id] || !teams[p.team]) continue
    let v = 0; try { v = Math.round(fs.statSync(`public/bobbleheads/${p.id}-head.webp`).mtimeMs) } catch { continue }
    players[p.id] = { name: p.name, team: p.team, num: String(p.num ?? ''), head: heads[p.id], v }
  }
  // tenues disponibles par équipe : domicile = team-<ABR>.webp ; les autres (ext, alt, leg) = team-<ABR>-<tenue>.webp avec leurs propres dimensions (teams.json, clé kits)
  // Anciennes équipes (BOB, SEA) : équipes à part entière, leurs tenues sont proposées à tous les joueurs (clé extra, ex. 'BOB-ext')
  const files = new Set(fs.readdirSync('public/bobbleheads'))
  for (const ab of Object.keys(teams)) {
    const { kits: raw = {}, ...base } = teams[ab]
    const kitMeta = {}
    for (const [k, m] of Object.entries(raw)) if (files.has(`team-${ab}-${k}.webp`)) kitMeta[k] = { ...m, src: `/bobbleheads/team-${ab}-${k}.webp` }
    teams[ab] = { ...base, kits: ['dom', ...Object.keys(kitMeta)], ...(Object.keys(kitMeta).length ? { kitMeta } : {}) }
  }
  const extra = {}
  for (const ab of ['BOB', 'SEA']) {
    const t = teams[ab]; if (!t || !files.has(`team-${ab}.webp`)) continue
    const { kits: _k, kitMeta: km = {}, name: _n, ...dom } = t
    extra[`${ab}-dom`] = { ...dom, src: `/bobbleheads/team-${ab}.webp` }
    for (const [k, m] of Object.entries(km)) extra[`${ab}-${k}`] = m
  }
  const out = JSON.stringify({ players, teams, extra })
  const f = 'public/bobbleheads/live.json'
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) { fs.writeFileSync(f, out); console.log(new Date().toLocaleTimeString('fr-FR'), Object.keys(players).length, 'bobbleheads validés') }
}
build()
if (process.argv.includes('--watch')) setInterval(build, 10000)
