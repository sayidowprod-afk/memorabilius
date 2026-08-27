'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
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
  const { t } = useLang()
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(item => (
            <Link
              key={item.id_manuelle}
              href={`/galerie/${item.slug || item.user_id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 10,
                textDecoration: 'none', color: 'var(--text, #121212)',
              }}
              className="activity-row"
            >
              <img
                src={item.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.display_name || 'U')}&background=003DA6&color=fff`}
                loading="lazy" width={40} height={40} alt=""
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
                  <b>{item.display_name || 'Collectionneur'}</b>{' '}
                  <span style={{ color: 'var(--text3, #999)' }}>{t('activity_added')}</span>{' '}
                  <b>{item.nom || t('activity_a_card')}</b>
                  {item.equipe && <span style={{ color: 'var(--text3, #999)' }}> · {item.equipe}</span>}
                  {item.annee && <span style={{ color: 'var(--text3, #999)' }}> · {item.annee}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3, #aaa)', marginTop: 2 }}>{timeAgo(item.created_at, t)}</div>
              </div>
              {item.image_recto && (
                <img src={item.image_recto} loading="lazy" alt=""
                  style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}
                />
              )}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .activity-row:hover { background: var(--bg3, #f7f7f7); }
      `}</style>
    </div>
  )
}
