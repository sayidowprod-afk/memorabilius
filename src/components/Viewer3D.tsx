'use client'
import { useRef, useCallback, useEffect } from 'react'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

const BASE_SCALE = 1.0

export default function Viewer3D({ popup, accent, onClose, getTags }: {
  popup: Card
  accent: string
  onClose: () => void
  getTags: (d: Card) => React.ReactNode
}) {
  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(BASE_SCALE)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const isZoomed = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const applyTransform = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
    }
    if (wrapRef.current) {
      wrapRef.current.style.transform = `scale(${scale.current})`
    }
  }, [])

  const reset = useCallback(() => {
    rotX.current = 0
    rotY.current = 0
    scale.current = BASE_SCALE
    isZoomed.current = false
    applyTransform()
  }, [applyTransform])

  const onDoubleClick = useCallback(() => {
    if (isZoomed.current) {
      scale.current = BASE_SCALE
      isZoomed.current = false
    } else {
      scale.current = BASE_SCALE * 1.8
      isZoomed.current = true
    }
    applyTransform()
  }, [applyTransform])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    lastX.current = e.clientX
    lastY.current = e.clientY
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    rotX.current = Math.max(-30, Math.min(30, rotX.current))
    rotY.current = Math.max(-40, Math.min(40, rotY.current))
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.max(0.5, Math.min(3, scale.current - e.deltaY * 0.001))
    applyTransform()
  }, [applyTransform])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true
      lastX.current = e.touches[0].clientX
      lastY.current = e.touches[0].clientY
      const now = Date.now()
      if (now - lastTap.current < 300) onDoubleClick()
      lastTap.current = now
    }
  }, [onDoubleClick])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastX.current
    const dy = e.touches[0].clientY - lastY.current
    lastX.current = e.touches[0].clientX
    lastY.current = e.touches[0].clientY
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    rotX.current = Math.max(-30, Math.min(30, rotX.current))
    rotY.current = Math.max(-40, Math.min(40, rotY.current))
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  useEffect(() => {
    applyTransform()
    return () => cancelAnimationFrame(rafRef.current)
  }, [applyTransform])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: '#fff', zIndex: 9999999, display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @media (min-width: 600px) {
          .viewer3d-inner { flex-direction: row !important; }
          .viewer3d-zone { flex: 1.2 !important; height: 100% !important; }
          .viewer3d-info { flex: 0.8 !important; height: 100% !important; }
        }
        @media (max-width: 599px) {
          .viewer3d-zone { flex: 0 0 55vh !important; }
          .viewer3d-info { flex: 1 !important; overflow-y: auto !important; }
        }
      `}</style>
      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 12, fontSize: 20, cursor: 'pointer',
        background: 'rgba(255,255,255,0.9)', width: 36, height: 36, borderRadius: '50%',
        border: '1px solid #eee', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10001,
      }}>×</button>

      <div className="viewer3d-inner" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>

        {/* Zone 3D */}
        <div
          className="viewer3d-zone"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#f8f8f8', perspective: 2000,
            cursor: isDragging.current ? 'grabbing' : 'grab',
            userSelect: 'none', WebkitUserSelect: 'none',
            touchAction: 'none', overflow: 'hidden', position: 'relative',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={() => { isDragging.current = false }}
        >
          <div ref={wrapRef} style={{ willChange: 'transform' }}>
            <div ref={cardRef} style={{
              width: 300, height: 420,
              position: 'relative',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}>
              {/* Face avant — image à sa taille naturelle via background-size: cover sur img native */}
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}>
                <img
                  src={popup.f}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'fill',
                    display: 'block',
                  }}
                  alt={popup.n}
                />
              </div>
              {/* Face arrière */}
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
                overflow: 'hidden',
              }}>
                <img
                  src={popup.b || popup.f}
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
                  alt={popup.n}
                />
              </div>
            </div>
          </div>
          <p style={{
            position: 'absolute', bottom: 16,
            left: '50%', transform: 'translateX(-50%)',
            fontSize: 11, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            Glisser · Scroll pour zoomer · Double-clic pour zoom/reset
          </p>
        </div>

        {/* Infos */}
        <div className="viewer3d-info" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'white', overflowY: 'auto' }}>
          <div style={{ color: accent, fontWeight: 900, fontSize: 11, textTransform: 'uppercase' }}>{popup.t}</div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '5px 0' }}>{popup.n}</h2>
          <div style={{ fontSize: '1.1rem', color: accent, fontWeight: 700, marginBottom: 10, fontStyle: 'italic' }}>{popup.v}</div>
          {getTags(popup)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, borderTop: '1px solid #eee', marginTop: 15, paddingTop: 15 }}>
            {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
              <div key={l}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>{l}</label>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
