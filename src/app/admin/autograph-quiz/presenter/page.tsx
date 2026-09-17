'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadUprightImage } from '@/lib/uprightImage'

interface QuizCard {
  id: string; player_name: string; team: string | null; image_recto: string
  crop_x: number; crop_y: number; crop_w: number; crop_h: number; is_horizontal: boolean
}

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Outil présentateur pour le quiz "devine le joueur" -- pas d'interaction
// spectateur, c'est l'animateur qui clique pendant l'émission. Signature
// seule affichée en grand (dessinée sur canvas depuis la zone de crop
// définie dans /admin/autograph-quiz), un clic révèle la carte complète.
export default function AutographQuizPresenterPage() {
  const [cards, setCards] = useState<QuizCard[]>([])
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [uprightFullSrc, setUprightFullSrc] = useState<string | null>(null)
  const [qcmMode, setQcmMode] = useState(false)
  const [choices, setChoices] = useState<string[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setError('Connecte-toi avec ton compte admin.'); setLoading(false); return }
      try {
        const res = await fetch('/api/admin/autograph-quiz', { headers: { Authorization: `Bearer ${session.access_token}` } })
        if (res.status === 403) { setError('Accès réservé aux admins.'); setLoading(false); return }
        const json = await res.json()
        setCards(shuffle((json.cards || []).filter((c: QuizCard) => c.crop_w > 0 && c.crop_h > 0)))
      } catch (e: any) {
        setError(e.message || String(e))
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const current = cards[idx]

  useEffect(() => {
    if (!current || !canvasRef.current) return
    let cancelled = false
    setUprightFullSrc(null)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    // Passe d'abord par une image "upright" (voir uprightImage.ts) -- les cartes
    // horizontales sont stockees en orientation brute (portrait, tournee), sinon
    // la signature (et la carte revelee) s'affichaient de travers.
    loadUprightImage(current.image_recto, current.is_horizontal).then(upright => {
      if (cancelled) return
      setUprightFullSrc(upright.toDataURL('image/jpeg', 0.92))
      const sx = current.crop_x * upright.width
      const sy = current.crop_y * upright.height
      const sw = current.crop_w * upright.width
      const sh = current.crop_h * upright.height
      const outW = 1400
      const outH = Math.round(outW * (sh / sw))
      canvas.width = outW
      canvas.height = outH
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, outW, outH)
      ctx.drawImage(upright, sx, sy, sw, sh, 0, 0, outW, outH)
    })
    return () => { cancelled = true }
  }, [current])

  // 4 choix (mode QCM) : le bon nom + 3 autres pioches parmi les autres cartes
  // validees, melanges. Recalcule a chaque nouvelle carte affichee.
  useEffect(() => {
    if (!current) return
    const others = cards.filter(c => c.id !== current.id).map(c => c.player_name)
    const wrongs = shuffle(others).slice(0, 3)
    setChoices(shuffle([current.player_name, ...wrongs]))
  }, [current?.id, cards])

  const next = () => { setRevealed(false); setIdx(i => (i + 1) % Math.max(1, cards.length)) }
  const prev = () => { setRevealed(false); setIdx(i => (i - 1 + cards.length) % Math.max(1, cards.length)) }
  const reshuffle = () => { setRevealed(false); setIdx(0); setCards(prev => shuffle(prev)) }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'white', background: '#0a0e1a', minHeight: '100vh' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{error}</div>
  if (cards.length === 0) return <div style={{ padding: 40, textAlign: 'center' }}>Aucune carte validée. Va d'abord sur /admin/autograph-quiz.</div>

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: '#0a0e1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 700, position: 'absolute', top: 16, left: 20 }}>
        {idx + 1} / {cards.length}
      </p>
      <button onClick={() => setQcmMode(v => !v)} style={{ ...btnStyle, position: 'absolute', top: 12, right: 20, fontSize: 12, padding: '8px 14px' }}>
        {qcmMode ? '📝 Mode QCM' : '🗽 Mode libre'}
      </button>

      {!revealed ? (
        <canvas ref={canvasRef} style={{ maxWidth: '92vw', maxHeight: '58vh', width: 'auto', height: 'auto', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <img src={uprightFullSrc || current.image_recto} alt={current.player_name} style={{ maxWidth: '70vw', maxHeight: '48vh', width: 'auto', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'white', fontSize: 36, fontWeight: 900, margin: 0 }}>{current.player_name}</p>
            {current.team && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: 700, margin: '4px 0 0' }}>{current.team}</p>}
          </div>
        </div>
      )}

      {qcmMode && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 640 }}>
          {choices.map(name => {
            const isCorrect = name === current.player_name
            return (
              <div key={name} style={{
                padding: '12px 18px', borderRadius: 12, fontWeight: 800, fontSize: 17, textAlign: 'center',
                background: revealed && isCorrect ? '#1a7a3a' : 'rgba(255,255,255,0.08)',
                border: revealed && isCorrect ? '2px solid #2ecc71' : '2px solid rgba(255,255,255,0.12)',
                color: 'white', transition: 'all 0.2s',
              }}>
                {name}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <button onClick={prev} style={btnStyle}>← Précédent</button>
        <button onClick={() => setRevealed(r => !r)} style={{ ...btnStyle, background: '#003DA6', minWidth: 160 }}>
          {revealed ? 'Cacher' : '👁️ Révéler'}
        </button>
        <button onClick={next} style={btnStyle}>Suivant →</button>
      </div>
      <button onClick={reshuffle} style={{ ...btnStyle, opacity: 0.6, fontSize: 12 }}>🔀 Remélanger</button>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '12px 22px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.1)',
  color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer',
}
