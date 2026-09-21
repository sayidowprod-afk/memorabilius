'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import { useTheme } from '@/lib/ThemeContext'

interface Sheet {
  id: string; player_name: string; card_image_recto: string | null
  card_is_horizontal: boolean; updated_at: string; sort_order: number
}

export default function TeamPlayerSheetsPage() {
  const { team: teamAbbr } = useParams<{ team: string }>()
  const router = useRouter()
  const { dark } = useTheme()
  const team = SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === teamAbbr)

  const [ready, setReady] = useState(false)
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase.from('player_sheets')
      .select('id, player_name, card_image_recto, card_is_horizontal, updated_at, sort_order')
      .eq('team_abbr', teamAbbr).order('sort_order', { ascending: true })
    setSheets(data || [])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      await load()
      setReady(true)
    })
  }, [teamAbbr])

  const createSheet = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('player_sheets').insert({
      user_id: user!.id, team_abbr: teamAbbr, player_name: name, sort_order: sheets.length,
    }).select('id').single()
    setCreating(false)
    if (error) { alert(error.message); return }
    setNewName('')
    router.push(`/admin/player-sheets/${teamAbbr}/${data.id}`)
  }

  const removeSheet = async (id: string) => {
    if (!confirm('Supprimer cette fiche ?')) return
    await supabase.from('player_sheets').delete().eq('id', id)
    load()
  }

  const onDragStart = (id: string) => { setDraggingId(id) }
  const onDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); if (id !== dragOverId) setDragOverId(id) }
  const onDragEnd = () => { setDraggingId(null); setDragOverId(null) }

  const onDrop = async (targetId: string) => {
    const fromId = draggingId
    setDraggingId(null)
    setDragOverId(null)
    if (!fromId || fromId === targetId) return

    const reordered = [...sheets]
    const fromIdx = reordered.findIndex(s => s.id === fromId)
    const toIdx = reordered.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    const withOrder = reordered.map((s, i) => ({ ...s, sort_order: i }))
    setSheets(withOrder)

    await Promise.all(withOrder.map((s, i) =>
      supabase.from('player_sheets').update({ sort_order: i }).eq('id', s.id)
    ))
  }

  if (!ready) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!team) return <div style={{ padding: 40, textAlign: 'center' }}>Équipe inconnue.</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>
      <Link href="/admin/player-sheets" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Équipes</Link>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, margin: '10px 0 22px',
        padding: '16px 18px', borderRadius: 16, background: team.color, color: '#fff',
      }}>
        <img src={teamLogoUrl(team)} alt="" style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.3))' }} />
        <div style={{ fontWeight: 900, fontSize: 22 }}>{team.name}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createSheet() }}
          placeholder="Nom du joueur..." style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, border: `1px solid ${dark ? '#333' : '#ddd'}`,
            background: dark ? '#1a1a1a' : '#fff', color: 'inherit', fontSize: 14,
          }}
        />
        <button onClick={createSheet} disabled={!newName.trim() || creating} style={{
          padding: '10px 18px', borderRadius: 10, border: 'none', background: team.color, color: '#fff',
          fontWeight: 800, fontSize: 14, cursor: newName.trim() ? 'pointer' : 'default', opacity: newName.trim() ? 1 : 0.5,
        }}>
          + Nouvelle fiche
        </button>
      </div>

      {sheets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 14 }}>Aucune fiche pour cette équipe pour l'instant.</div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>Glisse une fiche pour changer l'ordre.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {sheets.map(s => (
              <div
                key={s.id}
                draggable
                onDragStart={() => onDragStart(s.id)}
                onDragOver={e => onDragOver(e, s.id)}
                onDrop={() => onDrop(s.id)}
                onDragEnd={onDragEnd}
                style={{
                  position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'grab',
                  background: dark ? '#1a1a1a' : '#fff',
                  border: `1px solid ${dragOverId === s.id ? team.color : (dark ? '#2a2a2a' : '#eee')}`,
                  opacity: draggingId === s.id ? 0.4 : 1,
                  boxShadow: dragOverId === s.id ? `0 0 0 2px ${team.color}` : 'none',
                  transition: 'box-shadow 0.12s, border-color 0.12s',
                }}
              >
                <Link href={`/admin/player-sheets/${teamAbbr}/${s.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    aspectRatio: s.card_is_horizontal ? '5 / 3.5' : '2.5 / 3.5', background: dark ? '#111' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {s.card_image_recto
                      ? <img src={s.card_image_recto} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 12, color: '#999' }}>Pas de carte</span>}
                  </div>
                  <div style={{ padding: '10px 12px', fontWeight: 800, fontSize: 13.5 }}>{s.player_name}</div>
                </Link>
                <button onClick={() => removeSheet(s.id)} title="Supprimer" style={{
                  position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', border: 'none',
                  background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: 1,
                }}>✕</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
