'use client'
// Barre de saut rapide au bord de l'écran (lettres ou années) : appui ou glissé pour sauter à cet endroit de la collection.
import { useRef, useState } from 'react'

export type JumpKey = { key: string; idx: number }

export default function JumpBar({ keys, onJump }: { keys: JumpKey[]; onJump: (idx: number) => void }) {
  const [active, setActive] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<string | null>(null)
  // trop de repères (ex. 40 années) : on en garde ~24 répartis, la barre doit tenir à l'écran
  const shown = keys.length > 26 ? keys.filter((_, i) => i % Math.ceil(keys.length / 24) === 0 || i === keys.length - 1) : keys

  const pick = (clientY: number) => {
    const bar = barRef.current
    if (!bar || !shown.length) return
    const r = bar.getBoundingClientRect()
    const i = Math.min(shown.length - 1, Math.max(0, Math.floor(((clientY - r.top) / r.height) * shown.length)))
    const k = shown[i]
    setActive(k.key)
    if (lastRef.current !== k.key) { lastRef.current = k.key; onJump(k.idx) }
  }

  return (
    <>
      {active && <div className="da-jump-bubble" aria-hidden="true">{active}</div>}
      <div
        ref={barRef} className="da-jump" role="group" aria-label="Saut rapide dans la collection"
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pick(e.clientY) }}
        onPointerMove={e => { if (e.buttons || e.pointerType === 'touch') pick(e.clientY) }}
        onPointerUp={() => { setActive(null); lastRef.current = null }}
        onPointerCancel={() => { setActive(null); lastRef.current = null }}
      >
        {shown.map(k => <span key={k.key} className={k.key === active ? 'on' : ''}>{k.key}</span>)}
      </div>
    </>
  )
}
