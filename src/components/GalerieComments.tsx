'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Comment {
  id: string
  message: string
  created_at: string
  author_id: string
  profiles: { display_name: string; avatar_url: string | null; slug: string | null } | null
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

export default function GalerieComments({ galerieUserId, accent, isOwner }: { galerieUserId: string; accent: string; isOwner: boolean }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [message, setMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
    load()
  }, [galerieUserId])

  const load = async () => {
    const { data } = await supabase
      .from('galerie_comments')
      .select('*, profiles(display_name, avatar_url, slug)')
      .eq('galerie_user_id', galerieUserId)
      .order('created_at', { ascending: false })
      .limit(50)
    setComments((data || []) as Comment[])
  }

  const send = async () => {
    if (!message.trim() || !currentUserId) return
    setSending(true)
    const { data } = await supabase
      .from('galerie_comments')
      .insert({ galerie_user_id: galerieUserId, author_id: currentUserId, message: message.trim() })
      .select('*, profiles(display_name, avatar_url, slug)')
      .single()
    if (data) setComments(prev => [data as Comment, ...prev])
    setMessage('')
    setSending(false)
  }

  const remove = async (id: string) => {
    await supabase.from('galerie_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {currentUserId && !isOwner && (
        <div style={{ marginBottom: 20, background: 'white', borderRadius: 14, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Laisser un commentaire..."
            maxLength={500}
            rows={3}
            style={{
              width: '100%', border: '1px solid #eee', borderRadius: 10, padding: '10px 14px',
              fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>{message.length}/500</span>
            <button onClick={send} disabled={sending || !message.trim()} style={{
              background: message.trim() ? accent : '#ddd', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 20px', fontWeight: 800, fontSize: 13, cursor: message.trim() ? 'pointer' : 'default',
            }}>
              {sending ? 'Envoi...' : 'Commenter'}
            </button>
          </div>
        </div>
      )}

      {!currentUserId && (
        <div style={{ textAlign: 'center', padding: '20px', marginBottom: 20, background: '#f8f8f8', borderRadius: 12 }}>
          <span style={{ fontSize: 13, color: '#999' }}>
            <Link href="/connexion" style={{ color: accent, fontWeight: 700 }}>Connectez-vous</Link> pour laisser un commentaire
          </span>
        </div>
      )}

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ccc' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <p style={{ fontWeight: 700 }}>Aucun commentaire</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Soyez le premier à commenter cette galerie</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              background: 'white', borderRadius: 12, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <Link href={`/galerie/${c.profiles?.slug || c.author_id}`}>
                {c.profiles?.avatar_url
                  ? <img src={c.profiles.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                }
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Link href={`/galerie/${c.profiles?.slug || c.author_id}`} style={{ fontWeight: 800, fontSize: 13, color: '#333', textDecoration: 'none' }}>
                    {c.profiles?.display_name || 'Collectionneur'}
                  </Link>
                  <span style={{ fontSize: 11, color: '#bbb' }}>{timeAgo(c.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.5, wordBreak: 'break-word' }}>{c.message}</p>
              </div>
              {(isOwner || currentUserId === c.author_id) && (
                <button onClick={() => remove(c.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#ddd',
                  fontSize: 16, flexShrink: 0, padding: 4, lineHeight: 1,
                }} title="Supprimer">✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
