'use client'
import { useRef, useState } from 'react'

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
// Premier modele die-cut (YOLOv8s-seg, 138 images annotees) -- test de
// validation uniquement, jamais branche sur le scanner (CardScanner.tsx
// n'est pas touche).
const MODEL_URL = '/models/diecut.onnx'
const CONF_THRESHOLD = 0.4

function letterbox(img: HTMLImageElement) {
  const scale = Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)
  const newW = Math.round(img.naturalWidth * scale)
  const newH = Math.round(img.naturalHeight * scale)
  const padX = Math.round((IMGSZ - newW) / 2)
  const padY = Math.round((IMGSZ - newH) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = IMGSZ
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, IMGSZ, IMGSZ)
  ctx.drawImage(img, padX, padY, newW, newH)
  return { canvas, padX, padY, newW, newH, scale }
}

function toTensor(canvas: HTMLCanvasElement): Float32Array {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, IMGSZ, IMGSZ)
  const N = IMGSZ * IMGSZ
  const out = new Float32Array(3 * N)
  for (let i = 0; i < N; i++) {
    out[0 * N + i] = data[i * 4] / 255
    out[1 * N + i] = data[i * 4 + 1] / 255
    out[2 * N + i] = data[i * 4 + 2] / 255
  }
  return out
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

type DetectResult = {
  found: boolean
  conf: number
  ms: number
  // Masque de probabilite 640x640 (espace letterbox), 0..1 par pixel --
  // interpole (pas nearest-neighbor) pour un contour lisse plutot qu'en
  // escalier quand on l'agrandit depuis les prototypes 160x160.
  mask640: Float32Array | null
}

async function detect(ort: typeof import('onnxruntime-web'), img: HTMLImageElement): Promise<DetectResult> {
  const t0 = performance.now()
  const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
  const { canvas } = letterbox(img)
  const tensorData = toTensor(canvas)
  const input = new ort.Tensor('float32', tensorData, [1, 3, IMGSZ, IMGSZ])
  const outputs = await session.run({ [session.inputNames[0]]: input })

  // output0: [1,37,8400] (cx,cy,w,h,conf,32 coeffs masque) -- output1: [1,32,160,160] prototypes
  const names = session.outputNames
  const det = outputs[names[0]].dims.length === 3 && outputs[names[0]].dims[1] === 37 ? outputs[names[0]] : outputs[names[1]]
  const proto = det === outputs[names[0]] ? outputs[names[1]] : outputs[names[0]]

  const detData = det.data as Float32Array
  const N = det.dims[2]
  let bestConf = CONF_THRESHOLD
  let bestIdx = -1
  for (let i = 0; i < N; i++) {
    const conf = detData[4 * N + i]
    if (conf > bestConf) { bestConf = conf; bestIdx = i }
  }
  const ms = performance.now() - t0
  if (bestIdx < 0) return { found: false, conf: 0, ms, mask640: null }

  const cx = detData[0 * N + bestIdx]
  const cy = detData[1 * N + bestIdx]
  const bw = detData[2 * N + bestIdx]
  const bh = detData[3 * N + bestIdx]
  const coeffs = new Float32Array(32)
  for (let k = 0; k < 32; k++) coeffs[k] = detData[(5 + k) * N + bestIdx]

  const protoData = proto.data as Float32Array
  const PH = proto.dims[2], PW = proto.dims[3]
  const maskProto = new Float32Array(PH * PW)
  for (let p = 0; p < PH * PW; p++) {
    let sum = 0
    for (let k = 0; k < 32; k++) sum += coeffs[k] * protoData[k * PH * PW + p]
    maskProto[p] = sigmoid(sum)
  }

  // PAS de restriction a la bbox brute du detecteur ici -- cette bbox
  // (cx,cy,bw,bh) est juste l'estimation du detecteur, pas la verite
  // terrain, et peut etre legerement plus petite que la vraie carte
  // (constate : contour nettement en retrait du vrai bord sur une photo ou
  // la bbox etait a peine trop juste). Avec une marge fixe de quelques
  // pixels, le masque etait carrement tronque avant meme d'atteindre le
  // vrai bord. Le masque de segmentation (prototypes) est fiable sur toute
  // l'image, pas besoin de le limiter a la bbox pour le nettoyer.
  //
  // upscale bilineaire 160x160 -> 640x640 (pas nearest-neighbor) : le
  // prototype est une probabilite continue, l'interpolation donne un
  // contour qui suit une vraie courbe au lieu de blocs en escalier
  const mask640 = new Float32Array(IMGSZ * IMGSZ)
  const down = PW / IMGSZ
  for (let yy = 0; yy < IMGSZ; yy++) {
    const py = yy * down
    const py0 = Math.min(PH - 1, Math.floor(py))
    const py1 = Math.min(PH - 1, py0 + 1)
    const fy = py - py0
    for (let xx = 0; xx < IMGSZ; xx++) {
      const px = xx * down
      const px0 = Math.min(PW - 1, Math.floor(px))
      const px1 = Math.min(PW - 1, px0 + 1)
      const fx = px - px0
      const v00 = maskProto[py0 * PW + px0]
      const v10 = maskProto[py0 * PW + px1]
      const v01 = maskProto[py1 * PW + px0]
      const v11 = maskProto[py1 * PW + px1]
      const v0 = v00 + (v10 - v00) * fx
      const v1 = v01 + (v11 - v01) * fx
      mask640[yy * IMGSZ + xx] = v0 + (v1 - v0) * fy
    }
  }

  return { found: true, conf: bestConf, ms, mask640 }
}

