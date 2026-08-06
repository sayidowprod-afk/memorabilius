'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ResendConfirmButton({ email, lang }: { email: string; lang: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function resend() {
    setStatus('sending')
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setStatus(error ? 'error' : 'sent')
  }

  if (status === 'sent') return (
    <p style={{ fontSize: 14, color: '#2e7d32', marginTop: 16 }}>
      ✅ {lang === 'fr' ? 'Email renvoyé ! Vérifiez votre boîte.' : 'Email resent! Check your inbox.'}
    </p>
  )

  if (status === 'error') return (
    <p style={{ fontSize: 14, color: '#c62828', marginTop: 16 }}>
      ❌ {lang === 'fr' ? 'Erreur — réessayez dans quelques secondes.' : 'Error — try again in a moment.'}
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
      {status === 'sending'
        ? (lang === 'fr' ? 'Envoi…' : 'Sending…')
        : (lang === 'fr' ? 'Renvoyer l\'email de confirmation' : 'Resend confirmation email')}
    </button>
  )
}
