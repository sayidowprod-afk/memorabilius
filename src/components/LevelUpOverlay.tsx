'use client'
import { useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

const LABEL: Record<string, string> = { fr: 'Niveau supérieur', en: 'Level up', de: 'Level-Up', es: 'Nivel superior', it: 'Livello superiore' }
const HINT: Record<string, string> = { fr: 'Touche pour continuer', en: 'Tap to continue', de: 'Tippen zum Fortfahren', es: 'Toca para continuar', it: 'Tocca per continuare' }

// Ecran de montee de niveau : plein ecran (position fixe, porte sur document.body par l'appelant), donc jamais coupe par le
// bandeau du profil. Rayons qui tournent, numero geant, carres qui jaillissent ; se ferme seul apres 4 s ou au toucher.
export default function LevelUpOverlay({ level, onClose }: { level: number; onClose: () => void }) {
  const { lang } = useLang()
  useEffect(() => {
    const id = setTimeout(onClose, 4200)
    return () => clearTimeout(id)
  }, [onClose])
  const squares = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2
    const d = 160 + (i % 5) * 70
    return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, rr: (i % 2 ? 1 : -1) * (180 + i * 20), c: ['#fff', '#2f6bff', '#e9b44c'][i % 3], delay: (i % 6) * 0.05 }
  })
  return (
    <div className="lvlup" onClick={onClose} role="dialog" aria-label={LABEL[lang] || LABEL.en}>
      {squares.map((s, i) => (
        <i key={i} className="sq" style={{ background: s.c, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, ['--rr' as string]: `${s.rr}deg`, animationDelay: `${0.25 + s.delay}s` }} />
      ))}
      <div className="k">{LABEL[lang] || LABEL.en}</div>
      <div className="n da-display">{level}</div>
      <div className="xp"><i style={{ width: '8%' }} /></div>
      <div className="hint">{HINT[lang] || HINT.en}</div>
    </div>
  )
}
