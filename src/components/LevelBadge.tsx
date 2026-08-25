'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'
import { fireConfetti } from '@/components/Confetti'

// Niveau affiché à côté du pseudo sur la galerie publique — même source que
// le dashboard perso : le total XP événementiel (xp_events, voir xp.ts),
// public via la fonction SECURITY DEFINER get_user_xp_total.
export default function LevelBadge({ userId, celebrateOnLevelUp }: { userId: string; celebrateOnLevelUp?: boolean }) {
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

  if (!level) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
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
        display: 'inline-flex', flexDirection: 'column', gap: 4,
        background: 'linear-gradient(135deg, rgba(0,61,166,0.1), rgba(30,99,224,0.04))',
        border: '1px solid rgba(0,61,166,0.2)', borderRadius: 12, padding: '6px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#003DA6', letterSpacing: 0.5, textTransform: 'uppercase' }}>{t('word_level')}</span>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#003DA6', lineHeight: 1 }}>{level.level}</span>
          <button onClick={() => setShowInfo(v => !v)} aria-label={t('levelbadge_info_aria')} style={{
            width: 15, height: 15, borderRadius: '50%', border: '1px solid #003DA6', background: 'none',
            color: '#003DA6', fontSize: 9.5, fontWeight: 800, lineHeight: '13px', padding: 0, cursor: 'pointer',
          }}>?</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 58, height: 7, background: 'rgba(0,61,166,0.15)', borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}>
            <span style={{ display: 'block', height: '100%', width: `${fillPct}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 4, transition: 'width 0.9s cubic-bezier(0.22,0.61,0.36,1)' }} />
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text3, #888)', whiteSpace: 'nowrap' }}>
            {level.xpIntoLevel}/{level.xpForNextLevel} XP
          </span>
        </div>
      </div>

      {showInfo && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50, width: 220,
          background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', padding: 12,
          fontSize: 10.5, color: 'var(--text2, #555)', lineHeight: 1.6,
        }}>
          {t('xp_info_explanation')}
        </div>
      )}
    </div>
  )
}
