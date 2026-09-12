// Détection de coins par YOLOv8-pose en ONNX — tourne entièrement dans le navigateur.
// Le modèle est chargé une fois depuis /models/corners.onnx et mis en cache.

// 960 -> 640 (31/08) : re-export a 640 plus rapide (~450ms vs ~1800ms mesures
// en WASM reel) ET plus confiant (conf ~0.94 vs ~0.89) que la version 1280 --
// teste sur plusieurs cartes reelles avant deploiement, pas juste suppose.
// Le fichier ONNX en prod doit correspondre a cette taille (voir public/models/corners.onnx).
//
// 01/09 : modele remplace par le checkpoint train-28 (meme archi yolov8n-pose,
// dataset identique, mais sigma OKS d'entrainement/validation resserre --
// force une localisation de coins plus precise au lieu du sigma par defaut
// trop tolerant pour un modele a 4 keypoints, voir scripts/train_corners_tight_sigma.py)
// + quantification INT8 dynamique pour la vitesse (meme demarche que
// precedemment identifiee comme le meilleur compromis vitesse/precision).
//
// 11/09 : remplace par train-33 (epoch 176, EarlyStopping) -- meme sigma
// resserre (0.04) et memes reglages que train-28/29, mais SANS augmentation
// geometrique/couleur ajoutee (Ultralytics defaults stock) + dataset le plus
// recent sur-echantillonne x5 sur les corrections utilisateur reelles.
// Nouveau record toutes sessions confondues : fitness (mAP50-95 box+pose)
// 1.95056, contre 1.948 pour train-29 (le meilleur run precedent) -- voir
// scripts/train_corners_zero_aug_x5.py pour le detail des essais compares.
// Confiance verifiee coherente avant publication (/dev-model-test).
const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'

type Pt = { x: number; y: number }
type OrtSession = import('onnxruntime-web').InferenceSession

let _session: OrtSession | null = null
let _sessionPromise: Promise<OrtSession> | null = null

async function getSession(): Promise<OrtSession> {
  if (_session) return _session
  if (_sessionPromise) return _sessionPromise
  _sessionPromise = (async () => {
    console.log('[YOLO] chargement ORT...')
    const ort = await import('onnxruntime-web')
    console.log('[YOLO] ORT importé, init WASM...')
    ort.env.wasm.wasmPaths = ORT_CDN
    // Multi-thread (SharedArrayBuffer) seulement si la page est cross-origin isolée
    // (headers COOP/COEP, voir next.config.js) — sinon le navigateur n'expose pas
    // SharedArrayBuffer et ort retombe silencieusement sur 1 thread de toute façon.
    // Plafonné à 4 : au-delà, le gain marginal ne justifie pas de saturer un mobile
    // bas de gamme (peu de coeurs, cache partagé).
    ort.env.wasm.numThreads = (window as any).crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1
    console.log('[YOLO] chargement corners.onnx...')
    const s = await ort.InferenceSession.create('/models/corners.onnx', {
      executionProviders: ['wasm'],
    })
    console.log('[YOLO] modèle chargé ✓', s.inputNames, s.outputNames)
    _session = s
    return s
  })().catch(e => { console.error('[YOLO] ERREUR chargement:', e); _sessionPromise = null; throw e })
  return _sessionPromise
}

// Resize avec letterbox (fond gris 114) → canvas 640×640
function letterbox(img: HTMLImageElement): {
  canvas: HTMLCanvasElement; padX: number; padY: number; scale: number
} {
  const scale = Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)
  const newW  = Math.round(img.naturalWidth  * scale)
  const newH  = Math.round(img.naturalHeight * scale)
  const padX  = Math.round((IMGSZ - newW) / 2)
  const padY  = Math.round((IMGSZ - newH) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = IMGSZ
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgb(114,114,114)'
  ctx.fillRect(0, 0, IMGSZ, IMGSZ)
  ctx.drawImage(img, padX, padY, newW, newH)
  return { canvas, padX, padY, scale }
}

