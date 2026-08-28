'use client'
import { useEffect, useState } from 'react'
import { useIsNative } from '@/lib/useIsNative'

export default function OfflineBanner() {
  const isNative = useIsNative()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (!isNative) {
      // Web/PWA : le navigateur donne deja ce signal nativement, aucune raison
      // de se priver de ce bandeau juste parce qu'on n'est pas dans l'app.
      setOffline(!navigator.onLine)
      const onOnline = () => setOffline(false)
      const onOffline = () => setOffline(true)
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      return () => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
    }

    let removeListener: (() => void) | undefined

    import('@capacitor/network').then(async ({ Network }) => {
      const status = await Network.getStatus()
      setOffline(!status.connected)
      const listener = await Network.addListener('networkStatusChange', (status) => {
        setOffline(!status.connected)
      })
      removeListener = () => listener.remove()
    }).catch(() => {})

    return () => removeListener?.()
  }, [isNative])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed', top: 'var(--safe-area-inset-top, env(safe-area-inset-top))', left: 0, right: 0, zIndex: 400,
      background: '#c0392b', color: 'white', textAlign: 'center',
      padding: '8px 16px', fontSize: 13, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      📡 Pas de connexion internet
    </div>
  )
}
