'use client'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { detectCornersYOLO } from '@/lib/cornerDetectorYolo'

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
// Premier modele die-cut (YOLOv8s-seg, 138 images annotees) -- test de
// validation uniquement, jamais branche sur le scanner (CardScanner.tsx
// n'est pas touche). On importe seulement detectCornersYOLO (lecture) du
// detecteur de coins deja en prod, aucun fichier existant n'est modifie.
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

// Echantillonne le masque ML (espace letterbox 640x640) a des coordonnees
// de l'image ORIGINALE -- recalcule le meme transform (echelle + marges)
// que letterbox() pour l'inference.
function sampleMask640(mask640: Float32Array, imgW: number, imgH: number, x: number, y: number): number {
  const scale = Math.min(IMGSZ / imgW, IMGSZ / imgH)
  const padX = Math.round((IMGSZ - Math.round(imgW * scale)) / 2)
  const padY = Math.round((IMGSZ - Math.round(imgH * scale)) / 2)
  const mx = Math.max(0, Math.min(IMGSZ - 1, Math.round(x * scale + padX)))
  const my = Math.max(0, Math.min(IMGSZ - 1, Math.round(y * scale + padY)))
  return mask640[my * IMGSZ + mx]
}

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

// Accroche sur le bord du rectangle, mais par SEGMENT continu, jamais point
// par point : un accrochage point par point (1ere version) attrapait au
// hasard certains points d'une courbe arrondie (ceux tombes pres du
// rectangle) tout en laissant les autres points de la MEME courbe tels
// quels -- le trace alternait alors entre "colle au rectangle" et "suit la
// courbe" sur quelques pixels, un resultat pire que les deux approches
// separement (constate : "absolument tous les bords" avaient ce zigzag).
//
// Ici : chaque point est assigne au cote du rectangle le plus proche, ce qui
// decoupe le contour en segments continus (un par cote, dans l'ordre du
// trace). Un segment entier n'est redresse en ligne droite QUE SI TOUS ses
// points sont proches du rectangle (vrai bord droit bruite) -- des qu'un
// seul point du segment est loin (vraie encoche ou vraie courbe), tout le
// segment est laisse intact, forme d'origine preservee en bloc.
function snapToRect(pts: Pt[], rect: Pt[], notchThreshold: number): { pts: Pt[]; onRect: boolean[] } {
  const sides: [Pt, Pt][] = [[rect[0], rect[1]], [rect[1], rect[2]], [rect[2], rect[3]], [rect[3], rect[0]]]
  const n = pts.length
  const info = pts.map(p => {
    let best: { dist: number; proj: Pt } | null = null
    let bestSide = -1
    sides.forEach(([a, b], i) => {
      const r = pointToSegment(p, a, b)
      if (!best || r.dist < best.dist) { best = r; bestSide = i }
    })
    return { dist: best!.dist, proj: best!.proj, side: bestSide }
  })

  let start = 0
  for (let k = 0; k < n; k++) {
    if (info[k].side !== info[(k - 1 + n) % n].side) { start = k; break }
  }

  const result = [...pts]
  const onRect = new Array(n).fill(false)
  let idx = start, processed = 0
  while (processed < n) {
    const side = info[idx].side
    let runLen = 0
    while (processed + runLen < n && info[(idx + runLen) % n].side === side) runLen++
    const allNear = Array.from({ length: runLen }, (_, k) => info[(idx + k) % n].dist).every(d => d < notchThreshold)
    if (allNear) {
      for (let k = 0; k < runLen; k++) {
        const j = (idx + k) % n
        result[j] = info[j].proj
        onRect[j] = true
      }
    }
    idx = (idx + runLen) % n
    processed += runLen
  }
  return { pts: result, onRect }
}


