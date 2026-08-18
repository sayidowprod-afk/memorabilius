'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'

// Niveau affiché à côté du pseudo sur la galerie publique — même source que
// le dashboard perso : le total XP événementiel (xp_events, voir xp.ts),
// public via la fonction SECURITY DEFINER get_user_xp_total.
export default function LevelBadge({ userId }: { userId: string }) {
  const { t } = useLang()
  const [level, setLevel] = useState<LevelInfo | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_user_xp_total', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      setLevel(levelFromXP(data ?? 0))
    })
    return () => { cancelled = true }
  }, [userId])

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
            <span style={{ display: 'block', height: '100%', width: `${Math.round(level.pct * 100)}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 4 }} />
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
