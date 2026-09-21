'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
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

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
      padding: '18px 20px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
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
    return <div style={{ position: 'fixed', inset: 0, background: '#05070c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>
  }

  const flag = countryFlag(sheet.stat_country)
  const stats = [
    sheet.stat_points && { label: 'Points', value: sheet.stat_points },
    sheet.stat_rebonds && { label: 'Rebonds', value: sheet.stat_rebonds },
    sheet.stat_passes && { label: 'Passes', value: sheet.stat_passes },
    sheet.stat_matches && { label: 'Matchs', value: sheet.stat_matches },
    sheet.stat_minutes && { label: 'Min / match', value: sheet.stat_minutes },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999999, overflow: 'auto', color: '#fff',
      background: `
        radial-gradient(1100px 700px at 12% -10%, ${team.color}3d, transparent 60%),
        radial-gradient(900px 600px at 105% 110%, ${team.color}26, transparent 55%),
        linear-gradient(160deg, #05070c 0%, #0a0d16 55%, #05070c 100%)
      `,
    }}>
      <Link href={`/admin/player-sheets/${teamAbbr}/${sheetId}`} style={{
        position: 'fixed', top: 20, right: 24, width: 42, height: 42, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', fontSize: 18, cursor: 'pointer', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
      }}>✕</Link>

      <div style={{
        minHeight: '100%', display: 'flex', flexWrap: 'wrap-reverse', alignItems: 'center', justifyContent: 'center',
        gap: 72, padding: '70px 40px',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '50%', bottom: -20, transform: 'translateX(-50%)',
              width: '78%', height: 40, borderRadius: '50%',
              background: `radial-gradient(ellipse, ${team.color}55, transparent 72%)`, filter: 'blur(6px)',
            }} />
            {sheet.card_image_recto && (
              <Card3DInline
                front={sheet.card_image_recto_hd || sheet.card_image_recto}
                back={sheet.card_image_verso_hd || sheet.card_image_verso || undefined}
                isHorizontal={sheet.card_is_horizontal}
                accent={team.color}
              />
            )}
          </div>
        </div>

        <div style={{ maxWidth: 580, width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src={teamLogoUrl(team)} alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{team.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {flag && <span style={{ fontSize: 40, lineHeight: 1 }}>{flag}</span>}
              <div style={{
                fontSize: 'clamp(36px, 5.2vw, 58px)', fontWeight: 900, lineHeight: 1.03, letterSpacing: -1,
                background: `linear-gradient(135deg, #fff 40%, ${team.color})`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                {sheet.player_name}
              </div>
            </div>
            {(sheet.stat_poste || sheet.stat_age || sheet.stat_saison) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {[sheet.stat_poste, sheet.stat_age, sheet.stat_saison].filter(Boolean).map((v, i) => (
                  <span key={i} style={{
                    fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 999, padding: '6px 14px',
                  }}>{v}</span>
                ))}
              </div>
            )}
          </div>

          {stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {stats.map(s => <StatCard key={s.label} {...s} accent={team.color} />)}
            </div>
          )}

          {sheet.stat_autres && (
            <div style={{
              fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
              borderLeft: `3px solid ${team.color}`, paddingLeft: 16,
            }}>
              {sheet.stat_autres}
            </div>
          )}

          {sheet.notes && (
            <div style={{
              fontSize: 17, lineHeight: 1.55, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic',
              background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '20px 24px', whiteSpace: 'pre-wrap',
            }}>
              {sheet.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
