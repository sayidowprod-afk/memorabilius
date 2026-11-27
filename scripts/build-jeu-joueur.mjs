// Construit src/data/jeu-joueur.json : les joueurs du jeu « Joueur mystère » (joueurs actuels d'après les effectifs ESPN + anciens joueurs)
// et l'ordre des jours (un joueur différent chaque jour, jamais deux fois avant d'avoir fait le tour de la liste).
// Usage : node scripts/build-jeu-joueur.mjs
// IMPORTANT : l'ordre est figé. Pour ajouter des joueurs plus tard, relancer le script : les joueurs déjà présents gardent leur place,
// les nouveaux sont ajoutés À LA FIN de l'ordre (sinon les joueurs des jours à venir changeraient).
import fs from 'node:fs'

const OUT = 'src/data/jeu-joueur.json'
const DIV = {
  BOS: ['Est', 'Atlantique'], BKN: ['Est', 'Atlantique'], NY: ['Est', 'Atlantique'], PHI: ['Est', 'Atlantique'], TOR: ['Est', 'Atlantique'],
  CHI: ['Est', 'Centrale'], CLE: ['Est', 'Centrale'], DET: ['Est', 'Centrale'], IND: ['Est', 'Centrale'], MIL: ['Est', 'Centrale'],
  ATL: ['Est', 'Sud-Est'], CHA: ['Est', 'Sud-Est'], MIA: ['Est', 'Sud-Est'], ORL: ['Est', 'Sud-Est'], WSH: ['Est', 'Sud-Est'],
  DEN: ['Ouest', 'Nord-Ouest'], MIN: ['Ouest', 'Nord-Ouest'], OKC: ['Ouest', 'Nord-Ouest'], POR: ['Ouest', 'Nord-Ouest'], UTAH: ['Ouest', 'Nord-Ouest'],
  GS: ['Ouest', 'Pacifique'], LAC: ['Ouest', 'Pacifique'], LAL: ['Ouest', 'Pacifique'], PHX: ['Ouest', 'Pacifique'], SAC: ['Ouest', 'Pacifique'],
  DAL: ['Ouest', 'Sud-Ouest'], HOU: ['Ouest', 'Sud-Ouest'], MEM: ['Ouest', 'Sud-Ouest'], NO: ['Ouest', 'Sud-Ouest'], SA: ['Ouest', 'Sud-Ouest'],
}
// anciens joueurs : [nom, équipe de sa carrière rattachée à la franchise actuelle (SEA→OKC, NJN→BKN, NOH→NO…)]
const LEGENDS = `Michael Jordan:CHI|Scottie Pippen:CHI|Dennis Rodman:DET|Toni Kukoc:CHI|Derrick Rose:CHI|Joakim Noah:CHI|Luol Deng:CHI
Kobe Bryant:LAL|Shaquille O'Neal:LAL|Magic Johnson:LAL|Kareem Abdul-Jabbar:LAL|James Worthy:LAL|Pau Gasol:LAL|Lamar Odom:LAL|Derek Fisher:LAL|Vlade Divac:LAL
Tim Duncan:SA|David Robinson:SA|Tony Parker:SA|Manu Ginobili:SA|Bruce Bowen:SA|Avery Johnson:SA
Dirk Nowitzki:DAL|Steve Nash:PHX|Charles Barkley:PHX|Kevin Johnson:PHX|Amar'e Stoudemire:PHX|Shawn Marion:PHX|Jason Kidd:BKN|Vince Carter:TOR|Chris Bosh:MIA|Tracy McGrady:ORL|Penny Hardaway:ORL|Dwight Howard:ORL
Allen Iverson:PHI|Julius Erving:PHI|Moses Malone:HOU|Hakeem Olajuwon:HOU|Yao Ming:HOU|Clyde Drexler:POR|Steve Francis:HOU|Charles Oakley:NY|Larry Bird:BOS|Kevin McHale:BOS|Robert Parish:BOS|Paul Pierce:BOS|Kevin Garnett:MIN|Rajon Rondo:BOS|Ray Allen:BOS
Karl Malone:UTAH|John Stockton:UTAH|Andrei Kirilenko:UTAH|Patrick Ewing:NY|Carmelo Anthony:NY|Allan Houston:NY|John Starks:NY|Latrell Sprewell:NY|Dwyane Wade:MIA|Alonzo Mourning:MIA|Tim Hardaway:MIA|Glen Rice:MIA|Udonis Haslem:MIA
Isiah Thomas:DET|Joe Dumars:DET|Grant Hill:DET|Ben Wallace:DET|Chauncey Billups:DET|Richard Hamilton:DET|Rasheed Wallace:DET|Tayshaun Prince:DET|Bill Laimbeer:DET
Reggie Miller:IND|Rik Smits:IND|Jermaine O'Neal:IND|Gary Payton:OKC|Shawn Kemp:OKC|Dominique Wilkins:ATL|Joe Johnson:ATL|Dikembe Mutombo:DEN|Alex English:DEN|Carmelo Anthony:NY
Chris Webber:SAC|Peja Stojakovic:SAC|Mitch Richmond:SAC|Vlade Divac:LAL|Arvydas Sabonis:POR|Brandon Roy:POR|LaMarcus Aldridge:POR|Damon Stoudamire:POR
Larry Johnson:CHA|Muggsy Bogues:CHA|Dell Curry:CHA|Baron Davis:GS|Chris Mullin:GS|Tim Hardaway:GS|Andre Iguodala:GS|Rick Barry:GS
Marc Gasol:MEM|Zach Randolph:MEM|Tony Allen:MEM|Mike Conley:MEM|Gilbert Arenas:WSH|Wes Unseld:WSH|Elton Brand:LAC|Blake Griffin:LAC|DeAndre Jordan:LAC
Sidney Moncrief:MIL|Ray Allen:MIL|Michael Redd:MIL|Bob Lanier:MIL|Mark Price:CLE|Brad Daugherty:CLE|Zydrunas Ilgauskas:CLE|Kyrie Irving:CLE|Kevin Love:CLE
Drazen Petrovic:BKN|Allen Iverson:DEN|Luis Scola:HOU|Kyle Korver:ATL|Al Horford:BOS`.split(/\n|\|/).map(s => s.trim()).filter(Boolean).map(s => { const i = s.lastIndexOf(':'); return [s.slice(0, i), s.slice(i + 1)] })

