'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS } from '@/lib/sportsTeams'
import { useTheme } from '@/lib/ThemeContext'
import TeamBadge from '@/components/TeamBadge'

const NBA_TEAMS = SPORTS_TEAMS.filter(t => t.sport === 'nba')

type Filter = 'all' | 'todo' | 'done' | 'market'

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
  // Avancement des stats cartes par équipe (fiches calculées / fiches). null = migration 20261107 pas encore lancée.
  const [market, setMarket] = useState<Record<string, { total: number; done: number }> | null>(null)
  // Équipes cochées (seules elles sont calculées). null = migration 20261108 pas encore lancée.
  const [wanted, setWanted] = useState<Set<string> | null>(null)
  const toggleWanted = async (abbr: string) => {
    if (!wanted) return
    const on = wanted.has(abbr)
    const next = new Set(wanted)
    if (on) next.delete(abbr); else next.add(abbr)
    setWanted(next)
    const { error } = on
      ? await supabase.from('player_sheet_market_teams').delete().eq('team_abbr', abbr)
      : await supabase.from('player_sheet_market_teams').insert({ team_abbr: abbr })
    if (error) setWanted(wanted) // échec : on remet l'état d'avant
  }
  const loadMarket = async () => {
    const [{ data, error }, w] = await Promise.all([
      supabase.from('player_sheets').select('team_abbr, card_market_at').limit(5000),
      supabase.from('player_sheet_market_teams').select('team_abbr'),
    ])
    setWanted(w.error ? null : new Set((w.data ?? []).map(r => r.team_abbr)))
    if (error || !data) { setMarket(null); return }
    const acc: Record<string, { total: number; done: number }> = {}
    for (const r of data) {
      const cur = acc[r.team_abbr] ?? (acc[r.team_abbr] = { total: 0, done: 0 })
      cur.total++
      if (r.card_market_at) cur.done++
    }
    setMarket(acc)
  }

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
      loadMarket()
    })
  }, [])

  // Stats « marché des cartes » de TOUTES les fiches sans stats, par lots (le serveur répond « remaining » tant qu'il en reste).
  const [marketRun, setMarketRun] = useState<{ done: number; remaining: number | null; running: boolean; msg?: string } | null>(null)
  const computeAllMarkets = async () => {
    if (marketRun?.running) return
    if (!confirm(`Calculer les stats cartes (catalogue TCDB + annonces eBay) des ${wantedLeft} fiches des équipes cochées qui n’en ont pas ?\n\n≈ ${wantedLeft * 5} appels eBay (quota de 5 000 par jour, partagé avec le site). Tu peux laisser la page ouverte.`)) return
    setMarketRun({ done: 0, remaining: null, running: true })
    let done = 0
    for (let i = 0; i < 200; i++) {
      const tok = (await supabase.auth.getSession()).data.session?.access_token
      if (!tok) break
      const res = await fetch('/api/admin/player-sheets-market', {
        method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }),
      }).catch(() => null)
      if (!res || !res.ok) { setMarketRun({ done, remaining: null, running: false, msg: res?.status === 409 ? 'Migration 20261107 à lancer dans Supabase.' : 'Erreur : relance plus tard.' }); return }
      const j = await res.json().catch(() => null)
      if (!j) break
      done += j.done || 0
      setMarketRun({ done, remaining: j.remaining ?? 0, running: j.remaining > 0 && j.done > 0 })
      if (!j.remaining || !j.done) break
    }
    setMarketRun(m => m ? { ...m, running: false, msg: m.remaining ? 'Arrêté : certaines fiches n’ont pas pu être calculées.' : 'Terminé.' } : m)
    loadMarket()
  }

  const doneCount = useMemo(() => NBA_TEAMS.filter(t => stats[t.abbr]).length, [stats])
  // équipe dont au moins une fiche n'a pas encore ses stats cartes
  const marketTodo = (abbr: string) => !!wanted?.has(abbr) && !!market?.[abbr] && market[abbr].done < market[abbr].total
  const wantedLeft = NBA_TEAMS.reduce((n, t) => n + (wanted?.has(t.abbr) && market?.[t.abbr] ? market[t.abbr].total - market[t.abbr].done : 0), 0)
  const marketTodoCount = useMemo(() => NBA_TEAMS.filter(t => marketTodo(t.abbr)).length, [market]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => NBA_TEAMS.filter(t =>
    filter === 'all' ? true : filter === 'done' ? !!stats[t.abbr] : filter === 'market' ? marketTodo(t.abbr) : !stats[t.abbr]
  ), [stats, filter, market]) // eslint-disable-line react-hooks/exhaustive-deps

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={computeAllMarkets} disabled={!!marketRun?.running || !wanted || wantedLeft === 0} style={{
          padding: '7px 14px', borderRadius: 20, border: '1px solid #003DA6', background: 'transparent', color: '#003DA6',
          fontWeight: 800, fontSize: 12.5, cursor: marketRun?.running ? 'wait' : 'pointer', opacity: !wanted || wantedLeft === 0 ? 0.5 : 1,
        }}>💹 Calculer les équipes cochées{wanted ? ` (${wantedLeft} fiche${wantedLeft > 1 ? 's' : ''})` : ''}</button>
        {!wanted && <span style={{ fontSize: 12, color: '#c77700' }}>Migration 20261108 à lancer dans Supabase pour cocher les équipes.</span>}
        {wanted && wanted.size === 0 && <span style={{ fontSize: 12, color: '#888' }}>Coche les équipes dont tu veux les stats (case 💹 sur chaque équipe), puis lance le calcul. Tu peux étaler sur plusieurs jours.</span>}
        {marketRun && (
          <span style={{ fontSize: 12.5, color: '#888' }}>
            {marketRun.running ? 'Calcul en cours… ' : ''}{marketRun.done} fiche{marketRun.done > 1 ? 's' : ''} calculée{marketRun.done > 1 ? 's' : ''}
            {marketRun.remaining ? ` · ${marketRun.remaining} restante${marketRun.remaining > 1 ? 's' : ''}` : ''}{marketRun.msg ? ` · ${marketRun.msg}` : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {chip('all', `Toutes (${NBA_TEAMS.length})`)}
        {chip('todo', `À faire (${NBA_TEAMS.length - doneCount})`)}
        {chip('done', `Faites (${doneCount})`)}
        {market && wanted && chip('market', `💹 Cochées à calculer (${marketTodoCount})`)}
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
              {wanted && (
                <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); toggleWanted(team.abbr) }}
                  title={wanted.has(team.abbr) ? 'Stats cartes demandées pour cette équipe (clique pour retirer)' : 'Demander les stats cartes de cette équipe'}
                  aria-pressed={wanted.has(team.abbr)} style={{
                    position: 'absolute', top: 6, left: 6, borderRadius: 8, padding: '2px 7px', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                    border: `1px solid ${wanted.has(team.abbr) ? '#003DA6' : dark ? '#444' : '#ccc'}`,
                    background: wanted.has(team.abbr) ? '#003DA6' : 'transparent', color: wanted.has(team.abbr) ? '#fff' : '#888',
                  }}>{wanted.has(team.abbr) ? '☑' : '☐'} 💹</button>
              )}
              {market?.[team.abbr] && wanted?.has(team.abbr) && (() => {
                const m = market[team.abbr]
                const full = m.done >= m.total
                return (
                  <div title="Fiches dont les stats cartes (TCDB + eBay) sont calculées" style={{
                    fontSize: 11, fontWeight: 800, borderRadius: 12, padding: '2px 8px',
                    color: full ? '#1b8a3a' : '#c77700', background: full ? 'rgba(27,138,58,.12)' : 'rgba(255,170,0,.15)',
                  }}>💹 {m.done}/{m.total} {full ? '✓' : ''}</div>
                )
              })()}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
