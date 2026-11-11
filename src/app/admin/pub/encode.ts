/* eslint-disable @typescript-eslint/no-explicit-any */
// Outil admin (/admin/pub) : encodeur MP4 image par image (WebCodecs + mp4-muxer). Chaque image est calculée à l'instant exact : fluidité indépendante de la machine.
export type EncodeOpts = {
  canvas: HTMLCanvasElement
  fps: number
  dur: number
  draw: (t: number) => void
  audio?: (ac: BaseAudioContext) => void // programme le son (instants relatifs à ac.currentTime, qui vaut 0 hors-ligne)
  bitrate?: number
  onProgress?: (msg: string, ratio: number) => void
}

export async function encodeMp4(o: EncodeOpts): Promise<{ blob: Blob } | { error: string } | null> {
  const w = window as any
  if (typeof w.VideoEncoder === 'undefined') return null
  const { canvas: c, fps, dur } = o, W = c.width, H = c.height, bitrate = o.bitrate ?? 10_000_000
  let codec = ''
  for (const cf of ['avc1.64002A', 'avc1.4D002A', 'avc1.42002A']) {
    try { const r = await w.VideoEncoder.isConfigSupported({ codec: cf, width: W, height: H, bitrate, framerate: fps }); if (r.supported) { codec = cf; break } } catch { /* suivant */ }
  }
  if (!codec) return null
  let mod: any
  try { mod = await import('mp4-muxer') } catch { return null }
  const SR = 44100
  let audioOk = false
  if (o.audio && typeof w.AudioEncoder !== 'undefined') {
    try { audioOk = !!(await w.AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 })).supported } catch { audioOk = false }
  }
  const target = new mod.ArrayBufferTarget()
  const muxer = new mod.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: fps }, ...(audioOk ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: SR } } : {}), fastStart: 'in-memory' })
  let encErr: unknown = null
  const venc = new w.VideoEncoder({ output: (ch: unknown, meta: unknown) => muxer.addVideoChunk(ch, meta), error: (e: unknown) => { encErr = e } })
  venc.configure({ codec, width: W, height: H, bitrate, framerate: fps })
  if (audioOk && o.audio) {
    o.onProgress?.('Rendu du son…', 0)
    const oc = new OfflineAudioContext(2, Math.ceil(SR * dur), SR)
    o.audio(oc)
    const buf = await oc.startRendering()
    const aenc = new w.AudioEncoder({ output: (ch: unknown, meta: unknown) => muxer.addAudioChunk(ch, meta), error: (e: unknown) => { encErr = e } })
    aenc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 })
    const L = buf.getChannelData(0), R = buf.getChannelData(1)
    for (let off = 0; off < L.length; off += 4096) {
      const n = Math.min(4096, L.length - off), d = new Float32Array(n * 2)
      d.set(L.subarray(off, off + n), 0); d.set(R.subarray(off, off + n), n)
      const ad = new w.AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(off / SR * 1e6), data: d })
      aenc.encode(ad); ad.close()
    }
    await aenc.flush(); aenc.close()
  }
  const total = Math.round(dur * fps)
  for (let i = 0; i < total; i++) {
    o.draw(i / fps)
    const vf = new w.VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) })
    venc.encode(vf, { keyFrame: i % fps === 0 }); vf.close()
    while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 2))
    if (encErr) break
    if (i % 20 === 0) { o.onProgress?.(`Rendu image par image : ${i} / ${total} (${fps} i/s)`, i / total); await new Promise(r => setTimeout(r, 0)) }
  }
  if (!encErr) await venc.flush()
  venc.close()
  if (encErr) return { error: String(encErr) }
  muxer.finalize()
  o.onProgress?.('Vidéo prête', 1)
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }) }
}