// ESPN se trompe souvent sur le numéro et le pays des anciens joueurs : valeurs corrigées à la main (numéro porté dans l'équipe retenue, pays = nationalité sportive)
const FIX = { 'Dennis Rodman': { j: 10 }, 'Alex English': { j: 2 }, 'Glen Rice': { j: 41 }, 'Alonzo Mourning': { j: 33 }, 'Dell Curry': { j: 30 }, 'Baron Davis': { j: 1 }, 'Blake Griffin': { j: 32 }, 'Isiah Thomas': { j: 11 }, 'Magic Johnson': { j: 32 }, 'Kareem Abdul-Jabbar': { j: 33 }, 'James Worthy': { j: 42 }, 'Jason Kidd': { j: 5 }, 'Moses Malone': { j: 2 }, 'Larry Bird': { j: 33 }, 'Kevin McHale': { j: 32 }, 'Bill Laimbeer': { j: 40 }, 'Larry Johnson': { j: 2 }, 'Rick Barry': { j: 24 }, 'Wes Unseld': { j: 41 }, 'Sidney Moncrief': { j: 4 }, 'Bob Lanier': { j: 16 }, 'Brad Daugherty': { j: 43 }, 'Drazen Petrovic': { j: 3, c: 'Croatia' },
  'Derrick Rose': { j: 1 }, 'Joakim Noah': { j: 13 }, 'Luol Deng': { c: 'South Sudan' }, "Shaquille O'Neal": { j: 34 }, 'Lamar Odom': { j: 7 }, 'Derek Fisher': { j: 2 }, 'Toni Kukoc': { c: 'Croatia' }, 'Vlade Divac': { c: 'Serbia' }, 'Peja Stojakovic': { c: 'Serbia' }, 'Dirk Nowitzki': { c: 'Germany' }, 'Steve Nash': { j: 13, c: 'Canada' }, 'Charles Barkley': { j: 34 }, 'Dwight Howard': { j: 12 }, 'Steve Francis': { j: 3 }, 'Charles Oakley': { j: 34 },
  'Rajon Rondo': { j: 9 }, 'Ray Allen': { j: 20 }, 'Karl Malone': { j: 32 }, 'Patrick Ewing': { j: 33 }, 'Allan Houston': { j: 20 }, 'John Starks': { j: 3 }, 'Tim Hardaway': { j: 10 }, 'Ben Wallace': { j: 3 }, 'Tayshaun Prince': { j: 22 }, 'Joe Johnson': { j: 2 }, 'Mitch Richmond': { j: 2 }, 'Brandon Roy': { j: 7 }, 'LaMarcus Aldridge': { j: 12 }, 'Marc Gasol': { j: 33 }, 'Tony Allen': { j: 9 }, 'Gilbert Arenas': { j: 0 }, 'Mark Price': { j: 25 }, 'Kevin Love': { j: 0 },
  'Tony Parker': { c: 'France' }, 'Dominique Wilkins': { c: 'USA' }, 'Andrei Kirilenko': { c: 'Russia' }, 'Dikembe Mutombo': { c: 'Democratic Republic of Congo' }, 'Arvydas Sabonis': { c: 'Lithuania' }, 'Zydrunas Ilgauskas': { c: 'Lithuania' } }
