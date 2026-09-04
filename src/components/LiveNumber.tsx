'use client'
import { useEffect, useRef, useState } from 'react'

// Anime la transition entre deux valeurs (façon compteur "live" type
// livecounts.io) au lieu de faire sauter le chiffre instantanément à
// chaque poll -- easing out sur ~900ms, avec un léger overshoot si la
// valeur monte pour accentuer la sensation de mouvement.
function easeOutBack(t: number) {
  const c1 = 1.15
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export default function LiveNumber({ value, locale }: { value: number; locale: string }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; fromRef.current = value; setDisplay(value); return }
    if (value === fromRef.current) return
    const from = fromRef.current
    const to = value
    const start = performance.now()
    const DURATION = 900
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION)
      const eased = easeOutBack(t)
      setDisplay(Math.round(from + (to - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else { fromRef.current = to; setDisplay(to) }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value])

  return <>{display.toLocaleString(locale)}</>
}
