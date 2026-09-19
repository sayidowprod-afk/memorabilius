'use client'
import { use, useEffect, useRef, useState } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY, FDLC_NAVY_DEEP, FDLC_RED, FDLC_CHOICE_COLORS } from '@/lib/fdlcBranding'
import SignatureCrop from '@/components/SignatureCrop'

interface PromptImage { url: string; cropX: number; cropY: number; cropW: number; cropH: number; rotationDeg: number }
interface SessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  roundType: string | null; roundKey: string | null
  question: string | null; promptImage: PromptImage | null; choices: string[] | null; correctIndex: number | null
  roundStartedAt: string | null; roundDurationSeconds: number | null
}
interface Poll {
  session: SessionState; tally: number[]; totalAnswers: number
  leaderboard: { pseudo: string; score: number }[]
  myPoints: number | null
}

function getParticipantId(): string {
  let id = localStorage.getItem('quiz_participant_id')
  if (!id) {
    id = (crypto.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem('quiz_participant_id', id)
  }
  return id
}

function useCountdown(startedAt: string | null, durationSeconds: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!startedAt || !durationSeconds) { setRemaining(null); return }
    const end = new Date(startedAt).getTime() + durationSeconds * 1000
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [startedAt, durationSeconds])
  return remaining
}

export default function QuizJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params)
  const code = rawCode.toUpperCase()

  const [pseudo, setPseudo] = useState('')
  const [joined, setJoined] = useState(false)
  const [poll, setPoll] = useState<Poll | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [myAnswers, setMyAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const participantIdRef = useRef<string>('')

  useEffect(() => {
    participantIdRef.current = getParticipantId()
    const savedPseudo = localStorage.getItem('quiz_pseudo')
    if (savedPseudo) { setPseudo(savedPseudo); setJoined(true) }
    try {
      const saved = JSON.parse(localStorage.getItem(`quiz_my_answers_${code}`) || '{}')
      setMyAnswers(saved)
    } catch {}
  }, [code])

  useEffect(() => {
    if (!joined) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/live-quiz?code=${code}&participantId=${encodeURIComponent(participantIdRef.current)}`)
        if (res.status === 404) { if (!cancelled) setNotFound(true); return }
        const json = await res.json()
        if (!cancelled) setPoll(json)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [joined, code])

  const remaining = useCountdown(poll?.session.roundStartedAt ?? null, poll?.session.roundDurationSeconds ?? null)
  const timeUp = remaining === 0
  const timerPct = remaining !== null && poll?.session.roundDurationSeconds
    ? Math.max(0, Math.min(100, (remaining / poll.session.roundDurationSeconds) * 100))
    : null

  const [answerError, setAnswerError] = useState('')

  const submitAnswer = async (choiceIndex: number) => {
    if (!poll?.session.roundKey || submitting || timeUp) return
    setSubmitting(true)
    setAnswerError('')
    try {
      const res = await fetch('/api/live-quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, participantId: participantIdRef.current, pseudo, choiceIndex }),
      })
      // Le vote affichait "enregistré" même quand la requête échouait (ex:
      // migration pas encore appliquée côté DB, 500) -- l'écran spectateur
      // montrait un vote pris en compte alors que quiz_answers restait vide
      // côté serveur, l'animateur voyait 0 vote sans que personne comprenne
      // pourquoi. Ne marquer comme répondu qu'après un succès confirmé.
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setAnswerError(json.error || 'Échec de l\'envoi, réessaie.')
        return
      }
      const next = { ...myAnswers, [poll.session.roundKey]: choiceIndex }
      setMyAnswers(next)
      localStorage.setItem(`quiz_my_answers_${code}`, JSON.stringify(next))
    } catch {
      setAnswerError('Échec de l\'envoi, réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  const doJoin = () => {
    if (!pseudo.trim()) return
    localStorage.setItem('quiz_pseudo', pseudo.trim())
    setPseudo(pseudo.trim())
    setJoined(true)
  }

  if (notFound) {
    return <Centered><p style={{ fontSize: 18, fontWeight: 700 }}>Code invalide ou session terminée.</p></Centered>
  }

  if (!joined) {
    return (
      <Centered>
        <Logo />
        <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Rejoindre le quiz {code}
        </p>
        <input
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doJoin()}
          placeholder="Ton pseudo"
          maxLength={20}
          autoFocus
          style={{ width: '100%', maxWidth: 280, padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: 17, fontWeight: 700, textAlign: 'center', marginBottom: 14 }}
        />
        <button className="quiz-btn-pop" onClick={doJoin} disabled={!pseudo.trim()} style={{
          width: '100%', maxWidth: 280, padding: '16px 18px', borderRadius: 14, border: 'none',
          background: pseudo.trim() ? FDLC_RED : 'rgba(255,255,255,0.1)', color: 'white', fontSize: 17, fontWeight: 900, cursor: 'pointer',
          boxShadow: pseudo.trim() ? '0 8px 24px rgba(200,16,46,0.4)' : 'none',
        }}>Rejoindre →</button>
      </Centered>
    )
  }

  if (!poll) return <Centered><Spinner /></Centered>

  const { session, tally, totalAnswers, leaderboard, myPoints } = poll

  if (session.status === 'lobby') {
    return (
      <Centered wide={leaderboard.length > 0}>
        <Logo small />
        <p className={fdlcFont.className} style={{ fontSize: 21, marginBottom: 8, textAlign: 'center' }}>{session.title}</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textAlign: 'center', marginBottom: leaderboard.length > 0 ? 24 : 0 }}>
          Salut {pseudo} 👋 La prochaine question arrive<span className="quiz-dots" />
        </p>
        {leaderboard.length > 0 ? <Leaderboard leaderboard={leaderboard} pseudo={pseudo} /> : <Spinner />}
      </Centered>
    )
  }

  if (session.status === 'ended') {
    return (
      <Centered>
        <p className={fdlcFont.className} style={{ fontSize: 22, marginBottom: 20 }}>🏁 Merci d'avoir joué !</p>
        <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
      </Centered>
    )
  }

  const myChoice = session.roundKey ? myAnswers[session.roundKey] : undefined
  const revealed = session.status === 'reveal'
  const locked = myChoice !== undefined || revealed || timeUp
  const myCorrect = revealed && myChoice !== undefined && session.correctIndex === myChoice

  return (
    <Centered wide noPad>
      {timerPct !== null && !revealed && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.08)', zIndex: 5 }}>
          <div style={{
            height: '100%', width: `${timerPct}%`, transition: 'width 0.25s linear',
            background: timerPct <= 25 ? FDLC_RED : 'linear-gradient(90deg, #1d428a, #c8102e)',
          }} />
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 440, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {pseudo} · {code}
          </p>
          {remaining !== null && !revealed && (
            <p className={remaining <= 5 ? 'quiz-pulse' : undefined} style={{
              fontSize: 13, fontWeight: 900, padding: '4px 12px', borderRadius: 20,
              background: remaining <= 5 ? FDLC_RED : 'rgba(255,255,255,0.1)', color: 'white',
            }}>⏱ {remaining}s</p>
          )}
        </div>

        {revealed && myChoice !== undefined && (
          <div className="quiz-pop" style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>{myCorrect ? '🎉' : '💥'}</div>
            <div className={fdlcFont.className} style={{ fontSize: 22, color: myCorrect ? '#2ecc71' : FDLC_RED, marginTop: 6 }}>
              {myCorrect ? 'Bien joué !' : 'Raté !'}
            </div>
            {myPoints !== null && (
              <div style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {myPoints > 0 ? `+${myPoints} pts` : '0 pt'}
              </div>
            )}
          </div>
        )}

        {session.roundType === 'autograph' && session.promptImage ? (
          <div style={{ width: '100%', maxWidth: 300, margin: '0 auto 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              ✍️ Quelle est cette signature ?
            </p>
            <SignatureCrop {...session.promptImage} style={{ boxShadow: '0 14px 34px rgba(0,0,0,0.55)' }} />
          </div>
        ) : (
          <p className={fdlcFont.className} style={{ fontSize: 22, textAlign: 'center', marginBottom: 20, lineHeight: 1.35 }}>{session.question}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
          {(session.choices || []).map((choice, i) => {
            const isMine = myChoice === i
            const isCorrect = revealed && session.correctIndex === i
            const isWrongMine = revealed && isMine && !isCorrect
            const pct = totalAnswers > 0 ? Math.round((tally[i] ?? 0) / totalAnswers * 100) : 0
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => submitAnswer(i)}
                className={!locked ? 'quiz-choice-btn' : undefined}
                style={{
                  position: 'relative', overflow: 'hidden', padding: '18px 12px 14px', borderRadius: 16, textAlign: 'left',
                  border: `2px solid ${isCorrect ? '#2ecc71' : isWrongMine ? FDLC_RED : isMine ? FDLC_CHOICE_COLORS[i] : 'rgba(255,255,255,0.14)'}`,
                  background: isCorrect ? 'rgba(46,204,113,0.14)' : 'rgba(255,255,255,0.05)',
                  color: 'white', fontSize: 15, fontWeight: 800, cursor: !locked ? 'pointer' : 'default',
                  minHeight: 96, display: 'flex', flexDirection: 'column', gap: 10,
                  opacity: revealed && !isCorrect && !isWrongMine ? 0.55 : 1,
                  transition: 'opacity 0.3s, transform 0.15s',
                }}
              >
                {revealed && (
                  <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isCorrect ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.05)', transition: 'width 0.5s' }} />
                )}
                <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 24, height: 24, flexShrink: 0, borderRadius: 8, background: FDLC_CHOICE_COLORS[i],
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'white',
                  }}>{i + 1}</span>
                  {isMine && <span style={{ marginLeft: 'auto', fontSize: 16 }}>{revealed ? (isCorrect ? '✅' : '❌') : '☑️'}</span>}
                </span>
                <span style={{ position: 'relative', lineHeight: 1.25 }}>{choice}</span>
                {revealed && <span style={{ position: 'relative', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{pct}%</span>}
              </button>
            )
          })}
        </div>

        {myChoice !== undefined && !revealed && (
          <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Vote enregistré, en attente des autres<span className="quiz-dots" /></p>
        )}
        {answerError && myChoice === undefined && (
          <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: FDLC_RED }}>{answerError}</p>
        )}
        {timeUp && myChoice === undefined && !revealed && (
          <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: FDLC_RED }}>Temps écoulé.</p>
        )}

        {revealed && (
          <div style={{ marginTop: 26, width: '100%' }}>
            <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
          </div>
        )}
      </div>
    </Centered>
  )
}


function Logo({ small }: { small?: boolean }) {
  return <img src={FDLC_LOGO_URL} alt="Fédération de la Carte" style={{ height: small ? 46 : 64, width: 'auto', marginBottom: small ? 16 : 28, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }} />
}

function Leaderboard({ leaderboard, pseudo }: { leaderboard: { pseudo: string; score: number }[]; pseudo: string }) {
  if (leaderboard.length === 0) return null
  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, textAlign: 'center' }}>🏆 Classement</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leaderboard.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 12,
            background: e.pseudo === pseudo ? `${FDLC_RED}4d` : 'rgba(255,255,255,0.05)',
            border: e.pseudo === pseudo ? `1px solid ${FDLC_RED}` : '1px solid transparent',
          }}>
            <span style={{ width: 20, fontSize: 13, fontWeight: 900, color: i === 0 ? '#e8b400' : 'rgba(255,255,255,0.55)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{e.pseudo}</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return <div className="quiz-spinner" style={{ marginTop: 20 }} />
}

function Centered({ children, wide, noPad }: { children: React.ReactNode; wide?: boolean; noPad?: boolean }) {
  return (
    <div style={{
      minHeight: '100dvh', position: 'relative', overflow: 'hidden',
      background: `radial-gradient(circle at 50% -10%, ${FDLC_NAVY} 0%, ${FDLC_NAVY_DEEP} 65%)`,
      color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: noPad ? 0 : '24px 16px', fontFamily: 'system-ui, sans-serif',
    }}>
      <style>{`
        @keyframes quizSpin { to { transform: rotate(360deg) } }
        .quiz-spinner { width: 30px; height: 30px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); border-top-color: ${FDLC_RED}; animation: quizSpin 0.8s linear infinite; }
        @keyframes quizPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        .quiz-pulse { animation: quizPulse 0.8s ease-in-out infinite; }
        @keyframes quizPop { from { opacity: 0; transform: scale(0.7) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .quiz-pop { animation: quizPop 0.4s cubic-bezier(.2,1.4,.4,1) both; }
        .quiz-choice-btn:active { transform: scale(0.96); }
        .quiz-btn-pop:active { transform: scale(0.96); }
        .quiz-dots::after { content: '...'; display: inline-block; width: 1.2em; text-align: left; animation: quizDotsFade 1.2s steps(4) infinite; }
        @keyframes quizDotsFade { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
      `}</style>
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%', width: 340, height: 340, borderRadius: '50%',
        background: `radial-gradient(circle, ${FDLC_RED}33, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-10%', width: 380, height: 380, borderRadius: '50%',
        background: 'radial-gradient(circle, #1d428a44, transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: wide ? 440 : 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
