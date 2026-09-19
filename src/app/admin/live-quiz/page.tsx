'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import QRCode from 'qrcode'
import { FDLC_LOGO_URL, FDLC_RED, FDLC_NAVY } from '@/lib/fdlcBranding'

interface Session {
  id: string; code: string; title: string
  status: 'lobby' | 'question' | 'reveal' | 'ended'
  round_type: string | null; round_key: string | null
  round_question: string | null; round_choices: string[] | null; round_correct_index: number | null
}
interface Question {
  id: string; question: string; choices: string[]; correct_index: number; used: boolean
}
interface AutographCard {
  id: string; player_name: string; team: string | null
}

// Token capturé une fois expire au bout d'1h (même piège que
// admin/autograph-quiz -- voir page.tsx là-bas) -- toujours en récupérer un
// frais avant d'écrire plutôt que de garder un token en useState.
async function freshToken(): Promise<string | null> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null
}

const SITE_URL = 'https://www.memorabilius.fr'
const emptyForm = { text: '', choices: ['', '', '', ''], correct: 0 }

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

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Minuteur choisi au moment du lancement (pas à la création) -- id de la
  // question/carte pour laquelle le petit panneau "avec minuteur ?" est
  // ouvert, et la valeur en cours de saisie.
  const [launchingId, setLaunchingId] = useState<string | null>(null)
  const [launchDuration, setLaunchDuration] = useState('')

  const [autographCards, setAutographCards] = useState<AutographCard[]>([])
  const [autographLoaded, setAutographLoaded] = useState(false)
  const [autographFilter, setAutographFilter] = useState('')
  const [showAutograph, setShowAutograph] = useState(false)

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

  // Cartes du quiz autographes déjà validées dans /admin/autograph-quiz
  // (même table, aucune duplication) -- chargées à la demande seulement
  // (potentiellement 300+ lignes), pas au montage de la page.
  const loadAutographCards = async () => {
    if (autographLoaded) return
    const tok = await freshToken()
    if (!tok) return
    const res = await fetch('/api/admin/autograph-quiz', { headers: { Authorization: `Bearer ${tok}` } })
    if (!res.ok) return
    const json = await res.json()
    setAutographCards((json.cards || []).map((c: any) => ({ id: c.id, player_name: c.player_name, team: c.team })))
    setAutographLoaded(true)
  }

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

  const startEdit = (q: Question) => {
    setEditingId(q.id)
    setForm({ text: q.question, choices: [...q.choices, '', '', '', ''].slice(0, 4), correct: q.correct_index })
  }
  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }

  const saveQuestion = async () => {
    const choices = form.choices.map(c => c.trim()).filter(Boolean)
    if (!form.text.trim() || choices.length < 2 || !activeId) return
    const tok = await freshToken()
    if (!tok) return
    const correctIndex = Math.min(form.correct, choices.length - 1)
    const res = editingId
      ? await fetch('/api/admin/live-quiz/questions', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ id: editingId, question: form.text.trim(), choices, correctIndex }),
        })
      : await fetch('/api/admin/live-quiz/questions', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ sessionId: activeId, question: form.text.trim(), choices, correctIndex }),
        })
    if (!res.ok) { alert('Erreur enregistrement question'); return }
    cancelEdit()
    loadActive(activeId)
  }

  const deleteQuestion = async (id: string) => {
    const tok = await freshToken()
    if (!tok || !activeId) return
    await fetch('/api/admin/live-quiz/questions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ id }),
    })
    if (editingId === id) cancelEdit()
    loadActive(activeId)
  }

  const runAction = async (action: string, extra?: { questionId?: string; cardId?: string; durationSeconds?: number }) => {
    if (!activeId) return
    const tok = await freshToken()
    if (!tok) return
    await fetch('/api/admin/live-quiz', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: activeId, action, ...extra }),
    })
    loadActive(activeId)
  }

  const confirmLaunch = (extra: { questionId?: string; cardId?: string }) => {
    const durationSeconds = launchDuration.trim() ? Number(launchDuration) : undefined
    runAction('start_round', { ...extra, durationSeconds })
    setLaunchingId(null); setLaunchDuration('')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: FDLC_RED }}>{error}</div>

  const filteredAutograph = autographFilter.trim()
    ? autographCards.filter(c => c.player_name.toLowerCase().includes(autographFilter.trim().toLowerCase()))
    : autographCards

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 14,
        background: FDLC_NAVY, color: 'white', marginBottom: 20, flexWrap: 'wrap',
      }}>
        <img src={FDLC_LOGO_URL} alt="" style={{ height: 34, width: 34, borderRadius: 8, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 900, fontSize: 16 }}>🎙️ Quiz en direct</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Fédération de la Carte</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 20, alignItems: 'start' }} className="live-quiz-grid">
        <style>{`
          @media (max-width: 720px) {
            .live-quiz-grid { grid-template-columns: 1fr !important; }
            .live-quiz-panels { grid-template-columns: 1fr !important; }
          }
        `}</style>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titre (optionnel)"
              style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
            <button onClick={createSession} style={btnStyle(FDLC_RED)}>+ Créer</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sessions.map(s => (
              <button key={s.id} onClick={() => setActiveId(s.id)} style={{
                textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                border: s.id === activeId ? `2px solid ${FDLC_NAVY}` : '1px solid #eee',
                background: s.id === activeId ? 'rgba(12,26,61,0.06)' : 'white',
              }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{s.code} · {s.status}</div>
              </button>
            ))}
          </div>
        </div>

        {session && (
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, minWidth: 0 }} className="live-quiz-panels">
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: '100%', maxWidth: 220, height: 'auto', borderRadius: 12, border: '1px solid #eee' }} />}
              <p style={{ fontSize: 24, fontWeight: 900, letterSpacing: 2, marginTop: 10 }}>{session.code}</p>
              <p style={{ fontSize: 12, color: '#888', wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}</p>
              <p style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>👥 {participantCount} vote{participantCount > 1 ? 's' : ''} sur cette manche</p>
              <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: '#f4f6fb', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Lien overlay OBS/Streamlabs</div>
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}/overlay</code>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ padding: 14, borderRadius: 12, background: '#f4f6fb', marginBottom: 18 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>État : {session.status}</div>
                {(session.round_question || session.round_type === 'autograph') && (
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{session.round_question || '✍️ Signature (quiz autographes)'}</div>
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
                    <button onClick={() => runAction('end_session')} style={btnStyle(FDLC_RED)}>Terminer la session</button>
                  )}
                </div>
              </div>

              <h3 style={{ fontWeight: 800, marginBottom: 10 }}>Banque de questions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {questions.map(q => (
                  <div key={q.id} style={{ padding: 10, borderRadius: 10, border: '1px solid #eee', opacity: q.used ? 0.7 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{q.question}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{q.choices.join(' · ')}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setLaunchingId(launchingId === q.id ? null : q.id)} disabled={session.status === 'question'} style={btnStyle(FDLC_NAVY)}>Lancer</button>
                        <button onClick={() => startEdit(q)} style={btnStyle('#888')}>✏️</button>
                        <button onClick={() => deleteQuestion(q.id)} style={btnStyle(FDLC_RED)}>🗑️</button>
                      </div>
                    </div>
                    {launchingId === q.id && (
                      <LaunchTimerPicker
                        duration={launchDuration} setDuration={setLaunchDuration}
                        onLaunch={() => confirmLaunch({ questionId: q.id })}
                        onCancel={() => { setLaunchingId(null); setLaunchDuration('') }}
                      />
                    )}
                  </div>
                ))}
                {questions.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Aucune question pour l'instant.</p>}
              </div>

              <h3 style={{ fontWeight: 800, marginBottom: 10 }}>{editingId ? '✏️ Modifier la question' : '+ Ajouter une question'}</h3>
              <input value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} placeholder="Question"
                style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginBottom: 8, boxSizing: 'border-box' }} />
              {form.choices.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input type="radio" checked={form.correct === i} onChange={() => setForm({ ...form, correct: i })}
                    style={{ width: 16, height: 16, flexShrink: 0, accentColor: FDLC_RED }} />
                  <input value={c} onChange={e => setForm({ ...form, choices: form.choices.map((x, j) => j === i ? e.target.value : x) })}
                    placeholder={`Choix ${i + 1}${i >= 2 ? ' (optionnel)' : ''}`}
                    style={{ flex: '1 1 0%', minWidth: 0, padding: 8, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveQuestion} style={btnStyle(FDLC_RED)}>{editingId ? 'Enregistrer' : '+ Ajouter'}</button>
                {editingId && <button onClick={cancelEdit} style={btnStyle('#888')}>Annuler</button>}
              </div>

              <div style={{ marginTop: 26, borderTop: '1px solid #eee', paddingTop: 18 }}>
                <button onClick={() => { setShowAutograph(v => !v); if (!showAutograph) loadAutographCards() }}
                  style={{ ...btnStyle(FDLC_NAVY), marginBottom: showAutograph ? 12 : 0 }}>
                  ✍️ {showAutograph ? 'Masquer' : 'Lancer une carte du quiz autographes'}
                </button>
                {showAutograph && (
                  <div>
                    <input value={autographFilter} onChange={e => setAutographFilter(e.target.value)} placeholder="Filtrer par nom de joueur..."
                      style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }} />
                    {!autographLoaded ? (
                      <p style={{ fontSize: 13, color: '#888' }}>Chargement...</p>
                    ) : filteredAutograph.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#888' }}>Aucune carte validée trouvée (voir /admin/autograph-quiz).</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                        {filteredAutograph.slice(0, 40).map(c => (
                          <div key={c.id} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #eee' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.player_name}</div>
                                {c.team && <div style={{ fontSize: 11, color: '#888' }}>{c.team}</div>}
                              </div>
                              <button onClick={() => setLaunchingId(launchingId === c.id ? null : c.id)} disabled={session.status === 'question'} style={{ ...btnStyle(FDLC_NAVY), flexShrink: 0 }}>Lancer</button>
                            </div>
                            {launchingId === c.id && (
                              <LaunchTimerPicker
                                duration={launchDuration} setDuration={setLaunchDuration}
                                onLaunch={() => confirmLaunch({ cardId: c.id })}
                                onCancel={() => { setLaunchingId(null); setLaunchDuration('') }}
                              />
                            )}
                          </div>
                        ))}
                        {filteredAutograph.length > 40 && (
                          <p style={{ fontSize: 11, color: '#888' }}>{filteredAutograph.length - 40} de plus, affine ta recherche...</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LaunchTimerPicker({ duration, setDuration, onLaunch, onCancel }: {
  duration: string; setDuration: (v: string) => void; onLaunch: () => void; onCancel: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px dashed #ddd' }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#888', flexShrink: 0 }}>⏱ Minuteur (s)</label>
      <input type="number" min={5} value={duration} onChange={e => setDuration(e.target.value)} placeholder="sans minuteur"
        style={{ width: 110, minWidth: 0, padding: 6, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
      <button onClick={onLaunch} style={btnStyle('#2ecc71')}>▶️ Lancer</button>
      <button onClick={onCancel} style={btnStyle('#888')}>Annuler</button>
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 8, border: 'none', background: color, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
}
