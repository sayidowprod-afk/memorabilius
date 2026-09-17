'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string; rotation_deg: number
  tier: string | null
}

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
type Tier = typeof TIERS[number]
const TIER_COLORS: Record<string, string> = { S: '#e74c3c', A: '#e67e22', B: '#f1c40f', C: '#2ecc71', D: '#3498db' }
const UNRANKED = '__unranked__'

// Vue d'ensemble de la tier list construite en direct depuis le presentateur
// (voir presenter/page.tsx, boutons S/A/B/C/D a la revelation), avec
// reorganisation par glisser-deposer directement ici -- pensee pour etre
// affichee a l'ecran en fin d'emission.
export default function AutographQuizTierlistPage() {
  const [cards, setCards] = useState<QuizCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dragOverZone, setDragOverZone] = useState<string | null>(null)
  const draggedId = useRef<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setError('Connecte-toi avec ton compte admin.'); setLoading(false); return }
      try {
        const res = await fetch('/api/admin/autograph-quiz', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.status === 403) { setError('Accès réservé aux admins.'); setLoading(false); return }
        const json = await res.json()
        setCards(json.cards || [])
      } catch (e: any) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  // Token capture une fois expire au bout d'1h (voir presenter/page.tsx) --
  // toujours en recuperer un frais avant d'ecrire.
  const assignTier = async (id: string, tier: Tier | null) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, tier } : c))
    const tok = (await supabase.auth.getSession()).data.session?.access_token
    if (!tok) { console.error('[tierlist] session expirée'); return }
    try {
      await fetch('/api/admin/autograph-quiz', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ id, tier }),
      })
    } catch (e) {
      console.error('[tierlist] save failed', e)
    }
  }

  const onDrop = (zone: string) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverZone(null)
    const id = draggedId.current
    draggedId.current = null
    if (!id) return
    assignTier(id, zone === UNRANKED ? null : (zone as Tier))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'white', background: '#0a0e1a', minHeight: '100vh' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{error}</div>

  const unranked = cards.filter(c => !c.tier)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px 24px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1300, margin: '0 auto 28px' }}>
        <img src="/memorabilius-logo.png" alt="Memorabilius" style={{ height: 32, width: 'auto' }} />
        <Link href="/admin/autograph-quiz/presenter" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          ← Retour au présentateur
        </Link>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TIERS.map(tier => (
          <div
            key={tier}
            onDragOver={e => { e.preventDefault(); setDragOverZone(tier) }}
            onDragLeave={() => setDragOverZone(prev => prev === tier ? null : prev)}
            onDrop={onDrop(tier)}
            style={{
              display: 'flex', alignItems: 'stretch', minHeight: 118,
              background: dragOverZone === tier ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.025)',
              border: dragOverZone === tier ? `2px dashed ${TIER_COLORS[tier]}` : '2px solid transparent',
              borderRadius: 14, overflow: 'hidden', transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <div style={{
              width: 84, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: TIER_COLORS[tier], color: '#111', fontSize: 38, fontWeight: 900,
            }}>{tier}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 14, alignItems: 'flex-start', alignContent: 'flex-start' }}>
              {cards.filter(c => c.tier === tier).map(c => (
                <TierCard key={c.id} card={c} onDragStart={() => { draggedId.current = c.id }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOverZone(UNRANKED) }}
        onDragLeave={() => setDragOverZone(prev => prev === UNRANKED ? null : prev)}
        onDrop={onDrop(UNRANKED)}
        style={{
          maxWidth: 1300, margin: '28px auto 0', padding: 14, borderRadius: 14,
          background: dragOverZone === UNRANKED ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: dragOverZone === UNRANKED ? '2px dashed rgba(255,255,255,0.3)' : '2px solid transparent',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>
          Pas encore classées ({unranked.length})
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {unranked.map(c => (
            <TierCard key={c.id} card={c} dim onDragStart={() => { draggedId.current = c.id }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function TierCard({ card, dim, onDragStart }: { card: QuizCard; dim?: boolean; onDragStart: () => void }) {
  const [dragging, setDragging] = useState(false)
  const horiz = card.rotation_deg === 90 || card.rotation_deg === 270
  const flipped = card.rotation_deg === 180
  return (
    <div
      draggable
      onDragStart={() => { setDragging(true); onDragStart() }}
      onDragEnd={() => setDragging(false)}
      title={card.player_name}
      style={{ width: 82, cursor: 'grab', opacity: dragging ? 0.3 : dim ? 0.55 : 1, transition: 'opacity 0.15s' }}
    >
      <div style={{ width: 82, aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative', borderRadius: 8, background: '#1a1a1a', boxShadow: '0 6px 16px rgba(0,0,0,0.45)' }}>
        <img src={card.image_recto} alt={card.player_name} loading="lazy" draggable={false} style={horiz
          ? { position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover' }
          : flipped
          ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'rotate(180deg)' }
          : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }
        } />
      </div>
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10.5, fontWeight: 700, textAlign: 'center', margin: '5px 0 0', lineHeight: 1.25 }}>
        {card.player_name}
      </p>
    </div>
  )
}
