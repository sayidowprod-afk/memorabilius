'use client'
import { useState, type ReactNode } from 'react'
import { addToCalendar } from '@/lib/addToCalendar'
import type { EventLike } from '@/lib/eventIcs'

// Bouton « Ajouter au calendrier » (voir lib/addToCalendar.ts pour le détail selon l'appareil).
export default function AddToCalendarButton({ ev, serverUrl, filename, className, style, children }: {
  ev: EventLike; serverUrl: string; filename: string; className?: string; style?: React.CSSProperties; children: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <button type="button" className={className} style={style} disabled={busy}
      onClick={async () => { setBusy(true); try { await addToCalendar(ev, serverUrl, filename) } finally { setBusy(false) } }}>
      {children}
    </button>
  )
}
