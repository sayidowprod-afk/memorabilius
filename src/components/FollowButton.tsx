'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { hapticTap } from '@/lib/haptics'

export default function FollowButton({ targetUserId, accent }: { targetUserId: string; accent: string }) {
  const { t } = useLang()
  const [userId, setUserId] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      const [{ count }, followRow] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', targetUserId),
        uid
          ? supabase.from('follows').select('id').eq('follower_id', uid).eq('followed_id', targetUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (cancelled) return
      setUserId(uid)
      setFollowerCount(count ?? 0)
      setFollowing(!!followRow.data)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [targetUserId])

  const toggle = async () => {
    if (!userId || busy) return
    hapticTap()
    setBusy(true)
    if (following) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('followed_id', targetUserId)
      if (!error) { setFollowing(false); setFollowerCount(c => Math.max(0, (c ?? 1) - 1)) }
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: userId, followed_id: targetUserId })
      if (!error) { setFollowing(true); setFollowerCount(c => (c ?? 0) + 1) }
    }
    setBusy(false)
  }

  if (!ready || !userId || userId === targetUserId) return null

  return (
    <button onClick={toggle} disabled={busy} style={{
      display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
      color: following ? accent : 'white', background: following ? 'transparent' : accent,
      border: following ? `1.5px solid ${accent}` : 'none',
      padding: '5px 12px', borderRadius: 20, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
    }}>
      {following ? t('gallery_following') : t('gallery_follow')}
      {followerCount != null && followerCount > 0 && (
        <span style={{ opacity: 0.75, fontWeight: 600 }}>· {followerCount}</span>
      )}
    </button>
  )
}
