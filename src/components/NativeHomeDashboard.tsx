'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang } from '@/lib/LangContext'
import { hapticTap } from '@/lib/haptics'
import { BADGE_CATEGORIES, type BadgeCategory, type BadgeTier } from '@/lib/badgeDefinitions'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'
import { currentChallenge, startOfWeekISO, type ChallengeTemplate } from '@/lib/weeklyChallenge'

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

function ProgressRow({ icon, iconBg, label, valueLabel, valueColor, pct, barColor, href, onIconClick, first }: {
  icon: React.ReactNode; iconBg: string; label: React.ReactNode; valueLabel: string; valueColor: string
  pct: number; barColor: string; href: string; onIconClick?: () => void; first?: boolean
}) {
  const content = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: first ? undefined : '1px solid var(--border, #eee)' }}>
      <span
        onClick={onIconClick ? (e) => { e.preventDefault(); onIconClick() } : undefined}
        style={{
          fontSize: 15, fontWeight: 900, flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
          background: iconBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--text, #121212)' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
          <span style={{ color: valueColor, flexShrink: 0 }}>{valueLabel}</span>
        </div>
        <div style={{ height: 5, background: 'var(--bg3, #eee)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.round(pct * 100))}%`, background: barColor, borderRadius: 3 }} />
        </div>
      </div>
    </div>
  )
  return <Link href={href} onClick={hapticTap} style={{ textDecoration: 'none', display: 'block' }}>{content}</Link>
}

export default function NativeHomeDashboard({ siteStats }: { siteStats: SiteStats }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [data, setData] = useState<DashboardData | null>(null)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [showXpInfo, setShowXpInfo] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setFailed(false)

    // Juste après un cold start Android, le WebView peut redémarrer avant que le
    // réseau (DNS/TLS) ne soit vraiment prêt : ces requêtes peuvent alors échouer
    // ou rester bloquées en attente. Sans filet, setData() n'est jamais appelé et
    // le dashboard reste vide indéfiniment (jusqu'à un F5 manuel). On retente donc
    // automatiquement, avec un timeout pour ne pas dépendre d'un rejet explicite.
    // Timeout court (4s) et peu de tentatives (2) : un F5 manuel réussit vite car
    // c'est une requête toute neuve, pas parce qu'elle a besoin de longtemps pour
    // aboutir — un cycle d'auto-retry trop long (8s x4 + backoff, ~40s) fait juste
    // paraître la page cassée plus longtemps qu'un simple F5, pour le même résultat.
    const load = async (attempt: number) => {
      try {
        const challenge = currentChallenge()
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        // stats_total/rc/patch/num/auto viennent tous de profiles (recalculés chaque
        // nuit par /api/recalcul-stats, CSV inclus) — `auto` faisait avant l'objet
        // d'une requête live séparée sur cartes_manuelles uniquement, ratant les
        // cartes auto importées par CSV (incohérent avec rc/patch/num, en plus d'une
        // requête réseau de plus qui contribue au cold start).
        const [{ data: profile }, { data: lastCards }, { data: badgeRows }, { data: streakRows }, { data: weekCards }, { data: xpTotal }] = await Promise.race([
          Promise.all([
            supabase.from('profiles').select('display_name, avatar_url, stats_total, stats_auto').eq('id', user.id).single(),
            supabase.from('cartes_manuelles').select('image_recto, nom').eq('user_id', user.id).not('image_recto', 'is', null).order('created_at', { ascending: false }).limit(1),
            supabase.rpc('get_user_badge_data', { p_user_id: user.id }),
            supabase.rpc('bump_streak', { p_user_id: user.id }),
            supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', user.id).gte('created_at', startOfWeekISO()),
            supabase.rpc('get_user_xp_total', { p_user_id: user.id }),
          ]),
          timeout,
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
          displayName: profile?.display_name || t('gallery_default_collector'),
          avatarUrl: profile?.avatar_url || null,
          totalCards: profile?.stats_total || 0,
          lastCard: lastCards?.[0] ? { image: lastCards[0].image_recto, name: lastCards[0].nom || '' } : null,
          nextBadge,
          rc: b?.stat_rc ?? 0, patch: b?.stat_patch ?? 0, num: b?.stat_num ?? 0, auto: profile?.stats_auto ?? 0,
          level,
          streak: streakRows?.[0]?.current_streak ?? 0,
          challenge,
          challengeProgress,
        })
      } catch (e) {
        if (cancelled) return
        if (attempt < 2) {
          setTimeout(() => { if (!cancelled) load(attempt + 1) }, 1000)
        } else {
          console.error('[NativeHomeDashboard] load failed after retries', e)
          setFailed(true)
        }
      }
    }
    load(1)
    return () => { cancelled = true }
  }, [user, retryKey])

  if (!data) {
    // Sans filet visible ici, un échec réseau réel (pas juste un cold start)
    // laissait l'utilisateur bloqué sur une boîte vide indéfiniment, sans
    // indication ni moyen de réessayer autrement qu'un F5 manuel.
    if (failed) {
      return (
        <div style={{ background: 'var(--bg, #f8f9fa)', minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2, #777)' }}>{t('dashboard_load_error')}</div>
          <button onClick={() => setRetryKey(k => k + 1)}
            style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {t('dashboard_retry')}
          </button>
        </div>
      )
    }
    return (
      <div style={{ background: 'var(--bg, #f8f9fa)', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          border: '3px solid var(--border, #e0e0e0)', borderTopColor: '#003DA6',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const galleryStats = [
    { label: 'RC', val: data.rc, color: '#e67e22' },
    { label: 'AUTO', val: data.auto, color: '#2e7d32' },
    { label: 'PATCH', val: data.patch, color: '#1976d2' },
    { label: 'NUM', val: data.num, color: '#7b1fa2' },
  ]

  const siteStatsList = [
    { label: t('home_collectors'), val: siteStats.total },
    { label: t('dashboard_stat_cards'), val: siteStats.totalCartes },
    { label: t('dashboard_stat_binders'), val: siteStats.totalBinders },
    { label: t('dashboard_stat_trades'), val: siteStats.totalTrade },
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
          <div style={{ fontSize: 12.5, color: 'var(--text2, #777)', fontWeight: 600 }}>{t('dashboard_greeting')}</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text, #121212)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.displayName}</div>
        </div>
        {data.streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(230,126,34,0.12)', borderRadius: 20, padding: '5px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#e67e22', whiteSpace: 'nowrap' }}>
              {t(data.streak === 1 ? 'dashboard_streak_one' : 'dashboard_streak_other').replace('{n}', String(data.streak))}
            </span>
          </div>
        )}
      </div>

      <Link href={`/galerie/${user?.id}`} onClick={hapticTap} style={{
        display: 'flex', alignItems: 'stretch', margin: '0 16px 14px',
        background: 'linear-gradient(120deg, #0B1E4D 0%, #12318f 60%, #1E63E0 130%)',
        borderRadius: 20, overflow: 'hidden', textDecoration: 'none', color: '#fff',
        boxShadow: '0 6px 14px -6px rgba(11,30,77,0.35)',
      }}>
        <div style={{ flex: 1, padding: '18px 6px 18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: '#80B4FF', textTransform: 'uppercase' }}>{t('dashboard_my_gallery')}</div>
          <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, marginTop: 4 }}>{data.totalCards}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#cddcff', marginTop: -2 }}>{t(data.totalCards === 1 ? 'dashboard_card_one' : 'dashboard_card_other')}</div>
          {data.lastCard?.name && (
            <div style={{ fontSize: 11.5, color: '#9fbdf5', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('dashboard_last_added')} <strong style={{ color: '#fff', fontWeight: 700 }}>{data.lastCard.name}</strong>
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

      <div style={{ display: 'flex', gap: 8, margin: '0 16px 14px' }}>
        {galleryStats.map(s => (
          <div key={s.label} style={{ flex: 1, background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 12, padding: '11px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3, #999)', letterSpacing: 0.3, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', margin: '0 16px 20px', padding: '0 16px', background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #eee)', borderRadius: 18 }}>
        <ProgressRow
          first
          href={`/galerie/${user?.id}`}
          icon={data.level.level}
          iconBg="linear-gradient(135deg, #1E63E0, #003DA6)"
          label={t('word_level')}
          valueLabel={`${data.level.xpIntoLevel}/${data.level.xpForNextLevel} XP`}
          valueColor="#003DA6"
          pct={data.level.pct}
          barColor="linear-gradient(90deg, #1E63E0, #003DA6)"
          onIconClick={() => setShowXpInfo(v => !v)}
        />
        {data.nextBadge && (
          <ProgressRow
            href={`/galerie/${user?.id}?tab=badges`}
            icon={data.nextBadge.cat.emoji}
            iconBg="radial-gradient(circle at 35% 30%, #f0cc70, #a07018 75%)"
            label={`${t('dashboard_next_badge_prefix')} ${data.nextBadge.tier.label} ${data.nextBadge.cat.unit}`}
            valueLabel={`${data.nextBadge.value}/${data.nextBadge.tier.threshold}`}
            valueColor="#a07018"
            pct={data.nextBadge.pct}
            barColor="linear-gradient(90deg, #a07018, #f0cc70)"
          />
        )}
        <ProgressRow
          href={`/galerie/${user?.id}`}
          icon={challengeDone ? '✓' : data.challenge.emoji}
          iconBg={challengeDone ? '#2e7d32' : 'rgba(0,61,166,0.12)'}
          label={`${t('dashboard_challenge_prefix')} ${t(data.challenge.labelKey)}`}
          valueLabel={challengeDone ? t('dashboard_challenge_done') : `${data.challengeProgress}/${data.challenge.target}`}
          valueColor={challengeDone ? '#2e7d32' : '#003DA6'}
          pct={data.challengeProgress / data.challenge.target}
          barColor={challengeDone ? '#2e7d32' : 'linear-gradient(90deg, #1E63E0, #003DA6)'}
        />
        {showXpInfo && (
          <div style={{
            position: 'absolute', top: 8, left: 16, right: 16, zIndex: 5,
            background: 'var(--bg, #f8f9fa)', border: '1px solid var(--border, #eee)', borderRadius: 12,
            padding: 10, fontSize: 10, color: 'var(--text2, #777)', lineHeight: 1.6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}>
            {t('xp_info_explanation')}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 900, margin: '4px 0 16px', textAlign: 'center', color: 'var(--text, #121212)' }}>
        {t('dashboard_site_stats_title')}
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