// ── Segmentation par COULEUR directe (pas le masque du modele ML) -- idee :
// le modele die-cut (138 images) est intrinsequement limite en precision
// (mask 160x160 remonte, erreurs/trous constates). Les photos de test sont
// prises sur un fond raisonnablement uniforme (tapis/table) -- un simple
// ecart de couleur au fond (meme principe qu'un fond vert) donne un masque
// a la resolution PLEINE de la photo, sans dependre d'un modele entraine
// sur peu de donnees. Le detecteur de coins (deja fiable) sert seulement a
// cadrer la zone de recherche, pas a dessiner le contour.
function sampleBackgroundColor(data: Uint8ClampedArray, w: number, h: number): { r: number; g: number; b: number } {
  const patch = Math.max(6, Math.round(Math.min(w, h) * 0.04))
  const corners = [[0, 0], [w - patch, 0], [0, h - patch], [w - patch, h - patch]]
  let r = 0, g = 0, b = 0, n = 0
  for (const [cx, cy] of corners) {
    for (let y = Math.max(0, cy); y < Math.min(h, cy + patch); y++) {
      for (let x = Math.max(0, cx); x < Math.min(w, cx + patch); x++) {
        const i = (y * w + x) * 4
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
      }
    }
  }
  return { r: r / n, g: g / n, b: b / n }
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

// Combine PLUSIEURS indices independants au lieu d'un seul : teinte, saturation
// ET luminosite comptent toutes les 3 -- un poids ecrase sur un seul critere
// casse des qu'une carte differe du fond surtout par ce critere-la (ex. carte
// bleu marine sur fond bleu tres clair : meme teinte, ecart uniquement en
// luminosite). La luminosite utilise un "genou" doux : un petit ecart (plage
// d'une ombre portee typique) est tres peu compte, mais un GRAND ecart (vraie
// difference de materiau/couleur) compte presque a plein -- on garde la
// tolerance a l'ombre sans ignorer les cas ou la luminosite EST le signal.
function colorDistanceMap(data: Uint8ClampedArray, w: number, h: number, bg: { r: number; g: number; b: number }): Float32Array {
  const bgHsv = rgbToHsv(bg.r, bg.g, bg.b)
  const dist = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const hsv = rgbToHsv(r, g, b)
    const rawHueDiff = Math.abs(hsv.h - bgHsv.h)
    const hueDist = (Math.min(rawHueDiff, 360 - rawHueDiff) / 180) * (bgHsv.s > 0.08 && hsv.s > 0.08 ? 1 : 0.3)
    const satDist = Math.abs(hsv.s - bgHsv.s)
    const rawValDist = Math.abs(hsv.v - bgHsv.v)
    const SHADOW_KNEE = 0.35
    const valDist = rawValDist <= SHADOW_KNEE
      ? rawValDist * 0.2
      : SHADOW_KNEE * 0.2 + (rawValDist - SHADOW_KNEE)
    dist[i] = hueDist * 0.4 + satDist * 0.3 + valDist * 0.4
  }
  return dist
}

// Seuil ADAPTATIF (Otsu) plutot qu'une constante fixe -- un seuil fixe tune
// sur une photo (fond tres contraste, ex. teal vs carte blanche) echoue
// completement sur une autre (fond proche en couleur, ex. fond texture
// beige vs carte blanche) : soit toute la carte est ratee, soit le fond
// deborde. Otsu choisit, PAR IMAGE, le seuil qui separe le mieux les deux
// pics (fond / carte) de l'histogramme reel des distances observees.
function otsuThreshold(dist: Float32Array): number {
  let maxVal = 0
  for (let i = 0; i < dist.length; i++) if (dist[i] > maxVal) maxVal = dist[i]
  if (maxVal <= 0) return 0.1
  const BINS = 256
  const hist = new Array(BINS).fill(0)
  for (let i = 0; i < dist.length; i++) {
    const b = Math.min(BINS - 1, Math.floor((dist[i] / maxVal) * BINS))
    hist[b]++
  }
  const total = dist.length
  let sum = 0
  for (let i = 0; i < BINS; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, best = 0, bestVar = -1
  for (let i = 0; i < BINS; i++) {
    wB += hist[i]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += i * hist[i]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const varBetween = wB * wF * (mB - mF) * (mB - mF)
    if (varBetween > bestVar) { bestVar = varBetween; best = i }
  }
  // Plancher pour eviter un seuil degenere (quasi 0) quand fond et carte
  // sont presque identiques -- mieux vaut rater un peu de bord que faire
  // deborder tout le masque dans le fond.
  return Math.max(0.05, (best / BINS) * maxVal)
}

// Contrainte geometrique forte : une vraie decoupe die-cut n'existe JAMAIS
// loin a l'interieur de la carte, seulement pres du bord (encoches). Donc,
// peu importe sa couleur, tout pixel significativement a l'interieur du
// rectangle des vrais coins est FORCE "carte" -- ca empeche une photo
// imprimee dessus (zones claires ressemblant au fond) de creer de fausses
// intrusions profondes dans le trace, sans jamais toucher les encoches
// reelles qui restent pres du bord.
function forceInteriorAsCard(bin: Uint8Array, w: number, h: number, cropLeft: number, cropTop: number, cornerRect: Pt[], marginFrac: number): Uint8Array {
  const sides: [Pt, Pt][] = [[cornerRect[0], cornerRect[1]], [cornerRect[1], cornerRect[2]], [cornerRect[2], cornerRect[3]], [cornerRect[3], cornerRect[0]]]
  const rxs = cornerRect.map(p => p.x), rys = cornerRect.map(p => p.y)
  const rw = Math.max(...rxs) - Math.min(...rxs), rh = Math.max(...rys) - Math.min(...rys)
  const margin = Math.min(rw, rh) * marginFrac
  const out = new Uint8Array(bin)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + cropLeft, py = y + cropTop
      if (!pointInQuad(px, py, cornerRect)) continue
      let minDist = Infinity
      for (const [a, b] of sides) {
        const d = pointToSegment({ x: px, y: py }, a, b).dist
        if (d < minDist) minDist = d
      }
      if (minDist > margin) out[y * w + x] = 1
    }
  }
  return out
}

