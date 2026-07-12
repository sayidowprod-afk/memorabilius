'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

const IMG_PREFIX = '[[img]]'
const isImageMsg = (c: string) => typeof c === 'string' && c.startsWith(IMG_PREFIX)
const imgUrlOf = (c: string) => c.slice(IMG_PREFIX.length)

export default function ChatBubble() {
  const { dark } = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [conversations, setConversations] = useState<any[]>([])
  const [profiles, setProfiles] = useState<Record<string, any>>({})
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [uploadingImg, setUploadingImg] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const bg = dark ? '#222' : 'white'
  const border = dark ? '#333' : '#f0f0f0'
  const textMain = dark ? '#fff' : '#121212'
  const textMuted = dark ? '#888' : '#999'

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { setUserId(data.user.id); loadUnread(data.user.id) }
    })
  }, [])

  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`chat-bubble-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${userId}` },
        () => { loadUnread(userId); if (open) loadConversations(userId) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadUnread = async (uid: string) => {
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user_id', uid).eq('lu', false)
    setUnread(count || 0)
  }

  const loadConversations = async (uid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('from_user_id, to_user_id, contenu, created_at, lu')
      .or(`from_user_id.eq.${uid},to_user_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    if (!data) return
    const convMap: Record<string, any> = {}
    for (const msg of data) {
      const otherId = msg.from_user_id === uid ? msg.to_user_id : msg.from_user_id
      if (!convMap[otherId]) convMap[otherId] = { lastMsg: msg.contenu, date: msg.created_at, unread: 0 }
      if (!msg.lu && msg.to_user_id === uid) convMap[otherId].unread++
    }
    const ids = Object.keys(convMap)
    if (ids.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
      const profMap: Record<string, any> = {}
      profs?.forEach(p => { profMap[p.id] = p })
      setProfiles(prev => ({ ...prev, ...profMap }))
    }
    setConversations(Object.entries(convMap).map(([id, v]) => ({ id, ...v })))
  }

  const loadMessages = async (otherId: string) => {
    if (!userId) return
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_user_id.eq.${userId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${userId})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('messages').update({ lu: true }).eq('to_user_id', userId).eq('from_user_id', otherId)
    loadUnread(userId)
  }

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next && userId) loadConversations(userId)
  }

  const selectConv = (id: string) => {
    setActiveConv(id)
    loadMessages(id)
  }

  const notifyRecipient = async () => {
    if (!userId || !activeConv) return
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const senderName = profiles[userId]?.display_name || 'Quelqu\'un'
      fetch('/api/message-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ toUserId: activeConv, senderName }),
      }).catch(() => {})
    }
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !userId || !activeConv) return
    const content = newMsg.trim()
    setNewMsg('')
    await supabase.from('messages').insert({ from_user_id: userId, to_user_id: activeConv, contenu: content })
    loadMessages(activeConv)
    loadConversations(userId)
    notifyRecipient()
  }

  // Réduit l'image (max 1400px, JPEG 0.82) avant l'upload pour limiter le poids
  const downscaleImage = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight))
      const w = Math.max(1, Math.round(img.naturalWidth * scale))
      const h = Math.max(1, Math.round(img.naturalHeight * scale))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      c.toBlob(b => { c.width = 0; b ? resolve(b) : reject(new Error('blob')) }, 'image/jpeg', 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')) }
    img.src = url
  })

  const sendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId || !activeConv) return
    setUploadingImg(true)
    try {
      const blob = await downscaleImage(file)
      const path = `chat/${userId}/${Date.now()}.jpg`
      const up = new File([blob], 'chat.jpg', { type: 'image/jpeg' })
      const { error } = await supabase.storage.from('avatars').upload(path, up, { upsert: true })
      if (error) { alert('Erreur envoi image : ' + error.message); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('messages').insert({ from_user_id: userId, to_user_id: activeConv, contenu: IMG_PREFIX + data.publicUrl })
      loadMessages(activeConv)
      loadConversations(userId)
      notifyRecipient()
    } catch {
      alert('Image illisible, réessayez.')
    } finally {
      setUploadingImg(false)
    }
  }

  if (!userId) return null

  return (
    <>
      {/* Bulle flottante */}
      <button
        onClick={toggleOpen}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9500,
          width: 52, height: 52, borderRadius: '50%',
          background: '#003DA6', color: 'white', border: 'none',
          fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,61,166,0.4)',
        }}
        title="Messages"
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2, background: '#e74c3c', color: 'white',
            borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {/* Panneau */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 88, right: 16, zIndex: 9500,
          width: 'min(320px, calc(100vw - 32px))', height: 440, maxHeight: 'calc(100vh - 120px)',
          background: bg, borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {!activeConv ? (
            <>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: 15, color: textMain }}>Messages</h3>
                <Link href="/messages" style={{ fontSize: 11, color: '#003DA6', fontWeight: 700, textDecoration: 'none' }} onClick={() => setOpen(false)}>Ouvrir en grand</Link>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {conversations.length === 0 && (
                  <p style={{ padding: 20, color: textMuted, fontSize: 13, textAlign: 'center' }}>Aucune conversation</p>
                )}
                {conversations.map(conv => (
                  <div key={conv.id} onClick={() => selectConv(conv.id)} style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${border}`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <img src={profiles[conv.id]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[conv.id]?.display_name || 'U')}&background=003DA6&color=fff`}
                      style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 800, fontSize: 12, margin: 0, color: textMain, display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profiles[conv.id]?.display_name || '...'}</span>
                        {conv.unread > 0 && <span style={{ background: '#003DA6', color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{conv.unread}</span>}
                      </p>
                      <p style={{ fontSize: 10, color: textMuted, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isImageMsg(conv.lastMsg) ? '📷 Photo' : conv.lastMsg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#003DA6', padding: 0 }}>←</button>
                <Link href={`/galerie/${activeConv}`} onClick={() => setOpen(false)} title="Voir la galerie"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flex: 1, minWidth: 0 }}>
                  <img src={profiles[activeConv]?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profiles[activeConv]?.display_name || 'U')}&background=003DA6&color=fff`}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                  <span style={{ fontWeight: 800, fontSize: 13, color: textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profiles[activeConv]?.display_name}</span>
                </Link>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {messages.map(msg => {
                  const isMe = msg.from_user_id === userId
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {isImageMsg(msg.contenu) ? (
                        <a href={imgUrlOf(msg.contenu)} target="_blank" rel="noopener noreferrer">
                          <img src={imgUrlOf(msg.contenu)} alt="photo" style={{ maxWidth: 140, borderRadius: 10, display: 'block' }} />
                        </a>
                      ) : (
                        <div style={{
                          maxWidth: '75%', padding: '7px 11px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                          background: isMe ? '#003DA6' : (dark ? '#333' : '#f0f0f0'),
                          color: isMe ? 'white' : textMain, fontSize: 12, lineHeight: 1.4,
                        }}>{msg.contenu}</div>
                      )}
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
              <div style={{ padding: 10, borderTop: `1px solid ${border}`, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={sendImage} />
                <button onClick={() => fileRef.current?.click()} disabled={uploadingImg}
                  title="Envoyer une image"
                  style={{ background: dark ? '#333' : '#f0f0f0', color: dark ? '#ddd' : '#555', border: 'none', borderRadius: 8, padding: '0 10px', height: 32, fontSize: 15, cursor: uploadingImg ? 'wait' : 'pointer', flexShrink: 0 }}>
                  {uploadingImg ? '…' : '📷'}
                </button>
                <input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="Écrire..."
                  style={{ flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : 'white', color: textMain, outline: 'none' }}
                />
                <button onClick={sendMessage} style={{ background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '0 12px', height: 32, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>➤</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
