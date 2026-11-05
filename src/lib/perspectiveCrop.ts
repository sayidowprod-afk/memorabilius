// Découpe une carte dans une photo à partir de ses 4 coins (fractions 0..1), en redressant la perspective.
export type Pt = { x: number; y: number }
export type Quad = { topLeft: Pt; topRight: Pt; bottomRight: Pt; bottomLeft: Pt }

// Résout H (3x3, h22=1) qui envoie le rectangle de sortie (0,0)(w,0)(w,h)(0,h) sur les 4 points source.
function homography(dst: Pt[], src: Pt[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = dst[i], { x, y } = src[i]
    A.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x])
    A.push([0, 0, 0, u, v, 1, -y * u, -y * v, y])
  }
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    const t = A[c]; A[c] = A[p]; A[p] = t
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k] }
  }
  return [...A.map((r, i) => r[8] / r[i]), 1]
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

export type Src = ImageBitmap | HTMLImageElement | HTMLCanvasElement
const dims = (img: Src) => ('naturalWidth' in img ? { W: img.naturalWidth, H: img.naturalHeight } : { W: img.width, H: img.height })

export async function cropQuad(img: Src, q: Quad, maxSide = 2400, size?: { w: number; h: number }): Promise<Blob> {
  const c = await cropQuadCanvas(img, q, maxSide, size)
  return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encodage impossible')), 'image/jpeg', 0.93))
}

export async function cropQuadCanvas(img: Src, q: Quad, maxSide = 2400, size?: { w: number; h: number }): Promise<HTMLCanvasElement> {
  const { W, H } = dims(img)
  const src = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft].map(p => ({ x: p.x * W, y: p.y * H }))
  let w = (dist(src[0], src[1]) + dist(src[3], src[2])) / 2
  let h = (dist(src[0], src[3]) + dist(src[1], src[2])) / 2
  if (size) { w = size.w; h = size.h } else {
    const k = Math.min(1, maxSide / Math.max(w, h))
    w = Math.max(8, Math.round(w * k)); h = Math.max(8, Math.round(h * k))
  }
  const full = document.createElement('canvas'); full.width = W; full.height = H
  const fctx = full.getContext('2d', { willReadFrequently: true })!
  fctx.drawImage(img as CanvasImageSource, 0, 0)
  const sd = fctx.getImageData(0, 0, W, H).data
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const octx = out.getContext('2d')!
  const od = octx.createImageData(w, h)
  const m = homography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], src)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const d = m[6] * i + m[7] * j + 1
    const x = (m[0] * i + m[1] * j + m[2]) / d, y = (m[3] * i + m[4] * j + m[5]) / d
    const x0 = Math.floor(x), y0 = Math.floor(y), o = (j * w + i) * 4
    if (x0 < 0 || y0 < 0 || x0 >= W - 1 || y0 >= H - 1) { od.data[o + 3] = 255; continue }
    const fx = x - x0, fy = y - y0, a = (y0 * W + x0) * 4, b = a + 4, c = a + W * 4, e = c + 4
    for (let ch = 0; ch < 3; ch++) od.data[o + ch] = sd[a + ch] * (1 - fx) * (1 - fy) + sd[b + ch] * fx * (1 - fy) + sd[c + ch] * (1 - fx) * fy + sd[e + ch] * fx * fy
    od.data[o + 3] = 255
  }
  octx.putImageData(od, 0, 0)
  return out
}

const ctr = (q: Quad) => ({ x: (q.topLeft.x + q.topRight.x + q.bottomRight.x + q.bottomLeft.x) / 4, y: (q.topLeft.y + q.topRight.y + q.bottomRight.y + q.bottomLeft.y) / 4 })

// Range des cartes en lignes (de haut en bas), chaque ligne de gauche à droite. Une nouvelle ligne commence quand le centre saute de plus de ~60 % d'une hauteur de carte.
export function sortReading<T extends Quad>(cards: T[]): T[][] {
  const hOf = (c: Quad) => Math.abs((c.bottomLeft.y + c.bottomRight.y) / 2 - (c.topLeft.y + c.topRight.y) / 2) || 0.2
  const rows: T[][] = []
  for (const c of [...cards].sort((a, b) => ctr(a).y - ctr(b).y)) {
    const last = rows[rows.length - 1]
    if (last && Math.abs(ctr(c).y - ctr(last[0]).y) < hOf(c) * 0.6) last.push(c); else rows.push([c])
  }
  return rows.map(r => r.sort((a, b) => ctr(a).x - ctr(b).x))
}
