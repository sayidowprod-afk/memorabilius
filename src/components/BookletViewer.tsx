'use client'
import { useRef, useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  frontCover: string
  backCover: string
  interiorLeft?: string
  interiorRight?: string
  accent: string
}

export default function BookletViewer({ frontCover, backCover, interiorLeft, interiorRight, accent }: Props) {
  const { dark } = useTheme()
  const [open, setOpen] = useState(false)

  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(1)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)

  const applyTransform = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
    if (wrapRef.current) wrapRef.current.style.transform = `scale(${scale.current})`
  }, [])

  const reset = useCallback(() => {
    rotX.current = 0; rotY.current = 0; scale.current = 1
    applyTransform()
  }, [applyTransform])

  useEffect(() => { reset() }, [open, reset])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); isDragging.current = true
    lastX.current = e.clientX; lastY.current = e.clientY
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    rotY.current += (e.clientX - lastX.current) * 0.4
    rotX.current -= (e.clientY - lastY.current) * 0.4
    lastX.current = e.clientX; lastY.current = e.clientY
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001), 4)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) reset()
      lastTap.current = now
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    }
  }, [reset])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      rotY.current += (e.touches[0].clientX - touch1.current.x) * 0.4
      rotX.current -= (e.touches[0].clientY - touch1.current.y) * 0.4
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      scale.current = Math.min(Math.max(0.5, scale.current * (dist / lastDist.current)), 4)
      lastDist.current = dist
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    }
  }, [applyTransform])

  useEffect(() => {
    const prevent = (e: Event) => { if (isDragging.current) e.preventDefault() }
    document.addEventListener('selectstart', prevent)
    document.addEventListener('mouseup', () => { isDragging.current = false })
    return () => { document.removeEventListener('selectstart', prevent); cancelAnimationFrame(rafRef.current) }
  }, [])

  const shadow = '0 20px 60px rgba(0,0,0,0.35)'
  const zoneBg = dark ? '#111' : '#f8f8f8'

  // Dimensions : fermé = carte portrait, ouvert = double page paysage
  const closedW = 300, closedH = 420
  const openW = 570, openH = 200

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div
        style={{ flex: 1, background: zoneBg, display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2000, cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', position: 'relative' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onDoubleClick={reset} onWheel={onWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => { isDragging.current = false }}
      >
        <div ref={wrapRef} style={{ willChange: 'transform' }}>
          <div ref={cardRef} style={{ willChange: 'transform', transformStyle: 'preserve-3d', position: 'relative', width: open ? openW : closedW, height: open ? openH : closedH }}>

            {open && interiorLeft && interiorRight ? (<>
              {/* Face avant ouverte : pages intérieures */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: shadow, display: 'flex' }}>
                <div style={{ width: '50%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                  <img src={interiorLeft} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Page gauche" />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.22))' }} />
                </div>
                {/* Reliure */}
                <div style={{ width: 8, flexShrink: 0, background: 'linear-gradient(to right, #444, #aaa, #444)' }} />
                <div style={{ width: 'calc(50% - 4px)', height: '100%', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: 'linear-gradient(to left, transparent, rgba(0,0,0,0.12))' }} />
                  <img src={interiorRight} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Page droite" />
                </div>
              </div>
              {/* Face arrière ouverte : couvertures */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: shadow, display: 'flex' }}>
                <div style={{ width: '50%', height: '100%', overflow: 'hidden' }}>
                  <img src={backCover} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Couverture arrière" />
                </div>
                <div style={{ width: 8, flexShrink: 0, background: 'linear-gradient(to right, #444, #aaa, #444)' }} />
                <div style={{ width: 'calc(50% - 4px)', height: '100%', overflow: 'hidden' }}>
                  <img src={frontCover} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Couverture avant" />
                </div>
              </div>
            </>) : (<>
              {/* Face avant fermée : couverture avant */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: shadow, overflow: 'hidden' }}>
                <img src={frontCover} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Couverture avant" />
              </div>
              {/* Face arrière fermée : couverture arrière */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: shadow, overflow: 'hidden' }}>
                <img src={backCover} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Couverture arrière" />
              </div>
            </>)}

          </div>
        </div>

        <p style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          Glisser · Scroll pour zoomer · Double-clic pour reset
        </p>
      </div>

      {interiorLeft && interiorRight && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{ background: open ? accent : (dark ? '#333' : '#f0f0f0'), color: open ? 'white' : (dark ? '#eee' : '#333'), border: 'none', borderRadius: 20, padding: '8px 24px', fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: '0.2s' }}
          >
            {open ? '📕 Fermer' : '📖 Ouvrir'}
          </button>
        </div>
      )}
    </div>
  )
}
