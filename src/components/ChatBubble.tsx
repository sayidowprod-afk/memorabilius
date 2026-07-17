'use client'
import { toast } from '@/lib/toast'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

const IMG_PREFIX = '[[img]]'
const isImageMsg = (c: string) => typeof c === 'string' && c.startsWith(IMG_PREFIX)
const imgUrlOf = (c: string) => c.slice(IMG_PREFIX.length)

const TRADE_PREFIX = '[[trade_offer:'
const isTradeMsg = (c: string) => typeof c === 'string' && c.startsWith(TRADE_PREFIX)
const tradeIdOf = (c: string) => c.slice(TRADE_PREFIX.length, -2)

const STATUS_LABEL: Record<string, string> = { pending: 'En attente', accepted: 'Accepté ✓', refused: 'Refusé', cancelled: 'Annulé' }
const STATUS_COLOR: Record<string, string> = { pending: '#7a5500', accepted: '#1b5e20', refused: '#7f0000', cancelled: '#555' }

export default function ChatBubble() {
  const { dark } = useTheme()
  const [userId, setUserId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [conversations, setConversations] = useState<any[]>([])
  const [profiles, setProfiles] = useState<Record<string, any>>({})
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [tradeOffersMap, setTradeOffersMap] = useState<Record<string, any>>({})
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
      if (!convMap[otherId]) convMap[otherId] = {
        lastMsg: isTradeMsg(msg.contenu) ? '🔄 Offre d\'échange' : msg.contenu,
        date: msg.created_at, unread: 0,
      }
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

    const offerIds = [...new Set((data || [])
      .filter((m: any) => isTradeMsg(m.contenu))
      .map((m: any) => tradeIdOf(m.contenu))
    )]
    if (offerIds.length > 0) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch('/api/trades', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.ok) {
          const json = await res.json()
          const oMap: Record<string, any> = {}
          for (const t of (json.trades || [])) {
            if (offerIds.includes(t.id)) oMap[t.id] = t
          }
          setTradeOffersMap(oMap)
        }
      }
    }

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
      if (error) { toast.error('Erreur envoi image : ' + error.message); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('messages').insert({ from_user_id: userId, to_user_id: activeConv, contenu: IMG_PREFIX + data.publicUrl })
      loadMessages(activeConv)
      loadConversations(userId)
      notifyRecipient()
    } catch {
      toast.error('Image illisible, réessayez.')
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
          height: 52, borderRadius: !open && unread > 0 ? 26 : '50%',
          width: !open && unread > 0 ? 'auto' : 52,
          padding: !open && unread > 0 ? '0 18px' : '0',
          background: '#003DA6', color: 'white', border: 'none',
          fontSize: !open && unread > 0 ? 13 : 22, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(0,61,166,0.4)',
          transition: 'all 0.2s', whiteSpace: 'nowrap',
        }}
        title="Messages"
      >
        {open ? '✕' : (unread > 0 ? <>💬 Nouveau message reçu</> : '💬')}
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

                  const ts = (() => {
                    const d = new Date(msg.created_at)
                    const today = new Date()
                    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    if (d.toDateString() === today.toDateString()) return time
                    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${time}`
                  })()

                  // ── Bulle trade offer ──
                  if (isTradeMsg(msg.contenu)) {
                    const offer = tradeOffersMap[tradeIdOf(msg.contenu)]
                    const isSender = offer?.sender_id === userId
                    const isPending = offer?.status === 'pending'
                    const actOnOffer = async (action: 'accept' | 'refuse' | 'cancel') => {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (!session || !offer) return
                      await fetch(`/api/trades/${offer.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ action }),
                      })
                      if (userId) loadMessages(activeConv!)
                    }
                    return (
                      <div key={msg.id} style={{ width: '100%' }}>
                        <div style={{
                          background: dark ? '#1e2a3a' : '#f0f4ff',
                          border: `1.5px solid ${dark ? '#2a3a5a' : '#c5d5ff'}`,
                          borderRadius: 10, padding: 10,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#003DA6' }}>🔄 Offre d'échange</span>
                            {offer && <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[offer.status] || '#555' }}>{STATUS_LABEL[offer.status] || offer.status}</span>}
                          </div>
                          {offer ? (
                            <>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 9, color: textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{isSender ? 'Tu offres' : 'Il/elle offre'}</div>
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    {offer.offered_cards.slice(0, 3).map((c: any, i: number) => {
                                      const img = c.image_recto || c.card_image
                                      const href = img ? `/galerie/${offer.sender_id}?card=${encodeURIComponent(img)}` : null
                                      return (
                                        <a key={i} href={href || undefined} target="_blank" rel="noopener noreferrer"
                                          style={{ width: 28, height: 40, background: '#0d1a30', borderRadius: 3, overflow: 'hidden', flexShrink: 0, display: 'block', cursor: href ? 'pointer' : 'default', textDecoration: 'none' }}>
                                          {img && <img src={img} alt={c.nom || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                        </a>
                                      )
                                    })}
                                    {offer.offered_cards.length > 3 && <span style={{ fontSize: 9, color: textMuted, alignSelf: 'center' }}>+{offer.offered_cards.length - 3}</span>}
                                  </div>
                                </div>
                                <span style={{ color: textMuted, fontSize: 14, flexShrink: 0 }}>⇄</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 9, color: textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 3 }}>{isSender ? 'Tu demandes' : 'Il/elle demande'}</div>
                                  <div style={{ display: 'flex', gap: 3 }}>
                                    {offer.requested_cards.slice(0, 3).map((c: any, i: number) => {
                                      const img = c.image_recto || c.card_image
                                      const href = img ? `/galerie/${offer.receiver_id}?card=${encodeURIComponent(img)}` : null
                                      return (
                                        <a key={i} href={href || undefined} target="_blank" rel="noopener noreferrer"
                                          style={{ width: 28, height: 40, background: '#0d1a30', borderRadius: 3, overflow: 'hidden', flexShrink: 0, display: 'block', cursor: href ? 'pointer' : 'default', textDecoration: 'none' }}>
                                          {img && <img src={img} alt={c.nom || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                        </a>
                                      )
                                    })}
                                    {offer.requested_cards.length > 3 && <span style={{ fontSize: 9, color: textMuted, alignSelf: 'center' }}>+{offer.requested_cards.length - 3}</span>}
                                  </div>
                                </div>
                              </div>
                              {isPending && (
                                <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                                  {!isSender && (
                                    <>
                                      <button onClick={() => actOnOffer('accept')} style={{ flex: 1, background: '#003DA6', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontWeight: 800, fontSize: 10, cursor: 'pointer' }}>✓ Accepter</button>
                                      <button onClick={() => actOnOffer('refuse')} style={{ flex: 1, background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '5px 0', fontWeight: 700, fontSize: 10, cursor: 'pointer', color: textMain }}>✕ Refuser</button>
                                    </>
                                  )}
                                  {isSender && (
                                    <button onClick={() => actOnOffer('cancel')} style={{ background: 'none', border: `1px solid ${border}`, borderRadius: 6, padding: '5px 10px', fontWeight: 700, fontSize: 10, cursor: 'pointer', color: '#888' }}>Annuler</button>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: textMuted }}>Chargement…</div>
                          )}
                          <div style={{ fontSize: 9, color: textMuted, marginTop: 5, textAlign: 'right' }}>{ts}</div>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
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
                      <span style={{ fontSize: 9, color: textMuted, marginTop: 2 }}>{ts}</span>
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
