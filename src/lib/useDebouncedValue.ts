import { useEffect, useState } from 'react'

// Retarde la propagation d'une valeur qui change vite (frappe clavier) pour
// eviter de refiltrer/refetch a chaque caractere sur de grandes listes.
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
