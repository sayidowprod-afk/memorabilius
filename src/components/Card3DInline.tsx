'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Version allégée du drag-to-rotate de Viewer3D, pensée pour un rendu EN BLOC
// (pas de portal/popup, pas de wishlist/echange/tags -- juste la carte qui
// tourne) pour la fiche joueur en émission.
// Pas de coins arrondis sur la carte elle-meme (voir memoire projet) --
// contrairement au reste de l'UI, une vraie carte a des bords nets.
export default function Card3DInline({ front, back, isHorizontal, accent }: {
  front: string
  back?: string
  isHorizontal?: boolean
  accent?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const rotX = useRef(0)
  const rotY = useRef(0)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const rafRef = useRef(0)
  const [flipped, setFlipped] = useState(false)

  // Petit balancement automatique tant qu'on ne touche a rien -- sans ca rien
  // n'indique que la carte est manipulable (surtout en mode presentation ou
  // personne ne survole activement). Oscille autour de la rotation courante,
  // meme technique que Viewer3D.
  const idleActive = useRef(false)
  const idleRaf = useRef(0)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyTransform = useCallback(() => {
    if (cardRef.current) cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
  }, [])

  const stopIdleWobble = useCallback(() => {
    idleActive.current = false
    cancelAnimationFrame(idleRaf.current)
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }, [])

  const startIdleWobble = useCallback((delay: number) => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (isDragging.current) return
      idleActive.current = true
      const baseY = rotY.current
      const baseX = rotX.current
      const start = performance.now()
      const loop = (now: number) => {
        if (!idleActive.current || isDragging.current) return
        const t = (now - start) / 1000
        rotY.current = baseY + Math.sin(t * 0.6) * 14
        rotX.current = baseX + Math.sin(t * 0.42) * 6
        applyTransform()
        idleRaf.current = requestAnimationFrame(loop)
      }
      idleRaf.current = requestAnimationFrame(loop)
    }, delay)
  }, [applyTransform])

  useEffect(() => {
    startIdleWobble(1200)
    return stopIdleWobble
  }, [startIdleWobble, stopIdleWobble])

  const reset = useCallback(() => { rotX.current = 0; rotY.current = 0; applyTransform() }, [applyTransform])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
    stopIdleWobble()
  }, [stopIdleWobble])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    lastX.current = e.clientX
    lastY.current = e.clientY
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onPointerUp = useCallback(() => { isDragging.current = false; startIdleWobble(2500) }, [startIdleWobble])

  const boxStyle: React.CSSProperties = isHorizontal
    ? { width: 'min(85vw, 480px)', aspectRatio: '5 / 3.5' }
    : { width: 'min(70vw, 340px)', aspectRatio: '2.5 / 3.5' }

  const faceStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div
        style={{ ...boxStyle, perspective: 1800, cursor: 'grab', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={reset}
      >
        <div
          ref={cardRef}
          style={{
            width: '100%', height: '100%', position: 'relative',
            transformStyle: 'preserve-3d', transition: 'transform 0.1s linear',
            boxShadow: `0 16px 50px rgba(0,0,0,0.35), 0 0 0 2px ${accent || '#0046D1'}55`,
          }}
        >
          {/* Vrai retournement 3D (rotateY 0/180) plutot qu'un simple
              display:none/block -- chaque face porte sa propre orientation,
              donc la face visible depend uniquement de son propre angle et
              jamais d'un etat fragile a synchroniser. */}
          <div style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            transformStyle: 'preserve-3d', transition: 'transform 0.5s',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            <img src={front} alt="" draggable={false} style={faceStyle} />
            {back && <img src={back} alt="" draggable={false} style={{ ...faceStyle, transform: 'rotateY(180deg)' }} />}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {back && (
          <button onClick={() => setFlipped(f => !f)} style={{
            padding: '8px 16px', borderRadius: 20, border: 'none', background: accent || '#0046D1',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            {flipped ? 'Voir le recto' : 'Voir le verso'}
          </button>
        )}
        <button onClick={reset} style={{
          padding: '8px 16px', borderRadius: 20, border: '1px solid #ccc', background: 'transparent',
          color: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Réinitialiser
        </button>
      </div>
    </div>
  )
}
