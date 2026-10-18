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

  // bbox en espace prototype (160x160, soit /4 de 640), marge de securite pour
  // ne pas trancher le contour pile au bord de la bbox brute du detecteur
  const protoScale = PW / IMGSZ
  const margin = 2
  const x0 = Math.max(0, Math.round((cx - bw / 2) * protoScale) - margin)
  const y0 = Math.max(0, Math.round((cy - bh / 2) * protoScale) - margin)
  const x1 = Math.min(PW, Math.round((cx + bw / 2) * protoScale) + margin)
  const y1 = Math.min(PH, Math.round((cy + bh / 2) * protoScale) + margin)

  // upscale bilineaire 160x160 -> 640x640 (pas nearest-neighbor) : le
  // prototype est une probabilite continue, l'interpolation donne un
  // contour qui suit une vraie courbe au lieu de blocs en escalier
  const mask640 = new Float32Array(IMGSZ * IMGSZ)
  const down = PW / IMGSZ
  for (let yy = 0; yy < IMGSZ; yy++) {
    const py = yy * down
    const py0 = Math.max(y0, Math.min(PH - 1, Math.floor(py)))
    const py1 = Math.min(PH - 1, py0 + 1)
    const fy = py - py0
    for (let xx = 0; xx < IMGSZ; xx++) {
      const px = xx * down
      if (px < x0 || px >= x1 || py < y0 || py >= y1) continue
      const px0 = Math.max(x0, Math.min(PW - 1, Math.floor(px)))
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

// Centre de masse du masque (pondere par la probabilite), espace 640 letterbox.
function maskCentroid(mask640: Float32Array): Pt {
  let sx = 0, sy = 0, sw = 0
  for (let y = 0; y < IMGSZ; y++) {
    for (let x = 0; x < IMGSZ; x++) {
      const p = mask640[y * IMGSZ + x]
      if (p < 0.5) continue
      sx += x * p; sy += y * p; sw += p
    }
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : { x: IMGSZ / 2, y: IMGSZ / 2 }
}

// Echantillonne le contour du masque par rayons depuis le centre (coordonnees
// polaires) : pour la plupart des formes die-cut (encoches proches du centre,
// silhouette globalement "en etoile" autour du centre de la carte), c'est
// suffisant pour suivre les decrochages sans un vrai traceur de contour.
function sampleContourPolar(mask640: Float32Array, centroid: Pt, nAngles: number): Pt[] {
  const pts: Pt[] = []
  const maxR = IMGSZ * 0.75
  for (let a = 0; a < nAngles; a++) {
    const theta = (a / nAngles) * Math.PI * 2
    const dx = Math.cos(theta), dy = Math.sin(theta)
    let prevR = 0, prevP = 1
    let found: Pt | null = null
    for (let r = 1; r <= maxR; r += 1.5) {
      const x = centroid.x + dx * r, y = centroid.y + dy * r
      if (x < 0 || x >= IMGSZ || y < 0 || y >= IMGSZ) break
      const p = mask640[Math.round(y) * IMGSZ + Math.round(x)]
      if (p < 0.5 && prevP >= 0.5) {
        // interpolation sous-pixel entre le dernier point "dedans" et celui-ci
        const t = (0.5 - prevP) / (p - prevP)
        const rr = prevR + (r - prevR) * t
        found = { x: centroid.x + dx * rr, y: centroid.y + dy * rr }
        break
      }
      prevR = r; prevP = p
    }
    pts.push(found || { x: centroid.x + dx * prevR, y: centroid.y + dy * prevR })
  }
  return pts
}

// Lissage leger (moyenne glissante, contour ferme) -- attenue le bruit du
// masque avant d'en deduire les normales locales, sans gommer les vrais
// coins (fenetre petite).
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

// Normale locale au point i, deduite de la tangente (points voisins) plutot
// que de la direction radiale depuis le centre -- la direction radiale est
// une mauvaise approximation du bord reel la ou le contour tourne vite
// (coins, encoches), la tangente locale donne la vraie normale.
function localNormals(pts: Pt[], centroid: Pt): Pt[] {
  const n = pts.length
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n]
    const tx = next.x - prev.x, ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    let nx = -ty / len, ny = tx / len
    // oriente vers l'exterieur (s'eloigne du centre)
    if ((p.x - centroid.x) * nx + (p.y - centroid.y) * ny < 0) { nx = -nx; ny = -ny }
    return { x: nx, y: ny }
  })
}

