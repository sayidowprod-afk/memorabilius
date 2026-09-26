'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import { useTheme } from '@/lib/ThemeContext'
import TeamBadge from '@/components/TeamBadge'

const NBA_TEAMS = SPORTS_TEAMS.filter(t => t.sport === 'nba')

type Filter = 'all' | 'todo' | 'done'

export default function PlayerSheetsHubPage() {
  const router = useRouter()
  const { dark } = useTheme()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  // Une equipe est "faite" des qu'elle a au moins une fiche joueur : calcule a
  // partir des fiches existantes, donc automatique et retroactif (les equipes
  // deja traitees sont marquees sans rien avoir a saisir).
  const [stats, setStats] = useState<Record<string, { count: number; last: string }>>({})
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      setAllowed(true)
      setReady(true)
      const { data: rows } = await supabase.from('player_sheets').select('team_abbr, updated_at').limit(5000)
      const acc: Record<string, { count: number; last: string }> = {}
      for (const r of rows || []) {
        const cur = acc[r.team_abbr]
        if (!cur) acc[r.team_abbr] = { count: 1, last: r.updated_at }
        else { cur.count++; if (r.updated_at > cur.last) cur.last = r.updated_at }
      }
      setStats(acc)
    })
  }, [])

  const doneCount = useMemo(() => NBA_TEAMS.filter(t => stats[t.abbr]).length, [stats])
  const shown = useMemo(() => NBA_TEAMS.filter(t =>
    filter === 'all' ? true : filter === 'done' ? !!stats[t.abbr] : !stats[t.abbr]
  ), [stats, filter])

  if (!ready) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!allowed) return null

  const chip = (f: Filter, label: string) => (
    <button key={f} onClick={() => setFilter(f)} style={{
      padding: '6px 14px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
      border: `1px solid ${filter === f ? '#003DA6' : dark ? '#333' : '#ddd'}`,
      background: filter === f ? '#003DA6' : 'transparent',
      color: filter === f ? '#fff' : dark ? '#ccc' : '#555',
    }}>{label}</button>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Administration</Link>
        <h1 style={{ fontWeight: 900, fontSize: 24, margin: '6px 0 4px' }}>🏀 Fiches joueurs</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: 0 }}>
          Choisis une équipe NBA pour voir ou créer ses fiches joueurs (émission).{' '}
          <strong style={{ color: '#1b8a3a' }}>{doneCount}/{NBA_TEAMS.length} équipes faites</strong>
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {chip('all', `Toutes (${NBA_TEAMS.length})`)}
        {chip('todo', `À faire (${NBA_TEAMS.length - doneCount})`)}
        {chip('done', `Faites (${doneCount})`)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {shown.map(team => {
          const st = stats[team.abbr]
          return (
            <Link key={team.id} href={`/admin/player-sheets/${team.abbr}`} style={{
              position: 'relative',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '18px 10px', borderRadius: 14, textDecoration: 'none', color: 'inherit',
              background: dark ? '#1a1a1a' : '#fff', border: `1px solid ${st ? '#1b8a3a66' : dark ? '#2a2a2a' : '#eee'}`,
              borderTop: `3px solid ${team.color}`,
              opacity: st ? 0.92 : 1,
            }}>
              {st && (
                <span title={`${st.count} fiche${st.count > 1 ? 's' : ''}`} style={{
                  position: 'absolute', top: 6, right: 6, background: '#1b8a3a', color: '#fff',
                  borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 800,
                }}>✓ {st.count}</span>
              )}
              <TeamBadge teamId={team.id} size={44} />
              <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>{team.name}</div>
              {st && (
                <div style={{ fontSize: 11, color: '#888' }}>
                  Fait le {new Date(st.last).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
