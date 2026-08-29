'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { toast } from '@/lib/toast'

interface Props {
  reportedUserId?: string
  context: string
  compact?: boolean
}

const REASONS = ['spam', 'harcelement', 'contenu_inapproprie', 'autre'] as const

export default function ReportButton({ reportedUserId, context, compact }: Props) {
  const { t } = useLang()
  const { dark } = useTheme()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<typeof REASONS[number]>('spam')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error(t('report_login_required')); return }
      const r = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reportedUserId, context, reason, message: message.trim() || undefined }),
      })
      if (!r.ok) throw new Error()
      toast.success(t('report_sent'))
      setOpen(false)
      setMessage('')
      setReason('spam')
    } catch {
      toast.error(t('report_error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} title={t('report_action')} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: compact ? 26 : 30, height: compact ? 26 : 30, borderRadius: '50%',
        background: dark ? '#2a2a2a' : '#f0f0f0', color: dark ? '#aaa' : '#666',
        border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: compact ? 13 : 14,
      }}>🚩</button>

      {open && createPortal(
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? '#1e1e1e' : 'white', borderRadius: 16, padding: 22, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16, color: dark ? '#eee' : '#111' }}>🚩 {t('report_title')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {REASONS.map(r => (
                <button key={r} type="button" onClick={() => setReason(r)} style={{
                  padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${reason === r ? '#003DA6' : (dark ? '#3a3a3c' : '#e0e0e0')}`,
                  background: reason === r ? '#003DA6' : (dark ? '#2a2a2a' : '#f7f7f7'),
                  color: reason === r ? 'white' : (dark ? '#ddd' : '#333'),
                }}>
                  {t(`report_reason_${r}` as any)}
                </button>
              ))}
            </div>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)}
              placeholder={t('report_message_placeholder')} rows={3} maxLength={1000}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: 10, borderRadius: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, background: 'none', border: `1px solid ${dark ? '#444' : '#ddd'}`, color: dark ? '#ccc' : '#666', borderRadius: 8, padding: '9px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {t('profile_cancel')}
              </button>
              <button onClick={submit} disabled={sending} className="btn-main btn-primary" style={{ flex: 1, padding: '9px', fontSize: 13 }}>
                {sending ? t('feedback_sending') : t('report_submit')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
