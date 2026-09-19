'use client'
import { use, useEffect, useState } from 'react'

interface SessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  question: string | null; choices: string[] | null; correctIndex: number | null
}
interface Poll {
  session: SessionState; tally: number[]; totalAnswers: number
  leaderboard: { pseudo: string; score: number }[]
}

const COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71']

// Pensé pour être ajouté comme Browser Source dans OBS/Streamlabs (fond
// transparent, plein écran, aucune interaction) -- affiche la question, les
// votes en direct sous forme de barres, et le classement à chaque révélation.
// Ne JAMAIS afficher la bonne réponse avant status='reveal' (voir
// /api/live-quiz, qui filtre déjà côté serveur).
export default function QuizOverlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()
  const [poll, setPoll] = useState<Poll | null>(null)

  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/live-quiz?code=${code}`)
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setPoll(json)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 1500)
    return () => { cancelled = true; clearInterval(id) }
  }, [code])

  if (!poll) return null

  const { session, tally, totalAnswers, leaderboard } = poll
  const revealed = session.status === 'reveal'
  const maxTally = Math.max(1, ...tally)

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', fontFamily: 'system-ui, sans-serif', color: 'white', padding: '48px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {(session.status === 'question' || session.status === 'reveal') && session.question && (
        <div style={{ marginBottom: 28, maxWidth: 900 }}>
          <div style={{
            background: 'rgba(4,9,26,0.88)', backdropFilter: 'blur(6px)', borderRadius: 20,
            padding: '22px 30px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
              {session.title}
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, marginBottom: 18, lineHeight: 1.25 }}>{session.question}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(session.choices || []).map((choice, i) => {
                const count = tally[i] ?? 0
                const barPct = revealed || session.status === 'question' ? Math.max(4, (count / maxTally) * 100) : 4
                const isCorrect = revealed && session.correctIndex === i
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, background: COLORS[i], flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14,
                      boxShadow: isCorrect ? '0 0 0 3px #2ecc71' : 'none',
                    }} />
                    <div style={{ flex: 1, position: 'relative', height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        position: 'absolute', inset: 0, width: `${barPct}%`,
                        background: isCorrect ? 'linear-gradient(90deg, #1e9e57, #2ecc71)' : 'rgba(255,255,255,0.16)',
                        transition: 'width 0.6s ease',
                      }} />
                      <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{choice}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>{count}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
              {totalAnswers} vote{totalAnswers > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div style={{
          alignSelf: 'flex-start', background: 'rgba(4,9,26,0.88)', backdropFilter: 'blur(6px)',
          borderRadius: 20, padding: '18px 24px', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', minWidth: 260,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            🏆 Classement
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leaderboard.slice(0, 5).map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, fontSize: 14, fontWeight: 900, color: i === 0 ? '#f1c40f' : 'rgba(255,255,255,0.5)' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{e.pseudo}</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#2ecc71' }}>{e.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
