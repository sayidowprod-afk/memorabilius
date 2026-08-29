'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang, localeFor } from '@/lib/LangContext'

interface FeedbackRow {
  id: string
  type: 'bug' | 'suggestion'
  message: string
  page_url: string | null
  email: string | null
  user_name: string | null
  created_at: string
}

interface ReportRow {
  id: string
  reason: string
  message: string | null
  context: string | null
  reporter_name: string | null
  reported_user_name: string | null
  reported_user_id: string | null
  created_at: string
}

export default function AdminReportsPage() {
  const { dark } = useTheme()
  const { lang } = useLang()
  const router = useRouter()
  const [tab, setTab] = useState<'feedback' | 'reports'>('reports')
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      const r = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (r.status === 403) { setError('Accès refusé — compte non admin'); setLoading(false); return }
      const json = await r.json()
      setFeedback(json.feedback || [])
      setReports(json.reports || [])
      setLoading(false)
    })
  }, [])

  const text = dark ? '#eee' : '#121212'
  const sub = dark ? '#999' : '#666'
  const card = dark ? '#1e1e1e' : 'white'
  const border = dark ? '#2a2a2a' : '#f0f0f0'
  const fmt = (d: string) => new Date(d).toLocaleString(localeFor(lang), { dateStyle: 'medium', timeStyle: 'short' })

  if (loading) return <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px', color: text }}>Chargement…</div>
  if (error) return <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px', color: '#e74c3c' }}>{error}</div>

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 16px 60px' }}>
      <h1 style={{ color: text, fontWeight: 900, fontSize: 26, marginBottom: 20 }}>🚩 Signalements & feedback</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('reports')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: tab === 'reports' ? '#003DA6' : (dark ? '#2a2a2a' : '#f0f0f0'), color: tab === 'reports' ? 'white' : text,
        }}>🚩 Signalements ({reports.length})</button>
        <button onClick={() => setTab('feedback')} style={{
          padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: tab === 'feedback' ? '#003DA6' : (dark ? '#2a2a2a' : '#f0f0f0'), color: tab === 'feedback' ? 'white' : text,
        }}>💬 Feedback ({feedback.length})</button>
      </div>

      {tab === 'reports' && (
        reports.length === 0 ? <p style={{ color: sub }}>Aucun signalement.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reports.map(r => (
              <div key={r.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: '#fff3e0', color: '#e67e22', padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>{r.reason}</span>
                  <span style={{ color: sub, fontSize: 12 }}>{fmt(r.created_at)}</span>
                </div>
                <p style={{ color: text, fontSize: 13, margin: '10px 0 4px' }}>
                  Par <strong>{r.reporter_name || '?'}</strong>
                  {r.reported_user_id && <> · contre <Link href={`/galerie/${r.reported_user_id}`} style={{ color: '#003DA6' }}>{r.reported_user_name || r.reported_user_id}</Link></>}
                </p>
                {r.context && <p style={{ color: sub, fontSize: 12, margin: '2px 0' }}>{r.context}</p>}
                {r.message && <p style={{ color: text, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{r.message}</p>}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'feedback' && (
        feedback.length === 0 ? <p style={{ color: sub }}>Aucun feedback.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {feedback.map(f => (
              <div key={f.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: f.type === 'bug' ? '#fde8e8' : '#e8f0fe', color: f.type === 'bug' ? '#c0392b' : '#003DA6', padding: '3px 10px', borderRadius: 20, fontWeight: 700, fontSize: 12 }}>
                    {f.type === 'bug' ? '🐛 Bug' : '💡 Suggestion'}
                  </span>
                  <span style={{ color: sub, fontSize: 12 }}>{fmt(f.created_at)}</span>
                </div>
                <p style={{ color: text, fontSize: 13, margin: '10px 0 4px' }}>
                  {f.user_name || f.email || 'anonyme'} {f.page_url && <span style={{ color: sub }}>· {f.page_url}</span>}
                </p>
                <p style={{ color: text, fontSize: 13, margin: '6px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{f.message}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
