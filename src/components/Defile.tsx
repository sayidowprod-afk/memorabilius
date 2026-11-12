'use client'
// « Défilé » : tes cartes défilent en perspective, la carte du centre de face et les autres inclinées de chaque côté.
// On les fait glisser du doigt (ou avec les flèches). Un appui sur la carte du centre l'ouvre dans le viewer 3D ; un appui sur une carte voisine la ramène au centre.
// Lecture seule : rien n'est modifié. Les bords des cartes restent nets (jamais arrondis).
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DefileCard = {
  f: string; fHd?: string; thumb?: string; n: string; t?: string; y?: string; br?: string; s?: string; v?: string; num?: string; g?: string
  rc?: boolean; auto?: boolean; patch?: boolean; disponible_vente?: boolean; prix_vente?: number | null; quantite?: number
}

const CSS = `
.df-root { position: fixed; inset: 0; z-index: 500000; background: radial-gradient(circle at 50% 36%, #0a1a44 0%, #05070f 72%); color: #fff; display: flex; flex-direction: column; touch-action: none; user-select: none; -webkit-user-select: none; overflow: hidden; }
.df-top { padding: calc(env(safe-area-inset-top, 0px) + 10px) 14px 0; display: flex; align-items: center; gap: 10px; position: relative; z-index: 5; }
.df-bar { flex: 1; height: 4px; background: rgba(255,255,255,.22); } .df-bar i { display: block; height: 100%; background: #fff; }
.df-count { font: 800 12px system-ui, sans-serif; letter-spacing: .06em; opacity: .85; min-width: 62px; text-align: right; }
.df-x { width: 34px; height: 34px; border: 2px solid rgba(255,255,255,.7); background: rgba(0,0,0,.35); color: #fff; font-size: 18px; line-height: 1; cursor: pointer; }
.df-stage { flex: 1; min-height: 0; position: relative; perspective: 900px; perspective-origin: 50% 45%; }
.df-slot { position: absolute; left: 50%; top: 46%; will-change: transform; transition: transform .32s cubic-bezier(.22,.61,.36,1), opacity .32s; }
.df-slot.drag { transition: none; }
.df-img { display: block; height: auto; width: auto; max-height: min(56vh, 540px); max-width: 76vw; background: transparent !important; object-fit: contain; box-shadow: 0 18px 44px rgba(0,0,0,.65); -webkit-user-drag: none; }
.df-cap { text-align: center; padding: 0 14px calc(env(safe-area-inset-bottom, 0px) + 30px); min-height: 118px; position: relative; z-index: 5; }
.df-name { font: 400 clamp(24px, 6vw, 36px)/1 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; letter-spacing: .02em; overflow-wrap: anywhere; }
.df-sub { margin-top: 6px; font: 600 14px/1.35 system-ui, sans-serif; color: rgba(255,255,255,.78); overflow-wrap: anywhere; }
.df-pills { margin-top: 8px; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.df-pill { font: 800 11px system-ui, sans-serif; letter-spacing: .06em; padding: 3px 8px; color: #fff; background: #2f6bff; }
.df-hint { position: absolute; left: 0; right: 0; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px); text-align: center; font: 600 11px system-ui, sans-serif; color: rgba(255,255,255,.45); pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .df-slot { transition: none; } }
`

const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const VISIBLE = 3   // cartes affichées de chaque côté de celle du centre

