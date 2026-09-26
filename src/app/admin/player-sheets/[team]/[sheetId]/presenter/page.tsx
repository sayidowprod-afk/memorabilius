'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import Card3DInline from '@/components/Card3DInline'
import TeamBadge from '@/components/TeamBadge'
import type { CardMeta } from '@/app/api/admin/player-sheets-card-search/route'
import TeamHistory from '@/components/TeamHistory'
import type { TeamStint } from '@/lib/espnHeadshot'

interface Sheet {
  player_name: string
  card_image_recto: string | null; card_image_recto_hd: string | null
  card_image_verso: string | null; card_image_verso_hd: string | null
  card_is_horizontal: boolean
  card_meta: CardMeta | null
  stat_saison: string | null; stat_poste: string | null; stat_country: string | null; stat_age: string | null
  stat_matches: string | null; stat_minutes: string | null
  stat_points: string | null; stat_rebonds: string | null; stat_passes: string | null; stat_autres: string | null
  notes: string | null
  team_history?: TeamStint[] | null
}

// Image plutôt qu'emoji -- pas de police couleur pour les drapeaux sur
// Windows/Chrome desktop (affiche juste les 2 lettres du code).
function flagImgUrl(code: string | null | undefined): string | null {
  const c = (code || '').trim().toLowerCase()
  if (c.length !== 2) return null
  return `https://flagcdn.com/w80/${c}.png`
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
  // Fiches de l'equipe dans l'ordre de la page equipe -- pour passer a la
  // precedente / suivante (fleches du clavier ou boutons) sans quitter la presentation.
  const [order, setOrder] = useState<string[]>([])

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

  useEffect(() => {
    supabase.from('player_sheets')
      .select('id, card_image_recto')
      .eq('team_abbr', teamAbbr).order('sort_order', { ascending: true })
      .then(({ data }) => {
        const rows = data || []
        // Comme le bouton "Presentation" (visible seulement avec une carte) : on ne
        // navigue que parmi les fiches avec carte, en gardant toujours la fiche courante.
        setOrder(rows.filter(x => x.card_image_recto || x.id === sheetId).map(x => x.id))
      })
  }, [teamAbbr, sheetId])

  const idx = order.indexOf(sheetId)
  const prevId = idx > 0 ? order[idx - 1] : null
  const nextId = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
  const goTo = (id: string | null) => { if (id) router.replace(`/admin/player-sheets/${teamAbbr}/${id}/presenter`) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(nextId) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(prevId) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prevId, nextId, teamAbbr])

  if (!ready || !sheet || !team) {
    return <div style={{ position: 'fixed', inset: 0, background: '#05070c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>
  }

  const flag = flagImgUrl(sheet.stat_country)
  const infoBadges = [
    sheet.stat_poste && { label: 'Poste', value: sheet.stat_poste },
    sheet.stat_age && { label: 'Âge', value: sheet.stat_age },
    sheet.stat_saison && { label: 'Expérience', value: sheet.stat_saison },
  ].filter(Boolean) as { label: string; value: string }[]
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

      {order.length > 1 && (
        <div style={{
          // Discret : petit, coin bas droit, quasi transparent (visible au survol).
          position: 'fixed', bottom: 10, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 4,
          opacity: 0.18, transition: 'opacity .2s',
        }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.18' }}>
          <button onClick={() => goTo(prevId)} disabled={!prevId} aria-label="Joueur précédent"
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: prevId ? 'pointer' : 'default', opacity: prevId ? 1 : 0.3 }}>‹</button>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.8)', minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {order.length}</span>
          <button onClick={() => goTo(nextId)} disabled={!nextId} aria-label="Joueur suivant"
            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, lineHeight: 1, cursor: nextId ? 'pointer' : 'default', opacity: nextId ? 1 : 0.3 }}>›</button>
        </div>
      )}

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
                key={sheetId}
                front={sheet.card_image_recto_hd || sheet.card_image_recto}
                back={sheet.card_image_verso_hd || sheet.card_image_verso || undefined}
                isHorizontal={sheet.card_is_horizontal}
                accent={team.color}
              />
            )}
          </div>
          {sheet.card_meta && (sheet.card_meta.brand || sheet.card_meta.year || sheet.card_meta.number || sheet.card_meta.owner) && (
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)', marginTop: 10, textAlign: 'center' }}>
              {[sheet.card_meta.brand, sheet.card_meta.year, sheet.card_meta.number ? `#${sheet.card_meta.number}` : null].filter(Boolean).join(' · ')}
              {sheet.card_meta.owner && <span> · Collection de {sheet.card_meta.owner}</span>}
            </div>
          )}
        </div>

        <div style={{ maxWidth: 580, width: '100%', display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <TeamBadge teamId={team.id} size={30} />
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{team.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {flag && <img src={flag} alt="" style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />}
              <div style={{
                fontSize: 'clamp(36px, 5.2vw, 58px)', fontWeight: 900, lineHeight: 1.25, paddingBottom: 4, letterSpacing: -1,
                background: `linear-gradient(135deg, #fff 40%, ${team.color})`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}>
                {sheet.player_name}
              </div>
            </div>
            {infoBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {infoBadges.map(b => (
                  <span key={b.label} style={{
                    fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 999, padding: '6px 14px',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 800 }}>{b.label} : </span>{b.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {stats.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
              {stats.map(s => <StatCard key={s.label} {...s} accent={team.color} />)}
            </div>
          )}

          {Array.isArray(sheet.team_history) && sheet.team_history.length > 1 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Parcours</div>
              <TeamHistory history={sheet.team_history} variant="dark" />
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
