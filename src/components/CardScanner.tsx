'use client'
import { useEffect, useRef, useState } from 'react'

type Pt = { x: number; y: number }
type Status = 'loading' | 'detecting' | 'found' | 'notfound'

interface Props {
  src: string
  onResult: (blob: Blob) => void
  onFallback: () => void
  onClose: () => void
}

// OpenCV.js singleton loader
let cvPromise: Promise<any> | null = null
function getCV(): Promise<any> {
  if (cvPromise) return cvPromise
  cvPromise = new Promise((resolve, reject) => {
    if ((window as any).cv?.Mat) { resolve((window as any).cv); return }
    const s = document.createElement('script')
    s.src = 'https://docs.opencv.org/4.8.0/opencv.js'
    s.async = true
    s.onload = () => { const poll = () => (window as any).cv?.Mat ? resolve((window as any).cv) : setTimeout(poll, 100); poll() }
    s.onerror = () => { cvPromise = null; reject(new Error('OpenCV failed')) }
    document.head.appendChild(s)
  })
  return cvPromise
}

// Ordre: TL, TR, BR, BL
function orderCorners(pts: Pt[]): Pt[] {
  const bySum  = [...pts].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  const byDiff = [...pts].sort((a, b) => (a.x - a.y) - (b.x - b.y))
  return [bySum[0], byDiff[byDiff.length - 1], bySum[bySum.length - 1], byDiff[0]]
}

const HANDLE_COLORS = ['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff']
const CORNER_LABELS = ['Haut-gauche', 'Haut-droit', 'Bas-droit', 'Bas-gauche']
const HANDLE_R = 16

