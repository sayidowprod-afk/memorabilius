'use client'
import { useEffect, useState } from 'react'

export interface PromptImage { url: string; cropX: number; cropY: number; cropW: number; cropH: number; rotationDeg: number }
export interface QuizSessionState {
  code: string; title: string; status: 'lobby' | 'question' | 'reveal' | 'ended'
  roundType: string | null
  question: string | null; promptImage: PromptImage | null; choices: string[] | null; correctIndex: number | null
  roundStartedAt: string | null; roundDurationSeconds: number | null
}
export interface QuizPoll {
  session: QuizSessionState; tally: number[]; totalAnswers: number
  leaderboard: { pseudo: string; score: number }[]
  speedFeed: string[]
}

// Partagé entre les deux variantes de l'overlay (compact et grand format,
// voir /quiz/[code]/overlay et /quiz/[code]/overlay/big) -- même polling,
// même calcul de minuteur, juste la mise en page qui diffère.
export function useLiveQuizPoll(code: string) {
  const [poll, setPoll] = useState<QuizPoll | null>(null)
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
    const id = setInterval(tick, 1200)
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

  return { poll, remaining }
}
