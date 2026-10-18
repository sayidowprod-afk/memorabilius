'use client'
import { useRef, useState } from 'react'

const IMGSZ = 640
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/'
// Premier modele die-cut (YOLOv8s-seg, 138 images annotees) -- test de
// validation uniquement, jamais branche sur le scanner (CardScanner.tsx
// n'est pas touche).
const MODEL_URL = '/models/diecut.onnx'
const MASK_SIZE = 160 // resolution des prototypes de masque YOLOv8-seg
const CONF_THRESHOLD = 0.4
const MASK_THRESHOLD = 0.5

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

type DetectResult = {
  found: boolean
  conf: number
  ms: number
  // Masque binaire 640x640 (espace letterbox), 1 octet par pixel
  mask640: Uint8Array | null
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

  // bbox en espace prototype (160x160, soit /4 de 640)
  const protoScale = PW / IMGSZ
  const x0 = Math.max(0, Math.round((cx - bw / 2) * protoScale))
  const y0 = Math.max(0, Math.round((cy - bh / 2) * protoScale))
  const x1 = Math.min(PW, Math.round((cx + bw / 2) * protoScale))
  const y1 = Math.min(PH, Math.round((cy + bh / 2) * protoScale))

  // upscale nearest 160x160 -> 640x640, mais seulement a l'interieur de la bbox
  const mask640 = new Uint8Array(IMGSZ * IMGSZ)
  const up = IMGSZ / PW
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      if (maskProto[py * PW + px] <= MASK_THRESHOLD) continue
      const sx0 = Math.round(px * up), sx1 = Math.round((px + 1) * up)
      const sy0 = Math.round(py * up), sy1 = Math.round((py + 1) * up)
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          mask640[yy * IMGSZ + xx] = 1
        }
      }
    }
  }

  return { found: true, conf: bestConf, ms, mask640 }
}

function draw(canvas: HTMLCanvasElement, img: HTMLImageElement, result: DetectResult) {
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  if (!result.found || !result.mask640) return

  const { padX, padY, newW, newH } = letterbox(img)

  // Dessine le masque (espace 640 letterbox) dans un canvas tampon colore,
  // puis le reprojette sur l'image a sa resolution d'origine (meme logique
  // de mapping que le letterbox applique a l'entree, inversee).
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = maskCanvas.height = IMGSZ
  const mctx = maskCanvas.getContext('2d')!
  const imgData = mctx.createImageData(IMGSZ, IMGSZ)
  for (let i = 0; i < result.mask640.length; i++) {
    if (result.mask640[i]) {
      imgData.data[i * 4] = 0
      imgData.data[i * 4 + 1] = 255
      imgData.data[i * 4 + 2] = 120
      imgData.data[i * 4 + 3] = 120
    }
  }
  mctx.putImageData(imgData, 0, 0)

  ctx.drawImage(maskCanvas, padX, padY, newW, newH, 0, 0, img.naturalWidth, img.naturalHeight)
}

export default function DiecutTestPage() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<{ found: boolean; conf: number; ms: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const onFile = async (file: File) => {
    setBusy(true)
    setError('')
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

      const result = await detect(ort, img)
      setInfo({ found: result.found, conf: result.conf, ms: result.ms })
      if (canvasRef.current) draw(canvasRef.current, img, result)

      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setBusy(false)
    }
  }

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

      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '100%', borderRadius: 8, background: '#eee', marginTop: 12 }} />
    </div>
  )
}