export default function CardScanner({ src, onResult, onFallback, onClose }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)
  const scaleRef   = useRef(1)
  const [status, setStatus]   = useState<Status>('loading')
  const [corners, setCorners] = useState<Pt[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)

  // ── Chargement image + détection ───────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.onload = async () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return

      const maxW = Math.min(window.innerWidth - 32, 500)
      const maxH = Math.round(window.innerHeight * 0.58)
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      scaleRef.current = scale
      canvas.width  = Math.round(img.naturalWidth  * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)

      setStatus('detecting')
      try {
        const cv = await getCV()
        runDetection(cv, img, canvas, scale)
      } catch {
        setDefaultCorners(canvas)
        setStatus('notfound')
      }
    }
    img.src = src
  }, [src])

  const setDefaultCorners = (canvas: HTMLCanvasElement) => {
    const p = Math.round(Math.min(canvas.width, canvas.height) * 0.06)
    setCorners([
      { x: p, y: p },
      { x: canvas.width - p, y: p },
      { x: canvas.width - p, y: canvas.height - p },
      { x: p, y: canvas.height - p },
    ])
  }

  const runDetection = async (cv: any, img: HTMLImageElement, canvas: HTMLCanvasElement, scale: number) => {
    // Downscale pour la détection : max 600px → rapide et suffisant pour trouver le contour
    const DET_MAX = 600
    const detScale = Math.min(DET_MAX / img.naturalWidth, DET_MAX / img.naturalHeight, 1)
    const detW = Math.round(img.naturalWidth  * detScale)
    const detH = Math.round(img.naturalHeight * detScale)
    const detCanvas = document.createElement('canvas')
    detCanvas.width = detW; detCanvas.height = detH
    detCanvas.getContext('2d')!.drawImage(img, 0, 0, detW, detH)

    await new Promise(r => setTimeout(r, 0)) // yield UI avant le traitement lourd

    const mat   = cv.imread(detCanvas)
    const gray  = new cv.Mat()
    const blur  = new cv.Mat()
    const edges = new cv.Mat()
    const cnts  = new cv.MatVector()
    const hier  = new cv.Mat()

    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
    cv.Canny(blur, edges, 40, 120)
    const k = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3))
    cv.dilate(edges, edges, k); k.delete()
    cv.findContours(edges, cnts, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    let bestApprox: any = null
    let bestArea  = 0
    const minArea = detW * detH * 0.04

    for (let i = 0; i < cnts.size(); i++) {
      const cnt  = cnts.get(i)
      const area = cv.contourArea(cnt)
      if (area < minArea) continue
      const peri   = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true)
      if (approx.rows === 4 && area > bestArea) {
        bestArea = area
        bestApprox?.delete()
        bestApprox = approx.clone()
      }
      approx.delete()
    }

    mat.delete(); gray.delete(); blur.delete(); edges.delete(); cnts.delete(); hier.delete()

    if (bestApprox) {
      // Remettre à l'échelle du canvas d'affichage
      const toDisplay = scale / detScale
      const pts: Pt[] = []
      for (let i = 0; i < 4; i++) {
        pts.push({
          x: bestApprox.data32S[i * 2]     * toDisplay,
          y: bestApprox.data32S[i * 2 + 1] * toDisplay,
        })
      }
      bestApprox.delete()
      setCorners(orderCorners(pts))
      setStatus('found')
    } else {
      setDefaultCorners(canvas)
      setStatus('notfound')
    }
  }

  // ── Dessin overlay ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || corners.length < 4) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Quadrilatère
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (const c of corners) ctx.lineTo(c.x, c.y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(0,229,255,0.10)'
    ctx.fill()
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Handles
    corners.forEach((c, i) => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, HANDLE_R, 0, Math.PI * 2)
      ctx.fillStyle = HANDLE_COLORS[i]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }, [corners])

  // ── Drag ──────────────────────────────────────────────────────────────
  const canvasPt = (e: React.MouseEvent | React.TouchEvent): Pt => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const sx = canvas.width  / rect.width
    const sy = canvas.height / rect.height
    const src = 'touches' in e ? (e.touches[0] ?? (e as React.TouchEvent).changedTouches[0]) : (e as React.MouseEvent)
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy }
  }

  const nearestCorner = (pos: Pt): number => {
    let best = -1, bd = Infinity
    corners.forEach((c, i) => { const d = Math.hypot(c.x - pos.x, c.y - pos.y); if (d < bd) { bd = d; best = i } })
    return bd < HANDLE_R * 2.5 ? best : -1
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    const idx = nearestCorner(canvasPt(e))
    if (idx >= 0) { e.preventDefault(); setDragging(idx) }
  }

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (dragging === null) return
    e.preventDefault()
    const pos = canvasPt(e)
    const canvas = canvasRef.current!
    setCorners(prev => {
      const next = [...prev]
      next[dragging] = { x: Math.max(0, Math.min(canvas.width, pos.x)), y: Math.max(0, Math.min(canvas.height, pos.y)) }
      return next
    })
  }

  const onUp = () => setDragging(null)

  // ── Appliquer la transformation perspective ────────────────────────────
  const applyWarp = async () => {
    const img = imgRef.current
    if (!img || corners.length < 4 || applying) return
    setApplying(true)
    const s = scaleRef.current

    // Source limitée à 1500px max : évite le crash mémoire sur photos haute-res
    const WARP_MAX = 1500
    const warpScale = Math.min(WARP_MAX / img.naturalWidth, WARP_MAX / img.naturalHeight, 1)
    const warpW = Math.round(img.naturalWidth  * warpScale)
    const warpH = Math.round(img.naturalHeight * warpScale)

    // Coins en coordonnées source warpée
    const nat = corners.map(c => ({ x: c.x / s * warpScale, y: c.y / s * warpScale }))

    try {
      const cv = await getCV()
      await new Promise(r => setTimeout(r, 0)) // yield avant traitement

      const tmp = document.createElement('canvas')
      tmp.width = warpW; tmp.height = warpH
      tmp.getContext('2d')!.drawImage(img, 0, 0, warpW, warpH)

      const srcMat = cv.imread(tmp)
      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        nat[0].x, nat[0].y, nat[1].x, nat[1].y,
        nat[2].x, nat[2].y, nat[3].x, nat[3].y,
      ])
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, 600, 0, 600, 840, 0, 840])

      const M   = cv.getPerspectiveTransform(srcPts, dstPts)
      const dst = new cv.Mat()
      cv.warpPerspective(srcMat, dst, M, new cv.Size(600, 840))

      const out = document.createElement('canvas')
      out.width = 600; out.height = 840
      cv.imshow(out, dst)
      srcMat.delete(); dst.delete(); M.delete(); srcPts.delete(); dstPts.delete()

      out.toBlob(blob => { if (blob) onResult(blob) }, 'image/jpeg', 0.88)
    } catch {
      setApplying(false)
      onFallback()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 24px' }}>

      {/* Statut */}
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>
        {status === 'loading'    && 'Chargement…'}
        {status === 'detecting'  && 'Détection de la carte…'}
        {status === 'found'      && 'Carte détectée — ajustez les coins si besoin'}
        {status === 'notfound'   && 'Non détectée — ajustez les coins manuellement'}
      </p>

      {/* Canvas principal */}
      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', maxHeight: '58vh', borderRadius: 8, touchAction: 'none', cursor: dragging !== null ? 'grabbing' : 'crosshair', display: 'block' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      />

      {/* Légende coins */}
      {corners.length === 4 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {CORNER_LABELS.map((label, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: HANDLE_COLORS[i], display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, width: '100%', maxWidth: 420, boxSizing: 'border-box' }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Annuler
        </button>
        <button onClick={onFallback}
          style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Manuel
        </button>
        <button onClick={applyWarp} disabled={corners.length < 4 || applying}
          style={{ flex: 2, padding: '13px 0', background: applying ? '#888' : 'white', color: '#111', border: 'none', borderRadius: 12, fontWeight: 800, cursor: applying ? 'wait' : 'pointer', fontSize: 14 }}>
          {applying ? 'Traitement…' : 'Utiliser'}
        </button>
      </div>
    </div>
  )
}
