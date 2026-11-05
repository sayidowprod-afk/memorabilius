'use client'
// Mode rafale de l'ajout en lot : la caméra reste ouverte, on prend recto puis verso, recto puis verso… sans revenir au menu.
// Réutilise CameraCapture tel quel (aucune modification de ce composant) : il reste monté et on empile les photos.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import CameraCapture from '@/components/CameraCapture'

export default function BurstCamera({ onDone, onClose, maxCards = 30 }: { onDone: (files: File[], faces: 1 | 2) => void; onClose: () => void; maxCards?: number }) {
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([])
  const [faces, setFaces] = useState<1 | 2>(2)
  const shotsRef = useRef(shots)
  useEffect(() => { shotsRef.current = shots }, [shots])
  useEffect(() => () => { /* les URL sont libérées par la page qui récupère les fichiers */ }, [])

  const total = shots.length
  const card = Math.floor(total / faces) + 1
  const side = faces === 1 ? '' : total % 2 === 0 ? 'RECTO' : 'VERSO'
  const full = Math.ceil(total / faces) >= maxCards

  const finish = () => {
    const list = shotsRef.current
    list.forEach(s => URL.revokeObjectURL(s.url))
    if (!list.length) { onClose(); return }
    onDone(list.map((s, i) => new File([s.blob], `rafale_${i + 1}.jpg`, { type: 'image/jpeg' })), faces)
  }
  const undo = () => setShots(prev => { const last = prev[prev.length - 1]; if (last) URL.revokeObjectURL(last.url); return prev.slice(0, -1) })

  const bar: React.CSSProperties = { position: 'fixed', left: 0, right: 0, zIndex: 10001, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }
  const pill: React.CSSProperties = { pointerEvents: 'auto', background: 'rgba(0,0,0,.65)', color: '#fff', border: '2px solid #fff', padding: '8px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase' }

  return (
    <>
      <CameraCapture
        onClose={finish}
        onCapture={blob => {
          if (full) return
          setShots(prev => [...prev, { blob, url: URL.createObjectURL(blob) }])
          try { navigator.vibrate?.(30) } catch { /* pas de vibration */ }
        }}
      />
      {typeof document !== 'undefined' && createPortal(
        <>
          <div style={{ ...bar, top: 'max(12px, env(safe-area-inset-top))', gap: 8, alignItems: 'center' }}>
            <span style={{ ...pill, cursor: 'default', borderColor: '#ffd84d' }}>{full ? `Maximum atteint (${maxCards} cartes)` : <>Carte {card}{side && <> · <span style={{ color: '#ffd84d' }}>{side}</span></>}</>}</span>
            <button type="button" style={pill} onClick={() => setFaces(f => (f === 2 ? 1 : 2))} disabled={total > 0} title={total > 0 ? 'Choisis avant la première photo' : 'Recto + verso ou recto seul'}>{faces === 2 ? 'Recto + verso' : 'Recto seul'}</button>
          </div>
          <div style={{ ...bar, bottom: 'calc(env(safe-area-inset-bottom) + 118px)', gap: 6, alignItems: 'center', overflowX: 'auto', padding: '0 12px' }}>
            {shots.slice(-8).map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.url} src={s.url} alt={`Photo ${shots.length - Math.min(8, shots.length) + i + 1}`} style={{ height: 52, width: 37, objectFit: 'cover', border: '2px solid #fff' }} />
            ))}
          </div>
          <div style={{ ...bar, bottom: 'calc(env(safe-area-inset-bottom) + 16px)', justifyContent: 'space-between', padding: '0 14px' }}>
            <button type="button" style={{ ...pill, opacity: total ? 1 : 0.4 }} onClick={undo} disabled={!total}>↶ Refaire</button>
            <button type="button" style={{ ...pill, background: '#1f9d55', borderColor: '#1f9d55' }} onClick={finish}>Terminer{total ? ` (${Math.ceil(total / faces)})` : ''} ✓</button>
          </div>
        </>,
        document.body,
      )}
    </>
  )
}
