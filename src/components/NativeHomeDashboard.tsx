'use client'
import StreakFlame from '@/components/StreakFlame'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { useLang, type TranslationKey } from '@/lib/LangContext'
import { hapticTap } from '@/lib/haptics'
import { BADGE_CATEGORIES, type BadgeCategory, type BadgeTier } from '@/lib/badgeDefinitions'
import { levelFromXP, type LevelInfo } from '@/lib/leveling'
import { currentChallenge, startOfWeekISO, endOfWeekISO, type ChallengeTemplate } from '@/lib/weeklyChallenge'
import { recordJsError } from '@/lib/crashlytics'

interface SiteStats { total: number; totalCartes: number; totalBinders: number; totalTrade: number }

interface DashboardData {
  displayName: string
  avatarUrl: string | null
  totalCards: number
  lastCard: { image: string; name: string } | null
  lastCards: { image: string; name: string }[]   // 3 dernieres cartes (eventail), la plus recente en premier
  nextBadge: { cat: BadgeCategory; tier: BadgeTier; value: number; pct: number } | null
  rc: number; patch: number; auto: number; num: number
  week: { rc: number; patch: number; auto: number; num: number }   // cartes ajoutees cette semaine, par type
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


// "3j 4h" / "5h" / "moins d'1h" — pas besoin de granularité seconde, le défi
// change une fois par semaine (voir currentChallenge dans weeklyChallenge.ts).
function formatCountdown(msLeft: number, t: (k: TranslationKey) => string): string {
  if (msLeft <= 0) return ''
  const totalHours = Math.floor(msLeft / 3_600_000)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) return `${days}${t('dashboard_challenge_days_short')} ${hours}${t('dashboard_challenge_hours_short')}`
  if (totalHours > 0) return `${totalHours}${t('dashboard_challenge_hours_short')}`
  return t('dashboard_challenge_less_than_hour')
}

