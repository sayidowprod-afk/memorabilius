'use client'
import { useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'

export default function BottomSheet({
  open, onClose, title, children, bottomOffset = 0,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  bottomOffset?: number | string
}) {
  const { dark } = useTheme()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  // La feuille chevauche volontairement le haut de la bottom bar de quelques px :
  // la bottom bar (z-index plus élevé) la recouvre, ce qui absorbe tout écart
  // d'arrondi entre les deux calculs de hauteur et évite un liseré visible.
  const bottomRaw = typeof bottomOffset === 'number' ? `${bottomOffset}px` : bottomOffset
  const bottom = `calc(${bottomRaw} - 8px)`

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom, background: 'rgba(0,0,0,0.4)', zIndex: 240 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed', left: 0, right: 0, bottom, zIndex: 241,
          background: dark ? '#1e1e1e' : 'white',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          boxShadow: '0 -8px 30px rgba(0,0,0,0.2)',
          paddingBottom: 12,
          animation: 'sheet-up 0.22s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: dark ? '#444' : '#ddd' }} />
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
          color: dark ? '#888' : '#999', padding: '6px 20px 4px',
        }}>
          {title}
        </div>
        <div style={{ padding: '4px 12px 8px' }}>
          {children}
        </div>
      </div>
      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
