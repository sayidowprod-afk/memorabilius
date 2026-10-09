'use client'
import { useTheme } from '@/lib/ThemeContext'

// Bloc de chargement reutilisable (remplace les "Chargement..." en texte brut par une preview de la mise en page finale).
// Angles droits et reflet qui balaie (DA), au lieu d'un simple clignotement.
export default function SkeletonBlock({ style }: { style?: React.CSSProperties }) {
  const { dark } = useTheme()
  return <div className="skel-block" style={{ background: dark ? '#2a2f45' : '#e7e9f0', borderRadius: 0, ...style }} />
}
