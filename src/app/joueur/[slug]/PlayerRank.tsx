'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Bandeau « Top x % des collectionneurs de ce joueur » (calculé côté client pour le membre connecté : la page joueur reste en cache pour tout le monde)
// + menu déroulant avec le classement complet des collectionneurs de ce joueur (100 premiers).
type Row = { rank: number; id: string; name: string; avatar: string | null; cards: number }
export default function PlayerRank({ playerName }: { playerName: string }) {
  const [r, setR] = useState<{ pct: number; rank: number; total: number; cards: number; label?: string } | null>(null)
  const [uid, setUid] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [board, setBoard] = useState<{ total: number; rows: Row[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let off = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession(), id = data.session?.user.id
        if (!id) return
        if (!off) setUid(id)
        const d = await fetch(`/api/player-rank?name=${encodeURIComponent(playerName)}&userId=${encodeURIComponent(id)}`).then(x => x.json())
        if (!off && d && !d.none) setR(d)
      } catch { /* pas de bandeau si le calcul échoue */ }
    })()
    return () => { off = true }
  }, [playerName])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !board && !loading) {
      setLoading(true); setFailed(false)
      fetch(`/api/player-leaderboard?name=${encodeURIComponent(playerName)}`)
        .then(x => x.json())
        .then(d => { if (Array.isArray(d?.rows) && d.rows.length) setBoard(d); else setFailed(true) })
        .catch(() => setFailed(true))
        .finally(() => setLoading(false))
    }
  }

  return (
    <div style={{ margin: '0 0 var(--sp-4, 16px)', border: '2px solid #fdb927', background: 'rgba(253,185,39,.1)' }}>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {r ? (
          <>
            <b style={{ fontSize: 24, color: '#fdb927', fontFamily: 'var(--font-display, inherit)' }}>{r.label || `Top ${r.pct} %`}</b>
            <span style={{ fontSize: 13, flex: 1, minWidth: 180 }}>des collectionneurs de {playerName} · <b>{r.cards} carte{r.cards > 1 ? 's' : ''}</b> · n° {r.rank} sur {r.total}</span>
          </>
        ) : (
          <span style={{ fontSize: 13, flex: 1, minWidth: 180 }}>Classement des collectionneurs de <b>{playerName}</b></span>
        )}
        <button type="button" onClick={toggle} aria-expanded={open}
          style={{ padding: '6px 12px', border: '2px solid #fdb927', background: open ? '#fdb927' : 'transparent', color: open ? '#111' : '#fdb927', font: '700 12px sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', cursor: 'pointer', borderRadius: 0 }}>
          Classement complet {open ? '▲' : '▼'}
        </button>
      </div>
      {open && (
        <div style={{ borderTop: '2px solid rgba(253,185,39,.5)', maxHeight: 420, overflowY: 'auto' }}>
          {loading && <p style={{ padding: 14, margin: 0, fontSize: 13, opacity: .7 }}>Calcul du classement…</p>}
          {failed && !loading && <p style={{ padding: 14, margin: 0, fontSize: 13, opacity: .7 }}>Classement indisponible pour le moment, réessaie dans un instant.</p>}
          {board && (
            <>
              <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {board.rows.map(row => {
                  const me = row.id === uid
                  return (
                    <li key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', background: me ? 'rgba(253,185,39,.22)' : 'transparent', borderBottom: '1px solid rgba(253,185,39,.18)' }}>
                      <span style={{ width: 34, fontWeight: 800, fontSize: 14, color: row.rank <= 3 ? '#fdb927' : 'inherit', flexShrink: 0 }}>{row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}</span>
                      <img src={row.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name)}&background=003DA6&color=fff`} alt="" width={26} height={26} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      <Link href={`/galerie/${row.id}`} style={{ flex: 1, minWidth: 0, fontWeight: me ? 800 : 600, fontSize: 14, color: 'inherit', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}{me ? ' (toi)' : ''}</Link>
                      <b style={{ fontSize: 14, flexShrink: 0 }}>{row.cards} <span style={{ fontWeight: 500, fontSize: 12, opacity: .7 }}>carte{row.cards > 1 ? 's' : ''}</span></b>
                    </li>
                  )
                })}
              </ol>
              {board.total > board.rows.length && <p style={{ padding: '8px 14px', margin: 0, fontSize: 12, opacity: .65 }}>{board.rows.length} premiers sur {board.total} collectionneurs.</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
