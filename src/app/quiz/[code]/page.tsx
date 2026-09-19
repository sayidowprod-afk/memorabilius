'use client'
import { use, useEffect, useRef, useState } from 'react'
import { fdlcFont } from '@/lib/fdlcFont'
import { FDLC_LOGO_URL, FDLC_NAVY, FDLC_NAVY_DEEP, FDLC_RED, FDLC_CHOICE_COLORS } from '@/lib/fdlcBranding'

interface SessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  roundType: string | null; roundKey: string | null
  question: string | null; choices: string[] | null; correctIndex: number | null
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

  const submitAnswer = async (choiceIndex: number) => {
    if (!poll?.session.roundKey || submitting || timeUp) return
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
          style={{ width: '100%', maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 14 }}
        />
        <button onClick={doJoin} disabled={!pseudo.trim()} style={{
          width: '100%', maxWidth: 280, padding: '14px 16px', borderRadius: 12, border: 'none',
          background: pseudo.trim() ? FDLC_RED : 'rgba(255,255,255,0.1)', color: 'white', fontSize: 16, fontWeight: 900, cursor: 'pointer',
        }}>Rejoindre →</button>
      </Centered>
    )
  }

  if (!poll) return <Centered><Spinner /></Centered>

  const { session, tally, totalAnswers, leaderboard, myPoints } = poll

  if (session.status === 'lobby') {
    return (
      <Centered>
        <Logo small />
        <p className={fdlcFont.className} style={{ fontSize: 19, marginBottom: 8, textAlign: 'center' }}>{session.title}</p>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textAlign: 'center' }}>Salut {pseudo} 👋 La prochaine question arrive bientôt...</p>
        <Spinner />
      </Centered>
    )
  }

  if (session.status === 'ended') {
    return (
      <Centered>
        <p className={fdlcFont.className} style={{ fontSize: 20, marginBottom: 20 }}>🏁 Merci d'avoir joué !</p>
        <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
      </Centered>
    )
  }

  const myChoice = session.roundKey ? myAnswers[session.roundKey] : undefined
  const revealed = session.status === 'reveal'
  const locked = myChoice !== undefined || revealed || timeUp

  return (
    <Centered wide>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {pseudo} · {code}
        </p>
        {remaining !== null && !revealed && (
          <p style={{
            fontSize: 13, fontWeight: 900, padding: '3px 10px', borderRadius: 20,
            background: remaining <= 5 ? FDLC_RED : 'rgba(255,255,255,0.1)', color: 'white',
          }}>⏱ {remaining}s</p>
        )}
      </div>
      <p className={fdlcFont.className} style={{ fontSize: 20, textAlign: 'center', marginBottom: 22, lineHeight: 1.35 }}>{session.question}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
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
              style={{
                position: 'relative', overflow: 'hidden', padding: '16px 14px', borderRadius: 14, textAlign: 'left',
                border: `2px solid ${isCorrect ? '#2ecc71' : isWrongMine ? FDLC_RED : isMine ? FDLC_CHOICE_COLORS[i] : 'rgba(255,255,255,0.16)'}`,
                background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 15, fontWeight: 800, cursor: !locked ? 'pointer' : 'default',
                minHeight: 64,
              }}
            >
              {revealed && (
                <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: isCorrect ? 'rgba(46,204,113,0.22)' : 'rgba(255,255,255,0.06)', transition: 'width 0.4s' }} />
              )}
              <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: 6, background: FDLC_CHOICE_COLORS[i], flexShrink: 0, display: 'inline-block' }} />
                {choice}
                {isMine && <span style={{ marginLeft: 'auto' }}>{revealed ? (isCorrect ? '✅' : '❌') : '☑️'}</span>}
              </span>
              {revealed && <span style={{ position: 'relative', display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{pct}%</span>}
            </button>
          )
        })}
      </div>

      {myChoice !== undefined && !revealed && (
        <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Vote enregistré, en attente des autres...</p>
      )}
      {revealed && myPoints !== null && (
        <p className={fdlcFont.className} style={{ marginTop: 18, fontSize: 20, color: myPoints > 0 ? '#2ecc71' : 'rgba(255,255,255,0.5)' }}>
          {myPoints > 0 ? `+${myPoints} pts` : '0 pt'}
        </p>
      )}
      {timeUp && myChoice === undefined && !revealed && (
        <p style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: FDLC_RED }}>Temps écoulé.</p>
      )}

      {revealed && (
        <div style={{ marginTop: 26, width: '100%' }}>
          <Leaderboard leaderboard={leaderboard} pseudo={pseudo} />
        </div>
      )}
    </Centered>
  )
}

function Logo({ small }: { small?: boolean }) {
  return <img src={FDLC_LOGO_URL} alt="Fédération de la Carte" style={{ height: small ? 46 : 64, width: 'auto', marginBottom: small ? 16 : 28, borderRadius: 10 }} />
}

function Leaderboard({ leaderboard, pseudo }: { leaderboard: { pseudo: string; score: number }[]; pseudo: string }) {
  if (leaderboard.length === 0) return null
  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, textAlign: 'center' }}>🏆 Classement</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leaderboard.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10,
            background: e.pseudo === pseudo ? `${FDLC_RED}59` : 'rgba(255,255,255,0.05)',
          }}>
            <span style={{ width: 20, fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.55)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{e.pseudo}</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ marginTop: 20, width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: FDLC_RED, animation: 'quizSpin 0.8s linear infinite' }}>
      <style>{`@keyframes quizSpin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Centered({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{
      minHeight: '100dvh', background: `radial-gradient(circle at 50% -10%, ${FDLC_NAVY} 0%, ${FDLC_NAVY_DEEP} 65%)`,
      color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: wide ? 440 : 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  )
}
