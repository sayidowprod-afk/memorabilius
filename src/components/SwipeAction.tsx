'use client'
import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { hapticTap } from '@/lib/haptics'

// 252 · Balayage d'une ligne au doigt.
//  - direction="right" : glisser vers la droite déclenche l'action au relâchement (ex. répondre à un message).
//  - direction="left" avec `reveal` : glisser vers la gauche découvre un bouton (ex. Masquer) qu'on touche pour confirmer ;
//    toucher la ligne ou glisser en sens inverse la referme.
// Les gestes ne démarrent pas au bord de l'écran (réservé au retour arrière du système) et laissent le défilement vertical tranquille.
export default function SwipeAction({ direction, threshold = 64, onTrigger, reveal, icon, style, className, children }: {
  direction: 'left' | 'right'; threshold?: number; onTrigger?: () => void
  reveal?: { label: string; onClick: () => void; color?: string }
  icon?: ReactNode; style?: CSSProperties; className?: string; children: ReactNode
}) {
  const [dx, setDx] = useState(0)
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)
  const REVEAL_W = 92
  const sign = direction === 'right' ? 1 : -1

  const onStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    if (t.clientX < 24 || t.clientX > window.innerWidth - 24) { start.current = null; return }
    start.current = { x: t.clientX, y: t.clientY, locked: null }
  }
  const onMove = (e: React.TouchEvent) => {
    const s = start.current; if (!s) return
    const t = e.touches[0]
    const mx = t.clientX - s.x, my = t.clientY - s.y
    if (s.locked === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      s.locked = Math.abs(mx) > Math.abs(my) * 1.4 // geste horizontal : on le garde ; sinon c'est un défilement
    }
    if (!s.locked) return
    setDrag(true)
    const base = open ? -REVEAL_W : 0
    let v = base + mx
    if (direction === 'right') v = Math.max(0, Math.min(v * 0.6, threshold + 24))
    else v = Math.max(-REVEAL_W - 16, Math.min(0, v))
    setDx(v)
  }
  const onEnd = () => {
    const s = start.current; start.current = null
    if (!s?.locked) { setDrag(false); return }
    setDrag(false)
    if (direction === 'right') {
      if (dx >= threshold * 0.6) { hapticTap(); onTrigger?.() }
      setDx(0)
    } else if (reveal) {
      const o = dx < -REVEAL_W / 2
      setOpen(o); setDx(o ? -REVEAL_W : 0)
    } else setDx(0)
  }
  const swallowIfOpen = (e: React.MouseEvent) => { if (open) { e.stopPropagation(); e.preventDefault(); setOpen(false); setDx(0) } }

  const progress = direction === 'right' ? Math.min(1, dx / (threshold * 0.6)) : 0
  return (
    <div className={className} style={{ position: 'relative', overflow: reveal || dx ? 'hidden' : undefined, touchAction: 'pan-y', ...style }}
      onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      {direction === 'right' && dx > 0 && icon && (
        <span aria-hidden="true" style={{ position: 'absolute', left: 8, top: '50%', transform: `translateY(-50%) scale(${0.6 + progress * 0.4})`, opacity: progress, fontSize: 18, pointerEvents: 'none' }}>{icon}</span>
      )}
      {reveal && (
        <button type="button" onClick={() => { setOpen(false); setDx(0); reveal.onClick() }} tabIndex={open ? 0 : -1} aria-hidden={!open}
          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL_W, background: reveal.color || '#b42318', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{reveal.label}</button>
      )}
      <div onClickCapture={swallowIfOpen} style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: drag ? 'none' : 'transform .2s ease', display: 'flex', justifyContent: (style && style.justifyContent) as CSSProperties['justifyContent'], width: '100%', background: reveal ? 'inherit' : undefined }}>{children}</div>
    </div>
  )
}
