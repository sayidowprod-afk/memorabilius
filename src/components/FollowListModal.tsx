'use client'
import { useEffect, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import FollowButton from './FollowButton'

interface FollowProfile { id: string; display_name: string | null; avatar_url: string | null }

export default function FollowListModal({ userId, initialTab, onClose, accent }: {
  userId: string
  initialTab: 'followers' | 'following'
  onClose: () => void
  accent: string
}) {
  const titleId = useId()
  const { t } = useLang()
  const { dark } = useTheme()
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab)
  const [loading, setLoading] = useState(true)
  const [followers, setFollowers] = useState<FollowProfile[] | null>(null)
  const [following, setFollowing] = useState<FollowProfile[] | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const already = tab === 'followers' ? followers : following
    if (already !== null) return
    let cancelled = false
    setLoading(true)
    const query = tab === 'followers'
      ? supabase.from('follows').select('profiles!follows_follower_id_fkey(id, display_name, avatar_url)').eq('followed_id', userId).order('created_at', { ascending: false })
      : supabase.from('follows').select('profiles!follows_followed_id_fkey(id, display_name, avatar_url)').eq('follower_id', userId).order('created_at', { ascending: false })
    query.then(({ data }) => {
      if (cancelled) return
      const profiles = (data || []).map((r: any) => r.profiles).filter(Boolean) as FollowProfile[]
      if (tab === 'followers') setFollowers(profiles); else setFollowing(profiles)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [tab, userId, followers, following])

  const list = tab === 'followers' ? followers : following

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg, #fff)', color: 'var(--text, #121212)', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 0' }}>
          <h3 id={titleId} style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>
            {tab === 'followers' ? t('follow_followers_title') : t('follow_following_title')}
          </h3>
          <button onClick={onClose} aria-label={t('comments_close')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text3, #999)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '14px 18px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
          {(['followers', 'following'] as const).map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 0 10px', fontWeight: 800, fontSize: 13,
              color: tab === tb ? accent : 'var(--text3, #999)',
              borderBottom: tab === tb ? `2px solid ${accent}` : '2px solid transparent',
            }}>
              {tb === 'followers' ? t('follow_followers_tab') : t('follow_following_tab')}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 10px 14px' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 8px' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: dark ? '#2a2a2a' : '#eee', flexShrink: 0 }} />
                  <div style={{ height: 12, width: `${40 + (i % 3) * 15}%`, borderRadius: 4, background: dark ? '#2a2a2a' : '#eee' }} />
                </div>
              ))}
            </div>
          ) : (list?.length ?? 0) === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text3, #999)', fontSize: 13, padding: '30px 10px' }}>
              {tab === 'followers' ? t('follow_no_followers') : t('follow_no_following')}
            </p>
          ) : (
            list!.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px' }}>
                <Link href={`/galerie/${p.id}`} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, textDecoration: 'none' }}>
                  <img
                    src={p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.display_name || 'U')}&background=003DA6&color=fff`}
                    loading="lazy" width={40} height={40}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${dark ? '#333' : '#eee'}`, flexShrink: 0 }}
                    alt={p.display_name || ''}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text, #121212)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.display_name || 'Collectionneur'}
                  </span>
                </Link>
                <FollowButton targetUserId={p.id} accent={accent} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
