'use client'
import { use, useEffect, useState } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY_DEEP, FDLC_CHOICE_COLORS } from '@/lib/fdlcBranding'

interface SessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  question: string | null; choices: string[] | null; correctIndex: number | null
  roundStartedAt: string | null; roundDurationSeconds: number | null
}
interface Poll {
  session: SessionState; tally: number[]; totalAnswers: number
  leaderboard: { pseudo: string; score: number }[]
}

// Pensé pour être ajouté comme Browser Source dans OBS/Streamlabs (fond
// transparent, plein écran, aucune interaction) -- affiche la question, les
// votes en direct sous forme de barres, le minuteur optionnel et le
// classement à chaque révélation. Ne JAMAIS afficher la bonne réponse avant
// status='reveal' (voir /api/live-quiz, qui filtre déjà côté serveur).
export default function QuizOverlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()
  const [poll, setPoll] = useState<Poll | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

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

  useEffect(() => {
    const s = poll?.session
    if (!s?.roundStartedAt || !s?.roundDurationSeconds) { setRemaining(null); return }
    const end = new Date(s.roundStartedAt).getTime() + s.roundDurationSeconds * 1000
    const t = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)))
    t()
    const id = setInterval(t, 250)
    return () => clearInterval(id)
  }, [poll?.session.roundStartedAt, poll?.session.roundDurationSeconds])

  // globals.css force `body { background: var(--bg) !important }` sur tout le
  // site -- sans cette override, le body opaque derrière rendait cette page
  // (censée être une Browser Source OBS/Streamlabs transparente) entièrement
  // blanche/sombre, peu importe le style des <div> plus bas. Rendu
  // inconditionnellement (avant le `if (!poll)`) pour qu'il n'y ait jamais de
  // flash blanc le temps du tout premier chargement. Porté par ce composant,
  // donc retiré automatiquement en quittant la page.
  const transparentBodyStyle = <style>{`html, body { background: transparent !important; }`}</style>

  if (!poll) return transparentBodyStyle

  const { session, tally, totalAnswers, leaderboard } = poll
  const revealed = session.status === 'reveal'
  const maxTally = Math.max(1, ...tally)

  return (
    <div style={{ minHeight: '100dvh', background: 'transparent', fontFamily: 'system-ui, sans-serif', color: 'white', padding: '48px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {transparentBodyStyle}

      {(session.status === 'question' || session.status === 'reveal') && session.question && (
        <div style={{ marginBottom: 28, maxWidth: 900 }}>
          <div style={{
            background: `${FDLC_NAVY_DEEP}e6`, backdropFilter: 'blur(6px)', borderRadius: 20,
            padding: '22px 30px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={FDLC_LOGO_URL} alt="" style={{ height: 26, width: 26, borderRadius: 6 }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  {session.title}
                </div>
              </div>
              {remaining !== null && !revealed && (
                <div style={{
                  fontSize: 16, fontWeight: 900, padding: '4px 14px', borderRadius: 20,
                  background: remaining <= 5 ? '#c8102e' : 'rgba(255,255,255,0.12)',
                }}>⏱ {remaining}s</div>
              )}
            </div>
            <div className={fdlcFont.className} style={{ fontSize: 28, marginBottom: 18, lineHeight: 1.3 }}>{session.question}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(session.choices || []).map((choice, i) => {
                const count = tally[i] ?? 0
                const barPct = revealed || session.status === 'question' ? Math.max(4, (count / maxTally) * 100) : 4
                const isCorrect = revealed && session.correctIndex === i
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, background: FDLC_CHOICE_COLORS[i], flexShrink: 0,
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

            <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>
              {totalAnswers} vote{totalAnswers > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div style={{
          alignSelf: 'flex-start', background: `${FDLC_NAVY_DEEP}e6`, backdropFilter: 'blur(6px)',
          borderRadius: 20, padding: '18px 24px', border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', minWidth: 260,
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>
            🏆 Classement
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {leaderboard.slice(0, 5).map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, fontSize: 14, fontWeight: 900, color: i === 0 ? '#e8b400' : 'rgba(255,255,255,0.5)' }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>{e.pseudo}</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