// RGBA → tensor RGB CHW normalisé [0,1]. `flip` mirore horizontalement à la
// volée pendant la lecture des pixels (pour le TTA ci-dessous) sans avoir à
// dessiner un second canvas.
function toTensor(canvas: HTMLCanvasElement, flip = false): Float32Array {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, IMGSZ, IMGSZ)
  const N   = IMGSZ * IMGSZ
  const out = new Float32Array(3 * N)
  for (let y = 0; y < IMGSZ; y++) {
    for (let x = 0; x < IMGSZ; x++) {
      const srcX = flip ? IMGSZ - 1 - x : x
      const si = (y * IMGSZ + srcX) * 4
      const di = y * IMGSZ + x
      out[0 * N + di] = data[si]     / 255
      out[1 * N + di] = data[si + 1] / 255
      out[2 * N + di] = data[si + 2] / 255
    }
  }
  return out
}

type RawDetection = { corners: Pt[]; conf: number }

// Une passe d'inférence sur le tenseur donné -- retourne la meilleure
// détection en coordonnées du canvas letterboxé (pas encore reprojetée vers
// l'image d'origine), ou null si rien au-dessus du seuil.
async function runInference(
  ort: typeof import('onnxruntime-web'),
  session: OrtSession,
  tensorData: Float32Array,
  confThresh: number,
  label: string,
): Promise<RawDetection | null> {
  const input  = new ort.Tensor('float32', tensorData, [1, 3, IMGSZ, IMGSZ])
  const result = await session.run({ [session.inputNames[0]]: input })
  const outTensor = result[session.outputNames[0]]
  const raw    = outTensor.data as Float32Array

  // Sortie YOLOv8-pose : [1, channels, N] — N déduit dynamiquement
  // canal 0-3 : cx,cy,w,h  |  canal 4 : conf  |  canaux 5+ : 4 kpts × (x,y,v)
  const dims = outTensor.dims as number[]
  const N = dims[2]
  let bestConf = confThresh
  let bestIdx  = -1
  let maxConfAny = 0
  for (let i = 0; i < N; i++) {
    const conf = raw[4 * N + i]
    if (conf > maxConfAny) maxConfAny = conf
    if (conf > bestConf) { bestConf = conf; bestIdx = i }
  }
  console.log(`[YOLO${label}] maxConf=${maxConfAny.toFixed(3)} bestConf=${bestConf.toFixed(3)} threshold=${confThresh}`)
  if (bestIdx < 0) return null

  const corners: Pt[] = []
  for (let k = 0; k < 4; k++) {
    corners.push({
      x: raw[(5 + k * 3)     * N + bestIdx],
      y: raw[(5 + k * 3 + 1) * N + bestIdx],
    })
  }
  return { corners, conf: bestConf }
}

// 12/09 : raffinement sub-pixel en post-traitement, cf. discussion "le tracé
// n'est jamais parfait" -- YOLO reste une approximation apprise (toujours un
// petit biais résiduel même bien entraîné), donc on ancre chaque coin sur le
// vrai contraste de pixels de l'image d'origine plutôt que de compter
// uniquement sur le réseau. Équivalent de cv2.cornerSubPix : dans une fenêtre
// autour du coin YOLO, chaque pixel de bord "vote" pour la position du coin
// via son gradient (le coin doit se trouver sur la droite perpendiculaire au
// gradient passant par ce pixel), on résout au sens des moindres carrés,
// pondéré par une gaussienne recentrée sur l'estimation courante à chaque
// itération (comme cv2.cornerSubPix) -- sans ce recentrage, la première
// résolution est définitive et rien ne "cherche" activement le bord réel.
//
// Mesuré sur une vraie image d'entraînement (1200×1600) : l'écart entre le
// point YOLO et le vrai bord peut atteindre ~25px en résolution originale,
// car le réseau raisonne sur un canvas 640×640 -- une erreur de quelques
// pixels à cette échelle se retrouve multipliée par (résolution originale /
// 640) une fois reprojetée. La fenêtre de recherche doit donc s'adapter à ce
// facteur d'échelle (scale = 640 / plus grand côté), pas rester fixe.
const REFINE_ITERATIONS = 6
// Bornes de la fenêtre de recherche (rayon en pixels image d'origine) : assez
// grande pour couvrir l'erreur de reprojection typique (~8px en espace
// réseau / scale), plafonnée pour rester rapide sur les photos très haute
// résolution (fenêtre carrée -> coût en rayon²).
const REFINE_RADIUS_MIN = 20
const REFINE_RADIUS_MAX = 60
const REFINE_NETWORK_ERROR_BUDGET_PX = 12

