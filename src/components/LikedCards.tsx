'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface LikedCard {
  card_key: string
  gallery_user_id: string
  gallery_name: string
  created_at: string
}

export default function LikedCards({ userId }: { userId: string }) {
  const [items, setItems] = useState<LikedCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: likes } = await supabase
        .from('card_likes')
        .select('card_key, gallery_user_id, created_at')
        .eq('liker_user_id', userId)
        .order('created_at', { ascending: false })

      if (!likes?.length) { setItems([]); setLoading(false); return }

      const galleryIds = [...new Set(likes.map(l => l.gallery_user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', galleryIds)
      const names = new Map((profiles || []).map(p => [p.id, p.display_name || 'Collectionneur']))

      setItems(likes.map(l => ({ ...l, gallery_name: names.get(l.gallery_user_id) || 'Collectionneur' })))
      setLoading(false)
    })()
  }, [userId])

  const unlike = async (item: LikedCard) => {
    setItems(prev => prev.filter(i => !(i.card_key === item.card_key && i.gallery_user_id === item.gallery_user_id)))
    await supabase.from('card_likes').delete()
      .eq('card_key', item.card_key).eq('gallery_user_id', item.gallery_user_id).eq('liker_user_id', userId)
  }

  if (loading) return <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>Chargement...</p>

  if (items.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🤍</div>
      <p style={{ fontWeight: 700, fontSize: 16 }}>Aucune carte aimée pour le moment</p>
      <p style={{ fontSize: 13, marginTop: 4 }}>Likez des cartes dans les galeries pour les retrouver ici</p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
      {items.map(item => (
        <div key={`${item.gallery_user_id}-${item.card_key}`} style={{
          background: 'white', borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0',
        }}>
          <Link href={`/galerie/${item.gallery_user_id}`} style={{ display: 'block' }}>
            <img src={item.card_key} alt="" style={{ width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', display: 'block', background: '#f5f5f5' }} />
          </Link>
          <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <Link href={`/galerie/${item.gallery_user_id}`} style={{ fontSize: 12, fontWeight: 700, color: '#003DA6', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.gallery_name}
            </Link>
            <button onClick={() => unlike(item)} title="Retirer le like" style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, flexShrink: 0, opacity: 0.6,
            }}>
              ❤️
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
