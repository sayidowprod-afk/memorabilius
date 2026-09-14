'use client'
import { useRef, useState } from 'react'
import { refineCornersV5 } from '@/lib/cornerDetectorYolo'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import { useAuth } from '@/lib/AuthContext'
import CameraCapture from '@/components/CameraCapture'
import CardPicker, { type PickableCard } from '@/components/CardPicker'

// Estimation de condition (centrage + etat des coins) a partir du detecteur
// de coins deja en prod. Volontairement PAS un grade chiffre officiel façon
// PSA -- les sous-scores sont affiches separement, et la note globale porte
// un avertissement explicite juste a cote : une photo de telephone sans
// eclairage controle ne justifie pas une precision numerique unique.
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

// Loupe tactile (meme principe que CardScanner.tsx, l'ecran de recadrage de
// l'ajout de carte) : au doigt, le point qu'on essaie de positionner est
// cache sous le doigt lui-meme -- impossible de viser precisement sans ca.
const MAG_SIZE = 200
const MAG_OFFSET_Y = 110

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
//
// Meme un design "plein cadre" (pas de bordure imprimee -- tres courant sur
// les cartes NBA modernes type Prizm/Select/Donruss) a presque toujours un
// leger surplus d'impression au-dela du trait de coupe prevu (le "bleed"
// standard en imprimerie) : si la decoupe reelle n'est pas parfaitement
// centree, ca laisse un fin liseret de carton nu ou un micro-decalage de
// quelques pixels -- exactement ce qu'un grader humain regarde a la loupe sur
// ce type de carte. Ce signal est REEL mais tres faible, noye dans le bruit
// JPEG/capteur par un simple ecart 3-pixels comme avant. Deux ameliorations
// pour le faire ressortir sans se contenter d'abandonner :
// 1. Echantillonnage perpendiculaire beaucoup plus dense (quasi 1 ligne sur 1
//    au lieu de 1/40) -- moyenne sur plus de points, le bruit s'annule mieux.
// 2. Detecteur de "marche" par fenetres glissantes (moyenne avant vs moyenne
//    apres) plutot qu'une difference ponctuelle entre 2 pixels voisins --
//    beaucoup plus robuste a une fluctuation isolee, capte une vraie
//    transition meme fine et progressive.
const BORDER_CONFIDENCE_MIN_GRAD = 5
const STEP_WINDOW = 4
function detectBorderWidth(canvas: HTMLCanvasElement, side: 'left' | 'right' | 'top' | 'bottom'): { idx: number; confident: boolean } {
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
  const step = Math.max(1, Math.floor(perpLen / 250))
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
  // Marche detectee entre la moyenne des STEP_WINDOW points avant i et celle
  // des STEP_WINDOW points apres i -- une vraie transition (meme fine et
  // progressive sur quelques pixels) ressort nettement mieux qu'avec un ecart
  // ponctuel, qui peut tomber pile sur un pixel de bruit de chaque cote.
  //
  // On retient la PREMIERE marche qui depasse le seuil (pas la plus grosse
  // de toute la zone scannee) : la bordure physique d'une carte est par
  // definition le premier element imprime rencontre en partant du bord vers
  // l'interieur. Prendre "le plus gros saut" laissait un gros bandeau texte
  // interne (bien plus contraste qu'un fin filet de bordure, cf. bandeau nom/
  // equipe en bas de nombreux designs Donruss/Panini) l'emporter a tort sur
  // la vraie bordure -- confondant 2 elements differents entre les 2 cotes
  // d'un meme axe et donnant un centrage incoherent bien que "confiant".
  let bestIdx = limit - 1, bestGrad = 0
  for (let i = STEP_WINDOW; i < profile.length - STEP_WINDOW; i++) {
    let before = 0, after = 0
    for (let k = 1; k <= STEP_WINDOW; k++) { before += profile[i - k]; after += profile[i + k - 1] }
    const grad = Math.abs(after / STEP_WINDOW - before / STEP_WINDOW)
    if (grad >= BORDER_CONFIDENCE_MIN_GRAD) { bestGrad = grad; bestIdx = i; break }
    if (grad > bestGrad) { bestGrad = grad; bestIdx = i }
  }
  return { idx: bestIdx, confident: bestGrad >= BORDER_CONFIDENCE_MIN_GRAD }
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

// ── Etat des coins : detection par ecart de couleur a la propre bordure du
// coin, pas par texture locale de l'image ──────────────────────────────────
// Ce que regarde vraiment un grader, c'est le BLANCHIMENT : le carton blanc
// expose quand la couche imprimee s'ecaille. On compare donc la couleur
// exactement a la pointe du coin a celle mesuree a mi-largeur de SA PROPRE
// bordure adjacente (deja detectee/ajustee a la main juste a cote, voir
// borderSegments) -- la reference s'adapte automatiquement a la couleur de
// bordure de CETTE carte (blanche, coloree...) au lieu d'un seuil global.
// Un coin intact garde la meme couleur jusqu'a la pointe, quel que soit le
// fond de la photo derriere le bord physique de la carte.
const CORNER_NEIGHBORS: Record<number, { u: number; v: number; uFracKey: keyof BorderFrac; vFracKey: keyof BorderFrac }> = {
  0: { u: 1, v: 3, uFracKey: 'left', vFracKey: 'top' },     // TL : vers TR (u), vers BL (v)
  1: { u: 0, v: 2, uFracKey: 'right', vFracKey: 'top' },    // TR : vers TL (u), vers BR (v)
  2: { u: 3, v: 1, uFracKey: 'right', vFracKey: 'bottom' }, // BR : vers BL (u), vers TR (v)
  3: { u: 2, v: 0, uFracKey: 'left', vFracKey: 'bottom' },  // BL : vers BR (u), vers TL (v)
}

function avgColor(img: HTMLImageElement, pt: Pt, size: number): { r: number; g: number; b: number } {
  const s = Math.max(2, Math.round(size))
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, pt.x - s / 2, pt.y - s / 2, s, s, 0, 0, s, s)
  const { data } = ctx.getImageData(0, 0, s, s)
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++ }
  return { r: r / n, g: g / n, b: b / n }
}

