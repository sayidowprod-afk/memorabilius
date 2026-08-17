'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function ResendConfirmButton({ email }: { email: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function resend() {
    setStatus('sending')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setStatus(error ? 'error' : 'sent')
  }

  if (status === 'sent') return (
    <p style={{ fontSize: 14, color: '#2e7d32', marginTop: 16 }}>
      ✅ {t('resend_email_sent')}
    </p>
  )

  if (status === 'error') return (
    <p style={{ fontSize: 14, color: '#c62828', marginTop: 16 }}>
      ❌ {t('resend_error')}
    </p>
  )

  return (
    <button
      onClick={resend}
      disabled={status === 'sending'}
      style={{
        marginTop: 16, background: 'none', border: 'none',
        color: '#003DA6', fontSize: 14, cursor: 'pointer',
        textDecoration: 'underline', opacity: status === 'sending' ? 0.5 : 1,
      }}
    >
      {status === 'sending' ? t('resend_sending') : t('resend_button')}
    </button>
  )
}
