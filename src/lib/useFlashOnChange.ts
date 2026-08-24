import { useEffect, useRef, useState } from 'react'

// Renvoie true brievement apres que `value` ait change (et seulement apres le
// premier rendu -> pas de flash au chargement initial de la page).
export function useFlashOnChange(value: number, durationMs = 550): boolean {
  const [flashing, setFlashing] = useState(false)
  const prev = useRef(value)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; prev.current = value; return }
    if (value !== prev.current) {
      prev.current = value
      setFlashing(true)
      const id = setTimeout(() => setFlashing(false), durationMs)
      return () => clearTimeout(id)
    }
  }, [value, durationMs])

  return flashing
}
