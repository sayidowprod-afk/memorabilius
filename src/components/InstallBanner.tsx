'use client'

import { useEffect, useState } from 'react'

type Platform = 'ios' | 'android' | null

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
}

export default function InstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [dismissed, setDismissed] = useState(false)
  const [iosStep, setIosStep] = useState(false)

  useEffect(() => {
    const forceParam = new URLSearchParams(location.search).get('install')
    if (forceParam === 'ios') { setPlatform('ios'); return }
    if (forceParam === 'android') { setPlatform('android'); return }

    if (isInStandaloneMode()) return
    if (sessionStorage.getItem('install-dismissed')) return

    if (isIos()) {
      setPlatform('ios')
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setPlatform('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('install-dismissed', '1')
    setDismissed(true)
  }

  async function installAndroid() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDismissed(true)
    setDeferredPrompt(null)
  }

  if (dismissed || !platform) return null

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      background: 'var(--card-bg, #fff)', border: '1px solid var(--border, #e5e7eb)',
      borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      padding: '14px 16px', maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <img src="/icon-192.png" width={40} height={40} style={{ borderRadius: 10 }} alt="" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text, #111)' }}>Installer Memorabilius</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>Accès rapide depuis ton écran d'accueil</div>
        </div>
        <button onClick={dismiss} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #999)', fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
      </div>

      {platform === 'android' && (
        <button onClick={installAndroid} style={{
          width: '100%', background: '#003DA6', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          Installer l'app
        </button>
      )}

      {platform === 'ios' && !iosStep && (
        <button onClick={() => setIosStep(true)} style={{
          width: '100%', background: '#003DA6', color: '#fff', border: 'none',
          borderRadius: 10, padding: '10px 0', fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          Comment installer ?
        </button>
      )}

      {platform === 'ios' && iosStep && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { step: '1', icon: '⬆️', text: 'Appuie sur le bouton Partager en bas de Safari' },
            { step: '2', icon: '➕', text: 'Fais défiler et appuie sur « Sur l\'écran d\'accueil »' },
            { step: '3', icon: '✅', text: 'Appuie sur « Ajouter » en haut à droite' },
          ].map(({ step, icon, text }) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border, #f0f0f0)' }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#003DA6', textTransform: 'uppercase', letterSpacing: 0.5 }}>Étape {step}</span>
                <div style={{ fontSize: 13, color: 'var(--text, #333)' }}>{text}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