function colorMaskFromBackground(dist: Float32Array, threshold: number): Uint8Array {
  const bin = new Uint8Array(dist.length)
  for (let i = 0; i < dist.length; i++) bin[i] = dist[i] > threshold ? 1 : 0
  return bin
}

// Une photo imprimee sur la carte peut contenir des zones (maillot blanc,
// ciel clair...) de couleur proche du FOND, classees a tort comme fond en
// plein milieu de la carte -- le traceur de contour suit alors ces "trous"
// et produit un tracé qui plonge dans la photo. On comble tout pixel fond
// qui n'est PAS relie au bord du crop (donc enferme par de la carte tout
// autour) : un vrai fond est toujours relie a l'exterieur de la zone de
// recherche, un faux positif au milieu de la carte ne l'est jamais.
function fillEnclosedHoles(bin: Uint8Array, w: number, h: number): Uint8Array {
  const reachable = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let sp = 0
  const tryPush = (idx: number) => { if (bin[idx] === 0 && !reachable[idx]) { reachable[idx] = 1; stack[sp++] = idx } }
  for (let x = 0; x < w; x++) { tryPush(x); tryPush((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { tryPush(y * w); tryPush(y * w + w - 1) }
  while (sp > 0) {
    const cur = stack[--sp]
    const cx = cur % w, cy = (cur / w) | 0
    if (cx > 0) tryPush(cur - 1)
    if (cx < w - 1) tryPush(cur + 1)
    if (cy > 0) tryPush(cur - w)
    if (cy < h - 1) tryPush(cur + w)
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = bin[i] === 1 || !reachable[i] ? 1 : 0
  return out
}

// Morphologie simple (ouverture puis fermeture) -- enleve le bruit poivre-et-
// sel (pixels isoles mal classes) et comble les petits trous, sans quoi le
// traceur de contour peut s'accrocher sur des artefacts d'un seul pixel.
// Erosion/dilatation separable (passe horizontale puis verticale) -- bien
// plus rapide qu'un noyau carre complet, permet un rayon plus grand sans
// cout prohibitif.
function erodeDilate(bin: Uint8Array, w: number, h: number, radius: number, erode: boolean): Uint8Array {
  const temp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = erode ? 1 : 0
      for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx
        const val = xx >= 0 && xx < w ? bin[y * w + xx] : 0
        v = erode ? v & val : v | val
      }
      temp[y * w + x] = v
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = erode ? 1 : 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        const val = yy >= 0 && yy < h ? temp[yy * w + x] : 0
        v = erode ? v & val : v | val
      }
      out[y * w + x] = v
    }
  }
  return out
}

// Ouverture puis fermeture morphologique. Un rayon plus grand enleve des
// intrusions bien plus larges (ex. le detail d'une photo -- doigts, visages,
// foule en arriere-plan -- qui ressemble par endroits au fond) sans toucher
// les vraies encoches d'une die-cut, nettement plus grandes.
function morphOpenClose(bin: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const eroded = erodeDilate(bin, w, h, radius, true)
  const opened = erodeDilate(eroded, w, h, radius, false)
  const dilated = erodeDilate(opened, w, h, radius, false)
  return erodeDilate(dilated, w, h, radius, true)
}