// Score de dommage 0 (intact) -> 1 (tres endommage), combinant : saut de
// clarte (le blanchiment eclaircit), chute de saturation (le blanc/gris
// expose est plus terne qu'une bordure coloree), et distance de couleur
// generale -- ponderes, plafonnes a 1 chacun avant ponderation.
function cornerDamage(img: HTMLImageElement, pts: Pt[], i: number, frac: BorderFrac, stability: number): number {
  const corner = pts[i]
  const nb = CORNER_NEIGHBORS[i]
  const uNeighbor = pts[nb.u], vNeighbor = pts[nb.v]
  const uLen = Math.hypot(uNeighbor.x - corner.x, uNeighbor.y - corner.y) || 1
  const vLen = Math.hypot(vNeighbor.x - corner.x, vNeighbor.y - corner.y) || 1
  const uDir = { x: (uNeighbor.x - corner.x) / uLen, y: (uNeighbor.y - corner.y) / uLen }
  const vDir = { x: (vNeighbor.x - corner.x) / vLen, y: (vNeighbor.y - corner.y) / vLen }
  const uBorderPx = frac[nb.uFracKey] * uLen
  const vBorderPx = frac[nb.vFracKey] * vLen
  const minPx = Math.max(3, uLen * 0.006)

  // Reference : a mi-largeur de la bordure adjacente -- solidement dans la
  // couleur de bordure, loin de l'effet du coin lui-meme.
  const refU = Math.max(uBorderPx * 0.5, minPx * 2)
  const refV = Math.max(vBorderPx * 0.5, minPx * 2)
  // Pointe : tres pres du coin reel, juste assez pour eviter d'echantillonner
  // le fond hors-carte si la detection est a peine imprecise.
  const tipU = Math.max(uBorderPx * 0.12, minPx)
  const tipV = Math.max(vBorderPx * 0.12, minPx)

  const refPt = { x: corner.x + uDir.x * refU + vDir.x * refV, y: corner.y + uDir.y * refU + vDir.y * refV }
  const tipPt = { x: corner.x + uDir.x * tipU + vDir.x * tipV, y: corner.y + uDir.y * tipU + vDir.y * tipV }

  const sampleSize = Math.max(6, Math.min(refU, refV) * 0.6)
  const ref = avgColor(img, refPt, sampleSize)
  const tip = avgColor(img, tipPt, Math.max(5, sampleSize * 0.65))

  const refLum = 0.299 * ref.r + 0.587 * ref.g + 0.114 * ref.b
  const tipLum = 0.299 * tip.r + 0.587 * tip.g + 0.114 * tip.b
  const refChroma = Math.max(ref.r, ref.g, ref.b) - Math.min(ref.r, ref.g, ref.b)
  const tipChroma = Math.max(tip.r, tip.g, tip.b) - Math.min(tip.r, tip.g, tip.b)

  const lightnessJump = Math.max(0, tipLum - refLum)
  const chromaDrop = Math.max(0, refChroma - tipChroma)
  const colorDist = Math.hypot(tip.r - ref.r, tip.g - ref.g, tip.b - ref.b)

  const raw = Math.min(1,
    Math.min(1, lightnessJump / 55) * 0.5 +
    Math.min(1, chromaDrop / 60) * 0.3 +
    Math.min(1, colorDist / 130) * 0.2
  )
  // Attenue par la stabilite de couleur des bordures adjacentes (voir
  // borderChipScore) -- sur une finition foil/prizm/motif, la bordure elle-meme
  // n'a pas de couleur stable, donc "couleur a la pointe vs reference" est
  // intrinsequement bruite pres de ce coin. On ne met pas a zero (un vrai coin
  // abime reste visible meme sur une carte texturee) mais on reduit la confiance.
  return raw * stability
}

// Crop carre autour d'un coin, extrait directement de la photo source en
// PLEINE resolution native (1:1, aucun redimensionnement dans drawImage) --
// le "zoom" vient uniquement de l'affichage a une taille CSS plus grande que
// la taille native du crop, jamais d'un agrandissement de pixels deja
// degrades. PNG (sans perte) plutot que JPEG pour ne pas ajouter d'artefacts
// de compression sur une image dont le but est justement l'inspection visuelle.
function cropCornerImage(img: HTMLImageElement, pt: Pt, size: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, pt.x - size / 2, pt.y - size / 2, size, size, 0, 0, size, size)
  return canvas.toDataURL('image/png')
}

// ── Qualite de la photo : flou + eclairage ──────────────────────────────────
// Calcule sur le warp deja produit par recompute() (WARP_W x WARP_H fixe) --
// aucun cout supplementaire de warp, et normalise automatiquement l'echelle
// entre photos de resolutions tres differentes.
function grayscaleOf(canvas: HTMLCanvasElement): { gray: Float32Array; w: number; h: number } {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width, h = canvas.height
  const { data } = ctx.getImageData(0, 0, w, h)
  const gray = new Float32Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return { gray, w, h }
}

// Variance du Laplacien -- mesure standard de nettete (une image floue a
// des transitions douces, donc un Laplacien de faible amplitude partout).
// Sous-echantillonne (pas de 2px) pour rester rapide sur WARP_W x WARP_H.
function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  let sum = 0, sumSq = 0, n = 0
  for (let y = 2; y < h - 2; y += 2) {
    for (let x = 2; x < w - 2; x += 2) {
      const i = y * w + x
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w]
      sum += lap; sumSq += lap * lap; n++
    }
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

