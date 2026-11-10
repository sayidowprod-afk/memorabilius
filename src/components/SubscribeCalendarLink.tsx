'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'

// « Tout ajouter » : abonne l'agenda du téléphone au calendrier des sorties de cartes (il se met ensuite à jour tout seul).
// Un lien vers le simple fichier .ics ne propose que de l'enregistrer. Android -> Google Agenda (« ajouter un agenda par adresse ») ;
// iPhone / iPad -> abonnement natif (webcal://) ; ordinateur -> le fichier .ics.
const FEED = 'www.memorabilius.fr/api/sorties/ics'

export default function SubscribeCalendarLink({ className, style, title, children }: { className?: string; style?: React.CSSProperties; title?: string; children: ReactNode }) {
  const [href, setHref] = useState('/api/sorties/ics')
  const [external, setExternal] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    if (Capacitor.getPlatform() === 'android' || /Android/i.test(ua)) {
      setHref(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent('webcal://' + FEED)}`); setExternal(true)
    } else if (ios && !Capacitor.isNativePlatform()) {
      setHref(`webcal://${FEED}`)
    }
  }, [])
  return <a href={href} className={className} style={style} title={title} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>
}
