'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import { useTheme } from '@/lib/ThemeContext'
import TeamBadge from '@/components/TeamBadge'

const NBA_TEAMS = SPORTS_TEAMS.filter(t => t.sport === 'nba')

export default function PlayerSheetsHubPage() {
  const router = useRouter()
  const { dark } = useTheme()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      setAllowed(true)
      setReady(true)
    })
  }, [])

  if (!ready) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>
  if (!allowed) return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/admin" style={{ fontSize: 13, color: '#888', textDecoration: 'none' }}>← Administration</Link>
        <h1 style={{ fontWeight: 900, fontSize: 24, margin: '6px 0 4px' }}>🏀 Fiches joueurs</h1>
        <p style={{ fontSize: 13.5, color: '#888', margin: 0 }}>Choisis une équipe NBA pour voir ou créer ses fiches joueurs (émission).</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {NBA_TEAMS.map(team => (
          <Link key={team.id} href={`/admin/player-sheets/${team.abbr}`} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            padding: '18px 10px', borderRadius: 14, textDecoration: 'none', color: 'inherit',
            background: dark ? '#1a1a1a' : '#fff', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`,
            borderTop: `3px solid ${team.color}`,
          }}>
            <TeamBadge teamId={team.id} size={44} />
            <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.25 }}>{team.name}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
