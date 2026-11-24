'use client'
import { useEffect, useState } from 'react'
import type { KitCatalog } from '@/lib/bobbleheadsServer'

// Catalogue des tenues (par sport), chargé une seule fois pour toute la page
type S = 'nba' | 'mlb'
const cache: Partial<Record<S, KitCatalog | null>> = {}
const pending: Partial<Record<S, Promise<KitCatalog | null>>> = {}
function load(sport: S) {
  if (!pending[sport]) pending[sport] = fetch(sport === 'mlb' ? '/api/bobble-kits?sport=mlb' : '/api/bobble-kits').then(r => (r.ok ? r.json() : null)).then(d => { cache[sport] = d; return d }).catch(() => null)
  return pending[sport]!
}
export function useKitCatalog(sport: S = 'nba'): KitCatalog | null {
  const [c, setC] = useState<KitCatalog | null>(cache[sport] ?? null)
  useEffect(() => { if (!cache[sport]) load(sport).then(d => { if (d) setC(d) }) }, [sport])
  return c
}
