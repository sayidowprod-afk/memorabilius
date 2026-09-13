'use client'
import { useRef, useState } from 'react'
import { refineCornersV5 } from '@/lib/cornerDetectorYolo'
import { useTheme } from '@/lib/ThemeContext'
import CameraCapture from '@/components/CameraCapture'

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

// Sous-note 1-10 a partir de l'ecart de centrage par rapport a 50/50 (comme
// PSA/BGS raisonnent, mais seuils invente/non calibres -- voir avertissement
// affiche a cote de la note). deviation = ecart max des 2 cotes par rapport
// au centre parfait (50/50 -> 0, 60/40 -> 10, 100/0 -> 50).
function centeringSubscore(pct: [number, number]): number {
  const dev = Math.max(Math.abs(pct[0] - 50), Math.abs(pct[1] - 50))
  const steps = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45]
  const scores = [10, 9.5, 9, 8, 7, 6, 5, 4, 3, 2]
  for (let i = 0; i < steps.length; i++) if (dev <= steps[i]) return scores[i]
  return 1
}

// Sous-note 1-10 a partir du score de nettete brut (variance du Laplacien) --
// memes seuils que sharpnessLabel, juste plus granulaires pour une note.
function cornerSubscore(v: number): number {
  const steps = [30, 80, 150, 250, 400, 600, 900, 1500, 2500]
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = 0; i < steps.length; i++) if (v <= steps[i]) return scores[i]
  return 10
}

// Note globale indicative (1-10) : le point faible domine (comme une vraie
// gradation, ou le pire defaut plombe la note), amorti par la moyenne pour
// eviter qu'un seul coin flou n'ecrase tout. Ne prend PAS en compte la
// surface ni les bords (non evalues ici) -- voir avertissement affiche.
function estimateGrade(leftRightPct: [number, number], topBottomPct: [number, number], cornerScores: number[]): number {
  const centSub = Math.min(centeringSubscore(leftRightPct), centeringSubscore(topBottomPct))
  const cornerSub = cornerScores.reduce((a, b) => a + cornerSubscore(b), 0) / cornerScores.length
  const worst = Math.min(centSub, cornerSub)
  const avg = (centSub + cornerSub) / 2
  return Math.round((worst * 0.6 + avg * 0.4) * 2) / 2
}

function gradeColor(grade: number): string {
  if (grade >= 9) return '#16a34a'
  if (grade >= 7) return '#65a30d'
  if (grade >= 5) return '#d97706'
  return '#dc2626'
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

function CenteringBar({ leftLabel, rightLabel, pct, blue, border, muted, text }: {
  leftLabel: string; rightLabel: string; pct: [number, number]
  blue: string; border: string; muted: string; text: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: text, fontWeight: 700 }}>{leftLabel} <span style={{ color: muted, fontWeight: 400 }}>{pct[0]}%</span></span>
        <span style={{ color: text, fontWeight: 700 }}>{rightLabel} <span style={{ color: muted, fontWeight: 400 }}>{pct[1]}%</span></span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 7, overflow: 'hidden', background: border }}>
        <div style={{ width: `${pct[0]}%`, background: blue }} />
        <div style={{ width: `${pct[1]}%`, background: '#7db3ff' }} />
      </div>
    </div>
  )
}

