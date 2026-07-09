'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

const EMOJIS = [
  '😀','😂','🥰','😍','🤩','😎','🥳','🤯','😮','🔥',
  '👏','🙌','💪','👍','❤️','💎','✨','🏆','🎯','🃏',
  '🏀','⚽','🏈','⚾','🎾','🏒','🥊','🎱','🏅','🥇',
  '😤','💯','🤝','👀','😅','🤣','😭','🫡','🫶','🙏',
]

function EmojiPicker({ onPick, accent, dark }: { onPick: (e: string) => void; accent: string; dark: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const popupBg = dark ? '#2a2a2a' : 'white'
  const popupBorder = dark ? '#3a3a3a' : '#eee'
  const hoverBg = dark ? '#3a3a3a' : '#f5f5f5'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: `1px solid ${popupBorder}`, borderRadius: 8,
        padding: '5px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1,
        color: open ? accent : (dark ? '#888' : '#aaa'),
      }} title="Emojis">😊</button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '110%', left: 0, zIndex: 100,
          background: popupBg, borderRadius: 12, padding: 10,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', border: `1px solid ${popupBorder}`,
          display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 2, width: 280,
        }}>
          {EMOJIS.map(e => (
            <button key={e} type="button" onClick={() => { onPick(e); setOpen(false) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, padding: '4px', borderRadius: 6, lineHeight: 1,
              transition: '0.1s',
            }}
            onMouseEnter={ev => (ev.currentTarget.style.background = hoverBg)}
            onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
            >{e}</button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Profile { display_name: string; avatar_url: string | null; slug: string | null }
interface CommentRow {
  id: string; message: string; created_at: string
  author_id: string; parent_id: string | null
  profiles: Profile | null
}
interface Comment extends CommentRow {
  likes: number; liked: boolean; replies: Comment[]
}

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l\'instant'
  if (mins < 60) return `Il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours}h`
  return `Il y a ${Math.floor(hours / 24)}j`
}

const Avatar = ({ profile, accent, size = 36 }: { profile: Profile | null; accent: string; size?: number }) => (
  profile?.avatar_url
    ? <img src={profile.avatar_url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44, flexShrink: 0 }}>👤</div>
)

function CommentItem({
  comment, accent, currentUserId, isOwner, onDelete, onLike, onReply, depth = 0, dark
}: {
  comment: Comment; accent: string; currentUserId: string | null
  isOwner: boolean; onDelete: (id: string) => void
  onLike: (id: string, liked: boolean) => void
  onReply: (parentId: string, message: string) => void
  depth?: number; dark: boolean
}) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyMsg, setReplyMsg] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!replyMsg.trim()) return
    setSending(true)
    await onReply(comment.id, replyMsg.trim())
    setReplyMsg('')
    setReplyOpen(false)
    setSending(false)
  }

  const bg = dark ? '#333333' : 'white'
  const border = dark ? '#444' : '#f0f0f0'
  const textMain = dark ? '#ffffff' : '#333'
  const textBody = dark ? '#e0e0e0' : '#444'
  const textMuted = dark ? '#999' : '#bbb'

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Link href={`/galerie/${comment.profiles?.slug || comment.author_id}`}>
        <Avatar profile={comment.profiles} accent={accent} size={depth > 0 ? 28 : 36} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: bg, borderRadius: 12, padding: '10px 14px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)', border: `1px solid ${border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link href={`/galerie/${comment.profiles?.slug || comment.author_id}`} style={{ fontWeight: 800, fontSize: 13, color: textMain, textDecoration: 'none' }}>
                {comment.profiles?.display_name || 'Collectionneur'}
              </Link>
              <span style={{ fontSize: 11, color: textMuted }}>{timeAgo(comment.created_at)}</span>
            </div>
            {(isOwner || currentUserId === comment.author_id) && (
              <button onClick={() => onDelete(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, fontSize: 14, padding: '0 2px', lineHeight: 1 }}>✕</button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: textBody, lineHeight: 1.5, wordBreak: 'break-word' }}>{comment.message}</p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4 }}>
          <button onClick={() => currentUserId && onLike(comment.id, comment.liked)} style={{
            background: 'none', border: 'none', cursor: currentUserId ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 12, fontWeight: 700,
            color: comment.liked ? '#e74c3c' : textMuted,
            padding: 0,
          }}>
            {comment.liked ? '❤️' : '🤍'} {comment.likes > 0 && comment.likes}
          </button>
          {currentUserId && depth === 0 && (
            <button onClick={() => setReplyOpen(!replyOpen)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, color: replyOpen ? accent : textMuted, padding: 0,
            }}>
              Répondre
            </button>
          )}
        </div>

        {/* Formulaire réponse */}
        {replyOpen && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input
              autoFocus
              value={replyMsg}
              onChange={e => setReplyMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } if (e.key === 'Escape') setReplyOpen(false) }}
              placeholder="Votre réponse..."
              maxLength={500}
              style={{
                flex: 1, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 12px',
                fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
                background: bg, color: textMain,
              }}
            />
            <button onClick={send} disabled={sending || !replyMsg.trim()} style={{
              background: replyMsg.trim() ? accent : '#555', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontWeight: 800, fontSize: 12, cursor: replyMsg.trim() ? 'pointer' : 'default', flexShrink: 0,
            }}>↩</button>
          </div>
        )}

        {/* Réponses */}
        {comment.replies.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {comment.replies.map(reply => (
              <CommentItem key={reply.id} comment={reply} accent={accent} currentUserId={currentUserId}
                isOwner={isOwner} onDelete={onDelete} onLike={onLike} onReply={onReply} depth={1} dark={dark} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function GalerieComments({ galerieUserId, accent, isOwner, cardKey, binderId, notifyUserId, emptyLabel }: {
  galerieUserId: string; accent: string; isOwner: boolean
  cardKey?: string; binderId?: number; notifyUserId?: string; emptyLabel?: string
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [message, setMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { dark } = useTheme()

  const bg = dark ? '#333333' : 'white'
  const border = dark ? '#444' : '#f0f0f0'
  const textMain = dark ? '#ffffff' : '#333'
  const textMuted = dark ? '#999' : '#bbb'

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) { setMessage(m => m + emoji); return }
    const start = el.selectionStart ?? message.length
    const end = el.selectionEnd ?? message.length
    const next = message.slice(0, start) + emoji + message.slice(end)
    setMessage(next)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null))
    load()
  }, [galerieUserId, cardKey, binderId])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id || null

    let query = supabase.from('galerie_comments')
      .select('id, message, created_at, author_id, parent_id')
      .order('created_at', { ascending: true })
    if (binderId) query = query.eq('binder_id', binderId)
    else if (cardKey) query = query.eq('galerie_user_id', galerieUserId).eq('card_key', cardKey)
    else query = query.eq('galerie_user_id', galerieUserId).is('card_key', null).is('binder_id', null)

    const [{ data: rows }, { data: likes }] = await Promise.all([
      query,
      supabase.from('galerie_comment_likes').select('comment_id, user_id'),
    ])

    if (!rows) return

    // Fetch profiles separately
    const authorIds = [...new Set(rows.map((r: any) => r.author_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, slug')
      .in('id', authorIds)
    const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]))

    const likesByComment = new Map<string, { count: number; liked: boolean }>()
    for (const l of likes || []) {
      const e = likesByComment.get(l.comment_id) || { count: 0, liked: false }
      e.count++
      if (l.user_id === uid) e.liked = true
      likesByComment.set(l.comment_id, e)
    }

    const allComments: Comment[] = rows.map((r: any) => ({
      ...r,
      profiles: profileMap.get(r.author_id) || null,
      likes: likesByComment.get(r.id)?.count || 0,
      liked: likesByComment.get(r.id)?.liked || false,
      replies: [],
    }))

    const map = new Map(allComments.map(c => [c.id, c]))
    const roots: Comment[] = []
    for (const c of allComments) {
      if (c.parent_id && map.has(c.parent_id)) map.get(c.parent_id)!.replies.push(c)
      else if (!c.parent_id) roots.push(c)
    }
    setComments(roots.reverse())
  }

  const getMyName = async () => {
    if (!currentUserId) return 'Quelqu\'un'
    const { data } = await supabase.from('profiles').select('display_name').eq('id', currentUserId).single()
    return data?.display_name || 'Quelqu\'un'
  }

  // Renvoie directement sur la carte/le classeur commenté, pas juste l'onglet commentaires général
  const commentLink = () => {
    if (binderId) return `/galerie/${galerieUserId}?tab=library&binder=${binderId}`
    if (cardKey) return `/galerie/${galerieUserId}?card=${encodeURIComponent(cardKey)}`
    return `/galerie/${galerieUserId}?tab=comments`
  }

  const send = async () => {
    if (!message.trim() || !currentUserId) return
    setSending(true)
    await supabase.from('galerie_comments').insert({
      galerie_user_id: galerieUserId, author_id: currentUserId, message: message.trim(),
      card_key: cardKey || null, binder_id: binderId || null,
    })
    // Notifier le propriétaire (pas si c'est lui qui commente)
    const target = notifyUserId ?? galerieUserId
    if (currentUserId !== target) {
      const name = await getMyName()
      const what = binderId ? 'votre classeur' : cardKey ? 'votre carte' : 'votre galerie'
      await supabase.from('notifications').insert({
        user_id: target, type: 'comment', lu: false,
        message: `${name} a commenté ${what} : "${message.trim().slice(0, 60)}${message.length > 60 ? '…' : ''}"`,
        lien: commentLink(),
      })
    }
    setMessage('')
    setSending(false)
    load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('galerie_comments').delete().eq('id', id)
    load()
  }

  const handleLike = async (id: string, liked: boolean) => {
    if (!currentUserId) return
    if (liked) await supabase.from('galerie_comment_likes').delete().eq('comment_id', id).eq('user_id', currentUserId)
    else await supabase.from('galerie_comment_likes').insert({ comment_id: id, user_id: currentUserId })
    setComments(prev => {
      const toggle = (cs: Comment[]): Comment[] => cs.map(c => {
        if (c.id === id) return { ...c, liked: !liked, likes: c.likes + (liked ? -1 : 1) }
        return { ...c, replies: toggle(c.replies) }
      })
      return toggle(prev)
    })
  }

  const handleReply = async (parentId: string, msg: string) => {
    if (!currentUserId) return
    await supabase.from('galerie_comments').insert({
      galerie_user_id: galerieUserId, author_id: currentUserId, message: msg, parent_id: parentId,
      card_key: cardKey || null, binder_id: binderId || null,
    })
    // Notifier l'auteur du commentaire parent (pas si c'est soi-même)
    const parentComment = comments.find(c => c.id === parentId) || comments.flatMap(c => c.replies).find(c => c.id === parentId)
    if (parentComment && parentComment.author_id !== currentUserId) {
      const name = await getMyName()
      await supabase.from('notifications').insert({
        user_id: parentComment.author_id, type: 'comment', lu: false,
        message: `${name} a répondu à votre commentaire : "${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}"`,
        lien: commentLink(),
      })
    }
    load()
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      {currentUserId && (
        <div style={{ marginBottom: 20, background: bg, borderRadius: 14, padding: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.1)', border: `1px solid ${border}` }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Laisser un commentaire..."
            maxLength={500}
            rows={3}
            style={{
              width: '100%', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 14px',
              fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'vertical',
              outline: 'none', boxSizing: 'border-box',
              background: dark ? '#2a2a2a' : 'white', color: textMain,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <EmojiPicker onPick={insertEmoji} accent={accent} dark={dark} />
              <span style={{ fontSize: 11, color: textMuted }}>{message.length}/500</span>
            </div>
            <button onClick={send} disabled={sending || !message.trim()} style={{
              background: message.trim() ? accent : (dark ? '#444' : '#ddd'), color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 20px', fontWeight: 800, fontSize: 13, cursor: message.trim() ? 'pointer' : 'default',
            }}>
              {sending ? 'Envoi...' : 'Commenter'}
            </button>
          </div>
        </div>
      )}

      {!currentUserId && (
        <div style={{ textAlign: 'center', padding: '20px', marginBottom: 20, background: dark ? '#2a2a2a' : '#f8f8f8', borderRadius: 12 }}>
          <span style={{ fontSize: 13, color: textMuted }}>
            <Link href="/connexion" style={{ color: accent, fontWeight: 700 }}>Connectez-vous</Link> pour commenter ou liker
          </span>
        </div>
      )}

      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>💬</div>
          <p style={{ fontWeight: 700 }}>Aucun commentaire</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>{emptyLabel || 'Soyez le premier à commenter cette galerie'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} accent={accent} currentUserId={currentUserId}
              isOwner={isOwner} onDelete={handleDelete} onLike={handleLike} onReply={handleReply} dark={dark} />
          ))}
        </div>
      )}
    </div>
  )
}
