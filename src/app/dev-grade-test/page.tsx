'use client'
import { useRef, useState } from 'react'
import { refineCornersV5 } from '@/lib/cornerDetectorYolo'

// Page de test pour experimenter une estimation de condition (centrage +
// etat des coins) a partir du detecteur de coins deja en prod. Pas de gate
// de connexion -- l'URL non listee suffit, personne ne la connait. Volontairement
// PAS un grade chiffre façon PSA -- les sous-scores sont affiches separement,
// voir la discussion produit associee : une photo de telephone sans eclairage
// controle ne justifie pas une precision numerique unique.
//
// Coins ET lignes de bordure deplacables SUR LA MEME PHOTO (pas de deuxieme
// image "redressee" separee) : la bordure est detectee via un warp bilineaire
// interne (voir warpQuadToRect/detectBorderWidth), mais affichee en reprojetant
// les 2 lignes trouvees dans l'espace de la photo d'origine -- une ligne "u
// constant" dans l'image redressee est un segment droit entre le point
// correspondant sur l'arete haute et celui sur l'arete basse du quadrilatere
// (et vice-versa pour "v constant"), c'est une propriete du warp bilineaire.
// Glisser une ligne convertit sa position en (u,v) approximatifs via
// inverseBilinearUV -- une seule passe, pas iteratif, suffisant pour un
// quadrilatere proche d'un rectangle (photo prise a peu pres de face).

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
const MODEL_URL = '/models/corners.onnx'
const WARP_W = 500
const WARP_H = 700

type Pt = { x: number; y: number }
// Bordure exprimee en FRACTION (0..1) du cote correspondant du quadrilatere,
// pas en pixels -- permet de reprojeter les lignes sur la photo d'origine
// quels que soient sa taille et l'angle du quadrilatere.
type BorderFrac = { left: number; right: number; top: number; bottom: number }
type Percents = { leftRightPct: [number, number]; topBottomPct: [number, number] }

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
  return { canvas, padX, padY, scale }
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

async function detectRawCorners(ort: typeof import('onnxruntime-web'), img: HTMLImageElement): Promise<{ corners: Pt[] | null; conf: number }> {
  const session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] })
  const { canvas, padX, padY, scale } = letterbox(img)
  const tensorData = toTensor(canvas)
  const input = new ort.Tensor('float32', tensorData, [1, 3, IMGSZ, IMGSZ])
  const result = await session.run({ [session.inputNames[0]]: input })
  const outTensor = result[session.outputNames[0]]
  const raw = outTensor.data as Float32Array
  const dims = outTensor.dims as number[]
  const N = dims[2]
  let bestConf = 0.3
  let bestIdx = -1
  for (let i = 0; i < N; i++) {
    const conf = raw[4 * N + i]
    if (conf > bestConf) { bestConf = conf; bestIdx = i }
  }
  if (bestIdx < 0) return { corners: null, conf: 0 }
  const corners: Pt[] = []
  for (let k = 0; k < 4; k++) {
    const kx = raw[(5 + k * 3) * N + bestIdx]
    const ky = raw[(5 + k * 3 + 1) * N + bestIdx]
    corners.push({ x: (kx - padX) / scale, y: (ky - padY) / scale })
  }
  return { corners, conf: bestConf }
}

// Interpolation bilineaire du quadrilatere [TL,TR,BR,BL] vers un rectangle
// outW x outH -- approximation (pas une vraie homographie projective) mais
// largement suffisante pour une photo prise a peu pres de face. Sert
// uniquement au calcul interne (detectBorderWidth a besoin d'une image
// redressee) -- plus jamais affiche directement, voir borderSegments.
function warpQuadToRect(img: HTMLImageElement, quad: Pt[], outW: number, outH: number): HTMLCanvasElement {
  const [TL, TR, BR, BL] = quad
  const src = document.createElement('canvas')
  src.width = img.naturalWidth
  src.height = img.naturalHeight
  src.getContext('2d')!.drawImage(img, 0, 0)
  const srcData = src.getContext('2d')!.getImageData(0, 0, src.width, src.height).data
  const sw = src.width, sh = src.height

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')!
  const outImgData = octx.createImageData(outW, outH)
  const outData = outImgData.data

  for (let v = 0; v < outH; v++) {
    const vf = v / (outH - 1)
    const leftX = TL.x + vf * (BL.x - TL.x), leftY = TL.y + vf * (BL.y - TL.y)
    const rightX = TR.x + vf * (BR.x - TR.x), rightY = TR.y + vf * (BR.y - TR.y)
    for (let u = 0; u < outW; u++) {
      const uf = u / (outW - 1)
      const sx = Math.round(leftX + uf * (rightX - leftX))
      const sy = Math.round(leftY + uf * (rightY - leftY))
      const di = (v * outW + u) * 4
      if (sx >= 0 && sx < sw && sy >= 0 && sy < sh) {
        const si = (sy * sw + sx) * 4
        outData[di] = srcData[si]; outData[di + 1] = srcData[si + 1]; outData[di + 2] = srcData[si + 2]; outData[di + 3] = 255
      }
    }
  }
  octx.putImageData(outImgData, 0, 0)
  return out
}