type PhotoQuality = { blurry: boolean; tooDark: boolean; tooBright: boolean; lowContrast: boolean }

// Seuils empiriques (non calibres sur un vrai dataset, comme le reste des
// heuristiques de cette page) -- volontairement prudents : on prefere rater
// un avertissement plutot que spammer un faux positif sur une bonne photo.
function assessPhotoQuality(gray: Float32Array, w: number, h: number): PhotoQuality {
  const lapVar = laplacianVariance(gray, w, h)
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  const mean = sum / gray.length
  let sumSq = 0
  for (let i = 0; i < gray.length; i++) sumSq += (gray[i] - mean) ** 2
  const stdDev = Math.sqrt(sumSq / gray.length)
  return {
    blurry: lapVar < 120,
    tooDark: mean < 45,
    tooBright: mean > 225,
    lowContrast: stdDev < 20,
  }
}

// ── Etat de la surface : anomalies de texture locale (rayures/eclats) ──────
// Le visuel imprime d'une carte a deja beaucoup de texture normale (photo,
// degrade, texte) -- une variance locale brute serait noyee de faux positifs.
// On compare donc chaque patch a la MEDIANE des patches de la carte (mesure
// robuste, peu sensible aux quelques patches deja tres texturés par le design)
// plutot qu'a un seuil absolu : seuls les patches nettement hors-norme PAR
// RAPPORT AU RESTE DE CETTE CARTE precise comptent comme anomalie potentielle.
function surfaceScore(gray: Float32Array, w: number, h: number): number {
  const marginX = Math.round(w * 0.1), marginY = Math.round(h * 0.1)
  const patch = 22
  const variances: number[] = []
  for (let y = marginY; y + patch < h - marginY; y += patch) {
    for (let x = marginX; x + patch < w - marginX; x += patch) {
      let sum = 0, sumSq = 0, n = 0
      for (let py = y; py < y + patch; py++) {
        for (let px = x; px < x + patch; px++) {
          const v = gray[py * w + px]
          sum += v; sumSq += v * v; n++
        }
      }
      const mean = sum / n
      variances.push(sumSq / n - mean * mean)
    }
  }
  if (variances.length < 4) return 0
  const sorted = [...variances].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const deviations = sorted.map(v => Math.abs(v - median)).sort((a, b) => a - b)
  const mad = Math.max(1, deviations[Math.floor(deviations.length / 2)])
  // Seuil plus large (9x MAD, etait 6x) -- une carte a finition foil/prizm a
  // deja des patches irreguliers par design (reflets, degrade metallique), pas
  // seulement quelques outliers ; il faut un ecart plus net pour compter comme
  // anomalie potentielle plutot que comme variation normale du motif.
  const threshold = median + mad * 9
  const anomalous = variances.filter(v => v > threshold).length
  // Plafonne a 45% de patches anomaux -> score max (etait 30%), meme logique :
  // une carte texturee peut legitimement avoir beaucoup de patches "hors
  // mediane" sans qu'aucun ne soit une vraie rayure.
  return Math.min(1, anomalous / variances.length / 0.45)
}

// ── Etat des bords (hors coins) : meme principe de blanchiment que les coins,
// mais echantillonne le long de chaque bordure plutot qu'a une seule pointe --
// un eclat de bord n'est pas force d'etre pile dans un coin. ─────────────────
function borderChipScore(img: HTMLImageElement, quad: Pt[], frac: BorderFrac, side: keyof BorderFrac): { score: number; stability: number } {
  const segs = borderSegments(quad, frac)
  const [a, b] = segs[side]
  const isVertical = side === 'left' || side === 'right'
  const borderFracVal = frac[side]
  const sideLen = Math.hypot(b.x - a.x, b.y - a.y)
  const perpLen = isVertical
    ? Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y)
    : Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y)
  const borderPx = Math.max(3, borderFracVal * perpLen)
  const dx = (b.x - a.x) / sideLen, dy = (b.y - a.y) / sideLen
  // Normale pointant vers l'EXTERIEUR de la carte (vers le bord physique) --
  // pour left/top c'est -perp, pour right/bottom c'est +perp du sens du trait.
  const nx = -dy, ny = dx
  const outward = (side === 'left' || side === 'top') ? -1 : 1

  const N = 30
  const refDepth = borderPx * 0.55
  const tipDepth = borderPx * 0.15
  const samples: number[] = []
  const refColors: { r: number; g: number; b: number }[] = []
  const tipColors: { r: number; g: number; b: number }[] = []
  // Ignore les 12% aux deux extremites (deja couverts par la detection de coin).
  for (let i = 0; i < N; i++) {
    const tFrac = 0.12 + (i / (N - 1)) * 0.76
    const px = a.x + dx * sideLen * tFrac, py = a.y + dy * sideLen * tFrac
    const refPt = { x: px + nx * outward * refDepth, y: py + ny * outward * refDepth }
    const tipPt = { x: px + nx * outward * tipDepth, y: py + ny * outward * tipDepth }
    refColors.push(avgColor(img, refPt, Math.max(5, borderPx * 0.3)))
    tipColors.push(avgColor(img, tipPt, Math.max(4, borderPx * 0.2)))
  }
  // Reference globale du bord = mediane des points de reference (robuste a
  // quelques points de ref mal places si le tracé n'est pas parfaitement droit).
  const medianOf = (vals: number[]) => { const s = [...vals].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
  const refLums = refColors.map(c => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b)
  const medRefLum = medianOf(refLums)
  const medRefChroma = medianOf(refColors.map(c => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)))
  // Stabilite de la couleur de reference le long du bord -- une bordure unie
  // (la plupart des cartes) a une MAD faible ; une finition foil/prizm/motif a
  // une couleur qui change constamment meme sans aucun dommage. Sert a attenuer
  // le score plutot que le mettre a zero (un vrai eclat reste visible dessus).
  const refLumMAD = medianOf(refLums.map(l => Math.abs(l - medRefLum)))
  const stability = Math.max(0.2, 1 - refLumMAD / 35)

  for (let i = 0; i < N; i++) {
    const tip = tipColors[i]
    const tipLum = 0.299 * tip.r + 0.587 * tip.g + 0.114 * tip.b
    const tipChroma = Math.max(tip.r, tip.g, tip.b) - Math.min(tip.r, tip.g, tip.b)
    const lightnessJump = Math.max(0, tipLum - medRefLum)
    const chromaDrop = Math.max(0, medRefChroma - tipChroma)
    samples.push(Math.min(1, lightnessJump / 55) * 0.6 + Math.min(1, chromaDrop / 60) * 0.4)
  }
  samples.sort((x, y) => y - x)
  // Un vrai eclat est localise -- la moyenne des pires 20% des points
  // represente "y a-t-il un(des) defaut(s) visible(s)" sans etre noyee par
  // le reste du bord qui est presque toujours intact.
  const topK = Math.max(1, Math.round(N * 0.2))
  const worstAvg = samples.slice(0, topK).reduce((a, b) => a + b, 0) / topK
  return { score: worstAvg * stability, stability }
}

