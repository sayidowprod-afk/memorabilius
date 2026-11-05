'use client'
// Micro de recherche vocale (reconnaissance vocale du navigateur). N'apparaît que si l'appareil sait le faire ; rien n'est envoyé à Memorabilius.
import { useEffect, useRef, useState } from 'react'

type Rec = {
  lang: string; interimResults: boolean; maxAlternatives: number
  start: () => void; stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null
}

export default function VoiceButton({ onText, lang = 'fr-FR', style }: { onText: (text: string) => void; lang?: string; style?: React.CSSProperties }) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef<Rec | null>(null)

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
    const t = window.setTimeout(() => setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition)), 0)
    return () => window.clearTimeout(t)
  }, [])

  if (!supported) return null

  const toggle = () => {
    if (listening) { recRef.current?.stop(); return }
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = e => { const t = e.results[0]?.[0]?.transcript?.trim(); if (t) onText(t) }
    rec.onend = () => setListening(false)
    rec.onerror = e => { setListening(false); setError(e.error === 'not-allowed' ? 'Micro refusé par l’appareil' : e.error === 'no-speech' ? 'Rien entendu' : 'Reconnaissance impossible'); window.setTimeout(() => setError(''), 3000) }
    recRef.current = rec
    setError(''); setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  return (
    <>
      <button type="button" className={'da-voice' + (listening ? ' on' : '')} onClick={toggle} aria-label={listening ? 'Arrêter l’écoute' : 'Recherche vocale'} aria-pressed={listening} title="Recherche vocale" style={style}>🎙</button>
      {error && <span role="status" className="da-voice-msg">{error}</span>}
    </>
  )
}
