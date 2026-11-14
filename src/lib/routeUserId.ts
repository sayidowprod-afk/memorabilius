'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { resolveProfileBySlugParam } from '@/lib/resolveProfileSlug'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Le paramètre d'adresse /galerie/[userId]/… est soit l'identifiant, soit le pseudo lisible (/galerie/alf/ajouter : c'est ce que donne le raccourci
// « Ajouter » de l'accueil de l'app, qui retient l'adresse lisible de la galerie). Comparer ce paramètre à l'identifiant du membre connecté le
// renvoyait à tort vers la page de connexion au moment d'enregistrer une carte : le membre semblait « déconnecté ».

// Version asynchrone pour les gestionnaires (enregistrer, modifier) : renvoie toujours l'identifiant réel (ou le paramètre si introuvable).
export async function resolveRouteUserId(param: string): Promise<string> {
  if (UUID_RE.test(param)) return param
  try {
    const p = await resolveProfileBySlugParam(supabase, param)
    return p?.id || param
  } catch {
    return param
  }
}

// Version pour l'affichage : l'identifiant réel dès qu'il est connu (tout de suite si l'adresse contient déjà l'identifiant).
// Tant que le pseudo n'est pas résolu, on renvoie le paramètre tel quel (les liens de navigation restent valables).
export function useRouteUserId(param: string): { uid: string; resolved: boolean } {
  const [uid, setUid] = useState(param)
  const [resolved, setResolved] = useState(UUID_RE.test(param))
  useEffect(() => {
    if (UUID_RE.test(param)) { setUid(param); setResolved(true); return }
    let off = false
    resolveRouteUserId(param).then(id => { if (!off) { setUid(id); setResolved(true) } })
    return () => { off = true }
  }, [param])
  return { uid, resolved }
}