// Lissage par moyenne glissante, mais CONSCIENT DES ANGLES : les points deja
// sur le rectangle restent des ancres fixes (bords droits intacts), ET tout
// point formant un virage prononce (> ANCHOR_ANGLE_DEG, une vraie pointe
// d'encoche comme un V) est aussi laisse intact. Seuls les points formant un
// virage leger (l'escalier pixel-par-pixel du masque couleur le long d'une
// portion nominalement lisse) sont moyennes. Ca efface le bruit sans
// arrondir les vrais coins.
const ANCHOR_ANGLE_DEG = 35
function smoothCurve(pts: Pt[], onRect: boolean[], iterations: number): Pt[] {
  let cur = pts.map(p => ({ ...p }))
  const n = pts.length
  for (let it = 0; it < iterations; it++) {
    const next = cur.map(p => ({ ...p }))
    for (let i = 0; i < n; i++) {
      if (onRect[i]) continue
      const prev = cur[(i - 1 + n) % n]
      const nxt = cur[(i + 1) % n]
      const v1x = cur[i].x - prev.x, v1y = cur[i].y - prev.y
      const v2x = nxt.x - cur[i].x, v2y = nxt.y - cur[i].y
      const len1 = Math.hypot(v1x, v1y), len2 = Math.hypot(v2x, v2y)
      if (len1 < 1e-6 || len2 < 1e-6) continue
      const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)))
      const turnDeg = (Math.acos(dot) * 180) / Math.PI
      if (turnDeg > ANCHOR_ANGLE_DEG) continue
      next[i] = {
        x: cur[i].x * 0.5 + prev.x * 0.25 + nxt.x * 0.25,
        y: cur[i].y * 0.5 + prev.y * 0.25 + nxt.y * 0.25,
      }
    }
    cur = next
  }
  return cur
}

// Meme logique que le raffinement de bord du detecteur de coins en prod
// (cornerDetectorYolo.ts, detectEdgeLineV4/findEdgeCrossingV4) -- recherche
// directe de la transition de contraste la plus nette (multi-canal RGB,
// interpolation sous-pixel parabolique), perpendiculairement a la direction
// locale du contour. Beaucoup plus precis que la grille de pixels du masque
// binaire pour "toucher" exactement une vraie pointe d'encoche, puisqu'elle
// lit directement le signal de l'image au lieu de dependre d'une
// classification region par region. Logique reecrite ici (jamais
// d'import/modif du fichier de prod), adaptee a N points au lieu de 4 coins
// fixes : chaque point est affine independamment, pas par intersection de
// droites (un segment de die-cut n'est pas forcement une longue droite).
function sobelGrayFromRGBA(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }
  return gray
}
function sampleGrayAt(gray: Float32Array, w: number, h: number, x: number, y: number): number {
  const xi = Math.min(w - 1, Math.max(0, Math.round(x)))
  const yi = Math.min(h - 1, Math.max(0, Math.round(y)))
  return gray[yi * w + xi]
}
function sampleChannelAt(data: Uint8ClampedArray, w: number, h: number, c: number, x: number, y: number): number {
  const xi = Math.min(w - 1, Math.max(0, Math.round(x)))
  const yi = Math.min(h - 1, Math.max(0, Math.round(y)))
  return data[(yi * w + xi) * 4 + c]
}
const EDGE_PERP_SEARCH = 10
const EDGE_MIN_SCORE = 14
function refineContourPoints(
  pts: Pt[], onRect: boolean[], data: Uint8ClampedArray, gray: Float32Array,
  cw: number, ch: number, left: number, top: number,
): Pt[] {
  const n = pts.length
  return pts.map((p, i) => {
    if (onRect[i]) return p
    const prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n]
    const dx = next.x - prev.x, dy = next.y - prev.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return p
    const perp = { x: -dy / len, y: dx / len }
    const lx = p.x - left, ly = p.y - top
    const scores: number[] = []
    let maxScore = 0
    for (let t = -EDGE_PERP_SEARCH; t <= EDGE_PERP_SEARCH; t++) {
      const x = lx + perp.x * t, y = ly + perp.y * t
      const x1 = x - perp.x, y1 = y - perp.y, x2 = x + perp.x, y2 = y + perp.y
      let s = Math.abs(sampleGrayAt(gray, cw, ch, x2, y2) - sampleGrayAt(gray, cw, ch, x1, y1))
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(sampleChannelAt(data, cw, ch, c, x2, y2) - sampleChannelAt(data, cw, ch, c, x1, y1))
        if (d > s) s = d
      }
      scores.push(s)
      if (s > maxScore) maxScore = s
    }
    if (maxScore <= EDGE_MIN_SCORE) return p
    // Croisement le plus proche du centre qui depasse un seuil RELATIF au
    // meilleur score du profil -- pas le plus fort absolu -- pour ne pas
    // sauter sur un bord plus contraste mais sans rapport (ex: un motif de
    // la photo) juste a cote du vrai bord du masque.
    const threshold = Math.max(EDGE_MIN_SCORE, maxScore * 0.6)
    let chosenIdx = -1
    for (let d = 0; d < scores.length; d++) {
      const idxUp = EDGE_PERP_SEARCH + d, idxDown = EDGE_PERP_SEARCH - d
      if (idxDown >= 0 && scores[idxDown] >= threshold) { chosenIdx = idxDown; break }
      if (idxUp < scores.length && scores[idxUp] >= threshold) { chosenIdx = idxUp; break }
    }
    if (chosenIdx < 0) return p
    let dt = 0
    if (chosenIdx > 0 && chosenIdx < scores.length - 1) {
      const gm1 = scores[chosenIdx - 1], g0 = scores[chosenIdx], gp1 = scores[chosenIdx + 1]
      const denom = gm1 - 2 * g0 + gp1
      if (Math.abs(denom) > 1e-6) dt = 0.5 * (gm1 - gp1) / denom
    }
    const tFinal = (chosenIdx - EDGE_PERP_SEARCH) + dt
    return { x: left + lx + perp.x * tFinal, y: top + ly + perp.y * tFinal }
  })
}