function sobelGray(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const o = i * 4
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }
  return gray
}

function refineCornerSubpixel(img: HTMLImageElement, corner: Pt, scale: number): Pt {
  const r = Math.round(
    Math.min(REFINE_RADIUS_MAX, Math.max(REFINE_RADIUS_MIN, REFINE_NETWORK_ERROR_BUDGET_PX / scale))
  )
  const left = Math.round(corner.x - r)
  const top  = Math.round(corner.y - r)
  const size = r * 2 + 1
  // Trop près du bord de l'image = pas assez de marge pour une fenêtre fiable.
  if (left < 0 || top < 0 || left + size > img.naturalWidth || top + size > img.naturalHeight) {
    return corner
  }

  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, left, top, size, size, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  canvas.width = 0
  const gray = sobelGray(data, size, size)

  // Précalcule gradients + magnitude une seule fois (indépendants de
  // l'itération) -- seule la pondération gaussienne, recentrée à chaque
  // itération sur l'estimation courante, change.
  const gxArr = new Float32Array(size * size)
  const gyArr = new Float32Array(size * size)
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = y * size + x
      gxArr[i] = gray[i + 1] - gray[i - 1]
      gyArr[i] = gray[i + size] - gray[i - size]
    }
  }

  let px = corner.x - left, py = corner.y - top // position courante, coords fenêtre
  const sigma0 = r * 0.9
  for (let iter = 0; iter < REFINE_ITERATIONS; iter++) {
    const sigma = Math.max(4, sigma0 * (1 - iter / REFINE_ITERATIONS)) // fenêtre effective qui se resserre
    const twoSigma2 = 2 * sigma * sigma
    let sxx = 0, sxy = 0, syy = 0, sbx = 0, sby = 0
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x
        const gx = gxArr[i], gy = gyArr[i]
        const mag2 = gx * gx + gy * gy
        if (mag2 < 25) continue // zone plate (gradient trop faible) -- pas un bord
        const dx = x - px, dy = y - py
        const w = Math.exp(-(dx * dx + dy * dy) / twoSigma2)
        if (w < 0.02) continue
        sxx += w * gx * gx; sxy += w * gx * gy; syy += w * gy * gy
        sbx += w * (gx * gx * x + gx * gy * y)
        sby += w * (gx * gy * x + gy * gy * y)
      }
    }
    const det = sxx * syy - sxy * sxy
    if (Math.abs(det) < 1e-6) break // pas assez de structure directionnelle -> abandon
    const nx = (syy * sbx - sxy * sby) / det
    const ny = (sxx * sby - sxy * sbx) / det
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) break
    px = nx; py = ny
  }

  const refined = { x: left + px, y: top + py }
  // Garde-fou : le point raffiné doit rester DANS la fenêtre de recherche --
  // sinon la résolution a divergé (pas de structure cohérente) et on garde
  // le point YOLO brut plutôt qu'un résultat aberrant.
  if (!Number.isFinite(refined.x) || !Number.isFinite(refined.y) || px < 0 || py < 0 || px > size - 1 || py > size - 1) {
    return corner
  }
  return refined
}

function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i + 1) % pts.length]
    a += p1.x * p2.y - p2.x * p1.y
  }
  return a / 2
}

// Raffine les 4 coins (en pixels image d'origine) + garde-fou global : si le
// raffinement déforme trop le quadrilatère (aire trop différente -- ex.
// plusieurs coins tirés vers un même bord bruité), on rejette tout le
// raffinement et on garde les points bruts plutôt que de risquer un contour
// moins bon que l'original. Exporté pour /dev-model-test (comparaison
// visuelle brut vs raffiné avant décision de déploiement en prod).
export function refineCorners(img: HTMLImageElement, corners: Pt[], scale: number): Pt[] {
  const refined = corners.map(c => refineCornerSubpixel(img, c, scale))
  const origArea = Math.abs(signedArea(corners))
  const refinedArea = Math.abs(signedArea(refined))
  const areaRatio = origArea > 0 ? refinedArea / origArea : 1
  return (areaRatio > 0.85 && areaRatio < 1.15) ? refined : corners
}

