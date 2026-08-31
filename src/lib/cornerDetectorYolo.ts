// Détection de coins par YOLOv8-pose en ONNX — tourne entièrement dans le navigateur.
// Le modèle est chargé une fois depuis /models/corners.onnx et mis en cache.

// 960 -> 640 (31/08) : le meme modele (train-18) re-exporte a 640 est a la
// fois plus rapide (~450ms vs ~1800ms mesures en WASM reel) ET plus confiant
// (conf ~0.94 vs ~0.89) que la version 1280 -- teste sur plusieurs cartes
// reelles avant deploiement, pas juste suppose. Le fichier ONNX en prod doit
// correspondre a cette taille (voir public/models/corners.onnx).
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

// RGBA → tensor RGB CHW normalisé [0,1]
function toTensor(canvas: HTMLCanvasElement): Float32Array {
  const { data } = canvas.getContext('2d')!.getImageData(0, 0, IMGSZ, IMGSZ)
  const N   = IMGSZ * IMGSZ
  const out = new Float32Array(3 * N)
  for (let i = 0; i < N; i++) {
    out[0 * N + i] = data[i * 4]     / 255
    out[1 * N + i] = data[i * 4 + 1] / 255
    out[2 * N + i] = data[i * 4 + 2] / 255
  }
  return out
}

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
    canvas.width = 0  // libère la mémoire GPU

    const input  = new ort.Tensor('float32', tensorData, [1, 3, IMGSZ, IMGSZ])
    const result = await session.run({ [session.inputNames[0]]: input })
    const outTensor = result[session.outputNames[0]]
    const raw    = outTensor.data as Float32Array

    // Sortie YOLOv8-pose : [1, channels, N] — N déduit dynamiquement
    // canal 0-3 : cx,cy,w,h  |  canal 4 : conf  |  canaux 5+ : 4 kpts × (x,y,v)
    const dims = outTensor.dims as number[]
    const channels = dims[1]
    const N = dims[2]
    console.log(`[YOLO] outputDims=[${dims.join(',')}] channels=${channels} N=${N}`)
    let bestConf = confThresh
    let bestIdx  = -1
    let maxConfAny = 0
    for (let i = 0; i < N; i++) {
      const conf = raw[4 * N + i]
      if (conf > maxConfAny) maxConfAny = conf
      if (conf > bestConf) { bestConf = conf; bestIdx = i }
    }
    console.log(`[YOLO] maxConf=${maxConfAny.toFixed(3)} bestConf=${bestConf.toFixed(3)} threshold=${confThresh}`)
    if (bestIdx < 0) return null

    // Extrait les 4 keypoints et convertit vers l'espace image originale
    const corners: Pt[] = []
    for (let k = 0; k < 4; k++) {
      const kx = raw[(5 + k * 3)     * N + bestIdx]
      const ky = raw[(5 + k * 3 + 1) * N + bestIdx]
      corners.push({ x: (kx - padX) / scale, y: (ky - padY) / scale })
    }
    return corners
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
