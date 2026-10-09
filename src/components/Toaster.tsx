'use client'
import { useEffect, useState } from 'react'
import { NAV_TOTAL_HEIGHT_CSS } from '@/lib/nativeLayout'
import { useIsNative } from '@/lib/useIsNative'

type ToastItem = { id: number; message: string; type: 'error' | 'success' | 'info'; leaving?: boolean }

let nextId = 0
const ICON: Record<ToastItem['type'], string> = { error: '✕', success: '✓', info: 'ℹ' }

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const isNative = useIsNative()
  // Sur l'app native, la bottom bar prend la place du bas d'écran -- un toast
  // fixe à bottom:24 se retrouvait affiché par-dessus/dans la nav (ex: un
  // badge débloqué qui apparaissait dans la zone "Ma galerie").
  const bottomOffset = isNative ? `calc(${NAV_TOTAL_HEIGHT_CSS} + 12px)` : 24

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail
      const id = ++nextId
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200)
      }, 4000)
    }
    window.addEventListener('mb:toast', handler)
    return () => window.removeEventListener('mb:toast', handler)
  }, [])

  if (!toasts.length) return null

  return (
    <div style={{ position: 'fixed', bottom: bottomOffset, left: '50%', transform: 'translateX(-50%)', zIndex: 10000004, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} className="mb-toast" style={{ animation: t.leaving ? 'mb-toast-out 0.2s ease forwards' : 'mb-toast-in 0.35s cubic-bezier(.2,.9,.2,1)' }}>
          <div className={`mb-toast-ic${t.leaving ? '' : ' toast-icon-pop'}`} style={{ background: t.type === 'error' ? '#e74c3c' : t.type === 'success' ? '#1f9d55' : '#2f6bff' }}>
            {ICON[t.type]}
          </div>
          <div className="mb-toast-tx">{t.message}</div>
        </div>
      ))}
      <style>{`
        @keyframes mb-toast-in { from { opacity:0; transform:translateX(-48px) } to { opacity:1; transform:translateX(0) } }
        @keyframes mb-toast-out { from { opacity:1; transform:translateY(0) scale(1) } to { opacity:0; transform:translateY(4px) scale(0.96) } }
      `}</style>
    </div>
  )
}
