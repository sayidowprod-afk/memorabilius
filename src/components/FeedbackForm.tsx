'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { toast } from '@/lib/toast'

interface Props {
  dark: boolean
}

export default function FeedbackForm({ dark }: Props) {
  const { t } = useLang()
  const [type, setType] = useState<'bug' | 'suggestion'>('bug')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (message.trim().length < 3) return
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ type, message: message.trim(), pageUrl: window.location.pathname }),
      })
      if (!r.ok) throw new Error()
      setMessage('')
      setSent(true)
      setTimeout(() => setSent(false), 4000)
    } catch {
      toast.error(t('feedback_error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => setType('bug')} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: type === 'bug' ? '#e74c3c' : (dark ? '#2a2a2a' : '#f0f0f0'), color: type === 'bug' ? 'white' : (dark ? '#ccc' : '#333'),
        }}>🐛 {t('feedback_type_bug')}</button>
        <button onClick={() => setType('suggestion')} style={{
          flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
          background: type === 'suggestion' ? '#003DA6' : (dark ? '#2a2a2a' : '#f0f0f0'), color: type === 'suggestion' ? 'white' : (dark ? '#ccc' : '#333'),
        }}>💡 {t('feedback_type_suggestion')}</button>
      </div>
      <textarea
        value={message} onChange={e => setMessage(e.target.value)}
        placeholder={type === 'bug' ? t('feedback_placeholder_bug') : t('feedback_placeholder_suggestion')}
        rows={4}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: 10, borderRadius: 8 }}
      />
      <button onClick={submit} disabled={sending || message.trim().length < 3} className="btn-main btn-primary" style={{ marginTop: 10, padding: '8px 20px', fontSize: 13 }}>
        {sending ? t('feedback_sending') : sent ? t('feedback_sent') : t('feedback_submit')}
      </button>
    </div>
  )
}
