'use client'
// Ajustement manuel des 4 coins d'une carte découpée dans une grande photo. Les coins sont en fractions (0..1) de la photo entière.
import { useEffect, useRef, useState } from 'react'
import type { Pt, Quad } from '@/lib/perspectiveCrop'

const KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const
const clamp = (v: number) => Math.min(1, Math.max(0, v))

export default function CornerEditor({ full, quad, label, onSave, onCancel }: { full: HTMLCanvasElement; quad: Quad; label: string; onSave: (q: Quad) => void; onCancel: () => void }) {
  const [q, setQ] = useState<Quad>(quad)
  const canvas = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<(typeof KEYS)[number] | null>(null)

  // zone affichée : la carte + 35 % de marge, fixée à l'ouverture pour que les points ne « glissent » pas pendant le réglage
  const region = useRef((() => {
    const xs = KEYS.map(k => quad[k].x), ys = KEYS.map(k => quad[k].y)
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
    const x0 = clamp(Math.min(...xs) - w * 0.35), y0 = clamp(Math.min(...ys) - h * 0.35), x1 = clamp(Math.max(...xs) + w * 0.35), y1 = clamp(Math.max(...ys) + h * 0.35)
    return { x0, y0, w: x1 - x0, h: y1 - y0 }
  })()).current

  useEffect(() => {
    const cv = canvas.current; if (!cv) return
    const sx = region.x0 * full.width, sy = region.y0 * full.height, sw = region.w * full.width, sh = region.h * full.height
    const k = Math.min(1, 900 / Math.max(sw, sh)); cv.width = Math.round(sw * k); cv.height = Math.round(sh * k)
    cv.getContext('2d')!.drawImage(full, sx, sy, sw, sh, 0, 0, cv.width, cv.height)
  }, [full, region])

  const pos = (p: Pt) => ({ x: ((p.x - region.x0) / region.w) * 100, y: ((p.y - region.y0) / region.h) * 100 })
  const move = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return
    const r = box.current.getBoundingClientRect()
    const x = clamp(region.x0 + ((e.clientX - r.left) / r.width) * region.w), y = clamp(region.y0 + ((e.clientY - r.top) / r.height) * region.h)
    setQ(prev => ({ ...prev, [drag.current as string]: { x, y } }))
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Ajuster les coins : ${label}`} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(5,8,25,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 14, gap: 12 }}>
      <div style={{ color: '#fff', fontWeight: 800 }}>{label}</div>
      <div style={{ color: '#b9c3e8', fontSize: 13, textAlign: 'center' }}>Glisse les 4 points jaunes exactement sur les coins de la carte.</div>
      <div ref={box} onPointerMove={move} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
        style={{ position: 'relative', lineHeight: 0, touchAction: 'none', userSelect: 'none', maxWidth: 'min(560px, 100%)', maxHeight: '70vh', aspectRatio: `${region.w * full.width} / ${region.h * full.height}`, height: '70vh' }}>
        <canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <polygon points={KEYS.map(k => { const p = pos(q[k]); return `${p.x},${p.y}` }).join(' ')} fill="rgba(255,216,77,.08)" stroke="#ffd84d" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {KEYS.map(k => { const p = pos(q[k]); return (
          <div key={k} role="slider" aria-label={`Coin ${k}`} onPointerDown={e => { drag.current = k; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
            style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: 30, height: 30, marginLeft: -15, marginTop: -15, borderRadius: '50%', background: 'rgba(255,216,77,.85)', border: '3px solid #0a1030', cursor: 'grab', touchAction: 'none' }} />
        ) })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="btn-main btn-primary" onClick={() => onSave(q)}>Enregistrer</button>
        <button type="button" className="da-confirm-btn" onClick={() => setQ(quad)}>Réinitialiser</button>
        <button type="button" className="da-confirm-btn" onClick={onCancel}>Annuler</button>
      </div>
    </div>
  )
}