const POS_FIX = { 'Kobe Bryant': 'G', 'Magic Johnson': 'G', 'Shawn Marion': 'F', 'Marc Gasol': 'C', 'Alex English': 'F', 'Bob Lanier': 'C', 'Drazen Petrovic': 'G', 'Kareem Abdul-Jabbar': 'C', 'Kevin McHale': 'F', 'Larry Bird': 'F', 'Larry Johnson': 'F', 'Rick Barry': 'F', 'Wes Unseld': 'C', 'Chris Webber': 'F', "Amar'e Stoudemire": 'F', 'Ben Wallace': 'C' }
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
const get = async (url) => { for (let t = 0; t < 3; t++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(12000) }); if (r.ok) return await r.json() } catch { /* nouvel essai */ } await new Promise(r => setTimeout(r, 600 * (t + 1))) } return null }
const parseH = (s) => { const m = /(\d+)'\s*(\d+)/.exec(s || ''); return m ? +m[1] * 12 + +m[2] : 0 }
const countryOf = (bp) => { if (!bp) return ''; const parts = bp.split(',').map(x => x.trim()); const last = parts[parts.length - 1]; if (/^[A-Z]{2}$/.test(last) || /^(Washington D\.?C\.?|DC)$/i.test(last)) return 'USA'; if (parts.length === 1 && /^[A-Z][a-z]/.test(last) && !/,/.test(bp)) return last; return last }
const posAbbr = (p) => (p === 'PG' || p === 'SG' || p === 'G') ? 'G' : (p === 'SF' || p === 'PF' || p === 'F') ? 'F' : p === 'C' ? 'C' : (p || 'F')

const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null
const byId = new Map()
const teamNames = {}
let ok = 0

// 1) joueurs actuels
for (let id = 1; id <= 30; id++) {
  const d = await get(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/roster`)
  const abbr = d?.team?.abbreviation, dv = DIV[abbr]; if (!dv) { console.log('équipe ignorée', id, abbr); continue }
  teamNames[abbr] = d.team.displayName
  for (const a of d.athletes || []) {
    const jersey = Number(a.jersey)
    if (!a.displayName || !a.height || !a.position?.abbreviation || !a.dateOfBirth || a.jersey === undefined || !Number.isFinite(jersey)) continue
    byId.set(a.id, { id: a.id, name: a.displayName, team: abbr, teamName: d.team.displayName, conf: dv[0], div: dv[1], pos: posAbbr(a.position.abbreviation), height: a.height, dob: a.dateOfBirth.slice(0, 10), jersey, country: a.birthPlace?.country || '', img: a.headshot?.href || null, legend: false, ...((a.experience?.years ?? 0) >= 3 ? { a: 1 } : {}) })
    ok++
  }
}
console.log('joueurs actuels :', byId.size)

// 2) anciens joueurs
const seen = new Set()
for (const [name, team] of LEGENDS) {
  if (seen.has(name)) continue; seen.add(name)
  const dv = DIV[team]; if (!dv) { console.log('équipe inconnue', name, team); continue }
  const s = await get(`https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=8&type=player`)
  const list = (s?.results || []).find(r => r.type === 'player')?.contents || []
  const hit = list.find(c => /s:40~l:46~a:/.test(c.uid || '') && norm(c.displayName) === norm(name))
  if (!hit) { console.log('introuvable :', name); continue }
  const id = /a:(\d+)/.exec(hit.uid)[1]
  if (byId.has(id)) { console.log('déjà actuel :', name); continue }
  const d = (await get(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}`))?.athlete
  const fx = FIX[name] || {}, h = parseH(d?.displayHeight), jersey = fx.j ?? Number(d?.jersey ?? d?.displayJersey?.replace('#', ''))
  const dm = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(d?.displayDOB || '')
  const dob = dm ? `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : ''
  if (!d || !h || !dob || !Number.isFinite(jersey) || !(POS_FIX[name] || d.position?.abbreviation)) { console.log('données incomplètes :', name, !!h, dob, jersey); continue }
  byId.set(id, { id, name: d.displayName || name, team, teamName: teamNames[team] || team, conf: dv[0], div: dv[1], pos: POS_FIX[name] || posAbbr(d.position.abbreviation), height: h, dob, jersey, country: fx.c || countryOf(d.displayBirthPlace), img: `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png`, legend: true, a: 1 })
  console.log('ancien :', name, team, d.displayHeight, dob, '#' + jersey, countryOf(d.displayBirthPlace))
}

// 3) ordre des jours : on garde l'ordre déjà publié, on ajoute les nouveaux (mélange déterministe) à la fin
let rng = 20261127; const rand = () => { rng |= 0; rng = (rng + 0x6D2B79F5) | 0; let t = Math.imul(rng ^ (rng >>> 15), 1 | rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const eligible = [...byId.values()].filter(p => p.a).map(p => p.id).sort()
const order = (prev?.order || []).filter(id => byId.has(id) && byId.get(id).a)
// les plus connus d'abord : anciens joueurs et joueurs ayant une bobblehead sur le site, puis tous les autres (chaque groupe mélangé)
const bob = new Set(Object.values(JSON.parse(fs.readFileSync('public/bobbleheads/live.json', 'utf8')).players).map(p => norm(p.name)))
const famous = id => byId.get(id).legend || bob.has(norm(byId.get(id).name))
const fresh0 = eligible.filter(id => !order.includes(id))
const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }
const fresh = [...shuffle(fresh0.filter(famous)), ...shuffle(fresh0.filter(id => !famous(id)))]
order.push(...fresh)

const players = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
fs.mkdirSync('src/data', { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ players, order }))
console.log('FINI :', players.length, 'joueurs,', order.length, 'jours sans répétition (anciens :', players.filter(p => p.legend).length + ')')
