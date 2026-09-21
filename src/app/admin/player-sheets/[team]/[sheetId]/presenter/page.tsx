'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import Card3DInline from '@/components/Card3DInline'

interface Sheet {
  player_name: string
  card_image_recto: string | null; card_image_recto_hd: string | null
  card_image_verso: string | null; card_image_verso_hd: string | null
  card_is_horizontal: boolean
  stat_saison: string | null; stat_poste: string | null; stat_country: string | null; stat_age: string | null
  stat_matches: string | null; stat_minutes: string | null
  stat_points: string | null; stat_rebonds: string | null; stat_passes: string | null; stat_autres: string | null
  notes: string | null
}

function countryFlag(code: string | null | undefined): string | null {
  const c = (code || '').trim().toUpperCase()
  if (c.length !== 2) return null
  return [...c].map(ch => String.fromCodePoint(ch.charCodeAt(0) + 127397)).join('')
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function PlayerSheetPresenterPage() {
  const { team: teamAbbr, sheetId } = useParams<{ team: string; sheetId: string }>()
  const router = useRouter()
  const team = SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === teamAbbr)

  const [ready, setReady] = useState(false)
  const [sheet, setSheet] = useState<Sheet | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/connexion'); return }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      if (!p?.is_admin) { router.replace('/'); return }
      const { data } = await supabase.from('player_sheets').select('*').eq('id', sheetId).single()
      if (!data) { router.replace(`/admin/player-sheets/${teamAbbr}`); return }
      setSheet(data)
      setReady(true)
    })
  }, [sheetId])

  if (!ready || !sheet || !team) {
    return <div style={{ position: 'fixed', inset: 0, background: '#0a0e1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>
  }

  const flag = countryFlag(sheet.stat_country)
  const stats = [
    sheet.stat_points && { label: 'Points', value: sheet.stat_points },
    sheet.stat_rebonds && { label: 'Rebonds', value: sheet.stat_rebonds },
    sheet.stat_passes && { label: 'Passes', value: sheet.stat_passes },
    sheet.stat_matches && { label: 'Matchs', value: sheet.stat_matches },
    sheet.stat_minutes && { label: 'Min/match', value: sheet.stat_minutes },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999, background: `radial-gradient(circle at 15% 15%, ${team.color}33, #0a0e1a 55%)`,
      color: '#fff', overflow: 'auto',
    }}>
      <button onClick={() => window.close()} style={{
        position: 'fixed', top: 18, right: 22, width: 40, height: 40, borderRadius: '50%', border: 'none',
        background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
      }}>✕</button>

      <div style={{
        minHeight: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
        gap: 60, padding: '60px 40px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {sheet.card_image_recto && (
            <Card3DInline
              front={sheet.card_image_recto_hd || sheet.card_image_recto}
              back={sheet.card_image_verso_hd || sheet.card_image_verso || undefined}
              isHorizontal={sheet.card_is_horizontal}
              accent={team.color}
            />
          )}
        </div>

        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={teamLogoUrl(team)} alt="" style={{ width: 64, height: 64, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>{team.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {flag && <span style={{ fontSize: 34 }}>{flag}</span>}
                <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.05 }}>{sheet.player_name}</div>
              </div>
              {(sheet.stat_poste || sheet.stat_age || sheet.stat_saison) && (
                <div style={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  {[sheet.stat_poste, sheet.stat_age, sheet.stat_saison].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>

          {stats.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 24,
              background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '24px 28px',
            }}>
              {stats.map(s => <StatBlock key={s.label} {...s} />)}
            </div>
          )}

          {sheet.stat_autres && (
            <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{sheet.stat_autres}</div>
          )}

          {sheet.notes && (
            <div style={{
              fontSize: 18, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: '18px 22px', whiteSpace: 'pre-wrap',
            }}>
              {sheet.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
