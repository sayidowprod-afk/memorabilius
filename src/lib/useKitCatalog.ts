'use client'
import { useEffect, useState } from 'react'
import type { KitCatalog } from '@/lib/bobbleheadsServer'

// Catalogue des tenues (par sport), chargé une seule fois pour toute la page
type S = 'nba' | 'mlb' | 'nfl'
const cache: Partial<Record<S, KitCatalog | null>> = {}
const pending: Partial<Record<S, Promise<KitCatalog | null>>> = {}
function load(sport: S) {
  if (!pending[sport]) pending[sport] = fetch(sport === 'nba' ? '/api/bobble-kits' : `/api/bobble-kits?sport=${sport}`, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(d => { cache[sport] = d; return d }).catch(() => null)
  return pending[sport]!
}
export function useKitCatalog(sport: S = 'nba'): KitCatalog | null {
  // le catalogue rendu dépend TOUJOURS du sport courant : si le sport change (la figurine arrive après le premier affichage) ou si un autre composant a déjà chargé ce catalogue, on ne garde pas l'ancien (basket) par erreur
  const [, bump] = useState(0)
  useEffect(() => { if (!cache[sport]) load(sport).then(d => { if (d) bump(n => n + 1) }) }, [sport])
  return cache[sport] ?? null
}
