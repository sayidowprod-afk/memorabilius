'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadUprightImage } from '@/lib/uprightImage'

interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string; rotation_deg: number
  tier: string | null
}

const TIERS = ['S', 'A', 'B', 'C', 'D'] as const
const TIER_COLORS: Record<string, string> = { S: '#e74c3c', A: '#e67e22', B: '#f1c40f', C: '#2ecc71', D: '#3498db' }

// Vue d'ensemble de la tier list construite en direct depuis le presentateur
// (voir presenter/page.tsx, boutons S/A/B/C/D a la revelation) -- pensee pour
// etre affichee a l'ecran en fin d'emission.
export default function AutographQuizTierlistPage() {
  const [cards, setCards] = useState<QuizCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'white', background: '#0a0e1a', minHeight: '100vh' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{error}</div>

  const unranked = cards.filter(c => !c.tier)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', padding: '32px 24px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: 1200, margin: '0 auto 24px' }}>
        <img src="/memorabilius-logo.png" alt="Memorabilius" style={{ height: 30, width: 'auto' }} />
        <Link href="/admin/autograph-quiz/presenter" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          ← Retour au présentateur
        </Link>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TIERS.map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'stretch', minHeight: 96, background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              width: 70, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: TIER_COLORS[tier], color: '#111', fontSize: 32, fontWeight: 900,
            }}>{tier}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10, alignItems: 'center' }}>
              {cards.filter(c => c.tier === tier).map(c => <TierCard key={c.id} card={c} />)}
            </div>
          </div>
        ))}
      </div>

      {unranked.length > 0 && (
        <div style={{ maxWidth: 1200, margin: '32px auto 0' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 10 }}>
            Pas encore classées ({unranked.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {unranked.map(c => <TierCard key={c.id} card={c} dim />)}
          </div>
        </div>
      )}
    </div>
  )
}

function TierCard({ card, dim }: { card: QuizCard; dim?: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    loadUprightImage(card.image_recto, card.rotation_deg)
      .then(canvas => { if (!cancelled) setSrc(canvas.toDataURL('image/jpeg', 0.8)) })
      .catch(() => { if (!cancelled) setSrc(card.image_recto) })
    return () => { cancelled = true }
  }, [card.image_recto, card.rotation_deg])

  return (
    <div title={card.player_name} style={{ width: 56, opacity: dim ? 0.5 : 1 }}>
      {src ? (
        <img src={src} alt={card.player_name} style={{ width: 56, aspectRatio: '2.5/3.5', objectFit: 'cover', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }} />
      ) : (
        <div style={{ width: 56, aspectRatio: '2.5/3.5', background: '#222', borderRadius: 6 }} />
      )}
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 700, textAlign: 'center', margin: '3px 0 0', lineHeight: 1.2 }}>
        {card.player_name}
      </p>
    </div>
  )
}