export default function DevGradeTest() {
  const { dark } = useTheme()
  const bg     = dark ? '#0a0a0a' : '#f0f2f7'
  const cardBg = dark ? '#161616' : '#ffffff'
  const text   = dark ? '#f0f0f0' : '#0d0d0d'
  const muted  = dark ? '#666'    : '#888'
  const border = dark ? '#252525' : '#e8eaed'
  const blue   = '#0046D1'
  const warnText = dark ? '#d9a441' : '#9a6a00'
  const warnBg   = dark ? '#241c08' : '#fff8e6'
  const warnBorder = dark ? '#4a3a10' : '#f0dfa8'

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preCropped, setPreCropped] = useState(false)
  const [conf, setConf] = useState(0)
  const [hasCorners, setHasCorners] = useState(false)
  const [preCropWarning, setPreCropWarning] = useState(false)
  const [percents, setPercents] = useState<Percents | null>(null)
  const [cornerScores, setCornerScores] = useState<number[] | null>(null)
  const [cameraModal, setCameraModal] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const galleryRef = useRef<HTMLInputElement | null>(null)
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
      ctx.arc(p.x, p.y, Math.max(12, img.naturalWidth / 55), 0, Math.PI * 2)
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

    // Rayons genereux (surtout sur mobile ou le doigt masque la cible) --
    // exprimes en pixels de la photo source, donc automatiquement plus
    // "genereux visuellement" sur une photo de faible resolution.
    const cornerHitRadius = Math.max(34, img.naturalWidth / 22)
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
    const lineHitRadius = Math.max(26, img.naturalWidth / 42)
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

  const reset = () => {
    setHasCorners(false)
    setPercents(null)
    setCornerScores(null)
    setError('')
    setPreCropWarning(false)
    cornersRef.current = null
    fracRef.current = null
    imgRef.current = null
  }

  const handleCapture = (blob: Blob) => {
    setCameraModal(false)
    onFile(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
  }

  const grade = percents && cornerScores ? estimateGrade(percents.leftRightPct, percents.topBottomPct, cornerScores) : null

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ position: 'sticky', top: 'calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top)))', zIndex: 10, background: dark ? '#0f0f0f' : '#fff', borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', height: 48 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: text }}>🧪 Estimation de condition</span>
        {hasCorners && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: muted, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
            Nouvelle photo
          </button>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px 12px 80px' }}>
        <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', marginBottom: 16, lineHeight: 1.5 }}>
          ⚠️ Fonctionnalité expérimentale, non liée aux vrais scans de cartes du site — sert uniquement à tester
          l'idée. Rien ici n'est un grade officiel.
        </div>

        {!hasCorners && !busy && (
          <div style={{ paddingTop: 4 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: text, background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={preCropped} onChange={e => setPreCropped(e.target.checked)} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <span>Carte déjà rognée <span style={{ color: muted }}>(pas de fond autour de la carte sur la photo)</span></span>
            </label>

            <button onClick={() => setCameraModal(true)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', minHeight: 180, background: blue, border: 'none',
              borderRadius: 20, cursor: 'pointer', color: '#fff', marginBottom: 12,
            }}>
              <span style={{ fontSize: 48, lineHeight: 1 }}>📷</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>Prendre une photo</span>
            </button>
            <button onClick={() => galleryRef.current?.click()} style={{
              width: '100%', padding: '13px 0', background: 'none', border: `2px solid ${border}`,
              borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700,
            }}>
              Importer depuis la galerie
            </button>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
            />
          </div>
        )}

        {busy && (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 12 }}>Analyse en cours…</div>
            <div style={{ height: 4, background: border, borderRadius: 4, overflow: 'hidden', maxWidth: 200, margin: '0 auto' }}>
              <div style={{ height: '100%', background: blue, borderRadius: 4, animation: 'slideIn 1.6s ease-in-out infinite', width: '50%' }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: '#dc2626', background: dark ? '#2a0f0f' : '#fdecec', border: '1px solid #f3c6c6', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
            {error}
          </div>
        )}

        {hasCorners && (
          <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: muted, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff8c00', display: 'inline-block' }} /> Coin
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 2, background: '#00c878', display: 'inline-block' }} /> Bordure G/D
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 14, height: 2, background: '#1e78ff', display: 'inline-block' }} /> Bordure H/B
              </span>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ width: '100%', borderRadius: 10, background: border, touchAction: 'none', cursor: 'grab', display: 'block' }}
            />
            <p style={{ fontSize: 11, color: muted, marginTop: 8, textAlign: 'center' }}>
              Glisse un point ou une ligne pour corriger — la bordure se recalcule en direct, les coins au relâchement.
            </p>
          </div>
        )}

        {percents && cornerScores && grade !== null && (
          <div style={{ display: 'grid', gap: 14 }}>
            {preCropWarning && (
              <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
                ⚠️ Cette photo semble déjà recadrée pile sur la carte, sans marge autour — la détection automatique
                peut se tromper. Corrige les coins/lignes à la main ci-dessus, ou coche "Carte déjà rognée" et relance.
              </div>
            )}

            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: '18px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                Note indicative
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, color: gradeColor(grade), lineHeight: 1, letterSpacing: -2, fontVariantNumeric: 'tabular-nums' }}>
                {grade.toFixed(1)}<span style={{ fontSize: 22, color: muted, fontWeight: 700 }}>/10</span>
              </div>
              <div style={{ fontSize: 11, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', marginTop: 14, lineHeight: 1.5, textAlign: 'left' }}>
                ⚠️ <strong>Ceci n'est ni un grade officiel ni une certification</strong> — aucune valeur légale ou
                commerciale, non affilié à PSA/BGS/SGC ou tout autre service de gradation. Calculée uniquement à
                partir du centrage et de la netteté des coins (seuils non calibrés) — la surface et les bords ne
                sont pas du tout évalués. À titre indicatif seulement.
              </div>
            </div>

            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14 }}>
                Centrage <span style={{ fontWeight: 400, textTransform: 'none' }}>· confiance détection {conf.toFixed(2)}</span>
              </div>
              <CenteringBar leftLabel="Gauche" rightLabel="Droite" pct={percents.leftRightPct} blue={blue} border={border} muted={muted} text={text} />
              <div style={{ height: 16 }} />
              <CenteringBar leftLabel="Haut" rightLabel="Bas" pct={percents.topBottomPct} blue={blue} border={border} muted={muted} text={text} />
            </div>

            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
                Netteté des coins
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {cornerScores.map((s, i) => {
                  const { text: label, color } = sharpnessLabel(s)
                  return (
                    <div key={i} style={{ padding: '10px 12px', background: dark ? '#111' : '#f8f9fb', border: `1px solid ${border}`, borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{cornerNames[i]}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {cameraModal && (
        <CameraCapture onCapture={handleCapture} onClose={() => setCameraModal(false)} />
      )}

      <style>{`
        @keyframes slideIn { 0% { transform: translateX(-150%); } 100% { transform: translateX(280%); } }
      `}</style>
    </div>
  )
}
