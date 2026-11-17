'use client'
import { useEffect, useState } from 'react'
import type { KitCatalog } from '@/lib/bobbleheadsServer'

// Catalogue des tenues, chargé une seule fois pour toute la page
let cache: KitCatalog | null = null
let pending: Promise<KitCatalog | null> | null = null
function load() {
  if (!pending) pending = fetch('/api/bobble-kits').then(r => (r.ok ? r.json() : null)).then(d => { cache = d; return d }).catch(() => null)
  return pending
}
export function useKitCatalog(): KitCatalog | null {
  const [c, setC] = useState<KitCatalog | null>(cache)
  useEffect(() => { if (!cache) load().then(d => { if (d) setC(d) }) }, [])
  return c
}
