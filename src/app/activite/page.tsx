'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang, localeFor } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { useAuth } from '@/lib/AuthContext'

interface ActivityItem {
  id_manuelle: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  slug: string | null
  nom: string | null
  equipe: string | null
  annee: string | null
  image_recto: string | null
  created_at: string
}

function timeAgo(iso: string, t: ReturnType<typeof useLang>['t']): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return t('activity_just_now')
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} j`
  return new Date(iso).toLocaleDateString()
}

export default function ActivitePage() {
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const { user } = useAuth()
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!user) { setItems([]); return }
    let cancelled = false
    supabase.rpc('get_following_activity', { p_user_id: user.id, p_limit: 40 }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) { setError(true); setItems([]); return }
      setItems(data || [])
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Evenements : les ajouts d'un meme collectionneur le meme jour sont regroupes (une entree, plusieurs miniatures)
  const events = (() => {
    const out: { key: string; user: ActivityItem; items: ActivityItem[] }[] = []
    for (const it of items || []) {
      const day = new Date(it.created_at)
      const key = `${it.user_id}|${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(it)
      else out.push({ key, user: it, items: [it] })
    }
    return out
  })()

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 14px 90px', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4, color: 'var(--text, #121212)' }}>
        {t('activity_title')}
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text3, #999)', marginBottom: 20 }}>
        {t('activity_subtitle')}
      </p>

      {!user ? (
        <p style={{ textAlign: 'center', color: 'var(--text3, #999)', fontSize: 14, padding: '40px 10px' }}>
          {t('activity_login_required')}
        </p>
      ) : items === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: dark ? '#2a2a2a' : '#eee', flexShrink: 0 }} />
              <div style={{ flex: 1, height: 14, borderRadius: 4, background: dark ? '#2a2a2a' : '#eee' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <p style={{ textAlign: 'center', color: 'var(--text3, #999)', fontSize: 14, padding: '40px 10px' }}>
          {t('activity_error')}
        </p>
      ) : items.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text3, #999)', fontSize: 14, padding: '40px 10px' }}>
          {t('activity_empty')}
        </p>
      ) : (
        <div className="tl-feed">
          {events.map(ev => {
            const u = ev.user
            const first = ev.items[0]
            const gal = `/galerie/${u.slug || u.user_id}`
            const n = ev.items.length
            const d = new Date(first.created_at)
            return (
              <div className="tl-ev" key={ev.key}>
                <div className="tl-date da-display">
                  {d.toLocaleDateString(localeFor(lang), { day: '2-digit', month: 'short' }).replace('.', '')}
                  <small>{timeAgo(first.created_at, t)}</small>
                </div>
                <div className="tl-body">
                  <Link href={gal} className="tl-who">
                    <img
                      src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || 'U')}&background=003DA6&color=fff`}
                      loading="lazy" width={32} height={32} alt=""
                    />
                    <span>
                      <b>{u.display_name || 'Collectionneur'}</b>{' '}
                      <span className="tl-act">{t('activity_added')}</span>{' '}
                      <b>{n > 1 ? `${n} ${t('gallery_cards').toLowerCase()}` : (first.nom || t('activity_a_card'))}</b>
                      {n === 1 && first.equipe && <span className="tl-act"> · {first.equipe}</span>}
                      {n === 1 && first.annee && <span className="tl-act"> · {first.annee}</span>}
                    </span>
                  </Link>
                  <div className="tl-th">
                    {ev.items.slice(0, 6).map(it => it.image_recto && (
                      <Link key={it.id_manuelle} href={`${gal}?card=${encodeURIComponent(it.image_recto)}`} aria-label={it.nom || ''}>
                        <img src={it.image_recto} loading="lazy" alt="" />
                      </Link>
                    ))}
                    {n > 6 && <span className="tl-more">+{n - 6}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .activity-row:hover { background: var(--bg3, #f7f7f7); }
      `}</style>
    </div>
  )
}
