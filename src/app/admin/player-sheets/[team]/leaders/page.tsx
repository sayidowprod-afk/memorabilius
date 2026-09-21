'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import TeamBadge from '@/components/TeamBadge'

interface Sheet {
  id: string; player_name: string; card_image_recto: string | null
  stat_points: string | null; stat_rebonds: string | null; stat_passes: string | null
  stat_matches: string | null; stat_minutes: string | null
}

interface Category { key: keyof Sheet; label: string; unit?: string }

const CATEGORIES: Category[] = [
  { key: 'stat_points', label: 'Points' },
  { key: 'stat_rebonds', label: 'Rebonds' },
  { key: 'stat_passes', label: 'Passes' },
  { key: 'stat_matches', label: 'Matchs joués' },
  { key: 'stat_minutes', label: 'Min / match' },
]

// Parse tolerant : accepte "24.3", "24,3", "24.3 pts" -- prend le premier
// nombre trouve, ignore le reste (unites, texte libre).
function parseStat(v: string | null): number | null {
  if (!v) return null
  const m = v.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

interface Leader { player: Sheet; value: number }

export default function TeamLeadersPage() {
  const { team: teamAbbr } = useParams<{ team: string }>()
  const router = useRouter()
  const team = SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === teamAbbr)

  const [ready, setReady] = useState(false)
  const [sheets, setSheets] = useState<Sheet[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      const { data } = await supabase.from('player_sheets')
        .select('id, player_name, card_image_recto, stat_points, stat_rebonds, stat_passes, stat_matches, stat_minutes')
        .eq('team_abbr', teamAbbr)
      setSheets(data || [])
      setReady(true)
    })
  }, [teamAbbr])

  if (!ready || !team) {
    return <div style={{ position: 'fixed', inset: 0, background: '#05070c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>
  }

  const leaders: (Leader | null)[] = CATEGORIES.map(cat => {
    let best: Leader | null = null
    for (const s of sheets) {
      const value = parseStat(s[cat.key] as string | null)
      if (value === null) continue
      if (!best || value > best.value) best = { player: s, value }
    }
    return best
  })

  const anyData = leaders.some(Boolean)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999, overflow: 'auto', color: '#fff',
      background: `
        radial-gradient(1100px 700px at 12% -10%, ${team.color}33, transparent 60%),
        linear-gradient(160deg, #05070c 0%, #0a0d16 55%, #05070c 100%)
      `,
    }}>
      <Link href={`/admin/player-sheets/${teamAbbr}`} style={{
        position: 'fixed', top: 20, right: 24, width: 42, height: 42, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
      }}>✕</Link>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '70px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <TeamBadge teamId={team.id} size={54} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{team.name}</div>
            <div style={{ fontSize: 38, fontWeight: 900 }}>🏆 Leaders de l'équipe</div>
          </div>
        </div>

        {!anyData ? (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
            Aucune statistique renseignée pour l'instant sur les fiches de cette équipe.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
            {CATEGORIES.map((cat, i) => {
              const leader = leaders[i]
              if (!leader) return null
              return (
                <div key={cat.key} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18, padding: '18px 20px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: team.color }} />
                  <div style={{
                    width: 56, height: 78, borderRadius: 0, flexShrink: 0, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {leader.player.card_image_recto
                      ? <img src={leader.player.card_image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 20 }}>🏀</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{cat.label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{leader.player.player_name}</div>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{leader.player[cat.key]}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
