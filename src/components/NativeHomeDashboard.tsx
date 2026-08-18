'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { hapticTap } from '@/lib/haptics'
import { BADGE_CATEGORIES, type BadgeCategory, type BadgeTier } from '@/lib/badgeDefinitions'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'
import { currentChallenge, startOfWeekISO, type ChallengeTemplate } from '@/lib/weeklyChallenge'

// TODO: version de test — copie encore en dur (FR) plutôt que via t('...').
// LangContext.tsx est modifié en parallèle par un autre passage sur les
// traductions ; câblage i18n propre une fois ce passage terminé.
interface SiteStats { total: number; totalCartes: number; totalBinders: number; totalTrade: number }

interface DashboardData {
  displayName: string
  avatarUrl: string | null
  totalCards: number
  lastCard: { image: string; name: string } | null
  nextBadge: { cat: BadgeCategory; tier: BadgeTier; value: number; pct: number } | null
  rc: number; patch: number; auto: number; num: number
  level: LevelInfo
  streak: number
  challenge: ChallengeTemplate
  challengeProgress: number
}

const ChevronIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
)

// Sur toutes les catégories de badges, celle où l'utilisateur est le plus
// proche de débloquer le palier suivant (pas forcément la plus avancée en
// valeur absolue) — c'est ce qui donne le meilleur accroche "encore un peu".
function findNextBadge(stat: Record<string, number>): DashboardData['nextBadge'] {
  let best: DashboardData['nextBadge'] = null
  for (const cat of BADGE_CATEGORIES) {
    const value = stat[cat.id] ?? 0
    const tierIdx = cat.tiers.findIndex(t => value < t.threshold)
    if (tierIdx === -1) continue
    const tier = cat.tiers[tierIdx]
    const prevThreshold = tierIdx > 0 ? cat.tiers[tierIdx - 1].threshold : 0
    const pct = (value - prevThreshold) / (tier.threshold - prevThreshold)
    if (!best || pct > best.pct) best = { cat, tier, value, pct }
  }
  return best
}

