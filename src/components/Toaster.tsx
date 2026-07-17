'use client'
import { useEffect, useState } from 'react'

type ToastItem = { id: number; message: string; type: 'error' | 'success' | 'info' }

let nextId = 0

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, type } = (e as CustomEvent).detail
      const id = ++nextId
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    }
    window.addEventListener('mb:toast', handler)
    return () => window.removeEventListener('mb:toast', handler)
  }, [])

  if (!toasts.length) return null

  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'error' ? '#e74c3c' : t.type === 'success' ? '#27ae60' : '#2c3e50',
          color: 'white', borderRadius: 12, padding: '12px 20px', fontWeight: 700, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', maxWidth: 360, textAlign: 'center',
          animation: 'mb-toast-in 0.2s ease',
        }}>
          {t.message}
        </div>
      ))}
      <style>{`@keyframes mb-toast-in { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
