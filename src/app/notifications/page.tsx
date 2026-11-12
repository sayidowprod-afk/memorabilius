'use client'
import RelTime from '@/components/RelTime'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import { useLang, localeFor } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import SkeletonBlock from '@/components/SkeletonBlock'
import EmptyState from '@/components/EmptyState'
import PushNotificationSettings from '@/components/PushNotificationSettings'

export default function Notifications() {
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [avatars, setAvatars] = useState<Record<string, string | null>>({})
  const [open, setOpen] = useState<Set<string>>(new Set())

  useEffect(() => {
    // try/finally + withTimeout : voir withTimeout.ts -- evite que la page se
    // bloque sur son skeleton pour toujours en cas de rejet ou de requete qui
    // ne resout jamais.
    (async () => {
      try {
        await withTimeout((async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { router.replace('/connexion'); return }
          const data = { user: session.user }
          const { data: n } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false })
            .limit(50)
          setNotifs(n || [])
          // Tout marquer comme lu
          await supabase.from('notifications').update({ lu: true }).eq('user_id', data.user.id).eq('lu', false)
        })(), 8000, undefined)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      team_join: '👥', team_candidature: '📋', message: '💬', trade: '🔄', system: '🔔', wishlist_match: '🎯', comment: '💬', badge: '🏆', like: '❤️'
    }
    return icons[type] || '🔔'
  }

  const getColor = (type: string) => {
    const c: Record<string, string> = {
      team_join: '#7a3fbf', team_candidature: '#7a3fbf', message: '#2f6bff', trade: '#2f6bff', system: '#5b6b8c',
      wishlist_match: '#e67e22', comment: '#2f6bff', badge: '#e9b44c', like: '#e63a6e',
    }
    return c[type] || '#5b6b8c'
  }

  const dateGroupLabel = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate())
    const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000)
    if (diffDays === 0) return 'Aujourd\'hui'
    if (diffDays === 1) return 'Hier'
    if (diffDays < 7) return d.toLocaleDateString(localeFor(lang), { weekday: 'long' })
    return d.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'long' })
  }

  // 797 · plusieurs « j’aime » sur la même carte le même jour = une seule ligne (« Alex, Julie et 18 autres ont aimé votre carte »)
  const likerOf = (n: any): string | null => (n.type === 'like' && n.lien ? (String(n.message || '').match(/^(.+) a aimé votre carte$/)?.[1] || null) : null)
  const items = useMemo(() => {
    type Group = { kind: 'group'; key: string; list: any[]; names: string[] }
    const out: ({ kind: 'one'; n: any } | Group)[] = []
    const groups = new Map<string, Group>()
    for (const n of notifs) {
      const who = likerOf(n)
      if (!who) { out.push({ kind: 'one', n }); continue }
      const key = n.lien + '|' + new Date(n.created_at).toDateString()
      let g = groups.get(key)
      if (!g) { g = { kind: 'group', key, list: [], names: [] }; groups.set(key, g); out.push(g) }
      g.list.push(n); if (!g.names.includes(who)) g.names.push(who)
    }
    // un groupe d’une seule personne redevient une notification normale
    return out.map(it => (it.kind === 'group' && it.list.length < 2 ? { kind: 'one' as const, n: it.list[0] } : it))
  }, [notifs]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const names = [...new Set(items.flatMap(it => (it.kind === 'group' ? it.names.slice(0, 3) : [])))]
    if (!names.length) return
    supabase.from('profiles').select('display_name, avatar_url').in('display_name', names).limit(60).then(({ data }) => {
      const m: Record<string, string | null> = {}
      for (const p of data || []) m[p.display_name] = p.avatar_url || null
      setAvatars(m)
    })
  }, [items])
  const initials = (name: string) => name.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const stackStyle = (i: number): React.CSSProperties => ({ width: 28, height: 28, borderRadius: '50%', marginLeft: i ? -9 : 0, border: '2px solid var(--bg, #070b18)', overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#1e63e0,#00307e)', color: '#fff', font: '800 10px system-ui', zIndex: 3 - i })
  const AvatarStack = ({ names }: { names: string[] }) => (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {names.slice(0, 3).map((nm, i) => (
        <span key={nm} style={stackStyle(i)}>
          {avatars[nm]
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatars[nm] as string} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initials(nm)}
        </span>
      ))}
      {names.length > 3 && <span style={{ ...stackStyle(3), background: '#243063', fontSize: 9 }}>+{names.length - 3}</span>}
    </div>
  )
  const groupText = (names: string[]) => (names.length === 2 ? names[0] + ' et ' + names[1] : names[0] + ', ' + names[1] + ' et ' + (names.length - 2) + ' autre' + (names.length - 2 > 1 ? 's' : '')) + ' ont aimé votre carte'
  const toggle = (key: string) => setOpen(prev => { const nx = new Set(prev); if (nx.has(key)) nx.delete(key); else nx.add(key); return nx })

  if (loading) return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SkeletonBlock style={{ height: 28, width: 180, marginBottom: 14 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0' }}>
          <SkeletonBlock style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBlock style={{ height: 12, width: `${50 + (i % 3) * 15}%` }} />
            <SkeletonBlock style={{ height: 10, width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif', padding: '0 16px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('notif_title')}</h1>
        <PushNotificationSettings dark={dark} />
      </div>

      {notifs.length === 0 ? (
        <EmptyState icon="🔔" title={t('notif_none')} />
      ) : (
        <div className="notif-list">
          {items.map((it, i) => {
            const first = it.kind === 'one' ? it.n : it.list[0]
            const prev = items[i - 1]
            const prevFirst = prev ? (prev.kind === 'one' ? prev.n : prev.list[0]) : null
            const label = dateGroupLabel(first.created_at)
            const showHeader = i === 0 || dateGroupLabel(prevFirst.created_at) !== label
            if (it.kind === 'group') {
              const expanded = open.has(it.key)
              const unread = it.list.some(x => !x.lu)
              return (
                <div key={it.key} style={{ display: 'contents' }}>
                  {showHeader && <div className="notif-day">{label}<span /></div>}
                  <div className={'notif-banner link' + (unread ? ' unread' : '')} style={{ ['--c' as string]: getColor('like') }}
                    role="button" tabIndex={0} aria-expanded={expanded}
                    onClick={() => toggle(it.key)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(it.key) } }}>
                    <AvatarStack names={it.names} />
                    <div className="notif-tx">
                      <p className="m">{groupText(it.names)}</p>
                      <p className="t"><RelTime iso={first.created_at} />{unread && <b>Nouveau</b>}<span style={{ marginLeft: 8, opacity: .7 }}>{expanded ? '▴ Réduire' : '▾ Détail'}</span></p>
                      {expanded && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {it.list.map(x => <div key={x.id} style={{ fontSize: 13, opacity: .85 }}>{x.message}</div>)}
                          <a href={it.list[0].lien} onClick={e => { e.preventDefault(); e.stopPropagation(); router.push(it.list[0].lien) }} style={{ fontSize: 13, fontWeight: 800 }}>Voir la carte →</a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            }
            const n = it.n
            return (
              <div key={n.id} style={{ display: 'contents' }}>
                {showHeader && <div className="notif-day">{label}<span /></div>}
                <div
                  onClick={() => n.lien && router.push(n.lien)}
                  role={n.lien ? 'button' : undefined}
                  tabIndex={n.lien ? 0 : undefined}
                  onKeyDown={e => { if (n.lien && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); router.push(n.lien) } }}
                  aria-label={!n.lu ? t('notif_unread_label') + ' — ' + n.message : n.message}
                  className={'notif-banner' + (n.lu ? '' : ' unread') + (n.lien ? ' link' : '')}
                  style={{ ['--c' as string]: getColor(n.type) }}
                >
                  <div className="notif-ic" aria-hidden="true">{getIcon(n.type)}</div>
                  <div className="notif-tx">
                    <p className="m">{n.message}</p>
                    <p className="t"><RelTime iso={n.created_at} />{!n.lu && <b>Nouveau</b>}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
