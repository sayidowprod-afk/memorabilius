'use client'
import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

// Compteurs cliquables "X abonnés · Y abonnements" (style Instagram) placés sous le
// nom du profil — ouvrent FollowListModal via onOpenList.
export default function FollowCounts({ userId, onOpenList }: {
  userId: string
  onOpenList: (tab: 'followers' | 'following') => void
}) {
  const { t } = useLang()
  const [followers, setFollowers] = useState<number | null>(null)
  const [following, setFollowing] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]).then(([f, g]) => {
      if (cancelled) return
      setFollowers(f.count ?? 0)
      setFollowing(g.count ?? 0)
    })
    return () => { cancelled = true }
  }, [userId])

  if (followers === null || following === null) return null
  if (followers === 0 && following === 0) return null

  const btnStyle: CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    fontSize: 12.5, fontWeight: 700, color: 'var(--text2, #555)',
  }

  return (
    <div style={{ display: 'flex', gap: 14, marginTop: 2, marginBottom: 4 }}>
      <button onClick={() => onOpenList('followers')} style={btnStyle}>
        <b>{followers}</b> {t('follow_count_followers')}
      </button>
      <button onClick={() => onOpenList('following')} style={btnStyle}>
        <b>{following}</b> {t('follow_count_following')}
      </button>
    </div>
  )
}
