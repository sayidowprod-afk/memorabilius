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

interface Category { key: keyof Sheet; label: string }

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

interface Ranked { player: Sheet; value: number }

const MEDALS = ['🥇', '🥈', '🥉']

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

  const top3ByCategory: Ranked[][] = CATEGORIES.map(cat => {
    const ranked = sheets
      .map(s => ({ player: s, value: parseStat(s[cat.key] as string | null) }))
      .filter((r): r is Ranked => r.value !== null)
      .sort((a, b) => b.value - a.value)
    return ranked.slice(0, 3)
  })

  const anyData = top3ByCategory.some(list => list.length > 0)

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

      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 1000, width: '100%', margin: '0 auto', padding: '70px 40px 90px', boxSizing: 'border-box' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
            {CATEGORIES.map((cat, i) => {
              const top3 = top3ByCategory[i]
              if (top3.length === 0) return null
              return (
                <div key={cat.key} style={{
                  background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18, padding: '16px 18px', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: team.color }} />
                  <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{cat.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {top3.map((r, rank) => (
                      <div key={r.player.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>{MEDALS[rank]}</div>
                        <div style={{
                          width: 36, height: 50, flexShrink: 0, overflow: 'hidden',
                          background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {r.player.card_image_recto
                            ? <img src={r.player.card_image_recto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: 14 }}>🏀</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.player.player_name}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {r.player[cat.key]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
