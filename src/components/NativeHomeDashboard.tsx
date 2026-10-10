'use client'
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
            timed('lastCard', supabase.from('cartes_manuelles').select('image_recto, nom').eq('user_id', user.id).not('image_recto', 'is', null).order('created_at', { ascending: false }).abortSignal(abort.signal).limit(3)),
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

  const galleryStats = [
    { label: 'RC', val: data.rc },
    { label: 'AUTO', val: data.auto },
    { label: 'PATCH', val: data.patch },
    { label: 'NUM', val: data.num },
  ]

  const siteStatsList = [
    { label: t('home_collectors'), val: siteStats.total },
    { label: t('dashboard_stat_cards'), val: siteStats.totalCartes },
    { label: t('dashboard_stat_binders'), val: siteStats.totalBinders },
    { label: t('dashboard_stat_trades'), val: siteStats.totalTrade },
  ]

  const challengeDone = data.challengeProgress >= data.challenge.target
  const challengeMsLeft = new Date(endOfWeekISO()).getTime() - Date.now()
  const L = DD_TEXT[lang] || DD_TEXT.en

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
            <h1 className="dd-name">{data.displayName}</h1>
          </div>
        </div>
        {data.streak > 0 && (
          <div className="dd-streak">
            {t(data.streak === 1 ? 'dashboard_streak_one' : 'dashboard_streak_other').replace('{n}', String(data.streak))}
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
        <div className="dd-hero-r holo-light holo-tilt">
          {(data.lastCards || []).length
            // eventail : de l'arriere (3e carte) vers l'avant (la plus recente)
            ? [...(data.lastCards || [])].slice(0, 3).map((c, i) => ({ c, i })).reverse().map(({ c, i }) => (
                <img key={i} src={c.image} alt="" className={`dd-hero-card dd-fan-${i}${heroLandscape[i] ? ' dd-hero-card--h' : ''}`}
                  onLoad={e => { const land = e.currentTarget.naturalWidth > e.currentTarget.naturalHeight; setHeroLandscape(p => p[i] === land ? p : { ...p, [i]: land }) }} />
              ))
            : <div className="dd-hero-card dd-hero-card--empty" />}
          <span className="dd-hero-go"><ChevronIcon /></span>
        </div>
      </Link>

      <div className="dd-score">
        {galleryStats.map(s => (
          <div key={s.label}>
            <b className="da-num">{s.val}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="dd-actions">
        <Link href="/scanner" onClick={hapticTap} className="dd-act">{t('nav_scanner')}</Link>
        <Link href={`${galleryHref}/ajouter`} onClick={hapticTap} className="dd-act">{L.add}</Link>
        <Link href="/trades" onClick={hapticTap} className="dd-act">{t('nav_trades')}</Link>
      </div>

      {activityItems.length > 0 && (
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
      )}

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

      <h2 className="dd-h dd-h--site">{t('dashboard_site_stats_title')}</h2>
      <div className="dd-site">
        {siteStatsList.map(s => (
          <div key={s.label}>
            <b className="da-num">{s.val.toLocaleString()}</b>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
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

// Style du tableau de bord (nouvelle DA) : pose directement sur le fond de la
// page, cadres epais a angles droits, Surfquest pour les gros chiffres. Les
// cartes (image) restent a coins nets.
const DD_CSS = `
.dd { max-width: 1180px; margin: 0 auto; padding: 4px 0 28px; color: var(--text); }
.dd a { text-decoration: none; color: inherit; }
.dd-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 16px 14px; flex-wrap: wrap; }
.dd-who { display: flex; align-items: center; gap: 14px; min-width: 0; }
.dd-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 3px solid var(--text); }
.dd-avatar--ph { display: grid; place-items: center; background: #003da6; color: #fff; font-weight: 900; font-size: 22px; }
.dd-kicker { font: 800 12px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--text2); }
.dd-name { font-size: clamp(34px, 5vw, 56px); line-height: .95; margin: 2px 0 0; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dd-streak { font: 800 12px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; border: 3px solid var(--text); padding: 7px 12px; }
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
.dd-fan-0 { transform: rotate(7deg); z-index: 3; }
.dd-fan-1 { transform: translateX(-40%) rotate(-3deg); z-index: 2; }
.dd-fan-2 { transform: translateX(-80%) rotate(-12deg); z-index: 1; }
@media (max-width: 560px) { .dd-fan-1 { transform: translateX(-30%) rotate(-3deg); } .dd-fan-2 { transform: translateX(-60%) rotate(-12deg); } }
.dd-hero-card--empty { background: rgba(255,255,255,.1); border: 2px dashed rgba(255,255,255,.35); }
.dd-hero-go { position: absolute; top: 14px; right: 14px; color: rgba(255,255,255,.85); }
.dd-score { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 16px 14px; border: 3px solid var(--text); background: var(--card-bg); }
.dd-score > div { text-align: center; padding: 14px 6px 10px; border-right: 2px solid var(--border); }
.dd-score > div:last-child { border-right: 0; }
.dd-score b, .dd-site b { display: block; font-size: clamp(36px, 6vw, 72px); line-height: 1; color: var(--text); font-weight: 400; }
.dd-score span, .dd-site span { display: block; margin-top: 4px; font: 800 12px system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; color: var(--text2); }
.dd-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 16px 14px; }
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
