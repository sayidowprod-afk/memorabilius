'use client'
// Ce que collectionne le membre connecté : 'sport' (par défaut), 'tcg' ou 'both' (profiles.collection_focus).
// Lecture tolérante : si la colonne n'existe pas encore en base, on reste sur 'sport' (rien ne change). Gardé sur l'appareil pour éviter un clignotement.
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

export type CollectionFocus = 'sport' | 'tcg' | 'both'
const KEY = (uid: string) => `collection-focus-${uid}`
const EVT = 'collection-focus-changed'
const valid = (v: unknown): v is CollectionFocus => v === 'sport' || v === 'tcg' || v === 'both'

export function rememberCollectionFocus(uid: string, f: CollectionFocus) {
  try { localStorage.setItem(KEY(uid), f); window.dispatchEvent(new Event(EVT)) } catch { /* rien */ }
}

export function useCollectionFocus(): CollectionFocus {
  const { user } = useAuth()
  const uid = user?.id
  const [focus, setFocus] = useState<CollectionFocus>('sport')
  useEffect(() => {
    if (!uid) { setFocus('sport'); return }
    const readLocal = () => { try { const v = localStorage.getItem(KEY(uid)); if (valid(v)) setFocus(v) } catch { /* rien */ } }
    readLocal()
    let dead = false
    supabase.from('profiles').select('collection_focus').eq('id', uid).single().then(({ data, error }) => {
      if (dead || error) return
      const v = (data as { collection_focus?: string } | null)?.collection_focus
      if (valid(v)) { setFocus(v); try { localStorage.setItem(KEY(uid), v) } catch { /* rien */ } }
    })
    window.addEventListener(EVT, readLocal)
    return () => { dead = true; window.removeEventListener(EVT, readLocal) }
  }, [uid])
  return focus
}
