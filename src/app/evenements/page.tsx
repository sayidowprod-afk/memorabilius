'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'

type Event = {
  id: number
  title: string
  description: string | null
  date: string
  city: string
  country: string
  location_name: string | null
  website: string | null
  image_url: string | null
  attendees?: number
  going?: boolean
}

const emptyForm = { title: '', description: '', date: '', city: '', country: 'France', location_name: '', website: '', image_url: '' }

export default function Evenements() {
  const { dark } = useTheme()
  const [events, setEvents] = useState<Event[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showPropose, setShowPropose] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadingImg, setUploadingImg] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadEvents()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
      if (p?.is_admin) setIsAdmin(true)
    })
  }, [])

  const loadEvents = async () => {
    setLoading(true)
    const { data: evs } = await supabase.from('events').select('*').order('date', { ascending: true })
    if (!evs) { setLoading(false); return }

    const { data: session } = await supabase.auth.getUser()
    const uid = session.user?.id

    const withStats = await Promise.all(evs.map(async (ev: any) => {
      const { count } = await supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('event_id', ev.id)
      let going = false
      if (uid) {
        const { data: a } = await supabase.from('event_attendees').select('id').eq('event_id', ev.id).eq('user_id', uid).maybeSingle()
        going = !!a
      }
      return { ...ev, attendees: count || 0, going }
    }))
    setEvents(withStats)
    setLoading(false)
  }

  const toggleAttend = async (ev: Event) => {
    if (!userId) return
    if (ev.going) {
      await supabase.from('event_attendees').delete().eq('event_id', ev.id).eq('user_id', userId)
    } else {
      await supabase.from('event_attendees').insert({ event_id: ev.id, user_id: userId })
    }
    setEvents(prev => prev.map(e => e.id === ev.id
      ? { ...e, going: !e.going, attendees: (e.attendees || 0) + (e.going ? -1 : 1) }
      : e
    ))
  }

  const uploadEventImage = async (file: File): Promise<string | null> => {
    setUploadingImg(true)
    const path = `evenements/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    setUploadingImg(false)
    if (error) { alert('Erreur upload image : ' + error.message); return null }
    return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  const submitRequest = async () => {
    if (!userId || !form.title || !form.date || !form.city) return
    setSubmitting(true)
    await supabase.from('event_requests').insert({ ...form, user_id: userId })
    setSubmitting(false)
    setSubmitted(true)
    setForm(emptyForm)
    setTimeout(() => { setSubmitted(false); setShowPropose(false) }, 3000)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const upcoming = events.filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
  const past = events.filter(e => new Date(e.date) < new Date(new Date().toDateString()))

  const bg = dark ? '#121212' : '#f7f8fa'
  const card = dark ? '#1e1e1e' : 'white'
  const border = dark ? '#2a2a2a' : '#eee'
  const text = dark ? '#e0e0e0' : '#222'
  const sub = dark ? '#999' : '#666'

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${border}`,
    background: dark ? '#2a2a2a' : '#fafafa', color: text, fontSize: 14, boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: text, margin: 0, fontSize: 28, fontWeight: 800 }}>📅 Événements</h1>
            <p style={{ color: sub, margin: '4px 0 0', fontSize: 14 }}>Card shows, conventions et rencontres de collectionneurs</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isAdmin && (
              <Link href="/evenements/admin" style={{ padding: '10px 18px', borderRadius: 8, background: '#e74c3c', color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                ⚙️ Admin
              </Link>
            )}
            {userId && (
              <button onClick={() => setShowPropose(true)} style={{ padding: '10px 18px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
                + Proposer un événement
              </button>
            )}
          </div>
        </div>

        {loading && <p style={{ color: sub, textAlign: 'center' }}>Chargement...</p>}

        {!loading && events.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: sub }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
            <p>Aucun événement pour le moment.</p>
            {userId && <button onClick={() => setShowPropose(true)} style={{ marginTop: 12, padding: '10px 20px', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Proposer le premier</button>}
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <h2 style={{ color: text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>À venir</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
              {upcoming.map(ev => <EventCard key={ev.id} ev={ev} dark={dark} text={text} sub={sub} card={card} border={border} onToggle={() => toggleAttend(ev)} userId={userId} formatDate={formatDate} />)}
            </div>
          </>
        )}

        {past.length > 0 && (
          <>
            <h2 style={{ color: sub, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Passés</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: 0.6 }}>
              {past.map(ev => <EventCard key={ev.id} ev={ev} dark={dark} text={text} sub={sub} card={card} border={border} onToggle={() => {}} userId={null} formatDate={formatDate} />)}
            </div>
          </>
        )}
      </div>

      {/* Modal proposer */}
      {showPropose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowPropose(false)}>
          <div style={{ background: card, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: text, margin: '0 0 20px', fontSize: 20, fontWeight: 800 }}>Proposer un événement</h2>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#27ae60' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <p style={{ fontWeight: 700 }}>Demande envoyée ! Les admins vont l'examiner.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <input style={inp} placeholder="Nom de l'événement *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} placeholder="Description (optionnel)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <input style={inp} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input style={inp} placeholder="Ville *" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  <input style={inp} placeholder="Pays" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
                <input style={inp} placeholder="Lieu (ex: Parc des Expositions)" value={form.location_name} onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))} />
                <input style={inp} placeholder="Site web (optionnel)" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                <div>
                  <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return
                    const url = await uploadEventImage(file)
                    if (url) setForm(f => ({ ...f, image_url: url }))
                  }} />
                  {form.image_url ? (
                    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                      <img src={form.image_url} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                      <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, color: 'white', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => imgInputRef.current?.click()} disabled={uploadingImg} style={{ width: '100%', padding: '10px', borderRadius: 8, border: `2px dashed ${border}`, background: 'none', color: sub, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {uploadingImg ? 'Upload...' : '🖼️ Ajouter une image (optionnel)'}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => setShowPropose(false)} style={{ flex: 1, padding: '11px', borderRadius: 8, border: `1px solid ${border}`, background: 'none', color: text, fontWeight: 600, cursor: 'pointer' }}>Annuler</button>
                  <button onClick={submitRequest} disabled={submitting || !form.title || !form.date || !form.city} style={{ flex: 2, padding: '11px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Envoi...' : 'Envoyer la demande'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EventCard({ ev, dark, text, sub, card, border, onToggle, userId, formatDate }: any) {
  const [showAttendees, setShowAttendees] = useState(false)
  const [attendees, setAttendees] = useState<any[]>([])

  const loadAttendees = async () => {
    if (showAttendees) { setShowAttendees(false); return }
    const { data } = await supabase.from('event_attendees').select('user_id').eq('event_id', ev.id)
    if (!data || data.length === 0) { setAttendees([]); setShowAttendees(true); return }
    const ids = data.map((a: any) => a.user_id)
    const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids)
    setAttendees(profs || [])
    setShowAttendees(true)
  }

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
      {ev.image_url && <img src={ev.image_url} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />}
      <div style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: text, margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>{ev.title}</h3>
          <p style={{ color: '#003DA6', margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>📅 {formatDate(ev.date)}</p>
          <p style={{ color: sub, margin: '0 0 4px', fontSize: 13 }}>📍 {ev.location_name ? `${ev.location_name}, ` : ''}{ev.city}{ev.country !== 'France' ? `, ${ev.country}` : ''}</p>
          {ev.description && <p style={{ color: sub, margin: '6px 0 0', fontSize: 13, lineHeight: 1.5 }}>{ev.description}</p>}
          {ev.website && <a href={ev.website} target="_blank" rel="noopener noreferrer" style={{ color: '#003DA6', fontSize: 12, marginTop: 4, display: 'inline-block' }}>🔗 Site officiel</a>}
        </div>
        {userId && (
          <button onClick={onToggle} style={{
            padding: '8px 16px', borderRadius: 20, border: `2px solid ${ev.going ? '#27ae60' : '#003DA6'}`,
            background: ev.going ? '#27ae60' : 'transparent', color: ev.going ? 'white' : '#003DA6',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {ev.going ? '✅ J\'y vais' : '📌 J\'y vais ?'}
          </button>
        )}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${border}` }}>
        <button onClick={loadAttendees} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sub, fontSize: 13, fontWeight: 600, padding: 0 }}>
          👥 {ev.attendees} participant{ev.attendees !== 1 ? 's' : ''} {ev.attendees > 0 ? (showAttendees ? '▲' : '▼') : ''}
        </button>
        {showAttendees && attendees.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {attendees.map((p: any) => (
              <a key={p.id} href={`/galerie/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, background: dark ? '#2a2a2a' : '#f5f5f5', borderRadius: 20, padding: '4px 10px 4px 4px', textDecoration: 'none' }}>
                {p.avatar_url
                  ? <img src={p.avatar_url} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#003DA6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>{(p.display_name || '?')[0].toUpperCase()}</div>
                }
                <span style={{ color: text, fontSize: 12, fontWeight: 600 }}>{p.display_name || 'Utilisateur'}</span>
              </a>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
