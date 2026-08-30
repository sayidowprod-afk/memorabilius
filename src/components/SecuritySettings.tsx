'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

interface Props {
  dark: boolean
}

interface LoginEntry { id: string; ip: string | null; user_agent: string | null; created_at: string }

function deviceLabel(ua: string | null): string {
  if (!ua) return '—'
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS'
  if (/windows/i.test(ua)) return 'Windows'
  if (/macintosh/i.test(ua)) return 'Mac'
  return 'Navigateur'
}

export default function SecuritySettings({ dark }: Props) {
  const { t, lang } = useLang()
  const [loading, setLoading] = useState(true)
  const [enabledFactorId, setEnabledFactorId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<LoginEntry[]>([])
  const [secretCopied, setSecretCopied] = useState(false)

  const refreshFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const verified = data?.totp?.find(f => f.status === 'verified')
    setEnabledFactorId(verified?.id || null)
  }

  useEffect(() => {
    refreshFactors().finally(() => setLoading(false))
    supabase.from('login_history').select('id, ip, user_agent, created_at').order('created_at', { ascending: false }).limit(8)
      .then(({ data }) => setHistory(data || []))
  }, [])

  const startEnroll = async () => {
    if (starting) return
    setStarting(true)
    setError('')
    try {
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
      if (err || !data) { setError(err?.message || t('security_2fa_err')); return }
      setEnrollFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setEnrolling(true)
    } catch (e: any) {
      setError(e?.message || t('security_2fa_err'))
    } finally {
      setStarting(false)
    }
  }

  const cancelEnroll = async () => {
    if (enrollFactorId) await supabase.auth.mfa.unenroll({ factorId: enrollFactorId })
    setEnrolling(false)
    setEnrollFactorId(null)
    setQrCode(null)
    setSecret(null)
    setCode('')
    setError('')
  }

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!enrollFactorId) return
    setVerifying(true)
    setError('')
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: enrollFactorId })
      if (challengeErr || !challenge) { setError(challengeErr?.message || t('security_2fa_err')); return }
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: enrollFactorId, challengeId: challenge.id, code })
      if (verifyErr) { setError(verifyErr.message || t('security_2fa_err')); return }
      setEnrolling(false)
      setEnrollFactorId(null)
      setQrCode(null)
      setSecret(null)
      setCode('')
      await refreshFactors()
    } catch (e: any) {
      setError(e?.message || t('security_2fa_err'))
    } finally {
      setVerifying(false)
    }
  }

  const disable2fa = async () => {
    if (!enabledFactorId) return
    await supabase.auth.mfa.unenroll({ factorId: enabledFactorId })
    await refreshFactors()
  }

  const dateFmt = (iso: string) => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : lang, { dateStyle: 'medium', timeStyle: 'short' })

  if (loading) return null

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t('security_2fa_title')}</h4>
        <p style={{ fontSize: 12, color: dark ? '#999' : '#888', marginBottom: 12 }}>{t('security_2fa_desc')}</p>
        {error && !enrolling && <p style={{ color: '#e74c3c', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        {!enrolling && enabledFactorId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: '#e8f7ee', color: '#2ecc71', fontWeight: 700, fontSize: 12, padding: '4px 10px', borderRadius: 20 }}>✓ {t('security_2fa_enabled_label')}</span>
            <button onClick={disable2fa} style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: 8, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {t('security_2fa_disable_btn')}
            </button>
          </div>
        )}

        {!enrolling && !enabledFactorId && (
          <button onClick={startEnroll} disabled={starting} className="btn-main btn-primary" style={{ padding: '8px 18px', fontSize: 13, opacity: starting ? 0.6 : 1, cursor: starting ? 'default' : 'pointer' }}>
            {starting ? '…' : t('security_2fa_enable_btn')}
          </button>
        )}

        {enrolling && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
            <p style={{ fontSize: 12, color: dark ? '#999' : '#888', margin: 0 }}>{t('security_2fa_scan_hint')}</p>
            {qrCode && <img src={qrCode} alt="QR code 2FA" width={160} height={160} style={{ background: 'white', padding: 8, borderRadius: 8 }} />}
            {secret && (
              <div style={{ width: '100%', maxWidth: 260, background: dark ? '#2a2a2a' : '#f7f7f7', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: dark ? '#999' : '#888', margin: '0 0 6px' }}>{t('security_2fa_manual_hint')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ flex: 1, fontSize: 11, wordBreak: 'break-all', color: dark ? '#ccc' : '#444', textAlign: 'left' }}>{secret}</code>
                  <button type="button" onClick={() => {
                    navigator.clipboard.writeText(secret).then(() => { setSecretCopied(true); setTimeout(() => setSecretCopied(false), 2000) })
                  }} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '5px 9px', borderRadius: 6, border: `1px solid ${dark ? '#444' : '#ddd'}`, background: dark ? '#1e1e1e' : 'white', color: secretCopied ? '#2ecc71' : (dark ? '#ccc' : '#444'), cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {secretCopied ? `✓ ${t('security_2fa_copied')}` : t('security_2fa_copy')}
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={confirmEnroll} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 220 }}>
              <input
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" placeholder={t('security_2fa_code_ph')} maxLength={6}
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 4, fontWeight: 700 }}
              />
              {error && <p style={{ color: '#e74c3c', fontSize: 12, margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={cancelEnroll} style={{ flex: 1, background: 'none', border: '1px solid #ccc', color: dark ? '#ccc' : '#666', borderRadius: 8, padding: '8px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {t('profile_cancel')}
                </button>
                <button type="submit" disabled={verifying || code.length !== 6} className="btn-main btn-primary" style={{ flex: 1, padding: '8px', fontSize: 12 }}>
                  {t('security_2fa_confirm')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div>
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{t('security_login_history_title')}</h4>
        {history.length === 0 ? (
          <p style={{ fontSize: 12, color: dark ? '#999' : '#888' }}>{t('security_login_history_empty')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: dark ? '#ccc' : '#444', padding: '4px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f0f0f0'}` }}>
                <span>{deviceLabel(h.user_agent)}{h.ip ? ` · ${h.ip}` : ''}</span>
                <span style={{ color: dark ? '#888' : '#999' }}>{dateFmt(h.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