type Pt = { x: number; y: number }

// Suivi de contour par pixel (Moore-neighbor tracing) : un echantillonnage
// polaire (un rayon par angle depuis le centre) ne peut pas representer une
// forme CONCAVE -- une encoche qui "rentre" vers le centre entre deux
// "oreilles" d'une die-cut partage son angle avec le bord exterieur, donc un
// seul rayon par angle lissait/coupait ces encoches. Valide hors-ligne
// (ml/test_contour.js) sur un masque synthetique avant d'etre branche ici.
const MOORE_DIRS: [number, number][] = [
  [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1],
] // W, NW, N, NE, E, SE, S, SW (sens horaire a partir de l'Ouest)

function traceMooreBoundary(bin: Uint8Array, w: number, h: number, start: Pt): Pt[] {
  const at = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && bin[y * w + x] === 1
  const boundary: Pt[] = [start]
  let curr = start
  // start trouve en balayant vers la droite depuis un point interieur ->
  // le pixel Est est hors-forme, backtrack initial = Est
  let backDirIdx = 4
  let firstNeighbor: Pt | null = null
  const maxIter = w * h * 4
  for (let iter = 0; iter < maxIter; iter++) {
    let foundIdx = -1
    for (let i = 1; i <= 8; i++) {
      const idx = (backDirIdx + i) % 8
      const [dx, dy] = MOORE_DIRS[idx]
      if (at(curr.x + dx, curr.y + dy)) { foundIdx = idx; break }
    }
    if (foundIdx < 0) break // pixel isole
    const [dx, dy] = MOORE_DIRS[foundIdx]
    const next = { x: curr.x + dx, y: curr.y + dy }
    if (firstNeighbor === null) {
      firstNeighbor = next
    } else if (curr.x === start.x && curr.y === start.y && next.x === firstNeighbor.x && next.y === firstNeighbor.y) {
      // critere d'arret de Jacob : on est revenu au point de depart ET sur
      // le point d'en sortir par la MEME premiere transition qu'au debut --
      // verifier juste "curr === start" est insuffisant (faux positif
      // possible pres d'un coin convexe, teste et confirme en local)
      break
    }
    boundary.push(next)
    backDirIdx = (foundIdx + 4) % 8
    curr = next
  }
  return boundary
}

