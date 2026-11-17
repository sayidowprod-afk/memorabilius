// Tenues supplémentaires des corps d'équipe : extérieur (ext), alternative (alt), légendaire (leg), + anciennes équipes (Bobcats et SuperSonics : équipes à part entière, domicile / extérieur / alternative).
// Reprise automatique : scripts/.bobble-checkpoint.json (clé kits). Usage : node scripts/bobble-kits.mjs [ABR] [ext|alt|leg|dom]
// Sortie : public/bobbleheads/team-<ABR>-<tenue>.webp (ou team-<ABR>.webp pour BOB / SEA) + public/bobbleheads/teams.json (clé kits : dimensions + couleurs du numéro par tenue)
// Puis : node scripts/bobble-live.mjs pour publier les tenues dans live.json.
import fs from 'node:fs'
import sharp from 'sharp'
import { generate, rembg, loadCkpt, saveCkpt, comfyUp, WORK } from './bobble-lib.mjs'

// abr, tenue, maillot, liseré, short, chaussures, couleur du numéro, contour du numéro
const K = [
  // ── anciennes équipes (corps complets, utilisés comme tenue « légendaire » de CHA et OKC) ──
  ['BOB', 'dom', 'white', 'navy blue and orange', 'white', 'white and navy', '#1d3a8a', '#f26522'],
  ['BOB', 'ext', 'navy blue', 'orange and white', 'navy blue', 'navy and orange', '#f26522', '#ffffff'],
  ['BOB', 'alt', 'orange', 'navy blue and white', 'orange', 'orange and navy', '#1d3a8a', '#ffffff'],
  ['SEA', 'dom', 'white', 'forest green and yellow', 'white', 'white and green', '#00653a', '#ffc200'],
  ['SEA', 'ext', 'forest green', 'yellow and white', 'forest green', 'green and yellow', '#ffc200', '#ffffff'],
  ['SEA', 'alt', 'yellow', 'forest green and white', 'yellow', 'yellow and green', '#00653a', '#ffffff'],
  // ── ATL
  ['ATL', 'ext', 'white', 'red and yellow', 'white', 'white and red', '#c8102e', '#fdb927'],
  ['ATL', 'alt', 'black', 'volt yellow-green and red', 'black', 'black and volt yellow', '#c1d32f', '#000000'],
  ['ATL', 'leg', 'red', 'yellow and white retro stripes', 'red', 'red and yellow', '#ffffff', '#fdb927'],
  // ── BOS
  ['BOS', 'ext', 'white', 'green', 'white', 'white and green', '#007a33', '#ffffff'],
  ['BOS', 'alt', 'black', 'green and white', 'black', 'black and green', '#ffffff', '#007a33'],
  ['BOS', 'leg', 'white', 'thick green and black retro', 'white', 'white and green', '#007a33', '#ffffff'],
  // ── BKN
  ['BKN', 'ext', 'white', 'black', 'white', 'white and black', '#111111', '#ffffff'],
  ['BKN', 'alt', 'light grey', 'black and white', 'light grey', 'black and white', '#111111', '#ffffff'],
  ['BKN', 'leg', 'royal blue', 'red and white retro', 'royal blue', 'blue and red', '#ffffff', '#c8102e'],
  // ── CHA
  ['CHA', 'ext', 'white', 'teal and purple', 'white', 'white and teal', '#00788c', '#1d1160'],
  ['CHA', 'alt', 'purple', 'teal and white', 'purple', 'purple and teal', '#00bcd4', '#ffffff'],
  ['CHA', 'leg', 'teal', 'purple pinstripes and white 1990s', 'teal', 'teal and purple', '#ffffff', '#1d1160'],
  // ── CHI
  ['CHI', 'ext', 'white', 'red and black', 'white', 'white and red', '#ce1141', '#111111'],
  ['CHI', 'alt', 'black', 'red and white', 'black', 'black and red', '#ce1141', '#ffffff'],
  ['CHI', 'leg', 'red', 'black and white 1990s', 'red', 'red and black', '#ffffff', '#111111'],
  // ── CLE
  ['CLE', 'ext', 'white', 'wine red and gold', 'white', 'white and wine red', '#860038', '#fdbb30'],
  ['CLE', 'alt', 'gold', 'wine red and navy', 'gold', 'gold and wine red', '#860038', '#041e42'],
  ['CLE', 'leg', 'orange', 'blue and white retro', 'orange', 'orange and blue', '#ffffff', '#1f3a93'],
  // ── DAL
  ['DAL', 'ext', 'white', 'royal blue and silver', 'white', 'white and blue', '#00538c', '#b8c4ca'],
  ['DAL', 'alt', 'navy blue', 'light blue and silver', 'navy blue', 'navy and silver', '#ffffff', '#00538c'],
  ['DAL', 'leg', 'dark green', 'light blue and white retro', 'dark green', 'green and white', '#ffffff', '#00693e'],
  // ── DEN
  ['DEN', 'ext', 'white', 'navy and gold', 'white', 'white and navy', '#0e2240', '#fec524'],
  ['DEN', 'alt', 'navy blue', 'gold and light sky blue', 'navy blue', 'navy and gold', '#fec524', '#ffffff'],
  ['DEN', 'leg', 'rainbow-striped light blue', 'rainbow skyline stripes in orange, yellow and blue', 'light blue', 'white and blue', '#ffffff', '#1d428a'],
  // ── DET
  ['DET', 'ext', 'white', 'red and blue', 'white', 'white and blue', '#1d428a', '#c8102e'],
  ['DET', 'alt', 'dark teal', 'red and gold retro', 'dark teal', 'teal and red', '#ffffff', '#c8102e'],
  ['DET', 'leg', 'teal', 'red and purple retro flames', 'teal', 'teal and red', '#ffffff', '#c8102e'],
  // ── GSW
  ['GSW', 'ext', 'white', 'royal blue and golden yellow', 'white', 'white and yellow', '#1d428a', '#ffc72c'],
  ['GSW', 'alt', 'golden yellow', 'royal blue', 'golden yellow', 'yellow and blue', '#1d428a', '#ffffff'],
  ['GSW', 'leg', 'royal blue', 'golden yellow retro', 'royal blue', 'blue and yellow', '#ffc72c', '#ffffff'],
  // ── HOU
  ['HOU', 'ext', 'white', 'red and silver', 'white', 'white and red', '#ce1141', '#c4ced4'],
  ['HOU', 'alt', 'black', 'red and silver', 'black', 'black and red', '#ce1141', '#ffffff'],
  ['HOU', 'leg', 'red', 'yellow and navy retro stripes', 'red', 'red and yellow', '#ffffff', '#fdb927'],
  // ── IND
  ['IND', 'ext', 'white', 'navy and gold', 'white', 'white and navy', '#002d62', '#fdbb30'],
  ['IND', 'alt', 'gold', 'navy', 'gold', 'gold and navy', '#002d62', '#ffffff'],
  ['IND', 'leg', 'navy blue', 'gold and white retro', 'navy blue', 'navy and gold', '#fdbb30', '#ffffff'],
  // ── LAC
  ['LAC', 'ext', 'white', 'red and blue', 'white', 'white and blue', '#1d428a', '#c8102e'],
  ['LAC', 'alt', 'navy blue', 'red and white', 'navy blue', 'navy and red', '#ffffff', '#c8102e'],
  ['LAC', 'leg', 'light blue', 'orange and white retro', 'light blue', 'blue and orange', '#ffffff', '#f58426'],
  // ── LAL
  ['LAL', 'ext', 'white', 'purple and gold', 'white', 'white and purple', '#552583', '#fdb927'],
  ['LAL', 'alt', 'gold', 'purple', 'gold', 'gold and purple', '#552583', '#ffffff'],
  ['LAL', 'leg', 'gold', 'purple retro showtime stripes', 'gold', 'gold and purple', '#552583', '#ffffff'],
  // ── MEM
  ['MEM', 'ext', 'white', 'navy and light blue', 'white', 'white and navy', '#12173f', '#5d76a9'],
  ['MEM', 'alt', 'light blue', 'navy and yellow', 'light blue', 'blue and navy', '#12173f', '#ffffff'],
  ['MEM', 'leg', 'teal', 'red and gold retro', 'teal', 'teal and red', '#ffffff', '#29727c'],
  // ── MIA
  ['MIA', 'ext', 'white', 'red and black', 'white', 'white and red', '#98002e', '#111111'],
  ['MIA', 'alt', 'red', 'black and yellow', 'red', 'red and black', '#ffffff', '#111111'],
  ['MIA', 'leg', 'turquoise', 'pink and purple vice neon', 'turquoise', 'white and pink', '#ffffff', '#c2185b'],
  // ── MIL
  ['MIL', 'ext', 'white', 'forest green and cream', 'white', 'white and green', '#00471b', '#eee1c6'],
  ['MIL', 'alt', 'cream', 'forest green and blue', 'cream', 'cream and green', '#00471b', '#ffffff'],
  ['MIL', 'leg', 'forest green', 'red and purple retro', 'forest green', 'green and red', '#ffffff', '#c8102e'],
  // ── MIN
  ['MIN', 'ext', 'white', 'navy and green', 'white', 'white and navy', '#0c2340', '#78be20'],
  ['MIN', 'alt', 'light blue', 'navy and green', 'light blue', 'blue and navy', '#0c2340', '#ffffff'],
  ['MIN', 'leg', 'teal green', 'black and white retro', 'teal green', 'green and black', '#ffffff', '#111111'],
  // ── NOP
  ['NOP', 'ext', 'white', 'navy and red', 'white', 'white and navy', '#0c2340', '#c8102e'],
  ['NOP', 'alt', 'gold', 'navy and red', 'gold', 'gold and navy', '#0c2340', '#ffffff'],
  ['NOP', 'leg', 'teal', 'purple and gold retro hornets', 'teal', 'teal and purple', '#ffffff', '#1d1160'],
  // ── NYK
  ['NYK', 'ext', 'white', 'royal blue and orange', 'white', 'white and blue', '#006bb6', '#f58426'],
  ['NYK', 'alt', 'black', 'orange and blue', 'black', 'black and orange', '#f58426', '#ffffff'],
  ['NYK', 'leg', 'orange', 'blue and white retro', 'orange', 'orange and blue', '#ffffff', '#006bb6'],
  // ── OKC
  ['OKC', 'ext', 'white', 'bright blue and orange', 'white', 'white and blue', '#007ac1', '#ef3b24'],
  ['OKC', 'alt', 'navy blue', 'orange and blue', 'navy blue', 'navy and orange', '#ef3b24', '#ffffff'],
  ['OKC', 'leg', 'bright blue', 'orange and white 2012 finals', 'bright blue', 'blue and orange', '#ffffff', '#ef3b24'],
  // ── ORL
  ['ORL', 'ext', 'white', 'royal blue and black', 'white', 'white and blue', '#0077c0', '#111111'],
  ['ORL', 'alt', 'black', 'blue and silver', 'black', 'black and blue', '#0077c0', '#ffffff'],
  ['ORL', 'leg', 'white', 'black pinstripes and blue', 'white', 'white and blue', '#0077c0', '#111111'],
  // ── PHI
  ['PHI', 'ext', 'white', 'royal blue and red', 'white', 'white and blue', '#006bb6', '#ed174c'],
  ['PHI', 'alt', 'navy blue', 'red and white', 'navy blue', 'navy and red', '#ed174c', '#ffffff'],
  ['PHI', 'leg', 'black', 'blue and red 2001 finals', 'black', 'black and blue', '#ffffff', '#ed174c'],
  // ── PHX
  ['PHX', 'ext', 'white', 'purple and orange', 'white', 'white and purple', '#1d1160', '#e56020'],
  ['PHX', 'alt', 'orange', 'purple and black', 'orange', 'orange and purple', '#1d1160', '#ffffff'],
  ['PHX', 'leg', 'purple', 'orange and pink sunburst retro', 'purple', 'purple and orange', '#ffffff', '#e56020'],
  // ── POR
  ['POR', 'ext', 'white', 'red and black', 'white', 'white and red', '#e03a3e', '#111111'],
  ['POR', 'alt', 'red', 'black and white', 'red', 'red and black', '#ffffff', '#111111'],
  ['POR', 'leg', 'red', 'black and white pinwheel retro', 'red', 'red and black', '#ffffff', '#111111'],
  // ── SAC
  ['SAC', 'ext', 'white', 'purple and silver', 'white', 'white and purple', '#5a2d81', '#63727a'],
  ['SAC', 'alt', 'black', 'purple and silver', 'black', 'black and purple', '#ffffff', '#5a2d81'],
  ['SAC', 'leg', 'royal blue', 'red and white retro', 'royal blue', 'blue and red', '#ffffff', '#c8102e'],
  // ── SAS
  ['SAS', 'ext', 'white', 'black and silver', 'white', 'white and black', '#111111', '#c4ced4'],
  ['SAS', 'alt', 'silver grey', 'black', 'silver grey', 'grey and black', '#111111', '#ffffff'],
  ['SAS', 'leg', 'teal', 'orange and pink fiesta retro', 'teal', 'teal and orange', '#ffffff', '#f26522'],
  // ── TOR
  ['TOR', 'ext', 'white', 'red and black', 'white', 'white and red', '#ce1141', '#111111'],
  ['TOR', 'alt', 'black', 'red and gold', 'black', 'black and red', '#ce1141', '#ffffff'],
  ['TOR', 'leg', 'purple', 'red and black retro dinosaur', 'purple', 'purple and red', '#ffffff', '#111111'],
  // ── UTA
  ['UTA', 'ext', 'white', 'navy and yellow', 'white', 'white and navy', '#002b5c', '#f9a01b'],
  ['UTA', 'alt', 'yellow', 'navy and light blue', 'yellow', 'yellow and navy', '#002b5c', '#ffffff'],
  ['UTA', 'leg', 'purple', 'teal and yellow mountain retro', 'purple', 'purple and teal', '#ffffff', '#f9a01b'],
  // ── WAS
  ['WAS', 'ext', 'white', 'navy and red', 'white', 'white and navy', '#002b5c', '#e31837'],
  ['WAS', 'alt', 'red', 'navy and white', 'red', 'red and navy', '#ffffff', '#002b5c'],
  ['WAS', 'leg', 'red', 'white and blue bullets retro', 'red', 'red and blue', '#ffffff', '#002b5c'],
]

