// Aide au cadrage de la caméra : dit si une carte est bien alignée avec le cadre affiché, d'après l'aperçu vidéo.
// Très léger (quelques millisecondes, petite image, aucun modèle) pour ne jamais ralentir l'écran : on cherche un bord net
// exactement sur chacun des 4 côtés du cadre, plus marqué que les lignes voisines un peu plus loin.
// Lecture seule : rien n'est envoyé ni enregistré, et la capture de la photo n'est pas concernée.

export type VidRect = { x: number; y: number; w: number; h: number }
export type AlignResult = { ok: boolean; info: string }

let work: HTMLCanvasElement | null = null

const MIN_EDGE = 5   // contraste minimal (niveaux de gris) d'un bord, pour ignorer un fond uni
const MIN_RATIO = 1.7 // le bord du cadre doit être au moins 1,7 fois plus net que les lignes voisines

export function liveEdgeAligned(video: HTMLVideoElement, frame: VidRect): AlignResult {
  const vw = video.videoWidth, vh = video.videoHeight
  if (!vw || !vh) return { ok: false, info: 'pas de vidéo' }
  // zone examinée : le cadre + 22 % de marge, réduite à ~220 px de large
  const pad = 0.22
  const rx = Math.max(0, frame.x - frame.w * pad), ry = Math.max(0, frame.y - frame.h * pad)
  const rw = Math.min(vw - rx, frame.w * (1 + pad * 2)), rh = Math.min(vh - ry, frame.h * (1 + pad * 2))
  if (rw < 20 || rh < 20) return { ok: false, info: 'cadre hors image' }
  const S = 220 / rw
  const W = Math.max(8, Math.round(rw * S)), H = Math.max(8, Math.round(rh * S))
  if (!work) work = document.createElement('canvas')
  work.width = W; work.height = H
  const ctx = work.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, rx, ry, rw, rh, 0, 0, W, H)
  const px = ctx.getImageData(0, 0, W, H).data
  const g = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]

  const fx = (frame.x - rx) * S, fy = (frame.y - ry) * S, fw = frame.w * S, fh = frame.h * S
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  // force du contraste à travers une ligne horizontale (y) ou verticale (x), moyennée sur la partie centrale du côté
  const hLine = (y: number, x0: number, x1: number) => { // bord horizontal : différence entre la ligne au-dessus et en dessous
    const yy = clamp(Math.round(y), 1, H - 2); let s = 0, n = 0
    for (let x = Math.round(x0); x < Math.round(x1); x++) { if (x < 0 || x >= W) continue; s += Math.abs(g[(yy + 1) * W + x] - g[(yy - 1) * W + x]); n++ }
    return n ? s / n : 0
  }
  const vLine = (x: number, y0: number, y1: number) => {
    const xx = clamp(Math.round(x), 1, W - 2); let s = 0, n = 0
    for (let y = Math.round(y0); y < Math.round(y1); y++) { if (y < 0 || y >= H) continue; s += Math.abs(g[y * W + xx + 1] - g[y * W + xx - 1]); n++ }
    return n ? s / n : 0
  }
  // pour un côté : le bord le plus net dans une petite fenêtre autour du cadre, comparé à la moyenne des lignes plus éloignées
  const side = (line: (pos: number) => number, center: number, span: number) => {
    const win = Math.max(2, Math.round(span * 0.04)), far = win * 2, K = Math.max(far + 2, Math.round(span * 0.14))
    let near = 0, base = 0, nb = 0
    for (let k = -K; k <= K; k++) {
      const v = line(center + k)
      if (Math.abs(k) <= win) near = Math.max(near, v)
      else if (Math.abs(k) >= far) { base += v; nb++ }
    }
    base = nb ? base / nb : 0
    return { near, ratio: near / (base + 1) }
  }
  const top = side(y => hLine(y, fx + fw * 0.15, fx + fw * 0.85), fy, fh)
  const bottom = side(y => hLine(y, fx + fw * 0.15, fx + fw * 0.85), fy + fh, fh)
  const left = side(x => vLine(x, fy + fh * 0.15, fy + fh * 0.85), fx, fw)
  const right = side(x => vLine(x, fy + fh * 0.15, fy + fh * 0.85), fx + fw, fw)
  const all = [top, bottom, left, right]
  const ok = all.every(s => s.near >= MIN_EDGE && s.ratio >= MIN_RATIO)
  return { ok, info: `H ${top.ratio.toFixed(1)} B ${bottom.ratio.toFixed(1)} G ${left.ratio.toFixed(1)} D ${right.ratio.toFixed(1)} (il faut ≥ ${MIN_RATIO}) · contraste mini ${Math.round(Math.min(...all.map(s => s.near)))}` }
}