// Point de depart garanti a l'interieur de la forme principale (pixel de
// plus forte probabilite), puis premier pixel de bord trouve en balayant
// vers la droite -- evite de partir sur un petit artefact isole du masque.
function findBoundaryStart(mask640: Float32Array, bin: Uint8Array, w: number, h: number): Pt | null {
  let best = -1, bi = 0
  for (let i = 0; i < mask640.length; i++) if (mask640[i] > best) { best = mask640[i]; bi = i }
  if (best < 0.5) return null
  const sy = Math.floor(bi / w)
  let x = bi % w
  while (x < w && bin[sy * w + x] === 1) x++
  return { x: x - 1, y: sy }
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len
}

function douglasPeucker(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 3) return pts
  let maxDist = 0, idx = 0
  const a = pts[0], b = pts[pts.length - 1]
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], a, b)
    if (d > maxDist) { maxDist = d; idx = i }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(pts.slice(0, idx + 1), epsilon)
    const right = douglasPeucker(pts.slice(idx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [a, b]
}

// Simplifie un contour FERME : coupe la boucle en 2 chaines a des points
// opposes, simplifie chaque chaine independamment, recolle.
function simplifyClosed(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length < 8) return pts
  const n = pts.length
  const mid = Math.floor(n / 2)
  const chain1 = pts.slice(0, mid + 1)
  const chain2 = [...pts.slice(mid), ...pts.slice(0, 1)]
  const s1 = douglasPeucker(chain1, epsilon)
  const s2 = douglasPeucker(chain2, epsilon)
  return [...s1.slice(0, -1), ...s2.slice(0, -1)]
}

// Lissage leger (moyenne glissante, contour ferme) -- attenue le bruit
// pixel-a-pixel du trace sans gommer les vrais coins (fenetre petite).
function smoothContour(pts: Pt[], radius: number): Pt[] {
  const n = pts.length
  return pts.map((_, i) => {
    let sx = 0, sy = 0, c = 0
    for (let k = -radius; k <= radius; k++) {
      const p = pts[(i + k + n) % n]
      sx += p.x; sy += p.y; c++
    }
    return { x: sx / c, y: sy / c }
  })
}

// ── Contrainte geometrique : une carte, c'est un RECTANGLE dans lequel on
// decoupe des morceaux -- pas une forme libre. Une simplification generique
// (Douglas-Peucker seul) n'a aucune notion de "ceci doit etre un bord droit
// du rectangle" : elle traite le bruit du masque et une vraie encoche de la
// meme facon, avec un seul epsilon global qui ne peut pas convenir a la
// fois a une carte a grosses encoches et une carte a petites encoches.
//
// Ici : on detecte le rectangle de base (englobant minimal, eventuellement
// tourne si la photo n'est pas parfaitement droite), puis CHAQUE point du
// contour est accroche exactement sur ce rectangle SAUF s'il s'en ecarte
// assez pour etre une vraie encoche -- le bord reste droit par construction
// la ou il n'y a pas de decoupe, au lieu de dependre d'un lissage qui
// devine.

function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop(); upper.pop()
  return [...lower, ...upper]
}

// Rectangle englobant d'aire minimale (rotating calipers) : teste chaque
// orientation donnee par une arete de l'enveloppe convexe -- le rectangle
// minimal d'un nuage de points a toujours un cote aligne avec une arete de
// son enveloppe convexe.
function minAreaRect(hull: Pt[]): Pt[] {
  if (hull.length < 3) return hull
  let best: { area: number; c: number; s: number; minU: number; maxU: number; minV: number; maxV: number } | null = null
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i], p2 = hull[(i + 1) % hull.length]
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    const c = Math.cos(angle), s = Math.sin(angle)
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
    for (const p of hull) {
      const u = p.x * c + p.y * s
      const v = -p.x * s + p.y * c
      if (u < minU) minU = u
      if (u > maxU) maxU = u
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const area = (maxU - minU) * (maxV - minV)
    if (!best || area < best.area) best = { area, c, s, minU, maxU, minV, maxV }
  }
  const { c, s, minU, maxU, minV, maxV } = best!
  const corner = (u: number, v: number): Pt => ({ x: u * c - v * s, y: u * s + v * c })
  return [corner(minU, minV), corner(maxU, minV), corner(maxU, maxV), corner(minU, maxV)]
}

