'use client'
import { useRef, useState } from 'react'
import { refineCorners, refineCornersV3 } from '@/lib/cornerDetectorYolo'

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
// Modele en prod actuellement (voir CardScanner/cornerDetectorYolo.ts) --
// une seule inference ici, on compare ensuite 3 variantes de post-traitement
// sur les MEMES coins bruts plutot que plusieurs checkpoints de modele.
const MODEL_URL = '/models/corners.onnx'

type Pt = { x: number; y: number }

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

type DetectResult = { rawCorners: Pt[] | null; conf: number; ms: number }

async function detect(ort: typeof import('onnxruntime-web'), img: HTMLImageElement): Promise<DetectResult> {
  const t0 = performance.now()
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
  const ms = performance.now() - t0
  if (bestIdx < 0) return { rawCorners: null, conf: 0, ms }
  const rawCorners: Pt[] = []
  for (let k = 0; k < 4; k++) {
    const kx = raw[(5 + k * 3) * N + bestIdx]
    const ky = raw[(5 + k * 3 + 1) * N + bestIdx]
    rawCorners.push({ x: (kx - padX) / scale, y: (ky - padY) / scale })
  }
  return { rawCorners, conf: bestConf, ms }
}

function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, corners: Pt[] | null, color: string) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (!corners) return
  const lw = Math.max(3, img.naturalWidth / 300)
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.beginPath()
  corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = color
  corners.forEach(p => {
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(6, img.naturalWidth / 100), 0, Math.PI * 2)
    ctx.fill()
  })
}

// 3 variantes affichees separement (une carte par variante, pas superposees)
// -- une seule inference YOLO, 3 post-traitements differents sur les MEMES
// coins bruts : "actuel" (brut, sans raffinement -- ce qui est reellement en
// prod sur le scanner aujourd'hui), "test actuel" (v2, deploye sur cette page
// depuis peu) et "nouvelle version test" (v3, multi-canal couleur + repli
// texture, cf. discussion fond blanc/toploader). Aucune des 2 versions de
// raffinement n'est branchee sur le scan en prod (CardScanner).
const VARIANTS = [
  { key: 'actuel', label: 'Actuel (brut, sans raffinement -- ce qui tourne en prod aujourd\'hui)', color: '#2222ff' },
  { key: 'v2', label: 'Test actuel (v2 -- intersection de bords)', color: '#e74c3c' },
  { key: 'v3', label: 'Nouvelle version test (v3 -- multi-canal couleur + repli texture)', color: '#ff8c00' },
] as const

export default function DevModelTest() {
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<{ conf: number; ms: number } | null>(null)
  const [corners, setCorners] = useState<Partial<Record<typeof VARIANTS[number]['key'], Pt[] | null>>>({})
  const [error, setError] = useState('')
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({})

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
    setCorners({})
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

      const { rawCorners, conf, ms } = await detect(ort, img)
      setInfo({ conf, ms })

      const variants = {
        actuel: rawCorners,
        v2: rawCorners ? refineCorners(img, rawCorners, Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)) : null,
        v3: rawCorners ? refineCornersV3(img, rawCorners, Math.min(IMGSZ / img.naturalWidth, IMGSZ / img.naturalHeight)) : null,
      }
      setCorners(variants)

      for (const v of VARIANTS) {
        const canvas = canvasRefs.current[v.key]
        if (canvas) draw(canvas, img, variants[v.key], v.color)
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
        3 sections : brut (ce qui tourne en prod aujourd'hui), raffinement v2 (déjà testé), et nouvelle version v3
      </p>
      {/* Identifiant de build (SHA du commit deploye, cf. next.config.js) --
          permet de verifier qu'on teste bien la derniere version pushee et
          pas un bundle precedent (page/onglet reste ouvert entre deux
          deploiements). */}
      <p style={{ fontSize: 11, color: '#bbb', marginBottom: 16, fontFamily: 'monospace' }}>
        build: {process.env.NEXT_PUBLIC_APP_VERSION}
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
      {info && <p style={{ fontSize: 12, color: '#888' }}>conf {info.conf.toFixed(3)} — {info.ms.toFixed(0)}ms (détection, avant post-traitement)</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, marginTop: 12 }}>
        {VARIANTS.map(v => {
          const c = corners[v.key]
          return (
            <div key={v.key}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: v.color }}>
                {v.label}{corners[v.key] !== undefined && !c ? ' — aucune détection' : ''}
              </h3>
              <canvas ref={el => { canvasRefs.current[v.key] = el }} style={{ width: '100%', maxWidth: '100%', borderRadius: 8, background: '#eee' }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
