// Détection des cartes d'une page de classeur avec le détecteur maison (YOLO, une carte à la fois, dans le navigateur).
// Méthode : 1) passes successives sur la photo entière en masquant chaque carte trouvée ; 2) on garde les détections plausibles (taille, forme) ;
// 3) on en déduit le réseau régulier des pochettes (origine + pas horizontal + pas vertical) pour retrouver aussi les cartes ratées ;
// 4) chaque emplacement est affiné par un nouveau passage du détecteur sur un recadrage serré, avec repli sur l'emplacement prédit.
import { detectCornersYOLO } from '@/lib/cornerDetectorYolo'
import type { Quad } from '@/lib/perspectiveCrop'

export type P = { x: number; y: number }
export type Slot = { quad: Quad; how: 'affinée' | 'prédite' | 'large' }
// grid : disposition [lignes, colonnes] utilisée (devinée si rows/cols valent 0), [0, 0] si le réseau n'a pas été trouvé
export type BinderResult = { W: number; H: number; slots: Slot[]; lattice: boolean; grid: [number, number]; log: string[] }
const STD_GRIDS: [number, number][] = [[3, 3], [2, 2], [3, 2], [2, 3], [3, 4], [4, 3]]

const cent = (p: P[]) => ({ x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length })
const area = (p: P[]) => Math.abs(p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + (q.x * r.y - r.x * q.y) }, 0)) / 2
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const bbox = (p: P[]) => ({ x0: Math.min(...p.map(q => q.x)), y0: Math.min(...p.map(q => q.y)), x1: Math.max(...p.map(q => q.x)), y1: Math.max(...p.map(q => q.y)) })
const toQuad = (p: P[]): Quad => ({ topLeft: p[0], topRight: p[1], bottomRight: p[2], bottomLeft: p[3] })

const toEl = (cv: HTMLCanvasElement) => new Promise<HTMLImageElement>((res, rej) => cv.toBlob(b => {
  if (!b) return rej(new Error('encodage impossible'))
  const url = URL.createObjectURL(b); const im = new Image()
  im.onload = () => { URL.revokeObjectURL(url); res(im) }; im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image illisible')) }; im.src = url
}, 'image/jpeg', 0.9))

const edgeW = (p: P[]) => (dist(p[0], p[1]) + dist(p[3], p[2])) / 2
const edgeH = (p: P[]) => (dist(p[0], p[3]) + dist(p[1], p[2])) / 2

// moindres carrés : v = a + b*c + d*r (renvoie null si les points sont alignés)
function fit3(rows: { c: number; r: number; v: number }[]): [number, number, number] | null {
  let s = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], t = [0, 0, 0]
  for (const { c, r, v } of rows) { const f = [1, c, r]; for (let i = 0; i < 3; i++) { t[i] += f[i] * v; for (let j = 0; j < 3; j++) s[i][j] += f[i] * f[j] } }
  const m = s.map((row, i) => [...row, t[i]])
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r
    if (Math.abs(m[p][c]) < 1e-6) return null
    const tmp = m[c]; m[c] = m[p]; m[p] = tmp
    for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k] }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]]
}

