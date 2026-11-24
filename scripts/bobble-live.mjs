// Données « en direct » des bobbleheads pour les pages joueurs : public/bobbleheads/live.json (basket, têtes validées OK) et public/bobbleheads/mlb/live.json (baseball, toutes les têtes faites)
// Usage : node scripts/bobble-live.mjs          (une fois)   |   node scripts/bobble-live.mjs --watch   (toutes les 10 s)
import fs from 'node:fs'
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')) } catch { return d } }

// dir : dossier des images ('public/bobbleheads' ou 'public/bobbleheads/mlb'), url : même dossier côté site, needOk : seules les têtes validées (OK) sont publiées
function make({ list, dir, url, needOk, extraTeams }) {
  const flags = read('scripts/bobble-flags.json', {}), heads = read(`${dir}/heads.json`, {}), teams = read(`${dir}/teams.json`, {})
  const players = {}
  for (const p of list) {
    if ((needOk && !flags[p.id]?.ok) || !heads[p.id] || !teams[p.team]) continue
    let v = 0; try { v = Math.round(fs.statSync(`${dir}/${p.id}-head.webp`).mtimeMs) } catch { continue }
    players[p.id] = { name: p.name, team: p.team, num: String(p.num ?? ''), head: heads[p.id], v }
  }
  // tenues disponibles par équipe : domicile = team-<ABR>.webp ; les autres (ext, alt, leg) = team-<ABR>-<tenue>.webp avec leurs propres dimensions (teams.json, clé kits)
  // Anciennes équipes (BOB, SEA) : équipes à part entière, leurs tenues sont proposées à tous les joueurs (clé extra, ex. 'BOB-ext')
  const files = new Set(fs.readdirSync(dir))
  for (const ab of Object.keys(teams)) {
    const { kits: raw = {}, ...base } = teams[ab]
    const kitMeta = {}
    const mt = f => { try { return Math.round(fs.statSync(`${dir}/${f}`).mtimeMs) } catch { return 0 } }
    for (const [k, m] of Object.entries(raw)) if (files.has(`team-${ab}-${k}.webp`)) kitMeta[k] = { ...m, src: `${url}/team-${ab}-${k}.webp?v=${mt(`team-${ab}-${k}.webp`)}` }
    teams[ab] = { ...base, v: mt(`team-${ab}.webp`), kits: ['dom', ...Object.keys(kitMeta)], ...(Object.keys(kitMeta).length ? { kitMeta } : {}) }
  }
  const extra = {}
  for (const ab of extraTeams) {
    const t = teams[ab]; if (!t || !files.has(`team-${ab}.webp`)) continue
    const { kits: _k, kitMeta: km = {}, name: _n, ...dom } = t
    extra[`${ab}-dom`] = { ...dom, src: `${url}/team-${ab}.webp?v=${t.v || 1}` }
    for (const [k, m] of Object.entries(km)) extra[`${ab}-${k}`] = m
  }
  const out = JSON.stringify({ players, teams, extra })
  const f = `${dir}/live.json`
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== out) { fs.writeFileSync(f, out); console.log(new Date().toLocaleTimeString('fr-FR'), dir, Object.keys(players).length, 'bobbleheads publiés') }
}
function build() {
  make({ list: read('scripts/players-nba.json', []), dir: 'public/bobbleheads', url: '/bobbleheads', needOk: true, extraTeams: ['BOB', 'SEA'] })
  make({ list: read('scripts/players-mlb.json', []), dir: 'public/bobbleheads/mlb', url: '/bobbleheads/mlb', needOk: false, extraTeams: [] })
}
build()
if (process.argv.includes('--watch')) setInterval(build, 10000)