export default function NativeHomeDashboard({ siteStats }: { siteStats: SiteStats }) {
  // orientation reelle de chaque carte de l'eventail (lue sur l'image chargee)
  const [heroLandscape, setHeroLandscape] = useState<Record<number, boolean>>({})
  const { user } = useAuth()
  const { t, lang } = useLang()
  const [data, setData] = useState<DashboardData | null>(null)
  const [failed, setFailed] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [showXpInfo, setShowXpInfo] = useState(false)

  // Personnalisation de l'accueil (raccourcis choisis, ordre et visibilite des blocs) : stockee sur l'appareil, sans base de donnees
  const [editMode, setEditMode] = useState(false)
  const [shortcuts, setShortcuts] = useState<string[]>(DEFAULT_SHORTCUTS)
  const [layout, setLayout] = useState<{ order: BlockId[]; hidden: BlockId[] }>({ order: DEFAULT_BLOCKS, hidden: [] })
  useEffect(() => {
    try {
      const sc = JSON.parse(localStorage.getItem('dd-shortcuts') || 'null')
      if (Array.isArray(sc) && sc.length) setShortcuts(sc.filter((k: string) => k in SHORTCUT_DEFS).slice(0, 4))
      const ly = JSON.parse(localStorage.getItem('dd-layout') || 'null')
      if (ly && Array.isArray(ly.order)) {
        const order = (ly.order as BlockId[]).filter(b => DEFAULT_BLOCKS.includes(b))
        for (const b of DEFAULT_BLOCKS) if (!order.includes(b)) order.push(b)
        setLayout({ order, hidden: (ly.hidden || []).filter((b: BlockId) => DEFAULT_BLOCKS.includes(b)) })
      }
    } catch { /* stockage indisponible : valeurs par defaut */ }
  }, [])
  const saveShortcuts = (next: string[]) => { setShortcuts(next); try { localStorage.setItem('dd-shortcuts', JSON.stringify(next)) } catch {} }
  const saveLayout = (next: { order: BlockId[]; hidden: BlockId[] }) => { setLayout(next); try { localStorage.setItem('dd-layout', JSON.stringify(next)) } catch {} }
  const moveBlock = (id: BlockId, dir: -1 | 1) => {
    const o = [...layout.order]; const i = o.indexOf(id); const j = i + dir
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    saveLayout({ ...layout, order: o })
  }
  const toggleBlock = (id: BlockId) => saveLayout({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter(b => b !== id) : [...layout.hidden, id] })
  const toggleShortcut = (k: string) => {
    if (shortcuts.includes(k)) { if (shortcuts.length > 1) saveShortcuts(shortcuts.filter(x => x !== k)) }
    else if (shortcuts.length < 4) saveShortcuts([...shortcuts, k])
  }

  // Encart echanges (offres en attente + matches wishlist) : requete SEPAREE
  // et non bloquante -- ne doit jamais retarder ni faire echouer le
  // chargement principal du dashboard (voir l'historique du "F5" plus haut).
  const [tradeSummary, setTradeSummary] = useState<{ pendingReceived: number; inProgress: number; matches: number; perfectMatches: number } | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return
        const res = await fetch('/api/trades/summary', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setTradeSummary(json)
      } catch { /* encart optionnel */ }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // "Depuis ta derniere visite" : notifications non lues par type. Requete
  // separee et non bloquante (meme principe que l'encart echanges ci-dessus).
  const [activity, setActivity] = useState<{ like: number; comment: number; wishlist_match: number; other: number } | null>(null)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase.from('notifications').select('type').eq('user_id', user.id).eq('lu', false).limit(200)
      .then(({ data: rows }) => {
        if (cancelled || !rows) return
        const acc = { like: 0, comment: 0, wishlist_match: 0, other: 0 }
        for (const r of rows as { type: string }[]) {
          if (r.type === 'like') acc.like++
          else if (r.type === 'comment') acc.comment++
          else if (r.type === 'wishlist_match') acc.wishlist_match++
          else acc.other++
        }
        setActivity(acc)
      }, () => {})
    return () => { cancelled = true }
  }, [user?.id])

  // Depend sur user?.id (primitif stable), PAS sur l'objet `user` entier --
  // AuthContext peut fournir plusieurs references differentes pour le meme
  // utilisateur (lecture localStorage initiale, puis confirmation Supabase
  // async, puis chaque rafraichissement de token) : avec `user` dans les
  // deps, cet effet redemarrait tout le chargement a chaque fois, abandonnant
  // la requete en cours pile au moment ou la page s'affichait -- symptome
  // exact du dashboard bloque en chargement jusqu'a un F5 manuel.
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
    let currentAbort: AbortController | null = null
    const load = async (attempt: number) => {
      // Le timeout ci-dessous abandonne juste l'ATTENTE côté JS -- sans abort
      // explicite, les requetes de la tentative precedente continuaient de
      // tourner en arriere-plan (Supabase/le navigateur ne les annule pas
      // tout seul). Sur une connexion lente/limitee, chaque nouvelle tentative
      // s'ajoutait donc aux precedentes encore en vol au lieu de repartir
      // propre, saturant le nombre de requetes simultanees par domaine que le
      // navigateur autorise -- chaque tentative devenait alors plus lente que
      // la precedente jusqu'a l'echec garanti au bout des 5 essais (~40s).
      currentAbort?.abort()
      const abort = new AbortController()
      currentAbort = abort
      try {
        const challenge = currentChallenge()
        const pending = new Set<string>()
        const timeout = new Promise<never>((_, reject) => setTimeout(() => {
          // console.warn (visible au niveau "Default levels" de DevTools,
          // contrairement a console.debug masque par defaut) : liste des
          // requetes qui n'ont toujours pas repondu au moment du timeout.
          console.warn(`[dashboard] tentative ${attempt} timeout apres 4s -- en attente: ${[...pending].join(', ') || 'aucune (tout a repondu ?)'}`)
          reject(new Error('timeout'))
        }, 4000))
        // Diagnostic temporaire (signalement "timeout" recurrent malgre des
        // requetes individuellement rapides cote serveur) : chaque requete
        // logue sa propre duree des qu'elle repond, meme si l'ensemble finit
        // par timeout -- pour voir dans la console laquelle ne repond jamais,
        // au lieu de deviner. A retirer une fois la cause confirmee.
        const timed = <T,>(label: string, p: PromiseLike<T>) => {
          const t0 = performance.now()
          pending.add(label)
          return Promise.resolve(p).then(r => {
            pending.delete(label)
            console.warn(`[dashboard] ${label}: ${Math.round(performance.now() - t0)}ms`)
            return r
          }, e => {
            pending.delete(label)
            console.warn(`[dashboard] ${label}: FAILED after ${Math.round(performance.now() - t0)}ms`, e)
            throw e
          })
        }
        // stats_total/rc/patch/num/auto viennent tous de profiles (recalculés chaque
        // nuit par /api/recalcul-stats, CSV inclus) — `auto` faisait avant l'objet
        // d'une requête live séparée sur cartes_manuelles uniquement, ratant les
        // cartes auto importées par CSV (incohérent avec rc/patch/num, en plus d'une
        // requête réseau de plus qui contribue au cold start).
        const [{ data: profile }, { data: lastCards }, { data: badgeRows }, { data: streakRows }, { data: weekCards }, { data: xpTotal }] = await Promise.race([
          Promise.all([
            timed('profile', supabase.from('profiles').select('display_name, avatar_url, stats_total, stats_auto').eq('id', user.id).abortSignal(abort.signal).single()),
            timed('lastCard', supabase.from('cartes_manuelles').select('image_recto, nom').eq('user_id', user.id).not('image_recto', 'is', null).order('created_at', { ascending: false }).abortSignal(abort.signal).limit(24)),
            timed('badgeData', supabase.rpc('get_user_badge_data', { p_user_id: user.id }).abortSignal(abort.signal)),
            timed('bumpStreak', supabase.rpc('bump_streak', { p_user_id: user.id }).abortSignal(abort.signal)),
            timed('weekCards', supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', user.id).gte('created_at', startOfWeekISO()).abortSignal(abort.signal)),
            timed('xpTotal', supabase.rpc('get_user_xp_total', { p_user_id: user.id }).abortSignal(abort.signal)),
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
          lastCards: (lastCards || []).map((c: any) => ({ image: c.image_recto, name: c.nom || '' })),
          nextBadge,
          rc: b?.stat_rc ?? 0, patch: b?.stat_patch ?? 0, num: b?.stat_num ?? 0, auto: profile?.stats_auto ?? 0,
          week: {
            rc: (weekCards || []).filter(c => c.rc).length, patch: (weekCards || []).filter(c => c.patch).length,
            auto: (weekCards || []).filter(c => c.auto).length, num: (weekCards || []).filter(c => c.num).length,
          },
          level,
          streak: streakRows?.[0]?.current_streak ?? 0,
          challenge,
          challengeProgress,
        })
      } catch (e) {
        if (cancelled) return
        // 5 tentatives avec delai croissant (~15s) au lieu de 2x1s (~2s) --
        // meme raison que GalerieClient.tsx : sur un vrai cold start, 2s peut
        // ne pas suffire a ce que la session/reseau soit prete, et on
        // abandonnait trop tot (panel absent de l'accueil jusqu'a un F5).
        if (attempt < 5) {
          setTimeout(() => { if (!cancelled) load(attempt + 1) }, 1000 * (attempt + 1))
        } else {
          console.error('[NativeHomeDashboard] load failed after retries', e)
          // Diagnostic F5 a distance (voir AuthContext.tsx) -- les 5
          // tentatives ont toutes echoue, le panneau reste bloque avec un
          // bouton "reessayer" au lieu de charger normalement.
          recordJsError(e, '[F5-diag] NativeHomeDashboard load failed after 5 retries')
          setFailed(true)
        }
      }
    }
    load(1)
    return () => { cancelled = true; currentAbort?.abort() }
  }, [user?.id, retryKey])

  // Verse la récompense XP du défi hebdomadaire dès qu'il est complété. La
  // route recalcule elle-même la progression côté serveur (voir
  // /api/challenge-complete) et est idempotente — l'appeler ici à chaque fois
  // que challengeDone passe à true (montage, ou dernière carte qui complète le
  // défi) est donc sans risque de double versement.
  useEffect(() => {
    if (!data || !user) return
    if (data.challengeProgress < data.challenge.target) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/challenge-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    })
  }, [user, data?.challenge.id, data && data.challengeProgress >= data.challenge.target])

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

  // chaque tuile ouvre la galerie deja filtree (le champ de recherche comprend "rc", "auto", "patch", "num")
  const galleryStats = [
    { label: 'RC', val: data.rc, week: data.week.rc, q: 'rc' },
    { label: 'AUTO', val: data.auto, week: data.week.auto, q: 'auto' },
    { label: 'PATCH', val: data.patch, week: data.week.patch, q: 'patch' },
    { label: 'NUM', val: data.num, week: data.week.num, q: 'num' },
  ]

  const siteStatsList = [
    { label: t('home_collectors'), val: siteStats.total },
    { label: t('dashboard_stat_cards'), val: siteStats.totalCartes },
    { label: t('dashboard_stat_binders'), val: siteStats.totalBinders },
    { label: t('dashboard_stat_trades'), val: siteStats.totalTrade },
  ]

  const challengeDone = data.challengeProgress >= data.challenge.target
  const challengeMsLeft = new Date(endOfWeekISO()).getTime() - Date.now()
  const L = { ...(DD_TEXT[lang] || DD_TEXT.en), ...(DD_TEXT2[lang as keyof typeof DD_TEXT2] || DD_TEXT2.en) }

  // "Depuis ta derniere visite" : notifications non lues + echanges en attente.
  const activityItems: { n: number; label: string; href: string }[] = []
  if (activity) {
    if (activity.like > 0) activityItems.push({ n: activity.like, label: L.likes, href: '/notifications' })
    if (activity.comment > 0) activityItems.push({ n: activity.comment, label: L.comments, href: '/notifications' })
    if (activity.wishlist_match > 0) activityItems.push({ n: activity.wishlist_match, label: L.wishlist, href: '/notifications' })
    if (activity.other > 0) activityItems.push({ n: activity.other, label: L.other, href: '/notifications' })
  }
  if (tradeSummary && tradeSummary.pendingReceived > 0) activityItems.push({ n: tradeSummary.pendingReceived, label: t('home_trades_pending'), href: '/trades?tab=echanges' })
  if (tradeSummary && tradeSummary.matches > 0) activityItems.push({ n: tradeSummary.matches, label: t('home_trades_matches'), href: '/trades?tab=matches' })

  const galleryHref = `/galerie/${user?.id}`

  const renderActivity = () => activityItems.length === 0 ? <p className="dd-sub" style={{ margin: 0 }}>{L.since} : 0</p> : (
        <section className="dd-box">
          <h2 className="dd-h">{L.since}</h2>
          <div className="dd-act-list">
            {activityItems.map((a, i) => (
              <Link key={i} href={a.href} onClick={hapticTap} className="dd-act-item">
                <b className="da-num">{a.n}</b><span>{a.label}</span><ChevronIcon />
              </Link>
            ))}
          </div>
        </section>
  )
  const renderProgress = () => (
      <section className="dd-box">
        <div className="dd-prog dd-prog--first">
          <button type="button" className="dd-prog-ico dd-lvl-ico" onClick={() => setShowXpInfo(v => !v)} aria-label="XP">
            <b className="da-num">{data.level.level}</b>
          </button>
          <div className="dd-prog-b">
            <div className="dd-lvl-row"><span>{t('word_level')} {data.level.level}</span><span>{data.level.xpIntoLevel}/{data.level.xpForNextLevel} XP</span></div>
            <div className="dd-bar dd-bar--seg"><i style={{ width: `${Math.min(100, Math.round(data.level.pct * 100))}%` }} /></div>
            <div className="dd-sub">{Math.max(0, data.level.xpForNextLevel - data.level.xpIntoLevel)} {L.toNext}</div>
          </div>
        </div>
        {showXpInfo && <p className="dd-info">{t('xp_info_explanation')}</p>}

        {data.nextBadge && (
          <Link href={`${galleryHref}?tab=badges`} onClick={hapticTap} className="dd-prog">
            <span className="dd-prog-ico">{data.nextBadge.cat.emoji}</span>
            <div className="dd-prog-b">
              <div className="dd-lvl-row"><span>{`${t('dashboard_next_badge_prefix')} ${data.nextBadge.tier.label} ${data.nextBadge.cat.unit}`}</span><span>{data.nextBadge.value}/{data.nextBadge.tier.threshold}</span></div>
              <div className="dd-bar dd-bar--gold"><i style={{ width: `${Math.min(100, Math.round(data.nextBadge.pct * 100))}%` }} /></div>
            </div>
          </Link>
        )}

        <Link href={galleryHref} onClick={hapticTap} className="dd-prog">
          <span className="dd-prog-ico">{challengeDone ? '✓' : data.challenge.emoji}</span>
          <div className="dd-prog-b">
            <div className="dd-lvl-row">
              <span>{`${t('dashboard_challenge_prefix')} ${t(data.challenge.labelKey)}`}</span>
              <span>{challengeDone ? t('dashboard_challenge_done') : `${data.challengeProgress}/${data.challenge.target}`}</span>
            </div>
            <div className={`dd-bar${challengeDone ? ' dd-bar--ok' : ''}`}><i style={{ width: `${Math.min(100, Math.round((data.challengeProgress / data.challenge.target) * 100))}%` }} /></div>
            <div className="dd-sub">+{data.challenge.rewardXp} XP · {t('dashboard_challenge_ends_in')} {formatCountdown(challengeMsLeft, t)}</div>
          </div>
        </Link>
      </section>
  )
  const renderSite = () => (
    <>
      <h2 className="dd-h dd-h--site">{t('dashboard_site_stats_title')}</h2>
      <div className="dd-site">
        {siteStatsList.map(s => (
          <div key={s.label}>
            <b className="da-num">{s.val.toLocaleString()}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </>
  )

  return (
    <div className="dd">
      <style>{DD_CSS}</style>

      <header className="dd-head">
        <div className="dd-who">
          {data.avatarUrl
            ? <img src={data.avatarUrl} alt="" className="dd-avatar" />
            : <div className="dd-avatar dd-avatar--ph">{data.displayName[0]?.toUpperCase()}</div>}
          <div style={{ minWidth: 0 }}>
            <div className="dd-kicker">{t('dashboard_greeting')}</div>
            <div className="dd-name-row">
              <h1 className="dd-name">{data.displayName}</h1>
              <button type="button" className={'dd-edit-btn' + (editMode ? ' on' : '')} onClick={() => setEditMode(v => !v)} aria-label={L.customize} title={L.customize}>
                {editMode
                  ? L.done
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>}
              </button>
            </div>
          </div>
        </div>
        {data.streak > 0 && (
          <div className="dd-streak">
            <StreakFlame streak={data.streak} />
            <span><b className="da-num">{data.streak}</b>{t(data.streak === 1 ? 'dashboard_streak_one' : 'dashboard_streak_other').replace('{n}', '').trim()}</span>
          </div>
        )}
      </header>

      <Link href={galleryHref} onClick={hapticTap} className="dd-hero da-grain">
        <div className="dd-hero-l">
          <div className="dd-hero-k">{t('dashboard_my_gallery')}</div>
          <div className="dd-hero-n da-num">{data.totalCards}</div>
          <div className="dd-hero-u">{t(data.totalCards === 1 ? 'dashboard_card_one' : 'dashboard_card_other')}</div>
          {data.lastCard?.name && (
            <div className="dd-hero-last">{t('dashboard_last_added')} <strong>{data.lastCard.name}</strong></div>
          )}
        </div>
        {/* fond : mosaique de tes dernieres cartes (vignettes optimisees, fixe, fondue vers la gauche) */}
        {(data.lastCards || []).length > 5 && (
          <div className="dd-hero-mos" aria-hidden>
            {data.lastCards.slice(0, 24).map((c, i) => <img key={i} src={heroThumb(c.image, 220)} alt="" loading="lazy" decoding="async" />)}
          </div>
        )}
        <div className="dd-hero-r holo-light holo-tilt">
          {(data.lastCards || []).length
            // pile des 5 dernieres cartes ajoutees : de l'arriere (la plus ancienne) vers l'avant (la plus recente)
            ? [...(data.lastCards || [])].slice(0, 5).map((c, i) => ({ c, i })).reverse().map(({ c, i }) => (
                <img key={i} src={heroThumb(c.image, 440)} alt="" className={`dd-hero-card dd-pile-${i}${heroLandscape[i] ? ' dd-hero-card--h' : ''}`}
                  onLoad={e => { const land = e.currentTarget.naturalWidth > e.currentTarget.naturalHeight; setHeroLandscape(p => p[i] === land ? p : { ...p, [i]: land }) }} />
              ))
            : <div className="dd-hero-card dd-hero-card--empty" />}
          <span className="dd-hero-go"><ChevronIcon /></span>
        </div>
      </Link>

      <div className="dd-score">
        {galleryStats.map(s => (
          <Link key={s.label} href={`${galleryHref}?q=${s.q}`} onClick={hapticTap} className="dd-score-tile">
            <b className="da-num">{s.val}</b>
            <span>{s.label}</span>
            <i title={L.thisWeek}>{s.week > 0 ? `+${s.week}` : ''}</i>
          </Link>
        ))}
      </div>

      <div className="dd-actions" style={{ ['--n' as string]: shortcuts.length }}>
        {shortcuts.map(k => {
          const d = SHORTCUT_DEFS[k]; if (!d) return null
          const href = d.href.replace('{g}', galleryHref)
          return <Link key={k} href={href} onClick={hapticTap} className="dd-act">{d.label(t, L)}</Link>
        })}
      </div>
      {editMode && (
        <div className="dd-edit">
          <div className="dd-edit-h">{L.shortcutsHelp}</div>
          <div className="dd-edit-chips">
            {Object.keys(SHORTCUT_DEFS).map(k => (
              <button key={k} type="button" className={'dd-chip' + (shortcuts.includes(k) ? ' on' : '')} onClick={() => toggleShortcut(k)}>{SHORTCUT_DEFS[k].label(t, L)}</button>
            ))}
          </div>
        </div>
      )}

      {layout.order.map(id => {
        const hidden = layout.hidden.includes(id)
        if (hidden && !editMode) return null
        if (id === 'activity' && activityItems.length === 0 && !editMode) return null
        const body = id === 'activity' ? renderActivity() : id === 'progress' ? renderProgress() : renderSite()
        return (
          <div key={id} className={'dd-blk' + (hidden ? ' dd-blk--off' : '')}>
            {editMode && (
              <div className="dd-blk-bar">
                <span>{id === 'activity' ? L.blkActivity : id === 'progress' ? L.blkProgress : L.blkSite}</span>
                <button type="button" onClick={() => moveBlock(id, -1)} aria-label={L.up}>↑</button>
                <button type="button" onClick={() => moveBlock(id, 1)} aria-label={L.down}>↓</button>
                <button type="button" onClick={() => toggleBlock(id)}>{hidden ? L.show : L.hide}</button>
              </div>
            )}
            {body}
          </div>
        )
      })}
    </div>
  )
}

const DD_TEXT: Record<string, { add: string; since: string; likes: string; comments: string; wishlist: string; other: string; levelShort: string; toNext: string }> = {
  fr: { add: 'Ajouter une carte', since: 'Depuis ta dernière visite', likes: 'j’aime reçus', comments: 'commentaires', wishlist: 'cartes de ta wishlist trouvées', other: 'autres notifications', levelShort: 'Niv.', toNext: 'XP avant le niveau suivant' },
  en: { add: 'Add a card', since: 'Since your last visit', likes: 'likes received', comments: 'comments', wishlist: 'wishlist matches', other: 'other notifications', levelShort: 'Lvl', toNext: 'XP to next level' },
  de: { add: 'Karte hinzufügen', since: 'Seit deinem letzten Besuch', likes: 'Likes erhalten', comments: 'Kommentare', wishlist: 'Wunschlisten-Treffer', other: 'weitere Benachrichtigungen', levelShort: 'Lvl', toNext: 'XP bis zum nächsten Level' },
  es: { add: 'Añadir carta', since: 'Desde tu última visita', likes: 'me gusta recibidos', comments: 'comentarios', wishlist: 'coincidencias de tu lista de deseos', other: 'otras notificaciones', levelShort: 'Nv.', toNext: 'XP para el siguiente nivel' },
  it: { add: 'Aggiungi carta', since: 'Dalla tua ultima visita', likes: 'mi piace ricevuti', comments: 'commenti', wishlist: 'corrispondenze della wishlist', other: 'altre notifiche', levelShort: 'Liv.', toNext: 'XP al prossimo livello' },
}

// Vignette optimisee (meme optimiseur que la galerie, mise en cache 1 an) pour les images Supabase ; autres sources : image d'origine
const heroThumb = (url: string, w: number) => (url.includes('.supabase.co') ? `/_next/image?url=${encodeURIComponent(url)}&w=${w}&q=70` : url)

type BlockId = 'activity' | 'progress' | 'site'
const DEFAULT_BLOCKS: BlockId[] = ['activity', 'progress', 'site']
const DEFAULT_SHORTCUTS = ['scanner', 'add', 'trades']
type DDL = typeof DD_TEXT2['en']
const SHORTCUT_DEFS: Record<string, { href: string; label: (t: (k: TranslationKey) => string, L: DDL & { add: string }) => string }> = {
  scanner: { href: '/scanner', label: t => t('nav_scanner') },
  add: { href: '{g}/ajouter', label: (_t, L) => L.add },
  trades: { href: '/trades', label: t => t('nav_trades') },
  setlist: { href: '/setlist', label: t => t('nav_setlist') },
  wishlist: { href: '/wishlist', label: (_t, L) => L.wishlist2 },
  messages: { href: '/messages', label: t => t('nav_messages') },
  expo: { href: '{g}/expo', label: (_t, L) => L.expo },
}
const DD_TEXT2 = {
  fr: { thisWeek: 'ajoutées cette semaine', customize: 'Personnaliser', done: 'OK', shortcutsHelp: 'Choisis jusqu’à 4 raccourcis', wishlist2: 'Wishlist', expo: 'Mode expo', blkActivity: 'Activité', blkProgress: 'Niveau, badge, défi', blkSite: 'Le site en chiffres', up: 'Monter', down: 'Descendre', show: 'Afficher', hide: 'Masquer' },
  en: { thisWeek: 'added this week', customize: 'Customize', done: 'Done', shortcutsHelp: 'Pick up to 4 shortcuts', wishlist2: 'Wishlist', expo: 'Expo mode', blkActivity: 'Activity', blkProgress: 'Level, badge, challenge', blkSite: 'Site in numbers', up: 'Move up', down: 'Move down', show: 'Show', hide: 'Hide' },
  de: { thisWeek: 'diese Woche hinzugefügt', customize: 'Anpassen', done: 'OK', shortcutsHelp: 'Wähle bis zu 4 Kürzel', wishlist2: 'Wunschliste', expo: 'Expo-Modus', blkActivity: 'Aktivität', blkProgress: 'Level, Badge, Challenge', blkSite: 'Die Seite in Zahlen', up: 'Nach oben', down: 'Nach unten', show: 'Anzeigen', hide: 'Ausblenden' },
  es: { thisWeek: 'añadidas esta semana', customize: 'Personalizar', done: 'OK', shortcutsHelp: 'Elige hasta 4 atajos', wishlist2: 'Lista de deseos', expo: 'Modo expo', blkActivity: 'Actividad', blkProgress: 'Nivel, insignia, reto', blkSite: 'El sitio en cifras', up: 'Subir', down: 'Bajar', show: 'Mostrar', hide: 'Ocultar' },
  it: { thisWeek: 'aggiunte questa settimana', customize: 'Personalizza', done: 'OK', shortcutsHelp: 'Scegli fino a 4 scorciatoie', wishlist2: 'Wishlist', expo: 'Modalità expo', blkActivity: 'Attività', blkProgress: 'Livello, badge, sfida', blkSite: 'Il sito in numeri', up: 'Su', down: 'Giù', show: 'Mostra', hide: 'Nascondi' },
}

// Style du tableau de bord (nouvelle DA) : pose directement sur le fond de la
// page, cadres epais a angles droits, Surfquest pour les gros chiffres. Les
// cartes (image) restent a coins nets.
export const DD_CSS = `
.dd { max-width: 1180px; margin: 0 auto; padding: 4px 0 28px; color: var(--text); }
/* les blocs ont deja 16px de marge : on elargit le conteneur de 16px de chaque cote pour qu'ils aient la meme largeur que la carte du jour (placee hors du tableau de bord) */
.dd { width: calc(100% + 32px); max-width: none; margin-left: -16px; margin-right: -16px; }
.dd a { text-decoration: none; color: inherit; }
.dd-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 16px 14px; flex-wrap: wrap; }
.dd-who { display: flex; align-items: center; gap: 14px; min-width: 0; }
.dd-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 3px solid var(--text); }
.dd-avatar--ph { display: grid; place-items: center; background: #003da6; color: #fff; font-weight: 900; font-size: 22px; }
.dd-kicker { font: 800 12px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--text2); }
.dd-name { font-size: clamp(34px, 5vw, 56px); line-height: .95; margin: 2px 0 0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-streak { display: inline-flex; align-items: center; gap: 6px; font: 800 12px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; padding: 0; border: 0; }
.dd-streak span { display: inline-flex; align-items: baseline; gap: 6px; line-height: 1; }
.dd-streak b { font-size: 24px; line-height: 1; letter-spacing: 0; }
.flame-ic { filter: drop-shadow(0 0 10px rgba(255,140,0,.7)); animation: flameFlick 1.4s ease-in-out infinite; transform-origin: 50% 100%; flex-shrink: 0; }
@keyframes flameFlick { 0%,100% { transform: scale(1,1) rotate(0); } 25% { transform: scale(1.04,.97) rotate(-2deg); } 55% { transform: scale(.98,1.05) rotate(2deg); } 80% { transform: scale(1.02,.99) rotate(-1deg); } }
@media (prefers-reduced-motion: reduce) { .flame-ic { animation: none; } }
.dd-score-tile { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; text-decoration: none; color: inherit; }
.dd-score-tile i { font-style: normal; font: 800 12px system-ui, sans-serif; color: #3ddc97; min-height: 16px; margin-top: 2px; }
.dd-score-tile:hover { background: rgba(255,255,255,.08); }
/* bouton de personnalisation : discret, a droite du pseudo */
.dd-name-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dd-name-row .dd-name { min-width: 0; }
.dd-edit-btn { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 6px; background: transparent; border: 0; color: var(--text2); opacity: .55; cursor: pointer; font: 800 11px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; border-radius: 0; }
.dd-edit-btn:hover { opacity: 1; }
.dd-edit-btn.on { opacity: 1; color: var(--text); border-bottom: 2px solid var(--text); }
.dd-edit { margin: -6px 16px 14px; padding: 12px 14px; border: 2px dashed var(--text2, rgba(128,128,128,.6)); }
.dd-edit-h { font: 800 11px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--text2); margin-bottom: 8px; }
.dd-edit-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.dd-chip { padding: 7px 12px; border: 2px solid var(--text); background: transparent; color: var(--text); font: 800 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; border-radius: 0; }
.dd-chip.on { background: var(--text); color: var(--bg, #000); }
.dd-blk--off { opacity: .45; }
.dd-blk-bar { display: flex; align-items: center; gap: 6px; margin: 0 16px 6px; font: 800 11px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; color: var(--text2); }
.dd-blk-bar span { flex: 1; }
.dd-blk-bar button { padding: 4px 10px; border: 2px solid var(--text2, #888); background: transparent; color: var(--text); font: 800 11px system-ui, sans-serif; cursor: pointer; border-radius: 0; }
.dd-hero { display: flex; align-items: stretch; margin: 0 16px 14px; border: 3px solid rgba(255,255,255,.28);
  background: linear-gradient(135deg, #050912 0%, #08153b 48%, #003da6 100%); color: #fff; overflow: hidden; }
.dd-hero-l { flex: 1; padding: clamp(18px, 3vw, 36px); display: flex; flex-direction: column; justify-content: center; min-width: 0; }
.dd-hero-k { font: 800 12px system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #9fbdf5; }
.dd-hero-n { font-size: clamp(76px, 13vw, 160px); line-height: .9; margin: 6px 0 2px; color: #fff; }
.dd-hero-u { font: 800 14px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: #cddcff; }
.dd-hero-last { font-size: 13px; color: #9fbdf5; margin-top: 14px; }
.dd-hero-last strong { color: #fff; }
.dd-hero-r { position: relative; width: clamp(130px, 24vw, 280px); flex-shrink: 0; }
.dd-hero-card { position: absolute; right: clamp(14px, 3vw, 40px); bottom: clamp(14px, 3vw, 30px); width: clamp(84px, 14vw, 170px); aspect-ratio: 2.5/3.5;
  object-fit: cover; transform: rotate(5deg); box-shadow: 0 24px 50px rgba(0,0,0,.55); border: 0; border-radius: 0; }
/* carte horizontale : ratio inverse (sinon elle est rognee en vertical) et un peu plus large pour rester lisible */
.dd-hero-card--h { aspect-ratio: 3.5/2.5; width: clamp(120px, 20vw, 250px); }
/* eventail des 3 dernieres cartes : la plus recente devant (a droite), les autres decalees vers la gauche */
.dd-hero-card { transform-origin: 50% 100%; }
/* pile des 5 dernieres cartes : la plus recente devant, les autres decalees et inclinees, qui debordent du cadre par le bas */
.dd-hero-card { bottom: clamp(-30px, -2vw, -14px); }
.dd-pile-0 { transform: rotate(7deg); z-index: 5; }
.dd-pile-1 { transform: translateX(-42%) rotate(-3deg); z-index: 4; }
.dd-pile-2 { transform: translateX(-84%) rotate(-12deg); z-index: 3; }
.dd-pile-3 { transform: translateX(-126%) rotate(-20deg); z-index: 2; }
.dd-pile-4 { transform: translateX(-168%) rotate(-28deg); z-index: 1; }
@media (max-width: 560px) { .dd-pile-1 { transform: translateX(-30%) rotate(-3deg); } .dd-pile-2 { transform: translateX(-60%) rotate(-12deg); } .dd-pile-3, .dd-pile-4 { display: none; } }
/* mosaique de fond : fixe (aucune animation), fondue vers la gauche pour garder le chiffre lisible */
.dd-hero { position: relative; }
.dd-hero:before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(90deg, #050912 0%, rgba(5,9,18,.92) 30%, rgba(5,9,18,.45) 60%, rgba(5,9,18,.2) 100%); }
.dd-hero-l { position: relative; z-index: 2; }
.dd-hero-r { z-index: 3; }
.dd-hero-mos { position: absolute; right: 0; top: 0; bottom: 0; width: 66%; display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; padding: 6px; overflow: hidden; z-index: 0; opacity: .6; }
.dd-hero-mos img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; border-radius: 0; background: none; }
.dd-hero-mos img:nth-child(6n+2) { margin-top: -34px; } .dd-hero-mos img:nth-child(6n+4) { margin-top: -62px; } .dd-hero-mos img:nth-child(6n+3) { margin-top: -12px; } .dd-hero-mos img:nth-child(6n+5) { margin-top: -48px; }
@media (max-width: 767px) { .dd-hero-mos { width: 100%; grid-template-columns: repeat(4, 1fr); } .dd-hero-mos img:nth-child(n+13) { display: none; } .dd-hero:before { background: linear-gradient(90deg, rgba(5,9,18,.95) 0%, rgba(5,9,18,.7) 55%, rgba(5,9,18,.35) 100%); } }
.dd-hero-card--empty { background: rgba(255,255,255,.1); border: 2px dashed rgba(255,255,255,.35); }
.dd-hero-go { position: absolute; top: 14px; right: 14px; color: rgba(255,255,255,.85); }
.dd-score { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 16px 14px; border: 3px solid var(--text); background: var(--card-bg); }
.dd-score > div, .dd-score > a { text-align: center; padding: 14px 6px 10px; border-right: 2px solid var(--border); }
.dd-score > div:last-child, .dd-score > a:last-child { border-right: 0; }
.dd-score b, .dd-site b { display: block; font-size: clamp(36px, 6vw, 72px); line-height: 1; color: var(--text); font-weight: 400; }
.dd-score span, .dd-site span { display: block; margin-top: 4px; font: 800 12px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--text2); }
.dd-actions { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 10px; margin: 0 16px 14px; }
.dd-act { display: grid; place-items: center; text-align: center; padding: 16px 8px; background: #fff; color: #06122e !important; border: 3px solid #fff;
  font: 800 14px system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; transition: transform .15s; }
:root:not([data-theme="dark"]) .dd-act { background: #003da6; border-color: #003da6; color: #fff !important; }
.dd-act:hover { transform: translateY(-3px); }
.dd-box { margin: 0 16px 14px; border: 3px solid var(--text); background: var(--card-bg); padding: 4px 16px 6px; }
.dd-h { font: 800 13px system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--text2); margin: 14px 0 6px; }
.dd-h--site { margin: 26px 16px 10px; text-align: center; }
.dd-act-list { display: grid; }
.dd-act-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 2px solid var(--border); }
.dd-act-item:first-child { border-top: 0; }
.dd-act-item b { font-size: 34px; line-height: 1; min-width: 44px; font-weight: 400; color: var(--text); }
.dd-act-item span { flex: 1; font: 700 14px system-ui, sans-serif; }
.dd-lvl-row { display: flex; justify-content: space-between; gap: 10px; font: 800 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 7px; }
.dd-lvl-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dd-bar { height: 12px; background: var(--bg3); }
.dd-bar i { display: block; height: 100%; background: #2f6bff; }
.dd-bar--gold i { background: #e0a526; }
.dd-bar--ok i { background: #2fd072; }
.dd-info { font-size: 12px; color: var(--text2); line-height: 1.6; padding-bottom: 10px; }
.dd-prog { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-top: 2px solid var(--border); }
.dd-lvl-ico { background: transparent; color: var(--text); cursor: pointer; padding: 0; }
.dd-lvl-ico b { font-size: 36px; line-height: .8; font-weight: 400; display: block; transform: translateY(-2px); }
.dd-prog--first { border-top: 0; }
.dd-prog-ico { width: 46px; height: 46px; display: grid; place-items: center; font-size: 22px; border: 3px solid var(--text); flex-shrink: 0; }
.dd-prog-b { flex: 1; min-width: 0; }
.dd-sub { font: 700 11px system-ui, sans-serif; color: var(--text2); margin-top: 7px; letter-spacing: .04em; }
.dd-site { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 16px; border: 3px solid var(--text); background: var(--card-bg); }
.dd-site > div { text-align: center; padding: 16px 6px 12px; border-right: 2px solid var(--border); }
.dd-site > div:last-child { border-right: 0; }
@media (max-width: 700px) {
  .dd-site { grid-template-columns: repeat(2, 1fr); }
  .dd-site > div:nth-child(2) { border-right: 0; }
  .dd-site > div:nth-child(-n+2) { border-bottom: 2px solid var(--border); }
  .dd-actions { gap: 6px; }
  .dd-act { padding: 14px 4px; font-size: 11px; letter-spacing: .04em; }
  .dd-score span { font-size: 10px; letter-spacing: .08em; }
}
`
