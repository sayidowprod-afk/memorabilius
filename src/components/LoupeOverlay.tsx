'use client'
import { useEffect, useRef, useState } from 'react'

// Loupe d'inspection : mode a part (ouvert par un bouton) qui affiche la carte a plat en grand et une lentille ronde x3 qui suit la
// souris ou le doigt -- coins, surface, signature, numerotation. Separee du visualiseur 3D (la ou on fait tourner la carte).
export default function LoupeOverlay({ front, back, onClose }: { front: string; back?: string; onClose: () => void }) {
  const [side, setSide] = useState<'front' | 'back'>('front')
  const [lens, setLens] = useState<{ x: number; y: number; px: number; py: number; w: number; h: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const src = side === 'back' && back ? back : front
  const Z = 3, R = 70

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const track = (e: React.PointerEvent) => {
    const r = imgRef.current?.getBoundingClientRect()
    if (!r) return
    const x = e.clientX - r.left, y = e.clientY - r.top
    if (x < 0 || y < 0 || x > r.width || y > r.height) { setLens(null); return }
    setLens({ x, y, px: x / r.width, py: y / r.height, w: r.width, h: r.height })
  }

  return (
    <div className="loupe-ov" onClick={onClose}>
      <button className="loupe-x" onClick={onClose} aria-label="Fermer">✕</button>
      {back && (
        <button className="loupe-flip" onClick={e => { e.stopPropagation(); setSide(s => (s === 'front' ? 'back' : 'front')) }}>
          {side === 'front' ? 'Voir le verso' : 'Voir le recto'}
        </button>
      )}
      <div className="loupe-stage" onClick={e => e.stopPropagation()} onPointerMove={track} onPointerDown={track} onPointerLeave={() => setLens(null)} onPointerUp={e => { if (e.pointerType === 'touch') setLens(null) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="" draggable={false} />
        {lens && (
          <div className="loupe-lens" style={{
            left: lens.x - R, top: lens.y - R, width: R * 2, height: R * 2,
            backgroundImage: `url(${src})`, backgroundSize: `${lens.w * Z}px ${lens.h * Z}px`,
            backgroundPosition: `${-(lens.px * lens.w * Z - R)}px ${-(lens.py * lens.h * Z - R)}px`,
          }} />
        )}
      </div>
      <div className="loupe-hint">Passe la souris ou le doigt sur la carte</div>
    </div>
  )
}
