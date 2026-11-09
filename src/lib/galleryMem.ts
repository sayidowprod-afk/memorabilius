// Mémoire des cartes d'une galerie, le temps que l'onglet reste ouvert (aucun stockage, rien n'est écrit sur l'appareil).
// Sert à afficher une galerie déjà visitée tout de suite quand on y revient (depuis une carte, un autre onglet du site…),
// pendant que les données fraîches se rechargent en arrière-plan. Vidée à chaque connexion / déconnexion : une galerie vue
// avec un compte ne doit jamais s'afficher avec un autre (cartes privées).
import { supabase } from '@/lib/supabase'

type Entry<T> = { cards: T[]; at: number }
const MAX_AGE = 30 * 60 * 1000 // au-delà, on repart de zéro
const mem = new Map<string, Entry<unknown>>()
let wired = false

function wire() {
  if (wired || typeof window === 'undefined') return
  wired = true
  supabase.auth.onAuthStateChange(event => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') mem.clear() })
}

export function galleryMemGet<T>(userId: string): T[] | null {
  wire()
  const e = mem.get(userId)
  if (!e || Date.now() - e.at > MAX_AGE) return null
  return e.cards as T[]
}

export function galleryMemSet<T>(userId: string, cards: T[]) {
  wire()
  if (cards.length) mem.set(userId, { cards, at: Date.now() })
}

export function galleryMemClear(userId?: string) {
  if (userId) mem.delete(userId); else mem.clear()
}
