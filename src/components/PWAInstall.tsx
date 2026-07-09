'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/lib/LangContext'
import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function subscribePush(): Promise<boolean> {
  try {
    const sw = await navigator.serviceWorker.ready
    const existing = await sw.pushManager.getSubscription()
    const sub = existing || await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as unknown as ArrayBuffer,
    })
    const json = sub.toJSON()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return false
    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth }),
    })
    return res.ok
  } catch {
    return false
  }
}

export default function PWAInstall() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [pushDone, setPushDone] = useState(false)
  const { t } = useLang()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(async () => {
        // Si l'user est connecté et que la permission est déjà accordée, subscribe silencieusement
        const perm = Notification.permission
        if (perm === 'granted') {
          const { data } = await supabase.auth.getUser()
          if (data.user) subscribePush()
        }
      }).catch(console.error)
    }

    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); setShow(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      // Proposer push après l'installation
      if ('Notification' in window && Notification.permission === 'default') {
        const perm = await Notification.requestPermission()
        if (perm === 'granted') { await subscribePush(); setPushDone(true) }
      }
    }
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#003DA6', color: 'white', borderRadius: 16,
      padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 8px 30px rgba(0,61,166,0.4)', zIndex: 9999,
      maxWidth: 360, width: 'calc(100% - 40px)',
    }}>
      <span style={{ fontSize: 28 }}>📲</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>{t('pwa_install')}</p>
        <p style={{ fontSize: 12, margin: '2px 0 0', opacity: 0.8 }}>{t('pwa_sub')}</p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShow(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: '6px 12px', color: 'white', cursor: 'pointer', fontSize: 13 }}>
          Plus tard
        </button>
        <button onClick={install} style={{ background: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#003DA6', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
          Installer
        </button>
      </div>
    </div>
  )
}

// Hook exporté pour activer les notifs push depuis n'importe quelle page
export { subscribePush }
