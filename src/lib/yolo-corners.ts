import * as ort from 'onnxruntime-node'
import sharp from 'sharp'
import path from 'path'

const MODEL_PATH = path.join(process.cwd(), 'ml/model/corners.onnx')
const INPUT_SIZE = 640
const CONF_THRESH = 0.1
const NAMES = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

type Corner = { x: number; y: number }
export type CornersResult = {
  topLeft: Corner; topRight: Corner; bottomRight: Corner; bottomLeft: Corner; confidence: number
}

let _session: ort.InferenceSession | null = null
async function getSession() {
  if (!_session) _session = await ort.InferenceSession.create(MODEL_PATH)
  return _session
}

export async function detectCornersYolo(imageBase64: string): Promise<CornersResult | null> {
  const imgBuf = Buffer.from(imageBase64, 'base64')
  const { width: origW, height: origH } = await sharp(imgBuf).metadata()
  if (!origW || !origH) return null

  const scale = Math.min(INPUT_SIZE / origW, INPUT_SIZE / origH)
  const newW = Math.round(origW * scale)
  const newH = Math.round(origH * scale)
  const padLeft = Math.floor((INPUT_SIZE - newW) / 2)
  const padTop  = Math.floor((INPUT_SIZE - newH) / 2)

  const raw = await sharp(imgBuf)
    .resize(newW, newH)
    .extend({
      top: padTop, bottom: INPUT_SIZE - newH - padTop,
      left: padLeft, right: INPUT_SIZE - newW - padLeft,
      background: { r: 114, g: 114, b: 114 },
    })
    .raw()
    .toBuffer()

  // HWC → NCHW + normalize
  const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE)
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++)
      tensor[c * INPUT_SIZE * INPUT_SIZE + i] = raw[i * 3 + c] / 255.0

  const sess = await getSession()
  const input = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE])
  const outputs = await sess.run({ [sess.inputNames[0]]: input })
  const out = outputs[sess.outputNames[0]].data as Float32Array

  // out shape: (1, 17, 8400) — row-major: out[feature * 8400 + anchor]
  // features: 0-3=bbox cx/cy/w/h, 4=conf, 5-16=4 kpts (kx,ky,kvis each)
  const A = 8400
  let bestConf = CONF_THRESH, bestIdx = -1
  for (let a = 0; a < A; a++) {
    const conf = out[4 * A + a]
    if (conf > bestConf) { bestConf = conf; bestIdx = a }
  }
  if (bestIdx === -1) return null

  const corners = {} as Record<typeof NAMES[number], Corner>
  for (let k = 0; k < 4; k++) {
    const kx = out[(5 + k * 3) * A + bestIdx]
    const ky = out[(5 + k * 3 + 1) * A + bestIdx]
    corners[NAMES[k]] = {
      x: Math.round(Math.max(0, Math.min(1, (kx - padLeft) / scale / origW)) * 1e4) / 1e4,
      y: Math.round(Math.max(0, Math.min(1, (ky - padTop)  / scale / origH)) * 1e4) / 1e4,
    }
  }

  return { ...corners, confidence: Math.round(bestConf * 1e4) / 1e4 } as CornersResult
}