function polygonArea(pts: Pt[]): number {
  let area = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    area += a.x * b.y - b.x * a.y
  }
  return Math.abs(area) / 2
}

function pointInQuad(px: number, py: number, quad: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const xi = quad[i].x, yi = quad[i].y
    const xj = quad[j].x, yj = quad[j].y
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Le centre du rectangle des coins n'est pas un point de depart fiable : un
// design de carte peut avoir une bande claire (tableau de stats, texte) pile
// au centre, de couleur proche du fond, OU un petit ilot isole (une lettre,
// un point) tout pres du centre qui n'est PAS relie au corps principal de la
// carte apres la morphologie. Plutot que de partir d'un seul pixel, on
// etiquette TOUTES les composantes connexes du masque et on choisit celle
// qui recouvre le plus le vrai rectangle des coins (le corps de la carte,
// par definition, occupe la quasi-totalite de ce rectangle) -- independant
// du point de depart exact.
function findStartFromSeed(bin: Uint8Array, w: number, h: number, cropLeft: number, cropTop: number, cornerRect: Pt[]): Pt | null {
  const visited = new Uint8Array(w * h)
  let bestFirst: Pt | null = null
  let bestScore = -1
  const stack = new Int32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const start = y * w + x
      if (bin[start] !== 1 || visited[start]) continue
      let sp = 0
      stack[sp++] = start
      visited[start] = 1
      const firstX = x, firstY = y
      let insideCount = 0
      while (sp > 0) {
        const cur = stack[--sp]
        const cx = cur % w, cy = (cur / w) | 0
        if (pointInQuad(cx + cropLeft, cy + cropTop, cornerRect)) insideCount++
        if (cx > 0) { const n = cur - 1; if (bin[n] === 1 && !visited[n]) { visited[n] = 1; stack[sp++] = n } }
        if (cx < w - 1) { const n = cur + 1; if (bin[n] === 1 && !visited[n]) { visited[n] = 1; stack[sp++] = n } }
        if (cy > 0) { const n = cur - w; if (bin[n] === 1 && !visited[n]) { visited[n] = 1; stack[sp++] = n } }
        if (cy < h - 1) { const n = cur + w; if (bin[n] === 1 && !visited[n]) { visited[n] = 1; stack[sp++] = n } }
      }
      if (insideCount > bestScore) { bestScore = insideCount; bestFirst = { x: firstX, y: firstY } }
    }
  }
  if (!bestFirst) return null
  let x = bestFirst.x
  while (x < w && bin[bestFirst.y * w + x] === 1) x++
  return { x: x - 1, y: bestFirst.y }
}

