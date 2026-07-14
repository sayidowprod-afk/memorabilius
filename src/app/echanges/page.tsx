'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface TradeCard {
  id: string
  nom: string
  annee: string
  marque: string
  image_recto: string | null
  rc: boolean
  auto: boolean
  patch: boolean
}

interface Trade {
  id: string
  sender_id: string
  receiver_id: string
  sender_name: string
  receiver_name: string
  status: 'pending' | 'accepted' | 'refused' | 'cancelled'
  message: string | null
  created_at: string
  offered_cards: TradeCard[]
  requested_cards: TradeCard[]
}

function CardThumb({ card }: { card: TradeCard }) {
  return (
    <div title={`${card.nom} ${card.annee}`} style={{ width: 52, height: 73, background: '#0d1a30', borderRadius: 6, overflow: 'hidden', flex: '0 0 auto', position: 'relative' }}>
      {card.image_recto
        ? <img src={card.image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 20 }}>🃏</div>
      }
    </div>
  )
}

function CardStack({ cards, label }: { cards: TradeCard[]; label: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {cards.map(c => <CardThumb key={c.id} card={c} />)}
        {cards.length === 0 && <span style={{ color: '#bbb', fontSize: 13 }}>Aucune carte</span>}
      </div>
      {cards.length > 0 && (
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
          {cards.map(c => c.nom).join(', ')}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'En attente', color: '#7a5500', bg: '#fff8e1' },
  accepted:  { label: 'Accepté',    color: '#1b5e20', bg: '#e8f5e9' },
  refused:   { label: 'Refusé',     color: '#7f0000', bg: '#ffebee' },
  cancelled: { label: 'Annulé',     color: '#555',    bg: '#f5f5f5' },
}

export default function EchangesPage() {
  const router = useRouter()
  const [trades, setTrades] = useState<Trade[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/connexion'); return }
    setMyId(session.user.id)

    const res = await fetch('/api/trades', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json()
    setTrades(json.trades || [])
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const act = async (tradeId: string, action: 'accept' | 'refuse' | 'cancel') => {
    setActing(tradeId + action)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch(`/api/trades/${tradeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action }),
    })
    await load()
    setActing(null)
  }

  const pending = trades.filter(t => t.status === 'pending')
  const history = trades.filter(t => t.status !== 'pending')
  const shown = tab === 'pending' ? pending : history

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#888' }}>
      Chargement…
    </div>
  )

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/profil" style={{ color: '#888', textDecoration: 'none', fontSize: 20 }}>←</Link>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>🔄 Mes échanges</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['pending', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: 'none', borderRadius: 50, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: tab === t ? '#003DA6' : '#f0f0f0',
              color: tab === t ? '#fff' : '#555',
            }}
          >
            {t === 'pending' ? `En attente (${pending.length})` : `Historique (${history.length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div style={{ textAlign: 'center', color: '#bbb', padding: '48px 0', fontSize: 15 }}>
          {tab === 'pending' ? 'Aucun échange en attente' : 'Aucun historique'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {shown.map(trade => {
          const isSender = trade.sender_id === myId
          const status = STATUS_LABEL[trade.status]
          const otherName = isSender ? trade.receiver_name : trade.sender_name
          const myCards = isSender ? trade.offered_cards : trade.requested_cards
          const theirCards = isSender ? trade.requested_cards : trade.offered_cards

          return (
            <div key={trade.id} style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: '1.5px solid #f0f0f0' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>
                  {isSender ? `Envoyé à ${otherName}` : `Reçu de ${otherName}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    {new Date(trade.created_at).toLocaleDateString('fr-FR')}
                  </span>
                  <span style={{ background: status.bg, color: status.color, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20 }}>
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Cartes */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <CardStack cards={myCards} label="Tu offres" />
                <div style={{ fontSize: 22, paddingTop: 24, color: '#ccc', flex: '0 0 auto' }}>⇄</div>
                <CardStack cards={theirCards} label="Tu demandes" />
              </div>

              {/* Message */}
              {trade.message && (
                <div style={{ marginTop: 12, background: '#f8f8f8', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#555' }}>
                  💬 {trade.message}
                </div>
              )}

              {/* Actions */}
              {trade.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  {!isSender && (
                    <>
                      <button
                        disabled={acting !== null}
                        onClick={() => act(trade.id, 'accept')}
                        style={{ flex: 1, border: 'none', borderRadius: 50, padding: '10px', background: '#003DA6', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        {acting === trade.id + 'accept' ? '…' : '✓ Accepter'}
                      </button>
                      <button
                        disabled={acting !== null}
                        onClick={() => act(trade.id, 'refuse')}
                        style={{ flex: 1, border: '2px solid #ccc', borderRadius: 50, padding: '10px', background: '#fff', color: '#555', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
                      >
                        {acting === trade.id + 'refuse' ? '…' : '✕ Refuser'}
                      </button>
                    </>
                  )}
                  {isSender && (
                    <button
                      disabled={acting !== null}
                      onClick={() => act(trade.id, 'cancel')}
                      style={{ border: '2px solid #ccc', borderRadius: 50, padding: '9px 20px', background: '#fff', color: '#888', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      {acting === trade.id + 'cancel' ? '…' : 'Annuler l\'offre'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
