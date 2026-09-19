'use client'
import { useEffect, useRef, useState } from 'react'

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
  speedFeed: { pseudo: string; ms: number | null }[]
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

  // Signaux "ça vient de changer" pour animer l'overlay (rebond du compteur
  // de votes, confettis à la révélation) sans que chaque page ne doive
  // recomparer elle-même l'état précédent -- juste des booléens qui
  // s'allument brièvement puis se réinitialisent.
  const [voteBump, setVoteBump] = useState(false)
  const prevTotalRef = useRef(0)
  useEffect(() => {
    const total = poll?.totalAnswers ?? 0
    if (total > prevTotalRef.current) {
      setVoteBump(true)
      const t = setTimeout(() => setVoteBump(false), 420)
      prevTotalRef.current = total
      return () => clearTimeout(t)
    }
    prevTotalRef.current = total
  }, [poll?.totalAnswers])

  const [justRevealed, setJustRevealed] = useState(false)
  const prevStatusRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const status = poll?.session.status
    if (status === 'reveal' && prevStatusRef.current && prevStatusRef.current !== 'reveal') {
      setJustRevealed(true)
      const t = setTimeout(() => setJustRevealed(false), 1600)
      prevStatusRef.current = status
      return () => clearTimeout(t)
    }
    prevStatusRef.current = status
  }, [poll?.session.status])

  return { poll, remaining, voteBump, justRevealed }
}

// "1.2s" -- pour le fil "plus rapides" (temps de reponse depuis le
// lancement de la manche, stocke en base au moment du vote).
export function formatResponseMs(ms: number | null): string {
  if (ms == null) return ''
  return `${(ms / 1000).toFixed(1)}s`
}