export default function Defile({ cards, startIndex = 0, onClose, onOpen }: {
  cards: DefileCard[]; startIndex?: number; onClose: () => void; onOpen: (c: DefileCard) => void
}) {
  const n = cards.length
  const [pos, setPos] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, n - 1)))   // position fractionnaire pendant le glissement
  const [dragging, setDragging] = useState(false)
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 400 : window.innerWidth))
  const drag = useRef<{ x: number; startPos: number; moved: boolean; last: { x: number; t: number }; v: number } | null>(null)
  const i = Math.round(pos)
  const step = Math.min(width * 0.4, 200)

  const goTo = useCallback((k: number) => setPos(Math.max(0, Math.min(n - 1, k))), [n])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setPos(p => Math.max(0, Math.min(n - 1, Math.round(p) + 1))) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setPos(p => Math.max(0, Math.min(n - 1, Math.round(p) - 1))) }
    }
    const resize = () => setWidth(window.innerWidth)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', resize)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('resize', resize); document.body.style.overflow = prev }
  }, [n, onClose])

  // précharge les cartes proches (la photo complète pour celle du centre, les miniatures pour les voisines)
  useEffect(() => {
    for (let k = i - VISIBLE - 1; k <= i + VISIBLE + 1; k++) { const c = cards[k]; if (c) { const im = new Image(); im.decoding = 'async'; im.src = k === i ? (c.fHd || c.f) : (c.thumb || c.f) } }
  }, [i, cards])

  const down = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, startPos: pos, moved: false, last: { x: e.clientX, t: performance.now() }, v: 0 }
    setDragging(true)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const dx = e.clientX - d.x
    // la capture du pointeur ne démarre qu'au vrai glissement : un simple appui reste un clic sur la carte touchée
    if (!d.moved && Math.abs(dx) > 6) { d.moved = true; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
    const now = performance.now()
    if (now - d.last.t > 0) d.v = (e.clientX - d.last.x) / (now - d.last.t)   // px par ms
    d.last = { x: e.clientX, t: now }
    let p = d.startPos - dx / step
    if (p < 0) p *= 0.3; else if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.3   // résistance aux extrémités
    setPos(p)
  }
  const up = () => {
    const d = drag.current; drag.current = null; setDragging(false)
    if (!d) return
    if (!d.moved) return   // un simple appui : géré par le clic sur la carte
    // un petit coup de doigt rapide fait avancer d'une carte ; sinon on s'arrête sur la plus proche
    const flick = Math.abs(d.v) > 0.5 ? -Math.sign(d.v) * Math.min(3, Math.round(Math.abs(d.v) * 2)) : 0
    goTo(Math.round(pos) + (Math.round(pos) === Math.round(d.startPos) ? flick : 0))
  }

  const c = cards[i]
  if (!c || typeof document === 'undefined') return null
  const sub = [c.y, c.br, c.s, c.v].filter(Boolean).join(' · ')
  const pills = [c.rc && 'RC', c.auto && 'AUTO', c.patch && 'PATCH', c.num && c.num, c.g && c.g !== 'Raw' && c.g, (c.quantite || 1) > 1 && `×${c.quantite}`].filter(Boolean) as string[]

  const slots: React.ReactNode[] = []
  for (let k = Math.max(0, i - VISIBLE - 1); k <= Math.min(n - 1, i + VISIBLE + 1); k++) {
    const p = k - pos                                    // −3 … +3 : distance au centre
    const a = Math.abs(p)
    const rot = Math.max(-62, Math.min(62, -p * 52))     // les cartes de côté se tournent vers le centre
    const tx = p * step * (a < 1 ? 1 : 1)                // espacement régulier
    const scale = 1 - Math.min(a, 1) * 0.26 - Math.max(0, Math.min(a, 3) - 1) * 0.08   // le centre est le plus grand, les voisines nettement plus petites
    const z = -Math.min(a, 3) * 60
    const op = a > VISIBLE ? 0 : 1 - Math.min(a, 3) * 0.16
    const center = k === i
    slots.push(
      <div key={k} className={`df-slot${dragging ? ' drag' : ''}`} style={{ transform: `translate(-50%, -50%) translateX(${tx}px) translateZ(${z}px) rotateY(${rot}deg) scale(${scale})`, opacity: op, zIndex: 10 - Math.round(a * 2), pointerEvents: a > VISIBLE ? 'none' : 'auto' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="df-img" src={center ? (c.fHd || c.f) : (cards[k].thumb || cards[k].f)} alt={cards[k].n} draggable={false}
          onClick={() => { if (drag.current?.moved) return; if (center) onOpen(cards[k]); else goTo(k) }}
          onError={e => { if (e.currentTarget.src !== cards[k].f) e.currentTarget.src = cards[k].f }} />
      </div>,
    )
  }

  return createPortal(
    <div className="df-root" role="dialog" aria-modal="true" aria-label="Défilé de cartes">
      <style>{CSS}</style>
      <div className="df-top">
        <div className="df-bar" aria-hidden><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
        <span className="df-count">{i + 1} / {n}</span>
        <button type="button" className="df-x" aria-label="Fermer" onPointerDown={e => e.stopPropagation()} onClick={onClose}>✕</button>
      </div>
      <div className="df-stage" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{slots}</div>
      <div className="df-cap">
        <div className="df-name">{c.n}</div>
        {sub && <div className="df-sub">{sub}</div>}
        {(pills.length > 0 || (c.disponible_vente && c.prix_vente != null)) && (
          <div className="df-pills">
            {pills.map(p => <span key={p} className="df-pill">{p}</span>)}
            {c.disponible_vente && c.prix_vente != null && <span className="df-pill" style={{ background: '#1e9e57' }}>À vendre · {eur(Number(c.prix_vente))}</span>}
          </div>
        )}
      </div>
      <div className="df-hint">Fais glisser les cartes · touche celle du centre pour l’ouvrir</div>
    </div>,
    document.body,
  )
}