function damageKey(d: number): 'gradation_net' | 'gradation_light_wear' | 'gradation_visible_wear' {
  if (d < 0.15) return 'gradation_net'
  if (d < 0.4) return 'gradation_light_wear'
  return 'gradation_visible_wear'
}
function damageColor(d: number): string {
  if (d < 0.15) return '#16a34a'
  if (d < 0.4) return '#d97706'
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

const cornerNameKeys = ['gradation_corner_tl', 'gradation_corner_tr', 'gradation_corner_br', 'gradation_corner_bl'] as const

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

export default function EtatCartePage() {
  const { dark } = useTheme()
  const { t } = useLang()
  const { user } = useAuth()
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
  const [centeringConfidence, setCenteringConfidence] = useState({ lr: 1, tb: 1 })
  const [cornerScores, setCornerScores] = useState<number[] | null>(null)
  const [cornerCrops, setCornerCrops] = useState<string[] | null>(null)
  const [borderCrops, setBorderCrops] = useState<Record<keyof BorderFrac, string> | null>(null)
  // Loupe libre : deplacer/toucher n'importe ou sur la photo pour zoomer a
  // cet endroit (pas seulement pendant le glissement d'un coin/ligne) --
  // loupeZoom = diviseur de la largeur source (plus petit = plus zoome).
  const [freeLoupeOn, setFreeLoupeOn] = useState(false)
  const [loupeZoom, setLoupeZoom] = useState(16)
  const [borderScores, setBorderScores] = useState<Record<keyof BorderFrac, number> | null>(null)
  const [surface, setSurface] = useState<number | null>(null)
  const [photoQuality, setPhotoQuality] = useState<PhotoQuality | null>(null)
  const [cameraModal, setCameraModal] = useState(false)
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false)
  // Position ECRAN (client) du doigt/curseur pendant un drag -- pilote le
  // placement de la bulle flottante de la loupe. null = loupe masquee.
  const [touchPoint, setTouchPoint] = useState<Pt | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const magnifierCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const galleryRef = useRef<HTMLInputElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  // Sources de verite pendant un drag -- eviter de dependre du state React
  // (qui peut retarder d'une frame par rapport aux evenements pointer) pour
  // que le trace suive la souris sans a-coups.
  const cornersRef = useRef<Pt[] | null>(null)
  const fracRef = useRef<BorderFrac | null>(null)
  const dragCornerIdxRef = useRef<number | null>(null)
  const dragBorderSideRef = useRef<keyof BorderFrac | null>(null)

  // Redessine la loupe -- meme source (photo originale) que le crop de coin,
  // recadrage agrandi centre sur le point actuellement glisse. pt en
  // coordonnees image (memes que posFromEvent), color = teinte du reticule
  // (orange pour un coin, vert/bleu pour une ligne de bordure).
  const drawMagnifier = (pt: Pt, color: string) => {
    const img = imgRef.current, magCanvas = magnifierCanvasRef.current
    if (!img || !magCanvas) return
    const srcSize = Math.max(20, img.naturalWidth / loupeZoom)
    const mctx = magCanvas.getContext('2d')!
    mctx.clearRect(0, 0, MAG_SIZE, MAG_SIZE)
    mctx.save()
    mctx.beginPath(); mctx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2 - 3, 0, Math.PI * 2); mctx.clip()
    mctx.imageSmoothingEnabled = true
    mctx.imageSmoothingQuality = 'high'
    mctx.drawImage(img, pt.x - srcSize / 2, pt.y - srcSize / 2, srcSize, srcSize, 0, 0, MAG_SIZE, MAG_SIZE)
    mctx.restore()
    mctx.strokeStyle = color
    mctx.lineWidth = 1.5
    mctx.beginPath()
    mctx.moveTo(MAG_SIZE / 2, MAG_SIZE / 2 - 9); mctx.lineTo(MAG_SIZE / 2, MAG_SIZE / 2 + 9)
    mctx.moveTo(MAG_SIZE / 2 - 9, MAG_SIZE / 2); mctx.lineTo(MAG_SIZE / 2 + 9, MAG_SIZE / 2)
    mctx.stroke()
    mctx.beginPath()
    mctx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2 - 3, 0, Math.PI * 2)
    mctx.strokeStyle = 'rgba(255,255,255,0.9)'; mctx.lineWidth = 3; mctx.stroke()
  }

  const redrawOverlay = (pts: Pt[], frac: BorderFrac) => {
    const img = imgRef.current, c = canvasRef.current
    if (!img || !c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0)

    // Un fond de carte peut etre n'importe quelle couleur (holo, motifs...) --
    // une ligne fine et unie s'y noie facilement (signale). Chaque trait est
    // d'abord repasse en blanc semi-transparent, plus large, EN DESSOUS de la
    // couleur ; ce "halo" garde la ligne lisible sur n'importe quel fond.
    const lw = Math.max(5, img.naturalWidth / 180)
    const haloLw = lw + 5
    // Lignes de centrage nettement plus fines que le contour des coins --
    // rester lisible mais ne pas masquer l'image sous-jacente, seul ce qui
    // compte quand l'outil sert a inspecter visuellement plutot qu'a noter.
    const centerLw = Math.max(1.5, img.naturalWidth / 500)
    const centerHaloLw = centerLw + 2
    const dash = [Math.max(12, img.naturalWidth / 130), Math.max(8, img.naturalWidth / 190)]
    const strokeHalo = (segs: [Pt, Pt][], color: string) => {
      ctx.setLineDash([])
      ctx.lineCap = 'round'
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = centerHaloLw
      segs.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() })
      ctx.setLineDash(dash)
      ctx.strokeStyle = color
      ctx.lineWidth = centerLw
      segs.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() })
    }

    const segs = borderSegments(pts, frac)
    strokeHalo([segs.left, segs.right], '#00c878')
    strokeHalo([segs.top, segs.bottom], '#1e78ff')
    ctx.setLineDash([])

    // Quadrilatere des coins -- meme traitement halo, plus une bague blanche
    // autour de chaque poignee pour qu'elle reste visible meme sur un fond orange.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = haloLw
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()
    ctx.strokeStyle = '#ff8c00'
    ctx.lineWidth = lw
    ctx.beginPath()
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
    ctx.closePath()
    ctx.stroke()

    const handleR = Math.max(13, img.naturalWidth / 50)
    pts.forEach(p => {
      ctx.beginPath()
      ctx.arc(p.x, p.y, handleR + 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x, p.y, handleR, 0, Math.PI * 2)
      ctx.fillStyle = '#ff8c00'
      ctx.fill()
    })
  }

  const recompute = (pts: Pt[]) => {
    const img = imgRef.current
    if (!img) return
    const warp = warpQuadToRect(img, pts, WARP_W, WARP_H)
    const bLeft = detectBorderWidth(warp, 'left')
    const bRight = detectBorderWidth(warp, 'right')
    const bTop = detectBorderWidth(warp, 'top')
    const bBottom = detectBorderWidth(warp, 'bottom')
    // Sur un design "plein cadre" (pas de bordure imprimee -- tres courant
    // sur les cartes NBA modernes type Prizm/Select/Donruss), detectBorderWidth
    // n'a aucune vraie transition a trouver : le cote non confiant renvoie
    // alors une fluctuation de bruit quelconque, DIFFERENTE et INDEPENDANTE de
    // celle de son opposé -- d'ou des ratios delirants une fois normalises
    // (ex 99/1, confirme sur calibration reelle). Plutot que d'afficher un
    // ratio faux, un cote non confiant reprend la largeur de son OPPOSE
    // confiant (une carte est censee etre symetrique par design) : le
    // centrage retombe alors sur du 50/50 -- une hypothese par defaut bien
    // plus sure que du bruit pur, sans jamais cacher la mesure. Si aucun des
    // deux cotes n'est confiant, les deux se rabattent sur une meme petite
    // largeur fixe (2% -- meme resultat : 50/50).
    const DEFAULT_FRAC = 0.02
    const mirror = (a: { idx: number; confident: boolean }, b: { idx: number; confident: boolean }, dim: number) => {
      if (a.confident && b.confident) return [a.idx, b.idx]
      if (a.confident) return [a.idx, a.idx]
      if (b.confident) return [b.idx, b.idx]
      const d = Math.round(dim * DEFAULT_FRAC)
      return [d, d]
    }
    const [leftIdx, rightIdx] = mirror(bLeft, bRight, WARP_W)
    const [topIdx, bottomIdx] = mirror(bTop, bBottom, WARP_H)
    const frac: BorderFrac = {
      left: leftIdx / WARP_W,
      right: rightIdx / WARP_W,
      top: topIdx / WARP_H,
      bottom: bottomIdx / WARP_H,
    }
    fracRef.current = frac
    redrawOverlay(pts, frac)
    setPercents(percentsFromBorders(frac))
    // Confiance passee a estimateGrade (voir son commentaire) -- pas juste
    // "a-t-on trouve une transition", mais "peut-on faire confiance au RATIO
    // qui en resulte". Sur une bordure fine, quelques px d'erreur (recadrage
    // manuel imprecis, distorsion du plastique du boitier, bruit JPEG)
    // deviennent un ecart de pourcentage enorme une fois normalises -- alors
    // que la meme erreur en px reste negligeable sur une large bordure
    // vintage. C'est un effet d'amplification mathematique, independant de
    // la qualite de la detection elle-meme (confirme sur calibration reelle :
    // ameliorer seulement la detection du bord a EMPIRE la correlation avec
    // les vraies notes PSA, precisement parce que le detecteur ameliore
    // trouvait des bordures fines "en toute confiance"). On pondere donc
    // aussi par la largeur ABSOLUE detectee : une bordure sous ~4% de la
    // dimension ne peut pas justifier un ratio pris a la lettre, meme
    // confiante sur la transition elle-meme.
    const MIN_RELIABLE_BORDER_FRAC = 0.04
    const widthConfidence = (px: number, dim: number) => Math.max(0, Math.min(1, (px / dim) / MIN_RELIABLE_BORDER_FRAC))
    const sideConfidence = (b: { idx: number; confident: boolean }, dim: number) => b.confident ? widthConfidence(b.idx, dim) : 0
    const lrConf = Math.min(sideConfidence(bLeft, WARP_W), sideConfidence(bRight, WARP_W))
    const tbConf = Math.min(sideConfidence(bTop, WARP_H), sideConfidence(bBottom, WARP_H))
    setCenteringConfidence({ lr: lrConf, tb: tbConf })
    const leftB = borderChipScore(img, pts, frac, 'left')
    const rightB = borderChipScore(img, pts, frac, 'right')
    const topB = borderChipScore(img, pts, frac, 'top')
    const bottomB = borderChipScore(img, pts, frac, 'bottom')
    setBorderScores({ left: leftB.score, right: rightB.score, top: topB.score, bottom: bottomB.score })
    const stabilityBySide: Record<keyof BorderFrac, number> = {
      left: leftB.stability, right: rightB.stability, top: topB.stability, bottom: bottomB.stability,
    }
    setCornerScores(pts.map((_, i) => {
      const nb = CORNER_NEIGHBORS[i]
      const st = (stabilityBySide[nb.uFracKey] + stabilityBySide[nb.vFracKey]) / 2
      return cornerDamage(img, pts, i, frac, st)
    }))
    // Meme warp que la detection de bordure -- aucun cout supplementaire.
    const { gray, w, h } = grayscaleOf(warp)
    setSurface(surfaceScore(gray, w, h))
    setPhotoQuality(assessPhotoQuality(gray, w, h))
    // Champ de vision du crop proportionnel a la resolution de la photo --
    // meme logique que le rayon des poignees, pour rester coherent visuellement
    // quelle que soit la taille de l'image source.
    const cropSize = Math.max(90, img.naturalWidth / 20)
    setCornerCrops(pts.map(p => cropCornerImage(img, p, cropSize)))
    // Zoom sur chaque bord -- crop centre sur le MILIEU de chaque segment de
    // bordure (evite les coins, deja couverts a part) pour aider a juger
    // visuellement les eclats plutot que de se fier a un seul verdict calcule.
    const midOf = ([a, b]: [Pt, Pt]): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const bsegs = borderSegments(pts, frac)
    setBorderCrops({
      left: cropCornerImage(img, midOf(bsegs.left), cropSize),
      right: cropCornerImage(img, midOf(bsegs.right), cropSize),
      top: cropCornerImage(img, midOf(bsegs.top), cropSize),
      bottom: cropCornerImage(img, midOf(bsegs.bottom), cropSize),
    })
  }

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
    setPercents(null)
    setCornerScores(null)
    setCornerCrops(null)
    setBorderCrops(null)
    setHasCorners(false)
    try {
      const url = URL.createObjectURL(file)
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(t('gradation_error_invalid_image')))
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
        if (!rawCorners) throw new Error(t('gradation_error_no_card_detected'))
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

  const loadFromGallery = async (card: PickableCard) => {
    setGalleryPickerOpen(false)
    setBusy(true)
    setError('')
    try {
      // Passe par le proxy same-origin -- un fetch direct vers le storage
      // Supabase echoue en pratique (CORS), voir src/app/api/proxy-image.
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(card.img)}`)
      if (!res.ok) throw new Error(t('gradation_error_invalid_image'))
      const blob = await res.blob()
      await onFile(new File([blob], 'carte.jpg', { type: blob.type || 'image/jpeg' }))
    } catch (e: any) {
      setError(e?.message || String(e))
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
      setTouchPoint({ x: e.clientX, y: e.clientY })
      drawMagnifier(pos, '#ff8c00')
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
      setTouchPoint({ x: e.clientX, y: e.clientY })
      drawMagnifier(pos, bestSide === 'left' || bestSide === 'right' ? '#00c878' : '#1e78ff')
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
      setTouchPoint({ x: e.clientX, y: e.clientY })
      drawMagnifier(pos, '#ff8c00')
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
      setTouchPoint({ x: e.clientX, y: e.clientY })
      drawMagnifier(pos, side === 'left' || side === 'right' ? '#00c878' : '#1e78ff')
      return
    }

    // Loupe libre : hors de tout glissement de coin/ligne, suit simplement
    // le pointeur pour inspecter n'importe quelle zone (surface incluse).
    if (freeLoupeOn) {
      setTouchPoint({ x: e.clientX, y: e.clientY })
      drawMagnifier(pos, '#0046D1')
    }
  }

  const onPointerLeave = () => {
    if (freeLoupeOn && dragCornerIdxRef.current === null && dragBorderSideRef.current === null) {
      setTouchPoint(null)
    }
  }

  const onPointerUp = () => {
    const wasCorner = dragCornerIdxRef.current !== null
    dragCornerIdxRef.current = null
    dragBorderSideRef.current = null
    setTouchPoint(null)
    // Un coin deplace change la geometrie du warp -- on refait une detection
    // fraiche de la bordure (les reglages manuels de bordure precedents sont
    // perdus, mais un ajustement de coin se fait normalement avant, pas apres).
    if (wasCorner && cornersRef.current) recompute(cornersRef.current)
  }

  const reset = () => {
    setHasCorners(false)
    setPercents(null)
    setCornerScores(null)
    setCornerCrops(null)
    setBorderCrops(null)
    setBorderScores(null)
    setSurface(null)
    setPhotoQuality(null)
    setCenteringConfidence({ lr: 1, tb: 1 })
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

  // Coche/decoche "carte deja rognee" APRES qu'une photo soit deja chargee --
  // pas besoin de re-uploader : recalcule directement a partir de imgRef.
  const applyPreCropped = async (checked: boolean) => {
    setPreCropped(checked)
    const img = imgRef.current
    if (!img) return
    setBusy(true)
    setError('')
    try {
      let pts: Pt[]
      let c: number
      if (checked) {
        pts = [
          { x: 0, y: 0 },
          { x: img.naturalWidth, y: 0 },
          { x: img.naturalWidth, y: img.naturalHeight },
          { x: 0, y: img.naturalHeight },
        ]
        c = 1
      } else {
        const ort = await import('onnxruntime-web')
        ort.env.wasm.wasmPaths = ORT_CDN
        ort.env.wasm.numThreads = 1
        const scale = Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)
        const { corners: rawCorners, conf: rawConf } = await detectRawCorners(ort, img)
        if (!rawCorners) throw new Error(t('gradation_error_no_card_detected'))
        pts = refineCornersV5(img, rawCorners, scale)
        c = rawConf
      }
      cornersRef.current = pts
      setConf(c)
      setPreCropWarning(!checked && looksPreCropped(img.naturalWidth, img.naturalHeight))
      recompute(pts)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  const borderSideNames: Record<keyof BorderFrac, string> = {
    left: t('gradation_left'), right: t('gradation_right'), top: t('gradation_top'), bottom: t('gradation_bottom'),
  }
  const photoQualityIssues = photoQuality
    ? [
        photoQuality.blurry && t('gradation_quality_blurry'),
        photoQuality.tooDark && t('gradation_quality_dark'),
        photoQuality.tooBright && t('gradation_quality_bright'),
        photoQuality.lowContrast && t('gradation_quality_low_contrast'),
      ].filter(Boolean) as string[]
    : []

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ position: 'sticky', top: 'calc(60px + var(--safe-area-inset-top, env(safe-area-inset-top)))', zIndex: 10, background: dark ? '#0f0f0f' : '#fff', borderBottom: `1px solid ${border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', height: 48 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: text }}>🔍 {t('gradation_title')}</span>
        {hasCorners && (
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: muted, background: 'none', border: `1px solid ${border}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 700 }}>
            {t('gradation_new_photo')}
          </button>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px 12px 80px' }}>
        <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', marginBottom: 16, lineHeight: 1.5 }}>
          ⚠️ {t('gradation_beta_warning')}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: text, background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={preCropped} onChange={e => applyPreCropped(e.target.checked)} style={{ width: 18, height: 18, flexShrink: 0 }} />
          <span>
            {t('gradation_precropped_label')} <span style={{ color: muted }}>{t('gradation_precropped_hint')}</span>
            {hasCorners && <span style={{ color: muted }}> {t('gradation_precropped_recompute_note')}</span>}
          </span>
        </label>

        {!hasCorners && !busy && (
          <div style={{ paddingTop: 4 }}>
            <button onClick={() => setCameraModal(true)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', minHeight: 180, background: blue, border: 'none',
              borderRadius: 20, cursor: 'pointer', color: '#fff', marginBottom: 12,
            }}>
              <span style={{ fontSize: 48, lineHeight: 1 }}>📷</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{t('gradation_take_photo')}</span>
            </button>
            <button onClick={() => galleryRef.current?.click()} style={{
              width: '100%', padding: '13px 0', background: 'none', border: `2px solid ${border}`,
              borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700,
            }}>
              {t('gradation_import_gallery')}
            </button>
            {user && (
              <button onClick={() => setGalleryPickerOpen(true)} style={{
                width: '100%', padding: '13px 0', marginTop: 10, background: 'none', border: `2px solid ${border}`,
                borderRadius: 14, cursor: 'pointer', color: muted, fontSize: 14, fontWeight: 700,
              }}>
                🗂️ {t('gradation_from_memorabilius')}
              </button>
            )}
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
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 12 }}>{t('gradation_analyzing')}</div>
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

        {/* Toujours monte (jamais {hasCorners && ...}) -- recompute()/redrawOverlay()
            dessinent dedans de facon imperative des la fin du chargement du fichier,
            avant meme que React n'ait eu l'occasion de re-rendre suite a
            setHasCorners(true). Un canvas conditionnellement rendu n'existe pas
            encore dans le DOM a ce moment-la (canvasRef.current === null), et le
            dessin est silencieusement perdu. Seule la visibilite (display) doit
            dependre de hasCorners, jamais le montage. */}
        <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 12, marginBottom: 14, display: hasCorners ? 'block' : 'none' }}>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: muted, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff8c00', display: 'inline-block' }} /> {t('gradation_legend_corner')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: '#00c878', display: 'inline-block' }} /> {t('gradation_legend_border_lr')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 2, background: '#1e78ff', display: 'inline-block' }} /> {t('gradation_legend_border_tb')}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            style={{ width: '100%', borderRadius: 10, background: border, touchAction: 'none', cursor: freeLoupeOn ? 'crosshair' : 'grab', display: 'block' }}
          />
          <p style={{ fontSize: 11, color: muted, marginTop: 8, textAlign: 'center' }}>
            {t('gradation_drag_hint')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border}`, flexWrap: 'wrap' }}>
            <button
              onClick={() => setFreeLoupeOn(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
                color: freeLoupeOn ? '#fff' : text, background: freeLoupeOn ? blue : 'none',
                border: `1px solid ${freeLoupeOn ? blue : border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
              }}
            >
              🔍 {t('gradation_free_loupe')} {freeLoupeOn ? t('gradation_free_loupe_active') : ''}
            </button>
            {freeLoupeOn && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
                <span style={{ fontSize: 11, color: muted }}>{t('gradation_zoom_label')}</span>
                <input
                  type="range" min={6} max={40} value={loupeZoom}
                  onChange={e => setLoupeZoom(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 11, color: muted, minWidth: 40, textAlign: 'right' }}>
                  {loupeZoom <= 12 ? t('gradation_zoom_low') : loupeZoom <= 25 ? t('gradation_zoom_medium') : t('gradation_zoom_high')}
                </span>
              </div>
            )}
          </div>
          {freeLoupeOn && (
            <p style={{ fontSize: 11, color: muted, marginTop: 8, textAlign: 'center' }}>
              {t('gradation_free_loupe_hint')}
            </p>
          )}
        </div>

        {touchPoint && typeof window !== 'undefined' && (
          <div style={{
            position: 'fixed', zIndex: 999, pointerEvents: 'none',
            left: Math.max(8, Math.min(window.innerWidth - MAG_SIZE - 8, touchPoint.x - MAG_SIZE / 2)),
            // Bascule sous le point touche si la loupe (plus grande qu'avant)
            // deborderait en haut de l'ecran (doigt pres du haut sur mobile).
            top: touchPoint.y - MAG_OFFSET_Y - MAG_SIZE >= 8
              ? touchPoint.y - MAG_OFFSET_Y - MAG_SIZE
              : touchPoint.y + MAG_OFFSET_Y - 40,
            width: MAG_SIZE, height: MAG_SIZE, borderRadius: '50%',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          }}>
            <canvas ref={magnifierCanvasRef} width={MAG_SIZE} height={MAG_SIZE} style={{ width: MAG_SIZE, height: MAG_SIZE, borderRadius: '50%' }} />
          </div>
        )}

        {percents && cornerScores && (
          <div style={{ display: 'grid', gap: 14 }}>
            {preCropWarning && (
              <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
                ⚠️ {t('gradation_precrop_warning')}
              </div>
            )}

            {photoQualityIssues.length > 0 && (
              <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
                ⚠️ {photoQualityIssues.join(' · ')} — {t('gradation_quality_retake')}
              </div>
            )}

            <div style={{ fontSize: 12, color: warnText, background: warnBg, border: `1px solid ${warnBorder}`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>
              ⚠️ {t('gradation_no_grade_disclaimer')}
            </div>

            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                {t('gradation_centering_title')}
              </div>
              <p style={{ fontSize: 11, color: muted, marginTop: 0, marginBottom: 14 }}>
                {t('gradation_centering_desc')}
                {(centeringConfidence.lr < 0.5 || centeringConfidence.tb < 0.5) && ' ' + t('gradation_centering_low_confidence')}
              </p>
              <CenteringBar leftLabel={t('gradation_left')} rightLabel={t('gradation_right')} pct={percents.leftRightPct} blue={blue} border={border} muted={muted} text={text} />
              <div style={{ height: 16 }} />
              <CenteringBar leftLabel={t('gradation_top')} rightLabel={t('gradation_bottom')} pct={percents.topBottomPct} blue={blue} border={border} muted={muted} text={text} />
            </div>

            <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                {t('gradation_corners_title')}
              </div>
              <p style={{ fontSize: 11, color: muted, marginTop: 0, marginBottom: 12 }}>
                {t('gradation_corners_subtitle')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {cornerScores.map((s, i) => {
                  const label = t(damageKey(s))
                  const color = damageColor(s)
                  return (
                    <div key={i} style={{ padding: 10, background: dark ? '#111' : '#f8f9fb', border: `1px solid ${border}`, borderRadius: 10 }}>
                      {cornerCrops && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cornerCrops[i]}
                          alt={`Zoom ${t(cornerNameKeys[i])}`}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, marginBottom: 8, border: `1px solid ${border}`, background: border }}
                        />
                      )}
                      <div style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{t(cornerNameKeys[i])}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {borderScores && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  {t('gradation_borders_title')}
                </div>
                <p style={{ fontSize: 11, color: muted, marginTop: 0, marginBottom: 12 }}>
                  {t('gradation_borders_subtitle')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {(Object.keys(borderScores) as (keyof BorderFrac)[]).map(side => {
                    const s = borderScores[side]
                    return (
                      <div key={side} style={{ padding: 10, background: dark ? '#111' : '#f8f9fb', border: `1px solid ${border}`, borderRadius: 10 }}>
                        {borderCrops && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={borderCrops[side]}
                            alt={`${t('gradation_border_zoom_alt')} ${borderSideNames[side]}`}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, marginBottom: 8, border: `1px solid ${border}`, background: border }}
                          />
                        )}
                        <div style={{ fontSize: 10, color: muted, marginBottom: 3 }}>{borderSideNames[side]}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: damageColor(s) }}>{t(damageKey(s))}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {surface !== null && (
              <div style={{ background: cardBg, borderRadius: 16, border: `1px solid ${border}`, padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                  {t('gradation_surface_title')}
                </div>
                <p style={{ fontSize: 11, color: muted, marginTop: 0, marginBottom: 12 }}>
                  {t('gradation_surface_subtitle')}
                </p>
                <div style={{ padding: '10px 12px', background: dark ? '#111' : '#f8f9fb', border: `1px solid ${border}`, borderRadius: 10, display: 'inline-block' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: damageColor(surface) }}>{t(damageKey(surface))}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {cameraModal && (
        <CameraCapture onCapture={handleCapture} onClose={() => setCameraModal(false)} />
      )}

      {galleryPickerOpen && user && (
        <CardPicker userId={user.id} onSelect={loadFromGallery} onClose={() => setGalleryPickerOpen(false)} />
      )}

      <style>{`
        @keyframes slideIn { 0% { transform: translateX(-150%); } 100% { transform: translateX(280%); } }
      `}</style>
    </div>
  )
}
