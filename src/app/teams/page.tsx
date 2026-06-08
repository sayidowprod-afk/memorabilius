'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Teams() {
  const [teams, setTeams] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [userTeamId, setUserTeamId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadTeams()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: m } = await supabase.from('team_members').select('team_id').eq('user_id', data.user.id).single()
      if (m) setUserTeamId(m.team_id)
    })
  }, [])

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*, team_members(count)')
    setTeams(data || [])
  }

  const joinTeam = async (teamId: number) => {
    if (!userId) return
    setLoading(true)
    await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
    setUserTeamId(teamId)
    await loadTeams()
    setLoading(false)
  }

  const createTeam = async () => {
    if (!userId || !newTeamName.trim()) return
    setLoading(true)
    const { data } = await supabase.from('teams').insert({ name: newTeamName.trim(), created_by: userId }).select().single()
    if (data) {
      await supabase.from('team_members').insert({ team_id: data.id, user_id: userId })
      setUserTeamId(data.id)
    }
    setNewTeamName('')
    setShowCreate(false)
    await loadTeams()
    setLoading(false)
  }

  const filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>Annuaire des Teams</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une team..." style={{ maxWidth: 400 }} />
        {userId && !userTeamId && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}>
            + Créer ma Team
          </button>
        )}
        {userId && userTeamId && <span style={{ color: '#999', fontSize: 13, fontStyle: 'italic' }}>Vous avez déjà rejoint une team.</span>}
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: 24, borderRadius: 12, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: 12 }}>Créer une nouvelle team</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Nom de la team" onKeyDown={e => e.key === 'Enter' && createTeam()} />
            <button onClick={createTeam} disabled={loading} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>
              {loading ? '...' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <thead><tr>
            {['Nom de la Team', 'Membres', 'Action'].map(h => (
              <th key={h} style={{ background: '#fdfdfd', padding: '18px 15px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(team => (
              <tr key={team.id}>
                <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>
                  <Link href={`/annuaire?team_id=${team.id}`} style={{ fontWeight: 800, color: '#121212' }}>{team.name}</Link>
                </td>
                <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: 4, fontWeight: 700 }}>
                    {team.team_members?.[0]?.count || 0}
                  </span>
                </td>
                <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>
                  {userId && userTeamId === team.id ? (
                    <span style={{ color: '#003DA6', fontWeight: 700 }}>Ma Team ✓</span>
                  ) : userId && !userTeamId ? (
                    <button onClick={() => joinTeam(team.id)} disabled={loading} style={{ background: '#e8f5e9', color: '#2e7d32', padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 900 }}>
                      Rejoindre
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
