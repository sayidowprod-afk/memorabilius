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
  round_started_at: string | null; round_duration_seconds: number | null
}
interface Question {
  id: string; question: string; choices: string[]; correct_index: number; used: boolean
}
interface AutographCard {
  id: string; player_name: string; team: string | null
}
type Target = { type: 'question' | 'card'; id: string; label: string } | null

// Token capturé une fois expire au bout d'1h (même piège que
// admin/autograph-quiz -- voir page.tsx là-bas) -- toujours en récupérer un
// frais avant d'écrire plutôt que de garder un token en useState.
async function freshToken(): Promise<string | null> {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null
}

const SITE_URL = 'https://www.memorabilius.fr'
const emptyForm = { text: '', choices: ['', '', '', ''], correct: 0 }

const STATUS_LABEL: Record<Session['status'], string> = {
  lobby: 'En attente', question: 'Question en cours', reveal: 'Révélé', ended: 'Terminée',
}
const STATUS_COLOR: Record<Session['status'], string> = {
  lobby: '#888', question: FDLC_RED, reveal: '#2ecc71', ended: '#555',
}

// Refonte complète (l'ancienne version etait jugee "pas pratique") -- la
// logique centrale : UN SEUL point de controle "en direct" tout en haut,
// toujours visible, qui change de forme selon l'etat (lobby -> bouton
// Lancer geant / question -> vote en direct + Reveler / reveal -> resultat +
// Manche suivante). Choisir QUOI lancer se fait en cliquant une ligne dans
// la banque de questions (repliee par defaut une fois la session en cours,
// pour ne pas polluer l'ecran pendant le show) -- plus besoin de chercher un
// bouton "Lancer" perdu dans une liste, un seul endroit fait foi.
export default function LiveQuizAdminPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [participantCount, setParticipantCount] = useState(0)
  const [tally, setTally] = useState<number[]>([])
  const [totalAnswers, setTotalAnswers] = useState(0)
  const [leaderboard, setLeaderboard] = useState<{ pseudo: string; score: number }[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showLinks, setShowLinks] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showBank, setShowBank] = useState(false)

  // Cible du GRAND bouton Lancer -- choisie en cliquant une ligne dans la
  // banque/les autographes. Se recale automatiquement sur la prochaine
  // question non utilisee si rien n'est choisi ou si la cible a disparu.
  const [target, setTarget] = useState<Target>(null)
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
    setTarget(null); setShowBank(false); setShowAutograph(false)
    if (!activeId) return
    loadActive(activeId)
    const id = setInterval(() => loadActive(activeId), 2500)
    return () => clearInterval(id)
  }, [activeId])

  useEffect(() => {
    if (!session?.code) { setTally([]); setTotalAnswers(0); setLeaderboard([]); return }
    let cancelled = false
    const tick = async () => {
      const res = await fetch(`/api/live-quiz?code=${session.code}`)
      if (!res.ok || cancelled) return
      const json = await res.json()
      setTally(json.tally || [])
      setTotalAnswers(json.totalAnswers || 0)
      setLeaderboard(json.leaderboard || [])
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(id) }
  }, [session?.round_key, session?.code, session?.status])

  // Minuteur en direct (comme l'overlay) -- pour que l'animateur voie le
  // decompte sans devoir garder un second ecran ouvert.
  useEffect(() => {
    if (!session?.round_started_at || !session?.round_duration_seconds) { setRemaining(null); return }
    const end = new Date(session.round_started_at).getTime() + session.round_duration_seconds * 1000
    const tick = () => setRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [session?.round_started_at, session?.round_duration_seconds])

  useEffect(() => {
    if (!session) { setQrDataUrl(''); return }
    QRCode.toDataURL(`${SITE_URL}/quiz/${session.code}`, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => {})
  }, [session?.code])

  // Se recale sur la prochaine question non utilisee tant que l'animateur
  // n'a rien choisi lui-meme (ou que son choix precedent vient d'etre
  // consomme/supprime) -- le gros bouton a toujours quelque chose a lancer
  // sans action manuelle si la banque est preparee a l'avance.
  useEffect(() => {
    // Ne pas ecraser un choix "carte autographe" (pas de notion de "deja
    // utilisee" pour elles) ni une question encore valide ET pas encore
    // jouee -- sinon une question tout juste lancee/marquee "used" resterait
    // affichee comme "prochaine manche" au lieu de passer a la suivante.
    if (target && target.type === 'card') return
    if (target && target.type === 'question' && questions.some(q => q.id === target.id && !q.used)) return
    const next = questions.find(q => !q.used)
    setTarget(next ? { type: 'question', id: next.id, label: next.question } : null)
  }, [questions, target])

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
    setNewTitle(''); setShowCreate(false)
    await loadSessions()
    setActiveId(json.session.id)
  }

  const deleteSession = async (id: string, title: string) => {
    if (!confirm(`Supprimer définitivement "${title}" et toutes ses questions/réponses ?`)) return
    const tok = await freshToken()
    if (!tok) return
    await fetch('/api/admin/live-quiz', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: id }),
    })
    if (activeId === id) { setActiveId(null); setSession(null) }
    loadSessions()
  }

  // Duplique la banque de questions d'une session dans une nouvelle session
  // (nouveau code, jamais jouee) -- pratique pour rejouer le meme quiz a une
  // autre emission sans re-taper toutes les questions.
  const duplicateSession = async (source: Session) => {
    const tok = await freshToken()
    if (!tok) return
    const res = await fetch('/api/admin/live-quiz', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ title: `${source.title} (copie)`, duplicateFromId: source.id }),
    })
    if (!res.ok) { alert('Erreur duplication'); return }
    const json = await res.json()
    await loadSessions()
    setActiveId(json.session.id)
  }

  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const startRename = () => { if (!session) return; setRenameValue(session.title); setRenaming(true) }
  const saveRename = async () => {
    if (!activeId || !renameValue.trim()) return
    const tok = await freshToken()
    if (!tok) return
    await fetch('/api/admin/live-quiz', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: activeId, action: 'rename', title: renameValue.trim() }),
    })
    setRenaming(false)
    loadActive(activeId)
    loadSessions()
  }

  const startEdit = (q: Question) => {
    setEditingId(q.id)
    setForm({ text: q.question, choices: [...q.choices, '', '', '', ''].slice(0, 4), correct: q.correct_index })
    setShowBank(true)
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
    if (!confirm('Supprimer cette question ?')) return
    const tok = await freshToken()
    if (!tok || !activeId) return
    await fetch('/api/admin/live-quiz/questions', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ id }),
    })
    if (editingId === id) cancelEdit()
    if (target?.type === 'question' && target.id === id) setTarget(null)
    loadActive(activeId)
  }

  const runAction = async (action: string, extra?: { questionId?: string; cardId?: string; durationSeconds?: number }) => {
    if (!activeId || busy) return
    setBusy(true)
    const tok = await freshToken()
    if (!tok) { setBusy(false); return }
    await fetch('/api/admin/live-quiz', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ sessionId: activeId, action, ...extra }),
    })
    await loadActive(activeId)
    setBusy(false)
  }

  const launch = () => {
    if (!target) return
    const durationSeconds = launchDuration.trim() ? Number(launchDuration) : undefined
    runAction('start_round', {
      questionId: target.type === 'question' ? target.id : undefined,
      cardId: target.type === 'card' ? target.id : undefined,
      durationSeconds,
    })
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: FDLC_RED }}>{error}</div>

  const filteredAutograph = autographFilter.trim()
    ? autographCards.filter(c => c.player_name.toLowerCase().includes(autographFilter.trim().toLowerCase()))
    : autographCards
  const remainingQuestions = questions.filter(q => !q.used).length

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* ── Barre du haut : logo + choix de session ─────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 14,
        background: FDLC_NAVY, color: 'white', marginBottom: 16, flexWrap: 'wrap',
      }}>
        <img src={FDLC_LOGO_URL} alt="" style={{ height: 32, width: 32, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ fontWeight: 900, fontSize: 15, flexShrink: 0 }}>🎙️ Quiz en direct</div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <select value={activeId ?? ''} onChange={e => setActiveId(e.target.value || null)} style={{
            width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.12)',
            color: 'white', fontWeight: 700, fontSize: 13,
          }}>
            <option value="" style={{ color: '#000' }}>— Choisir une session —</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id} style={{ color: '#000' }}>{s.title} · {s.code} · {STATUS_LABEL[s.status]}</option>
            ))}
          </select>
        </div>
        {session && (
          <>
            <button onClick={startRename} title="Renommer cette session"
              style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>✏️</button>
            <button onClick={() => duplicateSession(session)} title="Dupliquer (nouvelle session, jamais jouée)"
              style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>⧉</button>
            <button onClick={() => deleteSession(session.id, session.title)} title="Supprimer cette session"
              style={{ ...btnStyle('transparent'), border: '1px solid rgba(255,255,255,0.25)', flexShrink: 0 }}>🗑️</button>
          </>
        )}
        <button onClick={() => setShowCreate(v => !v)} style={{ ...btnStyle(FDLC_RED), flexShrink: 0 }}>+ Nouvelle</button>
      </div>

      {renaming && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input value={renameValue} onChange={e => setRenameValue(e.target.value)} placeholder="Nouveau titre"
            autoFocus onKeyDown={e => e.key === 'Enter' && saveRename()}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          <button onClick={saveRename} style={btnStyle(FDLC_RED)}>Enregistrer</button>
          <button onClick={() => setRenaming(false)} style={btnStyle('#888')}>Annuler</button>
        </div>
      )}

      {showCreate && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Titre de la nouvelle session"
            autoFocus onKeyDown={e => e.key === 'Enter' && createSession()}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          <button onClick={createSession} style={btnStyle(FDLC_RED)}>Créer</button>
        </div>
      )}

      {!session ? (
        <p style={{ textAlign: 'center', color: '#888', padding: 40 }}>Choisis une session ci-dessus, ou crée-en une nouvelle.</p>
      ) : (
        <>
          {/* ── Liens (repliable, pas besoin de les regarder pendant le show) ── */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowLinks(v => !v)} style={{ ...linkBtnStyle, marginBottom: showLinks ? 10 : 0 }}>
              {showLinks ? '▾' : '▸'} Code {session.code} · liens & QR
            </button>
            {showLinks && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 14, borderRadius: 12, background: '#f4f6fb' }}>
                {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 120, height: 120, borderRadius: 10, border: '1px solid #eee', flexShrink: 0 }} />}
                <div style={{ minWidth: 0, fontSize: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: '#888', textTransform: 'uppercase', fontSize: 10 }}>Spectateurs</div>
                    <code style={{ wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}</code>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, color: '#888', textTransform: 'uppercase', fontSize: 10 }}>Overlay compact</div>
                    <code style={{ wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}/overlay</code>
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#888', textTransform: 'uppercase', fontSize: 10 }}>Overlay grand format</div>
                    <code style={{ wordBreak: 'break-all' }}>{SITE_URL}/quiz/{session.code}/overlay/big</code>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── LE panneau de controle en direct : toujours en haut, toujours visible ── */}
          <div style={{
            borderRadius: 18, border: `2px solid ${STATUS_COLOR[session.status]}`, padding: 20, marginBottom: 24,
            background: session.status === 'question' ? '#fff8f8' : session.status === 'reveal' ? '#f4fbf6' : '#f8f9fb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
                background: STATUS_COLOR[session.status], color: 'white', fontWeight: 900, fontSize: 12, textTransform: 'uppercase',
              }}>● {STATUS_LABEL[session.status]}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {remaining !== null && session.status === 'question' && (
                  <div style={{
                    fontSize: 16, fontWeight: 900, padding: '4px 14px', borderRadius: 20,
                    background: remaining <= 5 ? FDLC_RED : '#dde3f0', color: remaining <= 5 ? 'white' : '#333',
                  }}>⏱ {remaining}s</div>
                )}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#666' }}>👥 {participantCount} vote{participantCount > 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* LOBBY : gros bouton pour lancer ce qui est selectionne */}
            {session.status === 'lobby' && (
              <div>
                {target ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Prochaine manche</div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 14 }}>
                      {target.type === 'card' ? '✍️ ' : ''}{target.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button onClick={launch} disabled={busy} style={{ ...bigBtnStyle('#2ecc71'), opacity: busy ? 0.6 : 1 }}>▶️ Lancer la manche</button>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>⏱ Minuteur (s)</label>
                      <input type="number" min={5} value={launchDuration} onChange={e => setLaunchDuration(e.target.value)} placeholder="sans limite"
                        style={{ width: 110, padding: 8, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 14, color: '#888' }}>Aucune question prête. Ajoute une question ou une carte autographe ci-dessous.</p>
                )}
                {questions.length > 0 && (
                  <button onClick={() => setShowBank(true)} style={{ ...linkBtnStyle, marginTop: 14 }}>▸ Choisir une autre question ({remainingQuestions} restante{remainingQuestions > 1 ? 's' : ''})</button>
                )}
              </div>
            )}

            {/* QUESTION EN COURS : vote en direct + Reveler */}
            {session.status === 'question' && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                  {session.round_question || '✍️ Signature (quiz autographes)'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {(session.round_choices || []).map((c, i) => {
                    const pct = totalAnswers > 0 ? Math.round((tally[i] ?? 0) / totalAnswers * 100) : 0
                    return (
                      <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#eee', height: 34 }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: '#d8dff0', transition: 'width 0.4s' }} />
                        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 13, fontWeight: 700 }}>
                          <span>{c}</span><span>{tally[i] ?? 0} ({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => runAction('reveal')} disabled={busy} style={bigBtnStyle('#2ecc71')}>✅ Révéler</button>
                  <button onClick={() => runAction('end_round')} disabled={busy} style={btnStyle('#888')}>↩️ Annuler la manche</button>
                </div>
              </div>
            )}

            {/* REVELE : resultat + classement + manche suivante */}
            {session.status === 'reveal' && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                  {session.round_question || '✍️ Signature (quiz autographes)'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  {(session.round_choices || []).map((c, i) => {
                    const pct = totalAnswers > 0 ? Math.round((tally[i] ?? 0) / totalAnswers * 100) : 0
                    const correct = session.round_correct_index === i
                    return (
                      <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: correct ? '#d7f5e0' : '#eee', height: 34 }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: correct ? '#8fe3ab' : '#d8dff0', transition: 'width 0.4s' }} />
                        <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 13, fontWeight: correct ? 900 : 700 }}>
                          <span>{correct ? '✅ ' : ''}{c}</span><span>{tally[i] ?? 0} ({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => runAction('end_round')} disabled={busy} style={bigBtnStyle(FDLC_NAVY)}>➡️ Manche suivante</button>
              </div>
            )}

            {session.status === 'ended' && (
              <p style={{ fontSize: 14, color: '#888' }}>Session terminée -- le classement final reste visible aux spectateurs.</p>
            )}

            {session.status !== 'ended' && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <button onClick={() => { if (confirm('Terminer la session ? Les spectateurs verront le classement final.')) runAction('end_session') }}
                  style={{ ...linkBtnStyle, color: FDLC_RED }}>Terminer la session</button>
              </div>
            )}
          </div>

          {leaderboard.length > 0 && (
            <div style={{ padding: 16, borderRadius: 12, background: '#f4f6fb', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>🏆 Classement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leaderboard.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ width: 18, fontWeight: 900, color: i === 0 ? '#e8b400' : '#888' }}>{i + 1}</span>
                    <span style={{ flex: 1, fontWeight: 700 }}>{e.pseudo}</span>
                    <span style={{ fontWeight: 900, color: '#2ecc71' }}>{e.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Banque de questions (repliee par defaut, pour ne pas polluer pendant le show) ── */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setShowBank(v => !v)} style={linkBtnStyle}>
              {showBank ? '▾' : '▸'} Banque de questions ({questions.length}, {remainingQuestions} restante{remainingQuestions > 1 ? 's' : ''})
            </button>
            {showBank && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {questions.map(q => (
                    <div key={q.id} style={{
                      padding: 10, borderRadius: 10, opacity: q.used ? 0.6 : 1,
                      border: target?.type === 'question' && target.id === q.id ? `2px solid ${FDLC_NAVY}` : '1px solid #eee',
                      background: target?.type === 'question' && target.id === q.id ? 'rgba(12,26,61,0.05)' : 'white',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={() => setTarget({ type: 'question', id: q.id, label: q.question })}
                          disabled={session.status !== 'lobby'} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: session.status === 'lobby' ? 'pointer' : 'default', padding: 0, minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{q.question}{q.used ? ' · déjà jouée' : ''}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{q.choices.join(' · ')}</div>
                        </button>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => startEdit(q)} style={btnStyle('#888')}>✏️</button>
                          <button onClick={() => deleteQuestion(q.id)} style={btnStyle(FDLC_RED)}>🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && <p style={{ fontSize: 13, color: '#888' }}>Aucune question pour l'instant.</p>}
                </div>

                <h3 style={{ fontWeight: 800, marginBottom: 10, fontSize: 14 }}>{editingId ? '✏️ Modifier la question' : '+ Ajouter une question'}</h3>
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
              </div>
            )}
          </div>

          {/* ── Cartes autographes (repliees par defaut) ── */}
          <div>
            <button onClick={() => { setShowAutograph(v => !v); if (!showAutograph) loadAutographCards() }} style={linkBtnStyle}>
              {showAutograph ? '▾' : '▸'} ✍️ Cartes du quiz autographes
            </button>
            {showAutograph && (
              <div style={{ marginTop: 10 }}>
                <input value={autographFilter} onChange={e => setAutographFilter(e.target.value)} placeholder="Filtrer par nom de joueur..."
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box' }} />
                {!autographLoaded ? (
                  <p style={{ fontSize: 13, color: '#888' }}>Chargement...</p>
                ) : filteredAutograph.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#888' }}>Aucune carte validée trouvée (voir /admin/autograph-quiz).</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                    {filteredAutograph.slice(0, 40).map(c => (
                      <div key={c.id} style={{
                        padding: '8px 10px', borderRadius: 10,
                        border: target?.type === 'card' && target.id === c.id ? `2px solid ${FDLC_NAVY}` : '1px solid #eee',
                        background: target?.type === 'card' && target.id === c.id ? 'rgba(12,26,61,0.05)' : 'white',
                      }}>
                        <button onClick={() => setTarget({ type: 'card', id: c.id, label: c.player_name })}
                          disabled={session.status !== 'lobby'} style={{ background: 'none', border: 'none', textAlign: 'left', cursor: session.status === 'lobby' ? 'pointer' : 'default', padding: 0, width: '100%' }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{c.player_name}</div>
                          {c.team && <div style={{ fontSize: 11, color: '#888' }}>{c.team}</div>}
                        </button>
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
        </>
      )}
    </div>
  )
}

function btnStyle(color: string): React.CSSProperties {
  return { padding: '8px 14px', borderRadius: 8, border: 'none', background: color, color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
}
function bigBtnStyle(color: string): React.CSSProperties {
  return { padding: '14px 26px', borderRadius: 12, border: 'none', background: color, color: 'white', fontWeight: 900, fontSize: 16, cursor: 'pointer' }
}
const linkBtnStyle: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontWeight: 800, fontSize: 13, color: FDLC_NAVY, cursor: 'pointer' }
