// Détection de coins par YOLOv8-pose en ONNX — tourne entièrement dans le navigateur.
// Le modèle est chargé une fois depuis /models/corners.onnx et mis en cache.

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/'

type Pt = { x: number; y: number }
type OrtSession = import('onnxruntime-web').InferenceSession

let _session: OrtSession | null = null
let _sessionPromise: Promise<OrtSession> | null = null

async function getSession(): Promise<OrtSession> {
  if (_session) return _session
  if (_sessionPromise) return _sessionPromise
  _sessionPromise = (async () => {
    const ort = await import('onnxruntime-web')
    ort.env.wasm.wasmPaths = ORT_CDN
    ort.env.wasm.numThreads = 1
    const s = await ort.InferenceSession.create('/models/corners.onnx', {
      executionProviders: ['wasm'],
    })
    _session = s
    return s
  })().catch(e => { _sessionPromise = null; throw e })
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
    const raw    = result[session.outputNames[0]].data as Float32Array

    // Sortie YOLOv8-pose : [1, 17, 8400]
    // canal 0-3 : cx,cy,w,h  |  canal 4 : conf  |  canaux 5-16 : 4 kpts × (x,y,v)
    const N = 8400
    let bestConf = confThresh
    let bestIdx  = -1
    for (let i = 0; i < N; i++) {
      const conf = raw[4 * N + i]
      if (conf > bestConf) { bestConf = conf; bestIdx = i }
    }
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

// À appeler au montage du CardScanner pour précharger le modèle en arrière-plan.
export function warmupYOLO(): void {
  if (typeof window === 'undefined') return
  getSession().catch(() => {/* silencieux */})
}
