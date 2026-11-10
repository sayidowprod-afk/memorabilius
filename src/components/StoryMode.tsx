'use client'
// Mode « story » : tes cartes une par une en plein écran, qu'on fait défiler d'un geste vers le haut ou le bas (comme des stories).
// Un appui sur la carte l'ouvre dans le viewer 3D. Flèches du clavier et Échap aussi. Lecture seule : rien n'est modifié.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type StoryCard = {
  f: string; fHd?: string; n: string; t?: string; y?: string; br?: string; s?: string; v?: string; num?: string; g?: string
  rc?: boolean; auto?: boolean; patch?: boolean; disponible_vente?: boolean; prix_vente?: number | null; quantite?: number
}

const CSS = `
.sm-root { position: fixed; inset: 0; z-index: 500000; background: radial-gradient(circle at 50% 30%, #0a1a44 0%, #05070f 70%); color: #fff; display: flex; flex-direction: column; touch-action: none; user-select: none; overflow: hidden; }
.sm-top { padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 0; display: flex; align-items: center; gap: 10px; }
.sm-bar { flex: 1; height: 4px; background: rgba(255,255,255,.22); } .sm-bar i { display: block; height: 100%; background: #fff; transition: width .25s; }
.sm-count { font: 800 12px system-ui, sans-serif; letter-spacing: .06em; opacity: .85; min-width: 62px; text-align: right; }
.sm-x { width: 34px; height: 34px; border: 2px solid rgba(255,255,255,.7); background: rgba(0,0,0,.35); color: #fff; font-size: 18px; line-height: 1; cursor: pointer; }
.sm-stage { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 8px 18px 0; will-change: transform; }
.sm-card { max-width: min(82vw, 420px); max-height: 62vh; width: auto; height: auto; object-fit: contain; box-shadow: 0 18px 50px rgba(0,0,0,.65); cursor: pointer; -webkit-user-drag: none; }
.sm-cap { width: min(92vw, 520px); text-align: center; padding: 0 4px calc(env(safe-area-inset-bottom, 0px) + 26px); }
.sm-name { font: 400 clamp(26px, 6vw, 38px)/1 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; letter-spacing: .02em; overflow-wrap: anywhere; }
.sm-sub { margin-top: 6px; font: 600 14px/1.35 system-ui, sans-serif; color: rgba(255,255,255,.78); overflow-wrap: anywhere; }
.sm-pills { margin-top: 8px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.sm-pill { font: 800 11px system-ui, sans-serif; letter-spacing: .06em; padding: 3px 8px; color: #fff; background: #2f6bff; }
.sm-hint { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px); text-align: center; font: 600 11px system-ui, sans-serif; color: rgba(255,255,255,.45); pointer-events: none; }
@keyframes sm-up { from { transform: translateY(46px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes sm-down { from { transform: translateY(-46px); opacity: 0 } to { transform: none; opacity: 1 } }
.sm-in-up { animation: sm-up .26s ease-out; } .sm-in-down { animation: sm-down .26s ease-out; }
@media (prefers-reduced-motion: reduce) { .sm-in-up, .sm-in-down { animation: none; } .sm-bar i { transition: none; } }
`

const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

export default function StoryMode({ cards, startIndex = 0, onClose, onOpen }: {
  cards: StoryCard[]; startIndex?: number; onClose: () => void; onOpen: (c: StoryCard) => void
}) {
  const [i, setI] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, cards.length - 1)))
  const [dy, setDy] = useState(0)
  const dir = useRef<'up' | 'down'>('up')
  const drag = useRef<{ y: number; moved: boolean } | null>(null)
  const n = cards.length

  const go = useCallback((d: 1 | -1) => {
    setI(cur => {
      const next = cur + d
      if (next < 0 || next >= n) return cur
      dir.current = d === 1 ? 'up' : 'down'
      return next
    })
  }, [n])

  // clavier + page figée derrière
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1) }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', key)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev }
  }, [go, onClose])

  // précharge les deux cartes suivantes et la précédente
  useEffect(() => {
    for (const k of [i + 1, i + 2, i - 1]) { const c = cards[k]; if (c) { const im = new Image(); im.decoding = 'async'; im.src = c.fHd || c.f } }
  }, [i, cards])

  const down = (e: React.PointerEvent) => { drag.current = { y: e.clientY, moved: false }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return
    const d = e.clientY - drag.current.y
    if (Math.abs(d) > 8) drag.current.moved = true
    // résistance : la carte suit le doigt, mais de moins en moins ; rien au-delà de la première / dernière
    const blocked = (d > 0 && i === 0) || (d < 0 && i === n - 1)
    setDy(blocked ? d * 0.15 : d * 0.5)
  }
  const up = () => {
    const d = dy
    const moved = drag.current?.moved
    drag.current = null; setDy(0)
    if (!moved) return
    if (d < -40) go(1); else if (d > 40) go(-1)
  }

  const c = cards[i]
  if (!c || typeof document === 'undefined') return null
  const sub = [c.y, c.br, c.s, c.v].filter(Boolean).join(' · ')
  const pills = [c.rc && 'RC', c.auto && 'AUTO', c.patch && 'PATCH', c.num && c.num, c.g && c.g !== 'Raw' && c.g, (c.quantite || 1) > 1 && `×${c.quantite}`].filter(Boolean) as string[]

  return createPortal(
    <div className="sm-root" role="dialog" aria-modal="true" aria-label="Mode story"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <style>{CSS}</style>
      <div className="sm-top">
        <div className="sm-bar" aria-hidden><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
        <span className="sm-count">{i + 1} / {n}</span>
        <button type="button" className="sm-x" aria-label="Fermer" onPointerDown={e => e.stopPropagation()} onClick={onClose}>✕</button>
      </div>
      <div key={i} className={`sm-stage ${dir.current === 'up' ? 'sm-in-up' : 'sm-in-down'}`} style={{ transform: dy ? `translateY(${dy}px)` : undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="sm-card" src={c.fHd || c.f} alt={c.n} draggable={false} onClick={() => onOpen(c)} onError={e => { if (e.currentTarget.src !== c.f) e.currentTarget.src = c.f }} />
        <div className="sm-cap">
          <div className="sm-name">{c.n}</div>
          {sub && <div className="sm-sub">{sub}</div>}
          {(pills.length > 0 || (c.disponible_vente && c.prix_vente != null)) && (
            <div className="sm-pills">
              {pills.map(p => <span key={p} className="sm-pill">{p}</span>)}
              {c.disponible_vente && c.prix_vente != null && <span className="sm-pill" style={{ background: '#1e9e57' }}>À vendre · {eur(Number(c.prix_vente))}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="sm-hint">Glisse vers le haut ou le bas · touche la carte pour l’ouvrir</div>
    </div>,
    document.body,
  )
}