if (!(await comfyUp())) { console.error('ComfyUI ne répond pas (http://127.0.0.1:8188). Lance-le puis relance ce script.'); process.exit(1) }
fs.mkdirSync('public/bobbleheads', { recursive: true })
const metaFile = 'public/bobbleheads/teams.json'
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
const ck = loadCkpt(); ck.kits = ck.kits || {}
const [onlyAbr, onlyKit] = [process.argv[2], process.argv[3]]

async function cutBody(raw, dst) {
  const tmp = `${WORK}/cut-${Math.random().toString(36).slice(2)}.png`
  rembg(raw, tmp)
  const c = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  fs.unlinkSync(tmp)
  const w = c.info.width, h = c.info.height, C = c.data
  for (let i = 3; i < C.length; i += 4) if (C[i] < 24) C[i] = 0
  const rw = y => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (C[(y * w + x) * 4 + 3] > 60) { if (a < 0) a = x; b = x } return a < 0 ? 0 : b - a }
  let yNeck = Math.round(h * 0.06), minW = 1e9
  for (let y = Math.round(h * 0.06); y < Math.round(h * 0.30); y++) { const v = rw(y); if (v > 0 && v < minW) { minW = v; yNeck = y } }
  let top = yNeck
  for (let y = yNeck; y < Math.round(h * 0.4); y++) if (rw(y) > minW * 1.5) { top = Math.max(0, y - Math.round(h * 0.012)); break }
  const full = await sharp(C, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()
  const ext = await sharp(full).extract({ left: 0, top, width: w, height: h - top }).png().toBuffer()
  const out = await sharp(ext).trim({ threshold: 2 }).toBuffer({ resolveWithObject: true })
  const ow = out.info.width, oh = out.info.height
  const m = await sharp(out.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let span = 0
  { const y = Math.round(oh * 0.16); let a = -1, b = -1; for (let x = 0; x < ow; x++) if (m.data[(y * ow + x) * 4 + 3] > 60) { if (a < 0) a = x; b = x } span = a < 0 ? ow : b - a }
  await sharp(out.data).webp({ quality: 88, alphaQuality: 100 }).toFile(dst)
  return { w: ow, h: oh, span }
}

for (const [abr, kit, jersey, trim, shorts, shoes, numFill, numStroke] of K) {
  if (onlyAbr && onlyAbr !== abr) continue
  if (onlyKit && onlyKit !== kit) continue
  const key = `${abr}-${kit}`
  const historic = kit === 'dom'                       // domicile de BOB / SEA = corps d'équipe à part entière (team-BOB.webp)
  const dst = historic ? `public/bobbleheads/team-${abr}.webp` : `public/bobbleheads/team-${abr}-${kit}.webp`
  if (ck.kits[key]?.done && fs.existsSync(dst)) { console.log(key, 'déjà fait'); continue }
  const desc = `The body of a basketball player: plain ${jersey} jersey with ${trim} trim stripes, a perfectly clean smooth empty chest with nothing printed on it at all, ${shorts} shorts with ${trim} trim, ${shoes} sneakers, medium brown skin on arms and legs`
  let ok = false
  for (const off of [0, 11, 23]) {
    const seed = 7000 + K.findIndex(t => t[0] === abr && t[1] === kit) * 41 + off
    const t0 = Date.now()
    try {
      const raw = await generate('body', desc, `kit-${key}`, seed)
      const info = await cutBody(raw, dst)
      const m = { ...info, num: { fill: numFill, stroke: numStroke } }
      if (historic) meta[abr] = { name: abr === 'BOB' ? 'Charlotte Bobcats' : 'Seattle SuperSonics', ...m }
      else { meta[abr].kits = { ...(meta[abr].kits || {}), [kit]: m } }
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1))
      ck.kits[key] = { done: true, seed, at: Date.now() }
      saveCkpt(ck)
      console.log(key, 'OK', `${((Date.now() - t0) / 1000).toFixed(0)} s`, 'graine', seed)
      ok = true; break
    } catch (e) { console.log(key, 'erreur', e.message) }
  }
  if (!ok) console.log(key, 'ÉCHEC')
}
console.log('Terminé :', Object.keys(ck.kits).length, '/', K.length, 'tenues')
