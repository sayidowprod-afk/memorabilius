'use client'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

interface CardInfo {
  id: string
  nom: string
  annee: string
  marque: string
  image_recto: string | null
  rc: boolean
  auto: boolean
  patch: boolean
}

interface TradeModalProps {
  // La carte que le visiteur veut obtenir (chez l'autre user)
  targetCard: { id: string; nom: string; annee: string; marque: string; image_recto?: string }
  targetUserId: string
  targetUserName: string
  onClose: () => void
  onSuccess: () => void
}

export default function TradeModal({ targetCard, targetUserId, targetUserName, onClose, onSuccess }: TradeModalProps) {
  const [myCards, setMyCards] = useState<CardInfo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const fetchMyCards = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto, rc, auto, patch')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
    setMyCards((data as CardInfo[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMyCards() }, [fetchMyCards])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) { setError('Sélectionne au moins une carte à offrir'); return }
    setSending(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expirée'); setSending(false); return }

    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        receiverId: targetUserId,
        offeredCardIds: [...selected],
        requestedCardIds: [targetCard.id],
        message: message.trim() || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Erreur'); setSending(false); return }
    onSuccess()
  }

  const modal = (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 18, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>🔄 Proposer un échange</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        {/* Carte demandée */}
        <div style={{ background: '#f0f4ff', borderRadius: 12, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
          {targetCard.image_recto && (
            <img src={targetCard.image_recto} alt="" style={{ width: 48, height: 68, objectFit: 'contain', borderRadius: 6, background: '#0d1a30' }} />
          )}
          <div>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Tu veux obtenir de {targetUserName}</div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{targetCard.nom}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{targetCard.annee} · {targetCard.marque}</div>
          </div>
        </div>

        {/* Mes cartes à offrir */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>
            Tes cartes à offrir ({selected.size} sélectionnée{selected.size > 1 ? 's' : ''})
          </div>
          {loading ? (
            <div style={{ color: '#aaa', fontSize: 14, padding: 20, textAlign: 'center' }}>Chargement…</div>
          ) : myCards.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 14, padding: 20, textAlign: 'center' }}>Ta collection est vide</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, maxHeight: 240, overflowY: 'auto', padding: 4 }}>
              {myCards.map(c => {
                const isSelected = selected.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    title={`${c.nom} ${c.annee}`}
                    style={{
                      border: isSelected ? '2.5px solid #003DA6' : '2px solid transparent',
                      borderRadius: 8,
                      background: isSelected ? '#e8f0ff' : '#f5f5f5',
                      padding: 4,
                      cursor: 'pointer',
                      position: 'relative',
                      aspectRatio: '2.5/3.5',
                      overflow: 'hidden',
                    }}
                  >
                    {c.image_recto
                      ? <img src={c.image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🃏</div>
                    }
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 3, right: 3, background: '#003DA6', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 900 }}>✓</div>
                    )}
                    {(c.rc || c.auto || c.patch) && (
                      <div style={{ position: 'absolute', bottom: 2, left: 2, display: 'flex', gap: 2 }}>
                        {c.rc && <span style={{ background: '#003DA6', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>RC</span>}
                        {c.auto && <span style={{ background: '#8B0000', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>AU</span>}
                        {c.patch && <span style={{ background: '#4a2c00', color: '#fff', fontSize: 7, fontWeight: 900, padding: '1px 3px', borderRadius: 3 }}>PA</span>}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Message optionnel */}
        <textarea
          placeholder="Message (optionnel)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={300}
          rows={2}
          style={{ resize: 'none', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
        />

        {error && <div style={{ color: '#c00', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <button
          onClick={submit}
          disabled={sending || selected.size === 0}
          style={{
            background: sending || selected.size === 0 ? '#ccc' : '#003DA6',
            color: '#fff', border: 'none', borderRadius: 50, padding: '13px 24px',
            fontWeight: 800, fontSize: 15, cursor: sending || selected.size === 0 ? 'default' : 'pointer',
          }}
        >
          {sending ? 'Envoi…' : `Envoyer l'offre`}
        </button>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : null
}
