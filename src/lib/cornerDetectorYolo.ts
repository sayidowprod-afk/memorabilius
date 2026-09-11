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