function drawBase(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
}

// Calcule le contour detecte (sans rien dessiner) -- separe du rendu pour
// que l'edition manuelle (points glissables, voir le composant) puisse
// reutiliser/remplacer ces points sans refaire toute la detection couleur.
function computeContour(img: HTMLImageElement, result: DetectResult, cornerRect: Pt[] | null): Pt[] | null {
  if (!cornerRect) return null

  // Zone de recherche : bbox du rectangle des vrais coins, elargie (les
  // encoches/oreilles d'une die-cut peuvent sortir un peu du rectangle).
  const rxs = cornerRect.map(p => p.x), rys = cornerRect.map(p => p.y)
  const rw = Math.max(...rxs) - Math.min(...rxs), rh = Math.max(...rys) - Math.min(...rys)
  const marginX = rw * 0.18, marginY = rh * 0.18
  const left = Math.max(0, Math.floor(Math.min(...rxs) - marginX))
  const top = Math.max(0, Math.floor(Math.min(...rys) - marginY))
  const right = Math.min(img.naturalWidth, Math.ceil(Math.max(...rxs) + marginX))
  const bottom = Math.min(img.naturalHeight, Math.ceil(Math.max(...rys) + marginY))
  const cw = right - left, ch = bottom - top
  if (cw <= 0 || ch <= 0) return null

  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cw; cropCanvas.height = ch
  const cctx = cropCanvas.getContext('2d', { willReadFrequently: true })!
  cctx.imageSmoothingEnabled = false
  cctx.drawImage(img, left, top, cw, ch, 0, 0, cw, ch)
  const { data } = cctx.getImageData(0, 0, cw, ch)

  // Segmentation par couleur (pas le masque ML) : ecart au fond echantillonne
  // dans les 4 coins de la zone de recherche (hors de la carte, meme marge
  // large). Seuil choisi automatiquement par Otsu sur l'histogramme reel de
  // CETTE photo -- un seuil fixe ne generalise pas (fonctionne sur un fond
  // tres contraste, echoue totalement sur un fond proche de la carte).
  const bg = sampleBackgroundColor(data, cw, ch)
  const dist = colorDistanceMap(data, cw, ch, bg)
  const threshold = otsuThreshold(dist)
  let bin = colorMaskFromBackground(dist, threshold)

  // Validation par le masque ML (deja entraine sur de vraies die-cut, pas
  // retouche ici) : un pixel classe "fond" par la seule couleur reste
  // "carte" si le modele est tres confiant que c'est de la carte -- ca
  // filtre les faux positifs de couleur dans une photo (mains, visages,
  // foule) que le modele n'a jamais appris a traiter comme une decoupe.
  if (result.mask640) {
    const mask640 = result.mask640
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = y * cw + x
        if (bin[i] === 0 && sampleMask640(mask640, img.naturalWidth, img.naturalHeight, x + left, y + top) > 0.6) {
          bin[i] = 1
        }
      }
    }
  }

  // Un seul rayon de morphologie ne peut pas satisfaire deux besoins
  // opposes : les vraies encoches qui ENTAMENT la carte (interieur du
  // rectangle) ont parfois une pointe fine qu'un rayon large rognerait
  // avant meme le tracage -- alors qu'EN DEHORS du rectangle (marge de
  // recherche), on peut trouver un support, un reflet ou un objet du decor
  // qui ont besoin d'un nettoyage bien plus agressif pour ne pas polluer le
  // trace. On calcule donc 2 versions et on les fusionne selon la position
  // par rapport au vrai rectangle des coins.
  const binFine = morphOpenClose(bin, cw, ch, 1)
  const binClean = morphOpenClose(bin, cw, ch, 8)
  const merged = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x
      merged[i] = pointInQuad(x + left, y + top, cornerRect) ? binFine[i] : binClean[i]
    }
  }
  bin = merged
  bin = fillEnclosedHoles(bin, cw, ch)
  bin = forceInteriorAsCard(bin, cw, ch, left, top, cornerRect, 0.22)

  const start = findStartFromSeed(bin, cw, ch, left, top, cornerRect)
  if (!start) return null
  const traced = traceMooreBoundary(bin, cw, ch, start)
  // Epsilon plus bas que precedemment : la morphologie a rayon plus large
  // (+validation ML) nettoie deja le bruit pixel-par-pixel en amont, donc
  // la simplification n'a plus besoin d'etre agressive -- un epsilon plus
  // bas preserve les angles droits des petites encoches rectangulaires
  // (coupees en diagonale avec un epsilon trop eleve).
  const simplified = simplifyClosed(traced, 2).map(p => ({ x: p.x + left, y: p.y + top }))

  // Les vrais coins (deja fiables en prod) forcent les bords sans vraie
  // encoche a rester parfaitement droits ; le masque couleur (bien plus fin
  // que le masque ML) fournit la vraie forme des decoupes.
  const NOTCH_THRESHOLD = Math.max(rw, rh) * 0.012
  const { pts: snapped, onRect } = snapToRect(simplified, cornerRect, NOTCH_THRESHOLD)

  // Raffinement par bord net (meme technique que le detecteur de coins en
  // prod, voir le commentaire de refineContourPoints) : chaque point de
  // vraie encoche est replace exactement sur la transition de contraste
  // reelle de l'image, pas sur la grille de pixels du masque.
  const gray = sobelGrayFromRGBA(data, cw, ch)
  const refinedPts = refineContourPoints(snapped, onRect, data, gray, cw, ch, left, top)

  const smoothed = smoothCurve(refinedPts, onRect, 2)

  // Filet de securite : si une photo imprimee touche le vrai bord de la
  // carte (visages, foule, mains...), la segmentation par couleur peut se
  // mettre a decouper des morceaux entiers de la photo -- un vrai die-cut
  // n'enleve jamais une fraction enorme de la surface du rectangle. Si
  // l'aire tracee s'effondre trop par rapport au rectangle, mieux vaut
  // afficher le simple rectangle (fiable) qu'un trace faux et chaotique.
  const tracedArea = polygonArea(snapped)
  const rectArea = polygonArea(cornerRect)
  const contourImg = rectArea > 0 && tracedArea / rectArea < 0.75 ? cornerRect : smoothed

  // Fusionne les points parfaitement (ou quasi) alignes -- un bord droit du
  // rectangle n'a besoin que de ses 2 coins comme poignees, pas d'un point
  // tous les quelques pixels. Epsilon minuscule : ne retire que les points
  // vraiment redondants, aucune vraie courbe/encoche n'est affectee.
  const collinearMerged = simplifyClosed(contourImg, 1.5)

  // Le raffinement par bord (refineContourPoints) deplace chaque point
  // independamment vers le bord net le plus proche -- 2 points a l'origine
  // distincts peuvent converger presque au meme endroit si le vrai bord est
  // proche des deux. Retire les quasi-doublons (poignees superposees,
  // inutiles et source de confusion dans l'editeur).
  const MIN_POINT_DIST = Math.max(3, Math.min(rw, rh) * 0.004)
  const deduped: Pt[] = []
  for (const p of collinearMerged) {
    const last = deduped[deduped.length - 1]
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_DIST) deduped.push(p)
  }
  if (deduped.length > 1 && Math.hypot(deduped[0].x - deduped[deduped.length - 1].x, deduped[0].y - deduped[deduped.length - 1].y) < MIN_POINT_DIST) {
    deduped.pop()
  }
  return deduped
}

