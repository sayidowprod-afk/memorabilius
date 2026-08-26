'use client'
import { useEffect, useState, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'
import { fireConfetti } from '@/components/Confetti'

// Niveau affiché autour de l'avatar sur la galerie publique — même source que
// le dashboard perso : le total XP événementiel (xp_events, voir xp.ts),
// public via la fonction SECURITY DEFINER get_user_xp_total.
// `children` est l'avatar : un anneau de progression l'entoure au lieu d'un
// pavé texte séparé, pour ne montrer qu'un seul élément niveau+XP dans le
// bandeau au lieu de deux (avatar + badge) qui se répétaient visuellement.
export default function LevelBadge({ userId, celebrateOnLevelUp, accent = '#003DA6', avatarClassName, children }: { userId: string; celebrateOnLevelUp?: boolean; accent?: string; avatarClassName?: string; children: ReactNode }) {
  const { t } = useLang()
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [fillPct, setFillPct] = useState(0)
  const [justLeveledUp, setJustLeveledUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_xp_total', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      const info = levelFromXP(data ?? 0)
      setLevel(info)
      // Celebration ponctuelle : uniquement sur son propre profil (celebrateOnLevelUp),
      // comparee au dernier niveau vu localement -- pas de suivi temps reel du XP, donc
      // ca se declenche a la prochaine visite qui suit un gain de niveau, pas en direct.
      if (celebrateOnLevelUp && typeof window !== 'undefined') {
        const key = `mb_last_level_${userId}`
        const prev = Number(localStorage.getItem(key) || 0)
        if (prev > 0 && info.level > prev) {
          setJustLeveledUp(true)
          fireConfetti()
          setTimeout(() => setJustLeveledUp(false), 2600)
        }
        localStorage.setItem(key, String(info.level))
      }
    })
    return () => { cancelled = true }
  }, [userId, celebrateOnLevelUp])

  // Anime le remplissage de 0 -> pct reel au premier affichage, plutot que
  // d'apparaitre deja plein — petit effet "gratifiant" façon barre de jeu.
  useEffect(() => {
    if (!level) return
    setFillPct(0)
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setFillPct(level.pct * 100)))
    return () => cancelAnimationFrame(id)
  }, [level?.level, level?.pct])

  useEffect(() => {
    if (!showInfo) return
    const onOutside = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowInfo(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [showInfo])

  if (!level) return <>{children}</>

  const pct = Math.max(0, Math.min(100, fillPct))

  return (
    <div ref={ref} style={{ position: 'relative', width: 80, height: 80, flexShrink: 0, ['--avatar-accent' as any]: accent }}>
      {justLeveledUp && (
        <div className="selection-check-pop" style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, #ffd700, #f39c12)', color: '#3d2800', fontWeight: 900, fontSize: 11,
          padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(243,156,18,0.5)', zIndex: 51,
        }}>
          ⬆ Niveau supérieur !
        </div>
      )}

      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', padding: 4, boxSizing: 'border-box',
        background: `conic-gradient(${accent} ${pct}%, ${accent}2e ${pct}%)`,
        transition: 'background 0.9s cubic-bezier(0.22,0.61,0.36,1)',
      }}>
        <div className={avatarClassName} style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          {children}
        </div>
      </div>

      <button
        onClick={() => setShowInfo(v => !v)}
        aria-label={t('levelbadge_info_aria')}
        title={`${t('word_level')} ${level.level} · ${level.xpIntoLevel}/${level.xpForNextLevel} XP`}
        style={{
          position: 'absolute', bottom: -2, left: -2, width: 26, height: 26, borderRadius: '50%',
          background: accent, color: 'white', border: '2px solid var(--card-bg, white)', fontSize: 11, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, lineHeight: 1,
        }}
      >
        {level.level}
      </button>

      {showInfo && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 220,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 12,
          fontSize: 10.5, color: 'var(--text2, #555)', lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 800, color: accent, marginBottom: 6 }}>
            {t('word_level')} {level.level} · {level.xpIntoLevel}/{level.xpForNextLevel} XP
          </div>
          {t('xp_info_explanation')}
        </div>
      )}
    </div>
  )
}
