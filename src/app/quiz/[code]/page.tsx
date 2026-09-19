'use client'
import { use, useEffect, useRef, useState } from 'react'

interface SessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  roundType: string | null; roundKey: string | null
  question: string | null; choices: string[] | null; correctIndex: number | null
}
interface Poll {
  session: SessionState; tally: number[]; totalAnswers: number
  leaderboard: { pseudo: string; score: number }[]
}

function getParticipantId(): string {
  let id = localStorage.getItem('quiz_participant_id')
  if (!id) {
    id = (crypto.randomUUID?.() || `p-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem('quiz_participant_id', id)
  }
  return id
}

const COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71']

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
        const res = await fetch(`/api/live-quiz?code=${code}`)
        if (res.status === 404) { if (!cancelled) setNotFound(true); return }
        const json = await res.json()
        if (!cancelled) setPoll(json)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [joined, code])

  const submitAnswer = async (choiceIndex: number) => {
    if (!poll?.session.roundKey || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/live-quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, participantId: participantIdRef.current, pseudo, choiceIndex }),
      })
      const next = { ...myAnswers, [poll.session.roundKey]: choiceIndex }
      setMyAnswers(next)
      localStorage.setItem(`quiz_my_answers_${code}`, JSON.stringify(next))
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
        <img src="/memorabilius-logo.png" alt="" style={{ height: 34, marginBottom: 28 }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Rejoindre le quiz {code}
        </p>
        <input
          value={pseudo}
          onChange={e => setPseudo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doJoin()}
          placeholder="Ton pseudo"
          maxLength={20}
          autoFocus
          style={{ width: '100%', maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 14 }}
        />
        <button onClick={doJoin} disabled={!pseudo.trim()} style={{
          width: '100%', maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: 'none',
          background: pseudo.trim() ? '#003DA6' : 'rgba(255,255,255,0.1)', color: 'white', fontSize: 16, fontWeight: 900, cursor: 'pointer',
        }}>Rejoindre →</button>
      </Centered>
    )
  }

  if (!poll) return <Centered><Spinner /></Centered>

  const { session, tally, totalAnswers, leaderboard } = poll

  if (session.status === 'lobby') {
    return (
      <Centered>
        <img src="/memorabilius-logo.png" alt="" style={{ height: 30, marginBottom: 22 }} />
        <p style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>{session.title}</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Salut {pseudo} 👋 La prochaine question arrive bientôt...</p>
        <Spinner />
      </Centered>
    )
  }

  if (session.status === 'ended') {
    return (
      <Centered>
        <p style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>🏁 Merci d'avoir joué !</p>
        <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
      </Centered>
    )
  }

  const myChoice = session.roundKey ? myAnswers[session.roundKey] : undefined
  const revealed = session.status === 'reveal'

  return (
    <Centered wide>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {pseudo} · {code}
      </p>
      <p style={{ fontSize: 22, fontWeight: 900, textAlign: 'center', marginBottom: 22, lineHeight: 1.3 }}>{session.question}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {(session.choices || []).map((choice, i) => {
          const isMine = myChoice === i
          const isCorrect = revealed && session.correctIndex === i
          const isWrongMine = revealed && isMine && !isCorrect
          const pct = totalAnswers > 0 ? Math.round((tally[i] ?? 0) / totalAnswers * 100) : 0
          return (
            <button
              key={i}
              disabled={myChoice !== undefined || revealed}
              onClick={() => submitAnswer(i)}
              style={{
                position: 'relative', overflow: 'hidden', padding: '16px 14px', borderRadius: 14, textAlign: 'left',
                border: `2px solid ${isCorrect ? '#2ecc71' : isWrongMine ? '#e74c3c' : isMine ? COLORS[i] : 'rgba(255,255,255,0.14)'}`,
                background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 15, fontWeight: 800, cursor: myChoice === undefined && !revealed ? 'pointer' : 'default',
                minHeight: 64,
              }}
            >
              {revealed && (
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isCorrect ? 'rgba(46,204,113,0.22)' : 'rgba(255,255,255,0.06)', transition: 'width 0.4s' }} />
              )}
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: COLORS[i], flexShrink: 0, display: 'inline-block' }} />
                {choice}
                {isMine && <span style={{ marginLeft: 'auto' }}>{revealed ? (isCorrect ? '✅' : '❌') : '☑️'}</span>}
              </span>
              {revealed && <span style={{ position: 'relative', display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{pct}%</span>}
            </button>
          )
        })}
      </div>

      {myChoice !== undefined && !revealed && (
        <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Vote enregistré, en attente des autres...</p>
      )}

      {revealed && (
        <div style={{ marginTop: 26, width: '100%' }}>
          <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
        </div>
      )}
    </Centered>
  )
}

function Leaderboard({ leaderboard, pseudo }: { leaderboard: { pseudo: string; score: number }[]; pseudo: string }) {
  if (leaderboard.length === 0) return null
  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, textAlign: 'center' }}>🏆 Classement</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leaderboard.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
            background: e.pseudo === pseudo ? 'rgba(0,61,166,0.35)' : 'rgba(255,255,255,0.05)',
          }}>
            <span style={{ width: 20, fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.5)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{e.pseudo}</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#2ecc71' }}>{e.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ marginTop: 20, width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#003DA6', animation: 'quizSpin 0.8s linear infinite' }}>
      <style>{`@keyframes quizSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Centered({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: '#04091a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: wide ? 420 : 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