export default function DiecutTestPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ found: boolean; conf: number; ms: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Contour editable a la main (poignees glissables) -- initialise par la
  // detection auto, mais l'utilisateur peut corriger chaque point si le
  // resultat automatique n'est pas parfait.
  const [polygon, setPolygon] = useState<Pt[] | null>(null)
  const autoPolygonRef = useRef<Pt[] | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const draggingRef = useRef<number | null>(null)

  const runOn = async (imgSrc: string, revoke: boolean) => {
    setBusy(true)
    setError('')
    setInfo(null)
    setPolygon(null)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image invalide'))
        img.src = imgSrc
      })

      const ort = await import('onnxruntime-web')
      ort.env.wasm.wasmPaths = ORT_CDN
      ort.env.wasm.numThreads = 1

      const [result, corners] = await Promise.all([
        detect(ort, img),
        detectCornersYOLO(img),
      ])
      setInfo({ found: result.found, conf: result.conf, ms: result.ms })
      if (canvasRef.current) drawBase(canvasRef.current, img)
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      const contour = computeContour(img, result, corners)
      autoPolygonRef.current = contour
      setPolygon(contour)

      if (revoke) URL.revokeObjectURL(imgSrc)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  // Convertit les coordonnees ecran (souris/tactile) en coordonnees image
  // (le SVG a un viewBox cale sur la resolution naturelle de l'image, donc
  // ca marche quelle que soit la taille d'affichage -- mobile compris).
  const toImagePoint = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const p = pt.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  const lastTapRef = useRef<{ index: number; time: number } | null>(null)

  const onHandlePointerDown = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.index === i && now - last.time < 400) {
      // double tap/clic sur le meme point -> suppression (jamais sous 3
      // points, un contour a besoin d'un minimum de forme).
      lastTapRef.current = null
      setPolygon(prev => (prev && prev.length > 3 ? prev.filter((_, idx) => idx !== i) : prev))
      return
    }
    lastTapRef.current = { index: i, time: now }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    draggingRef.current = i
  }

  // Tap/clic sur un SEGMENT (pas sur un point) -> insere un nouveau point
  // deplacable a cet endroit precis, entre les 2 points de ce segment.
  const onSegmentClick = (i: number) => (e: ReactPointerEvent) => {
    e.stopPropagation()
    const p = toImagePoint(e.clientX, e.clientY)
    if (!p) return
    setPolygon(prev => {
      if (!prev) return prev
      const next = prev.slice()
      next.splice(i + 1, 0, p)
      return next
    })
  }

  const onSvgPointerMove = (e: ReactPointerEvent) => {
    const i = draggingRef.current
    if (i === null) return
    const p = toImagePoint(e.clientX, e.clientY)
    if (!p || !imgSize) return
    const x = Math.max(0, Math.min(imgSize.w, p.x))
    const y = Math.max(0, Math.min(imgSize.h, p.y))
    setPolygon(prev => {
      if (!prev) return prev
      const next = prev.slice()
      next[i] = { x, y }
      return next
    })
  }

  const onSvgPointerUp = () => {
    draggingRef.current = null
  }

  const resetPolygon = () => setPolygon(autoPolygonRef.current)

  const onFile = (file: File) => {
    const url = URL.createObjectURL(file)
    runOn(url, true)
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auto') === '1') {
      runOn('/_test-diecut-sample.jpg', false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      {polygon && (
        <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          Glissez un point pour le déplacer • double-tap/double-clic dessus pour le supprimer • tap/clic sur une ligne pour ajouter un point.
        </p>
      )}

      <div style={{ position: 'relative', marginTop: 12, lineHeight: 0 }}>
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '100%', borderRadius: 8, background: '#eee', display: 'block' }} />
        {polygon && imgSize && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerCancel={onSvgPointerUp}
          >
            <polygon
              points={polygon.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(0,255,120,0.18)"
              stroke="#00e676"
              strokeWidth={Math.max(2, imgSize.w / 300)}
            />
            {/* Zone cliquable invisible sur chaque segment -- tap/clic ajoute
                un point deplacable a cet endroit. Rendue AVANT les poignees
                pour qu'un clic pile sur un point touche d'abord le cercle. */}
            {polygon.map((p, i) => {
              const q = polygon[(i + 1) % polygon.length]
              return (
                <line
                  key={`seg-${i}`}
                  x1={p.x}
                  y1={p.y}
                  x2={q.x}
                  y2={q.y}
                  stroke="transparent"
                  strokeWidth={Math.max(16, imgSize.w * 0.025)}
                  style={{ cursor: 'copy', touchAction: 'none' }}
                  onPointerDown={onSegmentClick(i)}
                />
              )
            })}
            {polygon.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={Math.max(7, imgSize.w * 0.013)}
                fill="#00e676"
                stroke="#fff"
                strokeWidth={Math.max(1.5, imgSize.w / 500)}
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={onHandlePointerDown(i)}
              />
            ))}
          </svg>
        )}
      </div>

      {polygon && (
        <button
          onClick={resetPolygon}
          style={{ marginTop: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
        >
          ↺ Réinitialiser (détection auto)
        </button>
      )}
    </div>
  )
}
