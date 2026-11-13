import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Qui est connecté, SANS prendre un réseau instable pour une déconnexion.
// Avant : les pages d'ajout et de modification appelaient auth.getUser() (un aller-retour réseau) et renvoyaient vers /connexion dès que
// l'utilisateur était null. Or getUser() renvoie aussi null quand le réseau échoue (4G faible, longue veille, upload en cours) : un membre
// pourtant connecté était renvoyé à la page de connexion en plein ajout de carte.
// Ici : on lit d'abord la session enregistrée sur l'appareil (aucun réseau), puis on interroge le serveur seulement si elle manque ;
// si le serveur est injoignable, on le dit (`unreachable`) au lieu de conclure « déconnecté ».
export async function checkUser(): Promise<{ user: User | null; unreachable: boolean }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) return { user: session.user, unreachable: false }
  } catch { /* on retente avec le serveur */ }
  try {
    const { data, error } = await supabase.auth.getUser()
    if (data?.user) return { user: data.user, unreachable: false }
    const network = !!error && (error.name === 'AuthRetryableFetchError' || (error as { status?: number }).status === 0)
    return { user: null, unreachable: network || (typeof navigator !== 'undefined' && !navigator.onLine) }
  } catch {
    return { user: null, unreachable: true }
  }
}
