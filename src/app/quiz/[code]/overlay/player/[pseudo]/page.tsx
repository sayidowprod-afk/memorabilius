'use client'
import { use, useEffect, useRef, useState } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_NAVY_DEEP, FDLC_RED } from '@/lib/fdlcBranding'
import { formatResponseMs } from '@/lib/useLiveQuizPoll'
import QuizAnimStyles from '@/components/QuizAnimStyles'

interface PlayerState {
  found: boolean; pseudo: string; hasRound: boolean; hasAnswered: boolean; responseMs: number | null
  revealed: boolean; isCorrect: boolean | null; choiceIndex: number | null; choiceLabel: string | null
  correctIndex: number | null; score: number
}

// Overlay INDIVIDUELLE pour un chroniqueur/invité du plateau qui joue le quiz
// comme les spectateurs -- une Browser Source à part, positionnée à la main
// dans Streamlabs sous/à côté de sa propre caméra (voir le panneau admin,
// section "Overlays individuels", pour choisir qui et copier le lien). Même
// DA que les autres overlays, même règle de sécurité : jamais juste/faux
// avant que l'animateur clique "Révéler", juste "a répondu" + son temps en
// attendant.
export default function QuizPlayerOverlayPage({ params }: { params: Promise<{ code: string; pseudo: string }> }) {
  const { code: rawCode, pseudo: rawPseudo } = use(params)
  const code = rawCode.toUpperCase()
  const pseudo = decodeURIComponent(rawPseudo)
  const [state, setState] = useState<PlayerState | null>(null)
  const [justAnswered, setJustAnswered] = useState(false)
  const prevAnsweredRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/live-quiz/player?code=${code}&pseudo=${encodeURIComponent(pseudo)}`)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setState(json)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 1200)
    return () => { cancelled = true; clearInterval(id) }
  }, [code, pseudo])

  // Rebond au moment ou la reponse passe de "pas encore" a "repondu"
  useEffect(() => {
    if (state?.hasAnswered && !prevAnsweredRef.current) {
      setJustAnswered(true)
      const t = setTimeout(() => setJustAnswered(false), 700)
      prevAnsweredRef.current = true
      return () => clearTimeout(t)
    }
    if (!state?.hasAnswered) prevAnsweredRef.current = false
  }, [state?.hasAnswered])

  if (!state || !state.hasRound) return null

  const statusColor = state.revealed ? (state.isCorrect ? '#2ecc71' : FDLC_RED) : state.hasAnswered ? '#2ecc71' : 'rgba(255,255,255,0.35)'

  return (
    <div style={{ minHeight: '100dvh', background: 'transparent', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 10, fontFamily: 'system-ui, sans-serif' }}>
      <QuizAnimStyles />
      <div className={justAnswered ? 'quiz-anim-bump' : undefined} style={{
        position: 'relative', overflow: 'hidden', minWidth: 190, maxWidth: 280,
        borderRadius: 14, border: `2px solid ${statusColor}`, boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${FDLC_NAVY_DEEP}f0, ${FDLC_NAVY_DEEP}c8)`,
          backdropFilter: 'blur(6px)', padding: '9px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: statusColor,
              boxShadow: !state.hasAnswered && !state.revealed ? '0 0 0 3px rgba(255,255,255,0.08)' : 'none',
            }} />
            <span className={fdlcFont.className} style={{ fontSize: 14, color: 'white', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pseudo}
            </span>
            {state.revealed && <span style={{ fontSize: 15, flexShrink: 0 }}>{state.isCorrect ? '✅' : '❌'}</span>}
            <span style={{ fontSize: 13, fontWeight: 900, color: '#2ecc71', flexShrink: 0 }}>{state.score} pts</span>
          </div>

          {state.revealed && state.choiceLabel ? (
            <div style={{
              marginTop: 6, fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 8,
              background: state.isCorrect ? 'rgba(46,204,113,0.18)' : 'rgba(200,16,46,0.18)',
              color: state.isCorrect ? '#2ecc71' : '#ff6b7d',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {state.choiceLabel}
            </div>
          ) : (
            <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
              {state.hasAnswered
                ? `A répondu${state.responseMs != null ? ` en ${formatResponseMs(state.responseMs)}` : ''}`
                : 'En train de répondre...'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