// Largeur de bordure (px, dans l'espace redresse WARP_W x WARP_H) sur un des
// 4 cotes : moyenne la luminance sur une bande perpendiculaire a chaque
// position en avançant depuis le bord, et repere le plus gros saut de
// luminance (transition bordure -> zone imprimee). Point de depart seulement
// -- ajustable a la main ensuite (voir borderSegments/drag).
function detectBorderWidth(canvas: HTMLCanvasElement, side: 'left' | 'right' | 'top' | 'bottom'): number {
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  const { data } = ctx.getImageData(0, 0, W, H)
  const lum = (x: number, y: number) => {
    const i = (y * W + x) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const isVertical = side === 'left' || side === 'right'
  const scanLen = isVertical ? W : H
  const perpLen = isVertical ? H : W
  const step = Math.max(1, Math.floor(perpLen / 40))
  const sampleAt = (pos: number) => {
    let sum = 0, cnt = 0
    for (let p = 0; p < perpLen; p += step) {
      const x = isVertical ? pos : p
      const y = isVertical ? p : pos
      sum += lum(x, y); cnt++
    }
    return sum / cnt
  }
  const limit = Math.floor(scanLen * 0.25)
  const profile: number[] = []
  for (let i = 0; i < limit; i++) {
    const pos = (side === 'left' || side === 'top') ? i : scanLen - 1 - i
    profile.push(sampleAt(pos))
  }
  let bestIdx = limit - 1, bestGrad = 0
  for (let i = 2; i < profile.length - 1; i++) {
    const grad = Math.abs(profile[i + 1] - profile[i - 1])
    if (grad > bestGrad) { bestGrad = grad; bestIdx = i }
  }
  return bestIdx
}

// ── Geometrie du quadrilatere [TL,TR,BR,BL] ─────────────────────────────
function topEdgePt(q: Pt[], u: number): Pt { const [TL, TR] = q; return { x: TL.x + u * (TR.x - TL.x), y: TL.y + u * (TR.y - TL.y) } }
function bottomEdgePt(q: Pt[], u: number): Pt { const [, , BR, BL] = q; return { x: BL.x + u * (BR.x - BL.x), y: BL.y + u * (BR.y - BL.y) } }
function leftEdgePt(q: Pt[], v: number): Pt { const [TL, , , BL] = q; return { x: TL.x + v * (BL.x - TL.x), y: TL.y + v * (BL.y - TL.y) } }
function rightEdgePt(q: Pt[], v: number): Pt { const [, TR, BR] = q; return { x: TR.x + v * (BR.x - TR.x), y: TR.y + v * (BR.y - TR.y) } }

// Segments (dans l'espace de la photo d'origine) representant chacune des 4
// lignes de bordure -- une ligne "u constant" du warp est un segment droit
// entre le point correspondant sur l'arete haute et celui sur l'arete basse
// (propriete du warp bilineaire), et inversement pour "v constant".
function borderSegments(q: Pt[], f: BorderFrac) {
  return {
    left: [topEdgePt(q, f.left), bottomEdgePt(q, f.left)] as [Pt, Pt],
    right: [topEdgePt(q, 1 - f.right), bottomEdgePt(q, 1 - f.right)] as [Pt, Pt],
    top: [leftEdgePt(q, f.top), rightEdgePt(q, f.top)] as [Pt, Pt],
    bottom: [leftEdgePt(q, 1 - f.bottom), rightEdgePt(q, 1 - f.bottom)] as [Pt, Pt],
  }
}

// Approximation inverse du warp bilineaire : retrouve (u,v) pour un point de
// la photo d'origine. Une seule passe (pas iteratif) -- estime v via les
// aretes gauche/droite, puis u via les points gauche/droite interpoles a ce
// v. Suffisant pour un quadrilatere proche d'un rectangle.
function inverseBilinearUV(q: Pt[], pos: Pt): { u: number; v: number } {
  const [TL, TR, BR, BL] = q
  const leftLen2 = (BL.x - TL.x) ** 2 + (BL.y - TL.y) ** 2 || 1
  const rightLen2 = (BR.x - TR.x) ** 2 + (BR.y - TR.y) ** 2 || 1
  const vLeft = ((pos.x - TL.x) * (BL.x - TL.x) + (pos.y - TL.y) * (BL.y - TL.y)) / leftLen2
  const vRight = ((pos.x - TR.x) * (BR.x - TR.x) + (pos.y - TR.y) * (BR.y - TR.y)) / rightLen2
  const v = Math.max(0, Math.min(1, (vLeft + vRight) / 2))
  const leftPt = leftEdgePt(q, v)
  const rightPt = rightEdgePt(q, v)
  const uLen2 = (rightPt.x - leftPt.x) ** 2 + (rightPt.y - leftPt.y) ** 2 || 1
  const u = ((pos.x - leftPt.x) * (rightPt.x - leftPt.x) + (pos.y - leftPt.y) * (rightPt.y - leftPt.y)) / uLen2
  return { u: Math.max(0, Math.min(1, u)), v }
}

function distToSegment(p: Pt, [a, b]: [Pt, Pt]): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len2 = dx * dx + dy * dy || 1
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

function percentsFromBorders(f: BorderFrac): Percents {
  const lrTotal = f.left + f.right || 1
  const tbTotal = f.top + f.bottom || 1
  return {
    leftRightPct: [Math.round((f.left / lrTotal) * 100), Math.round((f.right / lrTotal) * 100)],
    topBottomPct: [Math.round((f.top / tbTotal) * 100), Math.round((f.bottom / tbTotal) * 100)],
  }
}

// Variance du Laplacien dans un petit patch autour du coin -- mesure de nettete
// classique (plus la variance est haute, plus le coin est net/contraste ;
// un coin use/arrondi/blanchi a un profil plus flou -> variance plus basse).
function cornerSharpness(img: HTMLImageElement, pt: Pt, patch = 28): number {
  const canvas = document.createElement('canvas')
  canvas.width = patch
  canvas.height = patch
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, pt.x - patch / 2, pt.y - patch / 2, patch, patch, 0, 0, patch, patch)
  const { data } = ctx.getImageData(0, 0, patch, patch)
  const gray = new Float32Array(patch * patch)
  for (let i = 0; i < patch * patch; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  let sum = 0, sumSq = 0, n = 0
  for (let y = 1; y < patch - 1; y++) {
    for (let x = 1; x < patch - 1; x++) {
      const idx = y * patch + x
      const lap = gray[idx - 1] + gray[idx + 1] + gray[idx - patch] + gray[idx + patch] - 4 * gray[idx]
      sum += lap; sumSq += lap * lap; n++
    }
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

function sharpnessLabel(v: number): { text: string; color: string } {
  if (v > 900) return { text: 'Net', color: '#16a34a' }
  if (v > 400) return { text: 'Usure légère', color: '#d97706' }
  return { text: 'Usure visible', color: '#dc2626' }
}

// Le detecteur est concu pour des photos avec un peu de marge/fond autour de
// la carte (comme le vrai scanner) -- sur une image deja recadree pile sur la
// carte, il n'y a plus de vrai bord physique carte->fond a trouver, et le
// raffinement se rabat sur le prochain contraste fort a l'INTERIEUR (logo,
// bordure imprimee), donnant un contour trop petit sans que rien ne le
// signale. Heuristique basee sur la photo elle-meme (pas sur la sortie du
// detecteur, potentiellement deja fausse) : si le ratio largeur/hauteur de
// l'image colle de pres au ratio standard d'une carte (2.5x3.5), il n'y a
// probablement pas de marge -- une vraie photo de telephone a un fond visible
// et un ratio different.
const CARD_RATIO = 2.5 / 3.5
function looksPreCropped(imgW: number, imgH: number): boolean {
  const ratio = Math.min(imgW, imgH) / Math.max(imgW, imgH)
  return Math.abs(ratio - CARD_RATIO) < 0.04
}

const cornerNames = ['Haut-gauche', 'Haut-droite', 'Bas-droite', 'Bas-gauche']

export default function DevGradeTest() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preCropped, setPreCropped] = useState(false)
  const [conf, setConf] = useState(0)
  const [hasCorners, setHasCorners] = useState(false)
  const [preCropWarning, setPreCropWarning] = useState(false)
  const [percents, setPercents] = useState<Percents | null>(null)
  const [cornerScores, setCornerScores] = useState<number[] | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  // Sources de verite pendant un drag -- eviter de dependre du state React
  // (qui peut retarder d'une frame par rapport aux evenements pointer) pour
  // que le trace suive la souris sans a-coups.
  const cornersRef = useRef<Pt[] | null>(null)
  const fracRef = useRef<BorderFrac | null>(null)
  const dragCornerIdxRef = useRef<number | null>(null)
  const dragBorderSideRef = useRef<keyof BorderFrac | null>(null)

  const redrawOverlay = (pts: Pt[], frac: BorderFrac) => {
    const img = imgRef.current, c = canvasRef.current
    if (!img || !c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0)

    const lw = Math.max(3, img.naturalWidth / 300)
    const segs = borderSegments(pts, frac)
    ctx.lineWidth = lw
    ctx.setLineDash([Math.max(10, img.naturalWidth / 150), Math.max(7, img.naturalWidth / 220)])
    ctx.strokeStyle = 'rgba(0, 200, 120, 0.95)'
    ;[segs.left, segs.right].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() })
    ctx.strokeStyle = 'rgba(30, 120, 255, 0.95)'
    ;[segs.top, segs.bottom].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() })
    ctx.setLineDash([])

    ctx.strokeStyle = '#ff8c00'
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = '#ff8c00'
    pts.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, Math.max(9, img.naturalWidth / 70), 0, Math.PI * 2)
      ctx.fill()
    })
  }

  const recompute = (pts: Pt[]) => {
    const img = imgRef.current
    if (!img) return
    const warp = warpQuadToRect(img, pts, WARP_W, WARP_H)
    const frac: BorderFrac = {
      left: detectBorderWidth(warp, 'left') / WARP_W,
      right: detectBorderWidth(warp, 'right') / WARP_W,
      top: detectBorderWidth(warp, 'top') / WARP_H,
      bottom: detectBorderWidth(warp, 'bottom') / WARP_H,
    }
    fracRef.current = frac
    redrawOverlay(pts, frac)
    setPercents(percentsFromBorders(frac))
    setCornerScores(pts.map(p => cornerSharpness(img, p)))
  }

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
    setPercents(null)
    setCornerScores(null)
    setHasCorners(false)
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image invalide'))
        img.src = url
      })
      imgRef.current = img

      let pts: Pt[]
      let c = 1
      if (preCropped) {
        // Carte deja rognee pile sur ses bords -- pas de detection a faire,
        // la carte EST l'image entiere.
        pts = [
          { x: 0, y: 0 },
          { x: img.naturalWidth, y: 0 },
          { x: img.naturalWidth, y: img.naturalHeight },
          { x: 0, y: img.naturalHeight },
        ]
      } else {
        const ort = await import('onnxruntime-web')
        ort.env.wasm.wasmPaths = ORT_CDN
        ort.env.wasm.numThreads = 1

        const scale = Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)
        const { corners: rawCorners, conf: rawConf } = await detectRawCorners(ort, img)
        if (!rawCorners) throw new Error('Aucune carte détectée')
        pts = refineCornersV5(img, rawCorners, scale)
        c = rawConf
      }

      if (canvasRef.current) {
        canvasRef.current.width = img.naturalWidth
        canvasRef.current.height = img.naturalHeight
      }
      cornersRef.current = pts
      setConf(c)
      setHasCorners(true)
      setPreCropWarning(!preCropped && looksPreCropped(img.naturalWidth, img.naturalHeight))
      recompute(pts)

      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const posFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const c = e.currentTarget
    const rect = c.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (c.width / rect.width),
      y: (e.clientY - rect.top) * (c.height / rect.height),
    }
  }

  // ── Drag combiné : coins (poignées oranges) ET lignes de bordure ────────
  // (vert gauche/droite, bleu haut/bas), directement sur la photo d'origine.
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = cornersRef.current, frac = fracRef.current, img = imgRef.current
    if (!pts || !frac || !img) return
    const pos = posFromEvent(e)

    const cornerHitRadius = Math.max(24, img.naturalWidth / 30)
    let nearestCorner = -1, nearestCornerDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.hypot(p.x - pos.x, p.y - pos.y)
      if (d < nearestCornerDist) { nearestCornerDist = d; nearestCorner = i }
    })
    if (nearestCornerDist <= cornerHitRadius) {
      dragCornerIdxRef.current = nearestCorner
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }

    const segs = borderSegments(pts, frac)
    const lineHitRadius = Math.max(18, img.naturalWidth / 60)
    let bestSide: keyof BorderFrac | null = null, bestDist = lineHitRadius
    ;(Object.keys(segs) as (keyof BorderFrac)[]).forEach(k => {
      const d = distToSegment(pos, segs[k])
      if (d < bestDist) { bestDist = d; bestSide = k }
    })
    if (bestSide) {
      dragBorderSideRef.current = bestSide
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pts = cornersRef.current, frac = fracRef.current
    if (!pts || !frac) return
    const pos = posFromEvent(e)

    if (dragCornerIdxRef.current !== null) {
      const next = pts.map((p, i) => (i === dragCornerIdxRef.current ? pos : p))
      cornersRef.current = next
      redrawOverlay(next, frac)
      return
    }

    const side = dragBorderSideRef.current
    if (side) {
      const { u, v } = inverseBilinearUV(pts, pos)
      const nextFrac = { ...frac }
      if (side === 'left') nextFrac.left = u
      else if (side === 'right') nextFrac.right = 1 - u
      else if (side === 'top') nextFrac.top = v
      else if (side === 'bottom') nextFrac.bottom = 1 - v
      fracRef.current = nextFrac
      redrawOverlay(pts, nextFrac)
      setPercents(percentsFromBorders(nextFrac))
    }
  }

  const onPointerUp = () => {
    const wasCorner = dragCornerIdxRef.current !== null
    dragCornerIdxRef.current = null
    dragBorderSideRef.current = null
    // Un coin deplace change la geometrie du warp -- on refait une detection
    // fraiche de la bordure (les reglages manuels de bordure precedents sont
    // perdus, mais un ajustement de coin se fait normalement avant, pas apres).
    if (wasCorner && cornersRef.current) recompute(cornersRef.current)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 14px 60px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>🧪 Test condition (centrage + coins)</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        Page privée, expérimentale. Pas un grade officiel — indicateurs séparés seulement,
        aucun score global. Warp par approximation bilinéaire (pas une vraie homographie),
        seuils de netteté non calibrés à grande échelle.
      </p>
      <p style={{ fontSize: 11, color: '#bbb', marginBottom: 16, fontFamily: 'monospace' }}>
        build: {process.env.NEXT_PUBLIC_APP_VERSION}
      </p>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 10 }}>
        <input type="checkbox" checked={preCropped} onChange={e => setPreCropped(e.target.checked)} />
        Carte déjà rognée (pas de fond autour) — saute la détection, utilise l'image entière comme carte
      </label>

      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={e => e.target.files?.[0] && onFile(e.target.files[0])}
        style={{ marginBottom: 16 }}
      />

      {busy && <p>⏳ Analyse en cours…</p>}
      {error && <p style={{ color: '#e74c3c' }}>{error}</p>}

      {hasCorners && (
        <p style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
          Glisse les points orange (coins) ou les lignes vertes/bleues (bordure) directement sur la photo —
          la bordure se recalcule en direct, les coins au relâchement.
        </p>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ width: '100%', maxWidth: 500, borderRadius: 8, background: '#eee', display: hasCorners ? 'block' : 'none', touchAction: 'none', cursor: 'grab' }}
      />

      {percents && (
        <div style={{ marginTop: 20, display: 'grid', gap: 20 }}>
          {preCropWarning && (
            <div style={{ fontSize: 13, color: '#9a6a00', background: '#fff8e6', border: '1px solid #f0dfa8', borderRadius: 8, padding: '10px 12px' }}>
              ⚠️ Cette photo semble déjà recadrée pile sur la carte (ratio proche de 2.5:3.5, pas de marge/fond visible).
              Le détecteur est conçu pour repérer le bord physique carte→fond ; sans fond, il peut se rabattre sur un
              contraste interne (logo, bordure imprimée) et donner un contour trop petit — corrige les coins ou les
              lignes à la main ci-dessus, ou coche "Carte déjà rognée" et relance.
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800 }}>Détection — conf {conf.toFixed(3)}</h3>
          </div>

          <div>
            <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Centrage (approximatif)</h3>
            <p style={{ fontSize: 13 }}>Gauche / Droite : <strong>{percents.leftRightPct[0]} / {percents.leftRightPct[1]}</strong></p>
            <p style={{ fontSize: 13 }}>Haut / Bas : <strong>{percents.topBottomPct[0]} / {percents.topBottomPct[1]}</strong></p>
          </div>

          {cornerScores && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Netteté des coins (heuristique, non calibrée)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {cornerScores.map((s, i) => {
                  const { text, color } = sharpnessLabel(s)
                  return (
                    <div key={i} style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: '#888' }}>{cornerNames[i]}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color }}>{text}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>score brut: {s.toFixed(0)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
