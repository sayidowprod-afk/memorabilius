'use client'
import { useTheme } from '@/lib/ThemeContext'

// Bloc pulsant reutilisable pour les etats de chargement (remplace les "Chargement..."
// en texte brut par une preview de la mise en page finale, sans changer le comportement).
export default function SkeletonBlock({ style }: { style?: React.CSSProperties }) {
  const { dark } = useTheme()
  return (
    <div style={{ background: dark ? '#333' : '#eee', borderRadius: 6, animation: 'skelPulse 1.4s ease infinite alternate', ...style }}>
      <style>{`@keyframes skelPulse { from{opacity:1} to{opacity:.5} }`}</style>
    </div>
  )
}
