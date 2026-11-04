'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import PlayerSheetPresenterView, { type PresenterSheet } from '@/components/PlayerSheetPresenterView'

export default function PlayerSheetPresenterPage() {
  const { team: teamAbbr, sheetId } = useParams<{ team: string; sheetId: string }>()
  const router = useRouter()
  const team = SPORTS_TEAMS.find(t => t.sport === 'nba' && t.abbr === teamAbbr)

  const [ready, setReady] = useState(false)
  const [sheet, setSheet] = useState<PresenterSheet | null>(null)
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

  return (
    <PlayerSheetPresenterView
      sheet={sheet} team={team} teamAbbr={teamAbbr} sheetId={sheetId}
      order={order} idx={idx} prevId={prevId} nextId={nextId} goTo={goTo}
    />
  )
}
