'use client'
import { useRef, useState } from 'react'
import { refineCorners } from '@/lib/cornerDetectorYolo'

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'

type Pt = { x: number; y: number }
type RunResult = { corners: Pt[] | null; rawCorners: Pt[] | null; conf: number; ms: number }

const MODELS = [
  { key: 'prod', label: 'Prod (actuel)', url: '/models/corners.onnx', color: '#e74c3c' },
  { key: 'train33dyn', label: 'train-33 FINAL (int8 dynamique, epoch 176 -- sans augmentation + dataset x5, nouveau record fitness 1.95056)', url: '/models/corners-train33-dynamic.onnx', color: '#27ae60' },
  // int8 statique retire : conf 0.000 systematique (bug de quantification irrecuperable
  // sur cette architecture -- teste per-channel + activations UInt8, echec identique dans
  // les deux cas). Le dynamique donne des scores quasi identiques au fp32, pas de perte
  // reelle a l'abandonner.
] as const

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

async function runModel(ort: typeof import('onnxruntime-web'), modelUrl: string, img: HTMLImageElement): Promise<RunResult> {
  const t0 = performance.now()
  const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
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
  if (bestIdx < 0) { const ms = performance.now() - t0; return { corners: null, rawCorners: null, conf: 0, ms } }
  const rawCorners: Pt[] = []
  for (let k = 0; k < 4; k++) {
    const kx = raw[(5 + k * 3) * N + bestIdx]
    const ky = raw[(5 + k * 3 + 1) * N + bestIdx]
    rawCorners.push({ x: (kx - padX) / scale, y: (ky - padY) / scale })
  }
  const corners = refineCorners(img, rawCorners, scale)
  const ms = performance.now() - t0
  return { corners, rawCorners, conf: bestConf, ms }
}

function drawQuad(ctx: CanvasRenderingContext2D, corners: Pt[], color: string, lineWidth: number, dashed: boolean) {
  ctx.setLineDash(dashed ? [10, 8] : [])
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.stroke()
  ctx.setLineDash([])
}

// Brut YOLO en rouge pointillé + raffiné sub-pixel (voir cornerDetectorYolo.ts)
// en couleur du modèle, plein -- pour juger visuellement si le raffinement
// corrige bien vers le vrai bord avant de l'activer sur le scanner en prod.
function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, res: RunResult, color: string) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (!res.corners) return
  const lw = Math.max(3, img.naturalWidth / 300)
  if (res.rawCorners) drawQuad(ctx, res.rawCorners, '#2222ff', lw, true)
  drawQuad(ctx, res.corners, color, lw, false)
  ctx.fillStyle = color
  res.corners.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(6, img.naturalWidth / 100), 0, Math.PI * 2)
    ctx.fill()
  })
}

export default function DevModelTest() {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Partial<Record<typeof MODELS[number]['key'], RunResult>>>({})
  const [error, setError] = useState('')
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
    setResults({})
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

      for (const m of MODELS) {
        const res = await runModel(ort, m.url, img)
        setResults(prev => ({ ...prev, [m.key]: res }))
        const canvas = canvasRefs.current[m.key]
        if (canvas) draw(canvas, img, res, m.color)
      }

      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 14px 60px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>🔬 Comparatif détection de coins</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        Prod actuelle vs le nouveau meilleur checkpoint (INT8 dynamique)
      </p>
      <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
        Bleu pointillé = point brut du modèle · couleur pleine = après raffinement sub-pixel (test, pas encore en prod)
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginTop: 12 }}>
        {MODELS.map(m => {
          const res = results[m.key]
          return (
            <div key={m.key}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: m.color }}>
                {m.label}{res && ` — conf ${res.conf.toFixed(3)} — ${res.ms.toFixed(0)}ms${res.corners ? '' : ' — aucune détection'}`}
              </h3>
              <canvas ref={el => { canvasRefs.current[m.key] = el }} style={{ width: '100%', maxWidth: '100%', borderRadius: 8, background: '#eee' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