// En dessous de ce seuil de confiance (ou si aucune détection), une seconde
// passe est tentée sur l'image mirorée horizontalement et moyennée avec la
// première -- classique "test-time augmentation" par flip, connu pour
// stabiliser les cas limites (reflet, angle serré) sans coûter le temps
// d'une 2e passe sur les scans déjà faciles (l'immense majorité).
const TTA_CONF_THRESHOLD = 0.85
// Coins dans l'ordre [tl, tr, br, bl] -- un flip horizontal échange
// tl<->tr et bl<->br (même convention que flip_idx dans data.yaml).
const FLIP_IDX = [1, 0, 3, 2]

// Détecte les 4 coins d'une carte (tl, tr, br, bl) en pixels image originale.
// Retourne null si aucune détection confiante ou si le modèle n'est pas disponible.
export async function detectCornersYOLO(
  img: HTMLImageElement,
  confThresh = 0.30,
): Promise<Pt[] | null> {
  try {
    const ort     = await import('onnxruntime-web')
    const session = await getSession()

    const { canvas, padX, padY, scale } = letterbox(img)
    const tensorData = toTensor(canvas)

    const primary = await runInference(ort, session, tensorData, confThresh, '')

    let combined: RawDetection | null = primary
    if (!primary || primary.conf < TTA_CONF_THRESHOLD) {
      const flippedTensor = toTensor(canvas, true)
      const flipped = await runInference(ort, session, flippedTensor, confThresh, ' (TTA flip)')
      if (flipped) {
        // Reprojette les coins de la passe mirorée dans le repère normal
        // (mirore x en retour) + reordonne selon FLIP_IDX (un coin "haut-
        // gauche" sur l'image mirorée est en realite le "haut-droit").
        const unflipped: Pt[] = FLIP_IDX.map(srcI => ({
          x: IMGSZ - flipped.corners[srcI].x,
          y: flipped.corners[srcI].y,
        }))
        if (!primary) {
          combined = { corners: unflipped, conf: flipped.conf }
        } else {
          // Moyenne ponderee par la confiance de chaque passe.
          const wPrimary = primary.conf, wFlip = flipped.conf
          const wSum = wPrimary + wFlip
          combined = {
            corners: primary.corners.map((p, i) => ({
              x: (p.x * wPrimary + unflipped[i].x * wFlip) / wSum,
              y: (p.y * wPrimary + unflipped[i].y * wFlip) / wSum,
            })),
            conf: Math.max(primary.conf, flipped.conf),
          }
        }
      }
    }

    canvas.width = 0  // libère la mémoire GPU

    if (!combined) return null
    // Raffinement sub-pixel (voir refineCorners plus haut) volontairement PAS
    // appliqué ici -- ce chemin est celui du scan en prod (CardScanner). Le
    // raffinement n'est branché que sur /dev-model-test pour l'instant, le
    // temps de le valider visuellement avant d'envisager de l'activer ici.
    return combined.corners.map(p => ({ x: (p.x - padX) / scale, y: (p.y - padY) / scale }))
  } catch (e) {
    console.warn('[YOLO corners]', e)
    return null
  }
}

// Retourne true si le modèle est chargé et prêt (warmup terminé).
export function isYOLOReady(): boolean {
  return _session !== null
}

// Attend que le modèle soit chargé (max timeoutMs). Retourne true si prêt.
export async function waitForYOLO(timeoutMs = 25000): Promise<boolean> {
  if (_session) return true
  try {
    await Promise.race([
      getSession(),
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), timeoutMs)),
    ])
    return _session !== null
  } catch {
    return false
  }
}

// À appeler au montage du CardScanner pour précharger le modèle en arrière-plan.
export function warmupYOLO(): void {
  if (typeof window === 'undefined') return
  getSession().catch(() => {/* silencieux */})
}