// Affine un point de contour en cherchant le plus fort ecart de couleur (par
// canal, comme pour les coins) le long de la normale locale -- recale sur le
// vrai bord physique de la carte plutot que sur le flou du masque de
// segmentation.
const EDGE_MIN_CONTRAST = 18

function snapToColorEdge(
  data: Uint8ClampedArray, w: number, h: number,
  pt: Pt, normal: Pt, searchPx: number,
): Pt {
  const sample = (x: number, y: number, c: number) => {
    const xi = Math.min(w - 1, Math.max(0, Math.round(x)))
    const yi = Math.min(h - 1, Math.max(0, Math.round(y)))
    return data[(yi * w + xi) * 4 + c]
  }
  const scoreAt = (t: number) => {
    const x = pt.x + normal.x * t, y = pt.y + normal.y * t
    const x1 = x - normal.x, y1 = y - normal.y, x2 = x + normal.x, y2 = y + normal.y
    let score = 0
    for (let c = 0; c < 3; c++) score = Math.max(score, Math.abs(sample(x2, y2, c) - sample(x1, y1, c)))
    return score
  }
  // Point qualifiant (contraste > seuil) le plus proche de t=0, en partant du
  // centre et en s'eloignant symetriquement -- pas le contraste le plus fort
  // absolu, pour ne pas sauter sur un bord voisin (meme logique que les coins).
  for (let d = 0; d <= searchPx; d += 0.5) {
    for (const t of d === 0 ? [0] : [-d, d]) {
      if (scoreAt(t) > EDGE_MIN_CONTRAST) return { x: pt.x + normal.x * t, y: pt.y + normal.y * t }
    }
  }
  return pt
}

function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, result: DetectResult) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (!result.found || !result.mask640) return

  const { padX, padY, newW, newH, scale } = letterbox(img)
  const toImg = (p: Pt): Pt => ({ x: (p.x - padX) / scale, y: (p.y - padY) / scale })

  const centroid = maskCentroid(result.mask640)
  const contour640raw = sampleContourPolar(result.mask640, centroid, 360)
  const contour640 = smoothContour(contour640raw, 2)
  let contourImg = contour640.map(toImg)

  // Recalage par contraste sur l'image d'origine, a pleine resolution --
  // seulement sur la zone utile (bbox du contour + marge), comme le
  // raffinement des coins qui ne travaille jamais sur l'image entiere.
  const xs = contourImg.map(p => p.x), ys = contourImg.map(p => p.y)
  const margin = 14
  const left = Math.max(0, Math.floor(Math.min(...xs) - margin))
  const top = Math.max(0, Math.floor(Math.min(...ys) - margin))
  const right = Math.min(img.naturalWidth, Math.ceil(Math.max(...xs) + margin))
  const bottom = Math.min(img.naturalHeight, Math.ceil(Math.max(...ys) + margin))
  const cw = right - left, ch = bottom - top

  if (cw > 0 && ch > 0) {
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = cw; cropCanvas.height = ch
    const cctx = cropCanvas.getContext('2d', { willReadFrequently: true })!
    cctx.imageSmoothingEnabled = false
    cctx.drawImage(img, left, top, cw, ch, 0, 0, cw, ch)
    const { data } = cctx.getImageData(0, 0, cw, ch)

    // normale par tangente locale (pas radiale) : bien plus fiable aux
    // coins et encoches, la ou le contour change vite de direction
    const normalsImg = localNormals(contourImg, toImg(centroid))
    const searchPx = Math.max(4, Math.round(Math.min(cw, ch) * 0.02))
    contourImg = contourImg.map((p, i) => {
      const normal = normalsImg[i]
      const local = { x: p.x - left, y: p.y - top }
      const snapped = snapToColorEdge(data, cw, ch, local, normal, searchPx)
      return { x: snapped.x + left, y: snapped.y + top }
    })
    // 2e lissage leger apres recalage : le recalage par contraste peut etre
    // bruyant point a point (chaque point cherche independamment), un leger
    // lissage final enleve le residuel en dents de scie sans perdre les coins.
    contourImg = smoothContour(contourImg, 1)
  }

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
