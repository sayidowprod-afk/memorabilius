'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// 890 · « Mes Rainbows » (Objectifs) : les joueurs dont je collectionne les parallèles dans un même produit, avec ma progression.
interface Rainbow { player: string; setId: number; setName: string; cardNumber: string | null; owned: number; total: number; thumb: string | null; image: string | null }

export default function MesRainbows({ accent, dark, onOpen }: { accent: string; dark: boolean; onOpen?: (image: string) => boolean | void }) {
  const [rows, setRows] = useState<Rainbow[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let cancel = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setRows([]); return }
      try {
        const r = await fetch('/api/mes-rainbows', { headers: { Authorization: 'Bearer ' + session.access_token } })
        if (!r.ok) throw new Error()
        const d = await r.json()
        if (!cancel) setRows(d.rainbows || [])
      } catch { if (!cancel) { setErr(true); setRows([]) } }
    })()
    return () => { cancel = true }
  }, [])

  const muted = dark ? '#8794bd' : '#777'
  if (rows === null) return <p style={{ color: muted, fontSize: 14 }}>Calcul de tes Rainbows… (quelques secondes)</p>
  if (err) return <p style={{ color: '#c0392b', fontSize: 14 }}>Impossible de calculer tes Rainbows pour le moment.</p>
  if (!rows.length) return <p style={{ color: muted, fontSize: 14, lineHeight: 1.5 }}>Aucun Rainbow pour l’instant. Il apparaît dès que tu as au moins deux parallèles d’un même joueur dans un même produit (par exemple Embiid en Prizm Silver et Prizm Gold), avec leur set connu dans les setlists.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, color: muted, fontSize: 13 }}>Pour chaque joueur, les parallèles de sa carte que tu as, sur toutes celles qui existent. Un clic ouvre ta carte ; le volet « Parallèles » du viewer montre le détail.</p>
      {rows.map(r => {
        const pct = Math.round(r.owned / r.total * 100)
        return (
          <div key={r.setId + r.player + (r.cardNumber || '')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, border: '1px solid ' + (dark ? '#2a2a2a' : '#e6e6e6'), background: dark ? '#1a1a1a' : '#fff' }}>
            <button type="button" onClick={() => r.image && onOpen?.(r.image)} aria-label={'Ouvrir ' + r.player}
              style={{ flex: 'none', width: 52, padding: 0, border: 0, background: 'none', cursor: r.image ? 'pointer' : 'default' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.thumb ? <img src={r.thumb} alt="" style={{ width: '100%', aspectRatio: '5 / 7', objectFit: 'cover', display: 'block' }} /> : <div style={{ aspectRatio: '5 / 7', background: dark ? '#222' : '#eee' }} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{r.player}</div>
              <div style={{ fontSize: 12, color: muted, overflowWrap: 'anywhere' }}>{r.setName}{r.cardNumber ? ' · n° ' + r.cardNumber : ''}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <div style={{ flex: 1, height: 8, background: dark ? '#2a2a2a' : '#eee' }}><div style={{ width: pct + '%', height: '100%', background: pct === 100 ? '#1e9e57' : accent }} /></div>
                <b style={{ fontSize: 13 }}>{r.owned} / {r.total}</b>
              </div>
            </div>
            <Link href={'/setlist/' + r.setId} prefetch={false} style={{ fontSize: 12, fontWeight: 700, color: accent, textDecoration: 'none', flex: 'none' }}>Set →</Link>
          </div>
        )
      })}
    </div>
  )
}