function pointToSegment(p: Pt, a: Pt, b: Pt): { dist: number; proj: Pt } {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = len2 > 1e-9 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const proj = { x: a.x + dx * t, y: a.y + dy * t }
  return { dist: Math.hypot(p.x - proj.x, p.y - proj.y), proj }
}

// Accroche chaque point du contour sur le bord du rectangle le plus proche
// s'il en est a moins de notchThreshold (bruit du masque, pas une vraie
// decoupe) -- sinon garde le point tel quel (vraie encoche, preservee).
function snapToRect(pts: Pt[], rect: Pt[], notchThreshold: number): Pt[] {
  const sides: [Pt, Pt][] = [[rect[0], rect[1]], [rect[1], rect[2]], [rect[2], rect[3]], [rect[3], rect[0]]]
  return pts.map(p => {
    let best: { dist: number; proj: Pt } | null = null
    for (const [a, b] of sides) {
      const r = pointToSegment(p, a, b)
      if (!best || r.dist < best.dist) best = r
    }
    return best && best.dist < notchThreshold ? best.proj : p
  })
}

function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, result: DetectResult) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (!result.found || !result.mask640) return

  const { padX, padY, newW, newH, scale } = letterbox(img)
  const toImg = (p: Pt): Pt => ({ x: (p.x - padX) / scale, y: (p.y - padY) / scale })

  const bin = new Uint8Array(IMGSZ * IMGSZ)
  for (let i = 0; i < result.mask640.length; i++) bin[i] = result.mask640[i] >= 0.5 ? 1 : 0
  const start = findBoundaryStart(result.mask640, bin, IMGSZ, IMGSZ)
  if (!start) return
  const traced = traceMooreBoundary(bin, IMGSZ, IMGSZ, start)
  const simplified = simplifyClosed(traced, 1.2)

  // Rectangle de base de la carte + accroche : un bord sans vraie encoche
  // colle exactement au rectangle (droit par construction), une vraie
  // encoche (deviation > seuil) est preservee telle quelle.
  const rect = minAreaRect(convexHull(simplified))
  const NOTCH_THRESHOLD_640 = 8
  const snapped = snapToRect(simplified, rect, NOTCH_THRESHOLD_640)
  const contour640 = smoothContour(snapped, 1)
  const contourImg = contour640.map(toImg)

  ctx.beginPath()
  contourImg.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,255,120,0.22)'
  ctx.fill()
  ctx.lineWidth = Math.max(2, img.naturalWidth / 300)
  ctx.strokeStyle = '#00e676'
  ctx.stroke()
}

export default function DiecutTestPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ found: boolean; conf: number; ms: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
    setInfo(null)
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image invalide'))
        img.src = url
      })

      const ort = await import('onnxruntime-web')
      ort.env.wasm.wasmPaths = ORT_CDN
      ort.env.wasm.numThreads = 1

      const result = await detect(ort, img)
      setInfo({ found: result.found, conf: result.conf, ms: result.ms })
      if (canvasRef.current) draw(canvasRef.current, img, result)

      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 14px 60px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>✂️ Test détection DieCut</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        Modèle expérimental (138 images annotées) — jamais branché sur le scanner, test uniquement.
      </p>
      <p style={{ fontSize: 12, color: '#e67e22', marginBottom: 16 }}>
        ⚠️ Modèle de 45 Mo — premier chargement un peu lent, normal pour cette page de test.
      </p>

      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
        style={{ marginBottom: 16 }}
      />

      {busy && <p>⏳ Analyse en cours…</p>}
      {error && <p style={{ color: '#e74c3c' }}>{error}</p>}
      {info && (
        <p style={{ fontSize: 13, fontWeight: 700, color: info.found ? '#2d6a4f' : '#e74c3c' }}>
          {info.found ? `Die-cut détectée — conf ${info.conf.toFixed(3)} — ${info.ms.toFixed(0)}ms` : `Aucune détection — ${info.ms.toFixed(0)}ms`}
        </p>
      )}

      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '100%', borderRadius: 8, background: '#eee', marginTop: 12 }} />
    </div>
  )
}
