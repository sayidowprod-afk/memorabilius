'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { useTheme } from '@/lib/ThemeContext'
import { toast } from '@/lib/toast'

export default function Teams() {
  const router = useRouter()
  const { t, lang } = useLang()
  const { dark } = useTheme()
  const [teams, setTeams] = useState<any[]>([])
  const [teamsStats, setTeamsStats] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [userTeamIds, setUserTeamIds] = useState<Set<number>>(new Set())
  const [hasCandidature, setHasCandidature] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadTeams()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const data = { user: session.user }
      setUserId(data.user.id)
      const [{ data: memberships }, { data: cands }] = await Promise.all([
        supabase.from('team_members').select('team_id').eq('user_id', data.user.id),
        // Candidatures en attente
        supabase.from('team_candidatures').select('team_id').eq('user_id', data.user.id).eq('statut', 'en_attente'),
      ])
      if (memberships?.length) setUserTeamIds(new Set(memberships.map((m: any) => m.team_id)))
      if (cands) setHasCandidature(new Set(cands.map((c: any) => c.team_id)))
    })
  }, [])

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*, team_members(count)').order('created_at', { ascending: false })
    setTeams(data || [])
    loadTeamsStats(data || [])
  }

  const loadTeamsStats = async (teamsList: any[]) => {
    if (!teamsList.length) return
    const ids = teamsList.map(t => t.id)
    const { data: members } = await supabase.from('team_members').select('team_id, profiles(stats_total)').in('team_id', ids)
    const totals = new Map<number, number>()
    for (const m of members || []) {
      const prev = totals.get(m.team_id) || 0
      totals.set(m.team_id, prev + ((m.profiles as any)?.stats_total || 0))
    }
    setTeamsStats(ids.map(id => ({ teamId: id, total: totals.get(id) || 0 })))
  }

  const joinTeam = async (teamId: number) => {
    if (!userId) return
    setLoading(true)
    // Passe par le serveur (service role) : un candidat déjà refusé (ou parti après avoir
    // été accepté) laisse une ligne team_candidatures non "en_attente" en base, et sa
    // suppression exige un DELETE qu'aucune policy RLS n'autorise côté client (testé —
    // le DELETE réussit silencieusement sans rien supprimer, l'INSERT échoue ensuite).
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/team-join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ teamId }),
    })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) {
      toast.error(t('teams_err_prefix') + (body.error || r.statusText))
    } else {
      setHasCandidature(prev => new Set([...prev, teamId]))
      toast.success(t('teams_request_sent'))
    }
    setLoading(false)
  }

  const createTeam = async () => {
    if (!userId || !newTeamName.trim()) return
    setLoading(true)
    const { data } = await supabase.from('teams').insert({ name: newTeamName.trim(), created_by: userId }).select().single()
    if (data) {
      const { error: memberErr } = await supabase.from('team_members').insert({ team_id: data.id, user_id: userId })
      if (memberErr) {
        // Sans cette verification, un echec ici laissait une team creee
        // (created_by pointe vers l'utilisateur, donc isChef=true) mais sans
        // aucune ligne team_members pour son fondateur (isMember=false) --
        // etat incoherent impossible a corriger depuis l'UI. On annule la
        // creation plutot que de laisser ce fondateur "fantome".
        await supabase.from('teams').delete().eq('id', data.id)
        toast.error(t('teams_create_error'))
      } else {
        setUserTeamIds(prev => new Set([...prev, data.id]))
        router.push(`/teams/${data.id}`)
      }
    } else {
      toast.error(t('teams_create_error'))
    }
    setNewTeamName('')
    setShowCreate(false)
    setLoading(false)
  }

  // Trier par nombre de cartes total
  const sorted = [...teams].sort((a, b) => {
    const aStats = teamsStats.find(s => s.teamId === a.id)?.total || 0
    const bStats = teamsStats.find(s => s.teamId === b.id)?.total || 0
    return bStats - aStats
  })

  const filtered = sorted.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 32, letterSpacing: '-0.5px', margin: 0 }}>{t('teams_title')}</h1>
        {userId && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {[...userTeamIds].map(tid => (
              <Link key={tid} href={`/teams/${tid}`} style={{ background: '#003DA6', color: 'white', padding: '8px 16px', borderRadius: 0, fontWeight: 800, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {teams.find(t => t.id === tid)?.name || t('teams_see_my_team')} →
              </Link>
            ))}
            <button onClick={() => setShowCreate(!showCreate)} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}>
              {t('teams_create')}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('teams_search')} style={{ maxWidth: 400 }} />
      </div>

      {showCreate && (
        <div style={{ background: dark ? '#1e1e1e' : 'white', padding: 24, borderRadius: 12, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: 12 }}>{t('teams_create_new')}</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder={t('teams_name_placeholder')} onKeyDown={e => e.key === 'Enter' && createTeam()} />
            <button onClick={createTeam} disabled={loading} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>
              {loading ? '...' : t('binder_create_btn')}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'transparent', borderRadius: 0, overflow: 'hidden', border: `1px solid ${dark ? 'rgba(255,255,255,0.28)' : '#06122e'}` }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead><tr>
            {['#', 'Team', t('teams_members'), t('teams_total_cards_label'), t('teams_action')].map(h => (
              <th key={h} style={{ background: 'transparent', padding: '16px', textAlign: 'left', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? '#fff' : '#06122e', borderBottom: `2px solid ${dark ? '#fff' : '#06122e'}` }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((team, i) => {
              const stats = teamsStats.find(s => s.teamId === team.id)
              const memberCount = team.team_members?.[0]?.count || 0
              const isMyTeam = userTeamIds.has(team.id)
              const pending = hasCandidature.has(team.id)
              return (
                <tr key={team.id} className="dir-row">
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(6,18,46,0.14)'}`, width: 56 }}>
                    <span className="da-display" style={{ fontSize: 30, lineHeight: 1, color: i === 0 ? '#ffd54a' : i === 1 ? '#c9d1e0' : i === 2 ? '#e0925a' : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(6,18,46,0.4)') }}>{i + 1}</span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(6,18,46,0.14)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      {team.avatar_url ? (
                        <img src={team.avatar_url} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={team.name} />
                      ) : (
                        <div className="da-display" style={{ width: 46, height: 46, borderRadius: '50%', background: '#003DA6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 24, flexShrink: 0 }}>
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/teams/${team.id}`} className="da-display dir-name" style={{ fontSize: 30, lineHeight: 1, color: dark ? '#fff' : '#06122e', display: 'block', overflowWrap: 'anywhere' }}>{team.name}</Link>
                        {team.description && <p style={{ fontSize: 12, color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(6,18,46,0.6)', margin: '4px 0 0' }}>{team.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(6,18,46,0.14)'}` }}>
                    <span className="da-display dir-num" style={{ fontSize: 30, lineHeight: 1, color: dark ? '#fff' : '#06122e' }}>{memberCount}</span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(6,18,46,0.14)'}` }}>
                    <span className="da-display dir-num" style={{ fontSize: 30, lineHeight: 1, color: dark ? '#5aa9ff' : '#1565c0' }}>{stats ? stats.total.toLocaleString('fr-FR') : '...'}</span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(6,18,46,0.14)'}` }}>
                    {isMyTeam ? (
                      <Link href={`/teams/${team.id}`} className="dir-act" style={{ color: '#ffd54a' }}>{t('teams_my_team')}</Link>
                    ) : pending ? (
                      <span className="dir-sq" style={{ color: '#ff9a3c' }}>⏳ En attente</span>
                    ) : userId ? (
                      <button onClick={() => joinTeam(team.id)} disabled={loading} aria-label={`${t('teams_join_aria')} ${team.name}`} className="dir-act" style={{ color: dark ? '#4cd37b' : '#1f8a45' }}>
                        {t('teams_join')}
                      </button>
                    ) : (
                      <Link href={`/teams/${team.id}`} className="dir-act" style={{ color: dark ? '#fff' : '#06122e' }}>Voir →</Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
