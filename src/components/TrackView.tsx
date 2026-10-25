'use client'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function TrackView() {
  const path = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    if (path === last.current) return
    last.current = path

    // Le pays/la position de l'utilisateur ne change pas d'une navigation a
    // l'autre -- envoyer le token (qui declenche une verification cote
    // serveur via admin.auth.getUser(), un vrai aller-retour reseau vers
    // l'API Auth Supabase) a CHAQUE page vue sollicitait Auth en continu sur
    // tout le trafic connecte du site, correle avec le gros volume
    // d'"Auth warnings" observe sur le dashboard Supabase. Une fois par
    // session navigateur suffit amplement ; page_views (compteur de vues)
    // continue d'etre enregistre a chaque navigation, inchange.
    let sentCountryThisSession = false
    try { sentCountryThisSession = sessionStorage.getItem('country_tracked') === '1' } catch {}

    const send = (token?: string) => {
      fetch('/api/track-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, token }),
      }).catch(() => {})
      if (token) { try { sessionStorage.setItem('country_tracked', '1') } catch {} }
    }

    if (sentCountryThisSession) { send(undefined); return }

    supabase.auth.getSession()
      .then(({ data: { session } }) => send(session?.access_token))
      .catch(() => send(undefined))
  }, [path])

  return null
}