// rows et cols à 0 : la disposition est devinée d'après les cartes trouvées (parmi les pages de classeur courantes)
export async function detectBinderCards(full: HTMLCanvasElement, rowsIn: number, colsIn: number, progress: (m: string) => void = () => {}): Promise<BinderResult> {
  const auto = !rowsIn || !colsIn
  let rows = auto ? 5 : rowsIn, cols = auto ? 5 : colsIn
  const W = full.width, H = full.height, n = auto ? 12 : rows * cols
  const log: string[] = []
  const s = Math.min(1, 1600 / Math.max(W, H))
  const work = document.createElement('canvas'); work.width = Math.round(W * s); work.height = Math.round(H * s)
  const wctx = work.getContext('2d')!; wctx.drawImage(full, 0, 0, work.width, work.height)

  // 1) passes successives en masquant
  const cands: P[][] = []
  for (let it = 0; it < n + 4; it++) {
    progress(`Recherche des cartes… ${it + 1}`)
    const pts = await detectCornersYOLO(await toEl(work), 0.15)
    if (!pts || pts.length !== 4) break
    const full4 = pts.map(p => ({ x: p.x / s, y: p.y / s }))
    cands.push(full4)
    const c = cent(pts); wctx.fillStyle = '#7a7a7a'; wctx.beginPath()
    pts.forEach((p, j) => { const x = c.x + (p.x - c.x) * 1.07, y = c.y + (p.y - c.y) * 1.07; if (j) wctx.lineTo(x, y); else wctx.moveTo(x, y) })
    wctx.closePath(); wctx.fill()
  }
  log.push(`${cands.length} détections larges`)

  // 2) détections plausibles : taille proche de la médiane, forme de carte, dans l'image, sans doublon
  // Le détecteur se trompe parfois (motif intérieur d'une carte, deux cartes d'un coup) : on garde le plus gros groupe de détections de même taille.
  const shapeOk = (q: P[]) => { const ratio = edgeW(q) / Math.max(1, edgeH(q)); const c = cent(q); return ((ratio > 0.55 && ratio < 0.95) || (ratio > 1.05 && ratio < 1.8)) && c.x > 0 && c.x < W && c.y > 0 && c.y < H }
  const valid = cands.filter(shapeOk)
  let bestA = 0, bestCount = 0
  for (const q of valid) {
    const a = area(q), cnt = valid.filter(o => { const r = area(o) / a; return r > 0.8 && r < 1.25 }).length
    if (cnt > bestCount || (cnt === bestCount && a > bestA)) { bestCount = cnt; bestA = a }
  }
  const good: P[][] = []
  for (const q of valid) {
    const r = area(q) / Math.max(1, bestA)
    if (r > 0.75 && r < 1.33 && !good.some(g => dist(cent(g), cent(q)) < 0.6 * Math.sqrt(bestA))) good.push(q)
  }
  log.push(`${good.length} plausibles`)

  const refine = async (pred: P[]): Promise<P[] | null> => {
    const b = bbox(pred), pw = (b.x1 - b.x0) * 0.25, ph = (b.y1 - b.y0) * 0.25
    const x0 = Math.max(0, b.x0 - pw), y0 = Math.max(0, b.y0 - ph), x1 = Math.min(W, b.x1 + pw), y1 = Math.min(H, b.y1 + ph)
    if (x1 - x0 < 20 || y1 - y0 < 20) return null
    const k = Math.min(1, 900 / Math.max(x1 - x0, y1 - y0))
    const cv = document.createElement('canvas'); cv.width = Math.round((x1 - x0) * k); cv.height = Math.round((y1 - y0) * k)
    cv.getContext('2d')!.drawImage(full, x0, y0, x1 - x0, y1 - y0, 0, 0, cv.width, cv.height)
    try {
      const pts = await detectCornersYOLO(await toEl(cv), 0.2)
      if (!pts || pts.length !== 4) return null
      const m = pts.map(p => ({ x: x0 + p.x / k, y: y0 + p.y / k }))
      const ratio = area(m) / Math.max(1, area(pred))
      return dist(cent(m), cent(pred)) < 0.22 * Math.hypot(b.x1 - b.x0, b.y1 - b.y0) && ratio > 0.65 && ratio < 1.5 ? m : null
    } catch { return null }
  }

  // 3) réseau régulier, estimé de façon robuste : on teste des hypothèses de pas (horizontal U, vertical V) tirées des détections elles-mêmes
  // et on garde celle que le plus de détections respectent ; les détections qui n'y rentrent pas (carte « fantôme ») sont ignorées.
  let preds: P[][] | null = null
  if (good.length >= 2) {
    const wMed = median(good.map(edgeW)), hMed = median(good.map(edgeH))
    const cs = good.map(cent)
    const Us: P[] = [{ x: wMed * 1.08, y: 0 }], Vs: P[] = [{ x: 0, y: hMed * 1.06 }]
    for (let i = 0; i < cs.length; i++) for (let j = 0; j < cs.length; j++) if (i !== j) {
      const d = { x: cs[j].x - cs[i].x, y: cs[j].y - cs[i].y }
      if (d.x > 0.9 * wMed && d.x < 1.7 * wMed && Math.abs(d.y) < 0.35 * hMed) Us.push(d)
      if (d.y > 0.9 * hMed && d.y < 1.7 * hMed && Math.abs(d.x) < 0.6 * wMed) Vs.push(d)
    }
    type Fit = { U: P; V: P; idx: { k: number; a: number; b: number }[]; err: number }
    let best: Fit | null = null
    for (const U of Us) for (const V of Vs) {
      const det = U.x * V.y - V.x * U.y
      if (Math.abs(det) < 1) continue
      for (let k0 = 0; k0 < cs.length; k0++) {
        const idx: { k: number; a: number; b: number }[] = []
        let err = 0
        for (let k = 0; k < cs.length; k++) {
          const d = { x: cs[k].x - cs[k0].x, y: cs[k].y - cs[k0].y }
          const a = Math.round((d.x * V.y - V.x * d.y) / det), b = Math.round((U.x * d.y - d.x * U.y) / det)
          const e = dist({ x: cs[k0].x + a * U.x + b * V.x, y: cs[k0].y + a * U.y + b * V.y }, cs[k])
          if (e < 0.18 * wMed) { idx.push({ k, a, b }); err += e }
        }
        const minA = Math.min(...idx.map(i => i.a)), minB = Math.min(...idx.map(i => i.b))
        if (Math.max(...idx.map(i => i.a)) - minA + 1 > cols || Math.max(...idx.map(i => i.b)) - minB + 1 > rows) continue
        // à nombre égal de cartes cohérentes, on préfère l'erreur la plus faible ET un réseau presque rectangulaire (U et V à peu près perpendiculaires)
        const cos = Math.abs(U.x * V.x + U.y * V.y) / (Math.hypot(U.x, U.y) * Math.hypot(V.x, V.y))
        const cost = err / Math.max(1, idx.length) + cos * 0.6 * wMed
        if (!best || idx.length > best.idx.length || (idx.length === best.idx.length && cost < best.err)) best = { U, V, idx: idx.map(i => ({ k: i.k, a: i.a - minA, b: i.b - minB })), err: cost }
      }
    }
    if (best && best.idx.length >= 3) {
      if (auto) {
        const extC = Math.max(...best.idx.map(i => i.a)) + 1, extR = Math.max(...best.idx.map(i => i.b)) + 1
        const g = STD_GRIDS.filter(([r, c]) => r >= extR && c >= extC).sort((a, b) => a[0] * a[1] - b[0] * b[1])[0] ?? [extR, extC]
        rows = g[0]; cols = g[1]
        log.push(`disposition devinée : ${rows} × ${cols}`)
      }
      log.push(`réseau : ${best.idx.length} / ${good.length} cartes cohérentes · U=(${best.U.x.toFixed(0)},${best.U.y.toFixed(0)}) V=(${best.V.x.toFixed(0)},${best.V.y.toFixed(0)})`)
      const fx = fit3(best.idx.map(i => ({ c: i.a, r: i.b, v: cs[i.k].x }))), fy = fit3(best.idx.map(i => ({ c: i.a, r: i.b, v: cs[i.k].y })))
      const first = best.idx[0]
      let O = { x: cs[first.k].x - first.a * best.U.x - first.b * best.V.x, y: cs[first.k].y - first.a * best.U.y - first.b * best.V.y }, U = best.U, V = best.V
      if (fx && fy) { O = { x: fx[0], y: fy[0] }; U = { x: fx[1], y: fy[1] }; V = { x: fx[2], y: fy[2] } }
      const inl = best.idx.map(i => good[i.k])
      // forme moyenne d'une carte, relative à son centre
      const tpl = [0, 1, 2, 3].map(k => ({ x: inl.reduce((acc, q) => acc + q[k].x - cent(q).x, 0) / inl.length, y: inl.reduce((acc, q) => acc + q[k].y - cent(q).y, 0) / inl.length }))
      preds = []
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const ce = { x: O.x + c * U.x + r * V.x, y: O.y + c * U.y + r * V.y }
        preds.push(tpl.map(t => ({ x: ce.x + t.x, y: ce.y + t.y })))
      }
    } else log.push('réseau introuvable')
  }

  // 4) affinage de chaque emplacement
  const slots: Slot[] = []
  if (preds) {
    for (let i = 0; i < preds.length; i++) {
      progress(`Affinage ${i + 1} / ${preds.length}…`)
      const m = await refine(preds[i])
      slots.push(m ? { quad: toQuad(m), how: 'affinée' } : { quad: toQuad(preds[i]), how: 'prédite' })
    }
    return { W, H, slots, lattice: true, grid: [rows, cols], log }
  }
  // repli : on garde ce qu'on a trouvé, rangé par lignes
  const sorted = [...good].sort((a, b) => cent(a).y - cent(b).y)
  return { W, H, slots: sorted.map(q => ({ quad: toQuad(q), how: 'large' as const })), lattice: false, grid: [0, 0], log }
}