export default function NativeHomeDashboard({ siteStats }: { siteStats: SiteStats }) {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const challenge = currentChallenge()
      const [{ data: profile }, { data: lastCards }, { data: badgeRows }, { count: autoCount }, { data: streakRows }, { data: weekCards }, { data: xpTotal }] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url, stats_total').eq('id', user.id).single(),
        supabase.from('cartes_manuelles').select('image_recto, nom').eq('user_id', user.id).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(1),
        supabase.rpc('get_user_badge_data', { p_user_id: user.id }),
        supabase.from('cartes_manuelles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('auto', true),
        supabase.rpc('bump_streak', { p_user_id: user.id }),
        supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', user.id).gte('created_at', startOfWeekISO()),
        supabase.rpc('get_user_xp_total', { p_user_id: user.id }),
      ])
      if (cancelled) return

      const b = badgeRows?.[0]
      const nextBadge = b ? findNextBadge({
        cartes: b.stat_total, rc: b.stat_rc, patch: b.stat_patch, num: b.stat_num,
        mois: b.mois_count, views: Number(b.views_count), teams: b.teams_count,
      }) : null

      const level = levelFromXP(xpTotal ?? 0)

      const challengeProgress = (weekCards || []).filter(c => challenge.match({ rc: c.rc, auto: c.auto, patch: c.patch, num: c.num })).length

      setData({
        displayName: profile?.display_name || 'collectionneur',
        avatarUrl: profile?.avatar_url || null,
        totalCards: profile?.stats_total || 0,
        lastCard: lastCards?.[0] ? { image: lastCards[0].image_recto, name: lastCards[0].nom || '' } : null,
        nextBadge,
        rc: b?.stat_rc ?? 0, patch: b?.stat_patch ?? 0, num: b?.stat_num ?? 0, auto: autoCount ?? 0,
        level,
        streak: streakRows?.[0]?.current_streak ?? 0,
        challenge,
        challengeProgress,
      })
    })()
    return () => { cancelled = true }
  }, [user])

  if (!data) {
    return <div style={{ background: 'var(--bg, #f8f9fa)', minHeight: 420 }} />
  }

  const galleryStats = [
    { label: 'RC', val: data.rc, color: '#e67e22' },
    { label: 'AUTO', val: data.auto, color: '#2e7d32' },
    { label: 'PATCH', val: data.patch, color: '#1976d2' },
    { label: 'NUM', val: data.num, color: '#7b1fa2' },
  ]

  const siteStatsList = [
    { label: 'Collectionneurs', val: siteStats.total },
    { label: 'Cartes', val: siteStats.totalCartes },
    { label: 'Classeurs', val: siteStats.totalBinders },
    { label: 'Échanges', val: siteStats.totalTrade },
  ]

  const challengeDone = data.challengeProgress >= data.challenge.target

  return (
    <div style={{ background: 'var(--bg, #f8f9fa)', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 18px 18px' }}>
        {data.avatarUrl
          ? <img src={data.avatarUrl} alt="" style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          : <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#003DA6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 17, flexShrink: 0 }}>{data.displayName[0]?.toUpperCase()}</div>
        }
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text2, #777)', fontWeight: 600 }}>Content de te revoir</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text, #121212)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.displayName}</div>
        </div>
        {data.streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(230,126,34,0.12)', borderRadius: 20, padding: '5px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#e67e22', whiteSpace: 'nowrap' }}>
              {data.streak} jour{data.streak > 1 ? 's' : ''} de suite
            </span>
          </div>
        )}
      </div>

      <Link href={`/galerie/${user?.id}`} onClick={hapticTap} style={{
        display: 'flex', alignItems: 'stretch', margin: '0 16px 14px',
        background: 'linear-gradient(120deg, #0B1E4D 0%, #12318f 60%, #1E63E0 130%)',
        borderRadius: 20, overflow: 'hidden', textDecoration: 'none', color: '#fff',
        boxShadow: '0 10px 24px -8px rgba(11,30,77,0.55)',
      }}>
        <div style={{ flex: 1, padding: '18px 6px 18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: '#80B4FF', textTransform: 'uppercase' }}>Ma galerie</div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, marginTop: 4 }}>{data.totalCards}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cddcff', marginTop: -2 }}>carte{data.totalCards === 1 ? '' : 's'}</div>
          {data.lastCard?.name && (
            <div style={{ fontSize: 11.5, color: '#9fbdf5', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              Dernier ajout <strong style={{ color: '#fff', fontWeight: 700 }}>{data.lastCard.name}</strong>
            </div>
          )}
        </div>
        <div style={{ position: 'relative', width: 108, flexShrink: 0 }}>
          {data.lastCard ? (
            <>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, #12318f, transparent 40%), url(${data.lastCard.image}) center/cover`, transform: 'scale(1.15)', opacity: 0.5, filter: 'blur(1px)' }} />
              <img src={data.lastCard.image} alt="" style={{
                position: 'absolute', bottom: 14, right: 16, width: 66, height: 92, borderRadius: 9, objectFit: 'cover',
                boxShadow: '0 10px 22px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.25)', transform: 'rotate(4deg)',
              }} />
            </>
          ) : (
            <div style={{ position: 'absolute', bottom: 14, right: 16, width: 66, height: 92, borderRadius: 9, background: 'rgba(255,255,255,0.1)', border: '1px dashed rgba(255,255,255,0.3)' }} />
          )}
          <div style={{ position: 'absolute', top: 14, right: 14, color: 'rgba(255,255,255,0.85)' }}><ChevronIcon /></div>
        </div>
      </Link>

      <div style={{
        margin: '0 16px 10px', padding: '14px 16px',
        background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 17, fontWeight: 900, flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1E63E0, #003DA6)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{data.level.level}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #121212)' }}>
              Niveau {data.level.level}
            </div>
            <div style={{ height: 6, background: 'var(--bg3, #eee)', borderRadius: 3, overflow: 'hidden', marginTop: 7 }}>
              <div style={{ height: '100%', width: `${Math.round(data.level.pct * 100)}%`, background: 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3, #999)', marginTop: 4 }}>
              {data.level.xpIntoLevel} / {data.level.xpForNextLevel} XP vers le niveau {data.level.level + 1}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3, #999)', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border, #eee)', lineHeight: 1.6 }}>
          XP gagné : <strong style={{ color: 'var(--text2, #777)' }}>+1 à +19</strong> par carte selon sa rareté (RC/auto/patch/num) · <strong style={{ color: 'var(--text2, #777)' }}>+15</strong> par badge débloqué · <strong style={{ color: 'var(--text2, #777)' }}>+20</strong> par team rejointe · <strong style={{ color: 'var(--text2, #777)' }}>+10</strong> par échange conclu · bonus de streak et de likes reçus
        </div>
      </div>

      {data.nextBadge && (
        <Link href={`/galerie/${user?.id}?tab=badges`} onClick={hapticTap} style={{
          display: 'flex', alignItems: 'center', gap: 12, margin: '0 16px 10px', padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(240,204,112,0.14), rgba(160,112,24,0.06))',
          border: '1px solid rgba(200,148,40,0.3)', borderRadius: 18, textDecoration: 'none',
        }}>
          <span style={{
            fontSize: 22, flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #f0cc70, #a07018 75%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(160,112,24,0.35)',
          }}>{data.nextBadge.cat.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #121212)' }}>
              Prochain badge : <span style={{ color: '#a07018' }}>{data.nextBadge.tier.label} {data.nextBadge.cat.unit}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(160,112,24,0.15)', borderRadius: 3, overflow: 'hidden', marginTop: 7 }}>
              <div style={{ height: '100%', width: `${Math.round(data.nextBadge.pct * 100)}%`, background: 'linear-gradient(90deg, #a07018, #f0cc70)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text3, #999)', marginTop: 4 }}>
              {data.nextBadge.value} / {data.nextBadge.tier.threshold} {data.nextBadge.cat.unit}
            </div>
          </div>
        </Link>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, margin: '0 16px 20px', padding: '14px 16px',
        background: challengeDone ? 'linear-gradient(135deg, rgba(46,125,50,0.14), rgba(46,125,50,0.05))' : 'var(--card-bg, #fff)',
        border: challengeDone ? '1px solid rgba(46,125,50,0.35)' : '1px solid var(--border, #eee)', borderRadius: 18,
      }}>
        <span style={{
          fontSize: 20, flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
          background: challengeDone ? '#2e7d32' : 'rgba(0,61,166,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{challengeDone ? '✓' : data.challenge.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text, #121212)' }}>
            Défi de la semaine : <span style={{ color: challengeDone ? '#2e7d32' : '#003DA6' }}>{data.challenge.label}</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg3, #eee)', borderRadius: 3, overflow: 'hidden', marginTop: 7 }}>
            <div style={{ height: '100%', width: `${Math.min(100, Math.round(data.challengeProgress / data.challenge.target * 100))}%`, background: challengeDone ? '#2e7d32' : 'linear-gradient(90deg, #1E63E0, #003DA6)', borderRadius: 3 }} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text3, #999)', marginTop: 4 }}>
            {challengeDone ? 'Défi complété !' : `${data.challengeProgress} / ${data.challenge.target} ${data.challenge.unit} cette semaine`}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '0 16px 20px' }}>
        {galleryStats.map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 12, padding: '9px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: 'var(--text3, #999)', letterSpacing: 0.3, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '4px 0 16px', textAlign: 'center', color: 'var(--text, #121212)' }}>
        🌍 Memorabilius en chiffres
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, padding: '0 16px 0' }}>
        {siteStatsList.map(s => (
          <div key={s.label} style={{ background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 14, padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#003DA6' }}>{s.val.toLocaleString()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3, #999)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
