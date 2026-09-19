'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'

interface Session {
  id: string; code: string; title: string
  status: 'lobby' | 'question' | 'reveal' | 'ended'
  round_type: string | null; round_key: string | null
  round_question: string | null; round_choices: string[] | null; round_correct_index: number | null
}
interface Question {
  id: string; question: string; choices: string[]; correct_index: number; used: boolean
}

// Token capturé une fois expire au bout d'1h (même piège que
// admin/autograph-quiz -- voir page.tsx là-bas) -- toujours en récupérer un
// frais avant d'écrire plutôt que de garder un token en useState.
async function freshToken(): Promise<string | null> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null
}

const SITE_URL = 'https://www.memorabilius.fr'

export default function LiveQuizAdminPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [tally, setTally] = useState<number[]>([])
  const [totalAnswers, setTotalAnswers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  const [qText, setQText] = useState('')
  const [qChoices, setQChoices] = useState(['', '', '', ''])
  const [qCorrect, setQCorrect] = useState(0)

  const loadSessions = async () => {
    const tok = await freshToken()
    if (!tok) { setError('Connecte-toi avec ton compte admin.'); setLoading(false); return }
    const res = await fetch('/api/admin/live-quiz', { headers: { Authorization: `Bearer ${tok}` } })
    if (res.status === 403) { setError('Accès réservé aux admins.'); setLoading(false); return }
    const json = await res.json()
    setSessions(json.sessions || [])
    setLoading(false)
  }

  useEffect(() => { loadSessions() }, [])

  const loadActive = async (id: string) => {
    const tok = await freshToken()
    if (!tok) return
    const res = await fetch(`/api/admin/live-quiz?id=${id}`, { headers: { Authorization: `Bearer ${tok}` } })
    if (!res.ok) return
    const json = await res.json()
    setSession(json.session)
    setQuestions(json.questions || [])
    setParticipantCount(json.participantCount || 0)
  }

  useEffect(() => {
    if (!activeId) return
    loadActive(activeId)
    const id = setInterval(() => loadActive(activeId), 2500)
    return () => clearInterval(id)
  }, [activeId])

  useEffect(() => {
    if (!session?.round_key) { setTally([]); setTotalAnswers(0); return }
    let cancelled = false
    const tick = async () => {
      const res = await fetch(`/api/live-quiz?code=${session.code}`)
      if (!res.ok || cancelled) return
      const json = await res.json()
      setTally(json.tally || [])
      setTotalAnswers(json.totalAnswers || 0)
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [session?.round_key, session?.code])

  useEffect(() => {
    if (!session) { setQrDataUrl(''); return }
    QRCode.toDataURL(`${SITE_URL}/quiz/${session.code}`, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [session?.code])

  const createSession = async () => {
    const tok = await freshToken()
    if (!tok) return
    const res = await fetch('/api/admin/live-quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: newTitle || undefined }),
    })
    if (!res.ok) { alert('Erreur création session'); return }
    const json = await res.json()
    setNewTitle('')
    await loadSessions()
    setActiveId(json.session.id)
  }

  const addQuestion = async () => {
    const choices = qChoices.map(c => c.trim()).filter(Boolean)
    if (!qText.trim() || choices.length < 2 || !activeId) return
    const tok = await freshToken()
    if (!tok) return
    const res = await fetch('/api/admin/live-quiz/questions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: activeId, question: qText.trim(), choices, correctIndex: Math.min(qCorrect, choices.length - 1) }),
    })
    if (!res.ok) { alert('Erreur ajout question'); return }
    setQText(''); setQChoices(['', '', '', '']); setQCorrect(0)
    loadActive(activeId)
  }

  const deleteQuestion = async (id: string) => {
    const tok = await freshToken()
    if (!tok || !activeId) return
    await fetch('/api/admin/live-quiz/questions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ id }),
    })
    loadActive(activeId)
  }

  const runAction = async (action: string, questionId?: string) => {
    if (!activeId) return
    const tok = await freshToken()
    if (!tok) return
    await fetch('/api/admin/live-quiz', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: activeId, action, questionId }),
    })
    loadActive(activeId)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#e74c3c' }}>{error}</div>

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 280, flexShrink: 0 }}>
        <h2 style={{ fontWeight: 900, marginBottom: 12 }}>🎙️ Quiz en direct</h2>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titre (optionnel)"
            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
          <button onClick={createSession} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#003DA6', color: 'white', fontWeight: 700, cursor: 'pointer' }}>+ Créer</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map(s => (
            <button key={s.id} onClick={() => setActiveId(s.id)} style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              border: s.id === activeId ? '2px solid #003DA6' : '1px solid #eee',
              background: s.id === activeId ? 'rgba(0,61,166,0.06)' : 'white',
            }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{s.code} · {s.status}</div>
            </button>
          ))}
        </div>
      </div>

      {session && (
        <div style={{ flex: 1, minWidth: 340, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ width: 260, flexShrink: 0, textAlign: 'center' }}>
            {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid #eee' }} />}
            <p style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, marginTop: 10 }}>{session.code}</p>
            <p style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}</p>
            <p style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>👥 {participantCount} vote{participantCount > 1 ? 's' : ''} sur cette manche</p>
            <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: '#f4f6fb', textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Lien overlay OBS/Streamlabs</div>
              <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}/overlay</code>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ padding: 14, borderRadius: 12, background: '#f4f6fb', marginBottom: 18 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>État : {session.status}</div>
              {session.round_question && (
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{session.round_question}</div>
                  {(session.round_choices || []).map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', fontWeight: session.round_correct_index === i ? 900 : 400, color: session.round_correct_index === i ? '#2ecc71' : undefined }}>
                      <span>{c}</span><span>{tally[i] ?? 0} ({totalAnswers > 0 ? Math.round((tally[i] ?? 0) / totalAnswers * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {session.status === 'question' && (
                  <button onClick={() => runAction('reveal')} style={btnStyle('#2ecc71')}>Révéler</button>
                )}
                {(session.status === 'question' || session.status === 'reveal') && (
                  <button onClick={() => runAction('end_round')} style={btnStyle('#888')}>Retour lobby</button>
                )}
                {session.status !== 'ended' && (
                  <button onClick={() => runAction('end_session')} style={btnStyle('#e74c3c')}>Terminer la session</button>
                )}
              </div>
            </div>

            <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Banque de questions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              {questions.map(q => (
                <div key={q.id} style={{ padding: 10, borderRadius: 10, border: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: q.used ? 0.5 : 1 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{q.question}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{q.choices.join(' · ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => runAction('start_round', q.id)} disabled={session.status === 'question'} style={btnStyle('#003DA6')}>Lancer</button>
                    <button onClick={() => deleteQuestion(q.id)} style={btnStyle('#e74c3c')}>🗑️</button>
                  </div>
                </div>
              ))}
              {questions.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Aucune question pour l'instant.</p>}
            </div>

            <h3 style={{ fontWeight: 800, marginBottom: 10 }}>+ Ajouter une question</h3>
            <input value={qText} onChange={e => setQText(e.target.value)} placeholder="Question"
              style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8 }} />
            {qChoices.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input type="radio" checked={qCorrect === i} onChange={() => setQCorrect(i)} />
                <input value={c} onChange={e => setQChoices(qChoices.map((x, j) => j === i ? e.target.value : x))}
                  placeholder={`Choix ${i + 1}${i >= 2 ? ' (optionnel)' : ''}`}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
              </div>
            ))}
            <button onClick={addQuestion} style={{ ...btnStyle('#003DA6'), marginTop: 6 }}>+ Ajouter</button>
          </div>
        </div>
      )}
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 8, border: 'none', background: color, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
}
