'use client'
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ageOf, type Cell, type St } from '@/lib/jeuJoueur'
import type { BobbleFig } from '@/lib/bobbleheadsServer'
import BobbleHero from '@/components/BobbleHero'
import { playerSlug } from '@/lib/playerSlug'

// Joueur mystère du jour : on devine un joueur NBA en 8 essais, chaque essai est comparé au joueur caché.
// <JoueurMystere /> : le jeu complet (section pleine largeur, comme « Pronos » sur l'accueil).
// <JoueurMystereBanner /> : la bannière compacte prévue pour l'accueil, qui renvoie vers /jeu-joueur.

const SURFQUEST = "'Surfquest', Impact, 'Arial Narrow', sans-serif"
const UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const NAVY = '#0d1840'
const MAX = 8

type Stats = { played: number; won: number; streak: number; best: number; last: string; dist: number[] }

type ListPlayer = { id: string; name: string; team: string; teamName: string; pos: string; img: string | null; head: string | null; legend: boolean }
type Answer = ListPlayer & { conf: string; div: string; height: number; dob: string; jersey: number; country: string }
type Row = { id: string; cells: Cell[] }
const POS_FR: Record<string, string> = { G: 'Arrière', F: 'Ailier', C: 'Pivot' }
const SITE_ABBR: Record<string, string> = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' }   // abréviations ESPN → celles des maillots du site
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const yesterdayOf = (seed: string) => new Date(Date.parse(seed + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10)
const cm = (inch: number) => `${Math.round(inch * 2.54)} cm`
const logoOf = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`

// Le jour du jeu est décidé par le SERVEUR (minuit, heure de Paris), jamais par l'horloge de l'appareil :
// on lit /api/jeu-joueur/today, puis on se reprogramme pile au prochain minuit du serveur et chaque fois que l'onglet redevient visible.
type Today = { day: string; n: number; nextAt: number; skew: number }   // skew = écart entre l'horloge du serveur et celle de l'appareil
function useServerDay() {
  const [today, setToday] = useState<Today | null>(null)
  const load = useCallback(() => {
    fetch('/api/jeu-joueur/today', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => setToday(prev => (prev && prev.day === d.day ? { ...prev, nextAt: d.nextAt, skew: d.now - Date.now() } : { day: d.day, n: d.n, nextAt: d.nextAt, skew: d.now - Date.now() })))
      .catch(() => { /* on réessaiera au prochain retour sur l'onglet */ })
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!today) return
    const wait = Math.max(500, today.nextAt - (Date.now() + today.skew) + 800)
    const t = setTimeout(load, wait)
    const vis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearTimeout(t); document.removeEventListener('visibilitychange', vis) }
  }, [today, load])
  return { today, reload: load }
}

const HEAD = ['Équipe', 'Conf.', 'Div.', 'Poste', 'Taille', 'Âge', 'N°', 'Pays']
const EMOJI: Record<St, string> = { ok: '🟩', near: '🟨', no: '⬛' }
const ST_FR: Record<St, string> = { ok: 'identique', near: 'proche', no: 'différent' }

function readStats(): Stats {
  try { const s = JSON.parse(localStorage.getItem('jj-stats') || 'null'); if (s && typeof s.played === 'number') return s as Stats } catch { /* rien */ }
  return { played: 0, won: 0, streak: 0, best: 0, last: '', dist: Array(MAX).fill(0) }
}

// photo du joueur ; si elle ne charge pas (ou n'existe pas), ses initiales
function Photo({ p, cls = '' }: { p: { name: string; img: string | null; head: string | null }; cls?: string }) {
  const [bad, setBad] = useState(false)
  const [headBad, setHeadBad] = useState(false)
  const useHead = !!p.head && !headBad
  const src = useHead ? p.head : p.img
  if (!src || bad) return <span className={'jm-ph ' + cls} aria-hidden>{p.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span>
  return <img className={cls + (useHead ? ' jm-hd' : '')} src={src as string} alt="" onError={() => (useHead ? setHeadBad(true) : setBad(true))} />
}
function Logo({ src }: { src: string }) {
  const [bad, setBad] = useState(false)
  if (bad) return null
  return <img className="jm-logo" src={src} alt="" onError={() => setBad(true)} />
}

// ─────────────────────────────────────────────── le jeu
export default function JoueurMystere() {
  const [players, setPlayers] = useState<ListPlayer[] | null>(null)
  const [err, setErr] = useState(false)
  const { today, reload: reloadDay } = useServerDay()
  const seed = today?.day || ''   // « jour » de la partie : donné par le serveur (minuit, heure de Paris)
  const [ids, setIds] = useState<string[]>([])
  const [fresh, setFresh] = useState<string | null>(null)   // dernier essai (animation)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [copied, setCopied] = useState(false)
  const [help, setHelp] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [left, setLeft] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const daily = !!seed

  useEffect(() => {
    let alive = true
    fetch('/api/jeu-joueur').then(r => (r.ok ? r.json() : Promise.reject())).then(d => { if (alive) setPlayers(d.players as ListPlayer[]) }).catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [])
  useEffect(() => { setStats(readStats()) }, [])

  // la partie est jugée par le serveur : le joueur mystère (le même pour tout le monde chaque jour) n'est connu qu'à la fin de la partie
  const [rows, setRows] = useState<Row[]>([])
  const [over, setOver] = useState(false)
  const [won, setWon] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [srvErr, setSrvErr] = useState(false)
  const reqN = useRef(0)
  const play = (sd: string, list: string[]) => {
    const n = ++reqN.current
    if (!list.length) { setRows([]); setOver(false); setWon(false); setAnswer(null); return }
    fetch('/api/jeu-joueur/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seed: sd, ids: list }) })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (n !== reqN.current) return; setSrvErr(false); setRows(d.rows as Row[]); setOver(!!d.over); setWon(!!d.won); setAnswer((d.answer as Answer) || null) })
      .catch(st => { if (st === 400) reloadDay(); else if (n === reqN.current) setSrvErr(true) })   // 400 = le jour a changé côté serveur : on se resynchronise
  }

  useEffect(() => {   // reprend la partie du jour (dès que le serveur a donné la date)
    if (!seed) return
    setFresh(null)
    let list: string[] = []
    try { const s = localStorage.getItem('jj-' + seed); list = s ? (JSON.parse(s) as string[]) : [] } catch { list = [] }
    setIds(list); play(seed, list)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])
  const save = (next: string[]) => { setIds(next); try { if (daily) localStorage.setItem('jj-' + seed, JSON.stringify(next)) } catch { /* rien */ } }

  const byId = useMemo(() => new Map((players || []).map(p => [p.id, p])), [players])
  const guesses = rows.map(r => ({ p: byId.get(r.id), cells: r.cells })).filter(g => g.p) as { p: ListPlayer; cells: Cell[] }[]

  // statistiques : une seule fois par partie du jour terminée
  useEffect(() => {
    if (!over || !daily) return
    try {
      if (localStorage.getItem('jj-done-' + seed)) return
      localStorage.setItem('jj-done-' + seed, '1')
      const s = readStats()
      s.played++
      if (won) { s.won++; s.streak = s.last === yesterdayOf(seed) ? s.streak + 1 : 1; s.best = Math.max(s.best, s.streak); s.dist[Math.min(rows.length, MAX) - 1]++ } else s.streak = 0
      s.last = seed
      localStorage.setItem('jj-stats', JSON.stringify(s)); setStats(s)
    } catch { /* rien */ }
  }, [over, daily, seed, won, rows.length])

  useEffect(() => {   // compte à rebours avant le prochain joueur
    if (!over || !today) return
    const tick = () => setLeft(Math.max(0, today.nextAt - (Date.now() + today.skew)))   // l'heure du serveur, pas celle de l'appareil
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [over, today])

  // à la fin de la partie : sa bobblehead entière, si le joueur en a une (chargée seulement à ce moment, pour ne pas dévoiler le joueur avant)
  const [fig, setFig] = useState<BobbleFig | null>(null)
  const [small, setSmall] = useState(false)
  useEffect(() => { const f = () => setSmall(window.innerWidth <= 520); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  useEffect(() => {
    setFig(null)
    if (!over || !answer) return
    let off = false
    // la figurine garde l'équipe de sa création : on la rhabille aux couleurs de l'équipe actuelle (d'après ESPN), avec son numéro actuel
    Promise.all([
      fetch(`/api/bobble-figs?names=${encodeURIComponent(answer.name)}`).then(r => (r.ok ? r.json() : null)),
      fetch('/api/bobble-kits').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, cat]) => {
      const f = d?.figs?.[0]?.fig as BobbleFig | undefined
      if (off || !f || f.sport) return
      const ab = SITE_ABBR[answer.team] || answer.team
      const kit = cat?.kits?.[`${ab}-dom`]
      setFig(kit && f.body.team ? { ...f, body: { ...f.body, w: kit.w, h: kit.h, span: kit.span, src: kit.src, team: ab, numFill: kit.num.fill, numStroke: kit.num.stroke, numCfg: kit.num, num: String(answer.jersey) } } : f)
    }).catch(() => { /* la carte retournée reste affichée */ })
    return () => { off = true }
  }, [over, answer])

  const sugg = useMemo(() => {
    const t = norm(q.trim())
    if (!players || t.length < 2) return []
    return players.filter(p => !ids.includes(p.id) && norm(p.name).includes(t)).slice(0, 7)
  }, [q, players, ids])

  const pick = (p: ListPlayer) => { if (over || ids.includes(p.id)) return; const next = [...ids, p.id]; setFresh(p.id); save(next); play(seed, next); setQ(''); setHi(0); inputRef.current?.focus() }
  const day = today?.n ?? 0

  const share = async () => {
    const lines = guesses.map(g => g.cells.map(c => EMOJI[c.st]).join(''))
    const txt = `🕵️ Joueur mystère Memorabilius${daily ? ' n°' + day : ''} ${won ? rows.length : 'X'}/${MAX}\n${lines.join('\n')}\nmemorabilius.fr`
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { window.prompt('Copie ce texte :', txt) }
  }
  const hms = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':') }

  const tries = rows.length
  const dist = stats?.dist || []
  const distMax = Math.max(1, ...dist)

  return (
    <section className="jm" aria-label="Joueur mystère">
      <style>{CSS}</style>
      <div className="jm-wrap">
        <div className="jm-top">
          <h2 className="jm-h2">🕵️ Joueur mystère</h2>
          <span className="jm-chip">N° {day}</span>
          {!!stats?.streak && <span className="jm-chip gold" title="Jours de suite où tu as trouvé le joueur">🔥 {stats.streak} jour{stats.streak > 1 ? 's' : ''}</span>}
          <button type="button" className="jm-chip btn" onClick={() => setHelp(h => !h)} aria-expanded={help}>{help ? 'Fermer' : 'Comment jouer ?'}</button>
        </div>
        {help && (
          <div className="jm-help">
            <p>Devine le joueur NBA du jour en <b>{MAX} essais</b>. Chaque joueur proposé est comparé au joueur caché :</p>
            <ul>
              <li><i className="ok" /> <b>Vert</b> : identique.</li>
              <li><i className="near" /> <b>Jaune</b> : proche (taille à 5 cm près, âge à 2 ans, numéro à 3).</li>
              <li><i className="no" /> <b>Gris</b> : différent. Une flèche <b>↑ / ↓</b> indique si le mystère est plus grand, plus âgé ou a un numéro plus haut (↑) ou l’inverse (↓).</li>
            </ul>
          </div>
        )}

        {err && <p className="jm-msg">Les données des joueurs sont indisponibles pour le moment. Réessaie dans quelques minutes.</p>}
        {srvErr && <p className="jm-msg">Connexion au jeu impossible pour le moment. Réessaie dans un instant.</p>}
        {!players && !err && <p className="jm-msg">Chargement des joueurs…</p>}

        {players && (
          <div className="jm-box">
            {over && fig && answer ? (
              <div className="jm-side fig">
                <div className="jm-figin"><BobbleHero fig={fig} name={answer.name} height={small ? 175 : 400} /></div>
                <div className="jm-fign"><Link href={`/joueur/${playerSlug(answer.name)}`} className="jm-fnl"><b>{answer.name}</b></Link><span>{answer.teamName} · #{answer.jersey}</span><em className={won ? 'w' : 'l'}>{won ? `Trouvé en ${tries} essai${tries > 1 ? 's' : ''} !` : 'Perdu'}</em><Link href={`/joueur/${playerSlug(answer.name)}`} className="jm-cards">🃏 Voir ses cartes</Link></div>
              </div>
            ) : (
            <div className="jm-side">
              <div className={'jm-mc' + (over ? ' on' : '')}>
                <div className="jm-mc-in">
                  <div className="jm-mc-f jm-mc-front"><span className="jm-q">?</span><small>Joueur du jour</small></div>
                  <div className="jm-mc-f jm-mc-back" style={{ ['--team' as string]: '#1b3a8a' }}>
                    {answer && <><Photo p={answer} cls="jm-mc-ph" /><b>{answer.name}</b><small>{answer.teamName}</small><Logo src={logoOf(answer.team)} /></>}
                  </div>
                </div>
              </div>
              <div className="jm-info">
                <div className="jm-pips" aria-label={`Essai ${Math.min(tries + (over ? 0 : 1), MAX)} sur ${MAX}`}>
                  {Array.from({ length: MAX }, (_, i) => <i key={i} className={i < tries ? (won && i === tries - 1 ? 'w' : 'u') : i === tries && !over ? 'n' : ''} />)}
                </div>
                <span className="jm-try">{over ? (won ? 'Trouvé !' : 'Perdu') : `Essai ${tries + 1} / ${MAX}`}</span>
                {over && answer && <Link href={`/joueur/${playerSlug(answer.name)}`} className="jm-cards">🃏 Voir ses cartes</Link>}
              </div>
            </div>
            )}

            <div className="jm-main">
              {!over && (
                <div className="jm-in">
                  <span className="jm-in-i" aria-hidden>🔎</span>
                  <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setHi(0) }} placeholder="Tape le nom d’un joueur…" aria-label="Nom du joueur" autoComplete="off" spellCheck={false}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, sugg.length - 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)) }
                      else if (e.key === 'Enter' && sugg[hi]) { e.preventDefault(); pick(sugg[hi]) }
                      else if (e.key === 'Escape') setQ('')
                    }} />
                  {sugg.length > 0 && (
                    <ul className="jm-sg" role="listbox">
                      {sugg.map((p, i) => (
                        <li key={p.id} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); pick(p) }}>
                          <Photo p={p} /><b>{p.name}</b><span><Logo src={logoOf(p.team)} />{p.team} · {p.pos}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {q.trim().length >= 2 && sugg.length === 0 && !over && <p className="jm-none">Aucun joueur ne correspond (ou il est déjà dans tes essais).</p>}

              {tries === 0 && !over && <p className="jm-hint">Commence par un joueur connu : on voit tout de suite l’équipe, la taille et l’âge qui comptent.</p>}

              {over && answer && (
                <div className={'jm-end ' + (won ? 'w' : 'l')}>
                  {won && <div className="jm-conf" aria-hidden>{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: (i * 37) % 100 + '%', animationDelay: (i % 9) * 90 + 'ms', background: ['#1fae4a', '#d4a017', '#2f6bff', '#d6293e', '#fff'][i % 5] }} />)}</div>}
                  <div className="jm-end-t">{won ? `Bravo ! Trouvé en ${tries} essai${tries > 1 ? 's' : ''}` : 'Dommage, ce sera pour demain !'}</div>
                  <div className="jm-end-s">{answer.name} · {answer.teamName} · {POS_FR[answer.pos] || answer.pos} · {cm(answer.height)} · {ageOf(answer.dob)} ans · #{answer.jersey}</div>
                  <div className="jm-bt">
                    <button type="button" className="pri" onClick={share}>{copied ? 'Copié ✓' : '📋 Copier mon résultat'}</button>
                  </div>
                  {daily && <div className="jm-next">Prochain joueur dans <b>{hms(left)}</b></div>}
                  {daily && stats && stats.played > 0 && (
                    <div className="jm-stats">
                      <div><b>{stats.played}</b><span>parties</span></div>
                      <div><b>{Math.round((stats.won / stats.played) * 100)} %</b><span>trouvés</span></div>
                      <div><b>{stats.streak}</b><span>série</span></div>
                      <div><b>{stats.best}</b><span>record</span></div>
                      <div className="jm-dist" aria-label="Répartition des victoires par nombre d’essais">{dist.map((n, i) => <i key={i} title={`${i + 1} essai(s) : ${n}`} style={{ height: 6 + (n / distMax) * 34 }} />)}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="jm-list">
                <div className="jm-cols" aria-hidden>
                  <span className="jm-cn" />
                  <div className="jm-tiles">{HEAD.map((h, i) => <span key={h}><span className="jm-l">{h}</span><span className="jm-s">{i === 0 ? 'Éq.' : h}</span></span>)}</div>
                </div>
                {guesses.map(({ p: g, cells }) => {
                  const isNew = g.id === fresh
                  return (
                    <div className={'jm-g' + (answer && g.id === answer.id ? ' win' : '')} key={g.id}>
                      <div className="jm-gh"><Photo p={g} /><div><b>{g.name}</b><span>{g.teamName}</span></div></div>
                      <div className="jm-tiles">
                        {cells.map((c, i) => (
                          <div key={i} className={'jm-t ' + c.st + (isNew ? ' fresh' : '')} style={isNew ? { animationDelay: i * 110 + 'ms' } : undefined} aria-label={`${HEAD[i]} : ${c.label}, ${ST_FR[c.st]}${c.arrow ? (c.arrow === '↑' ? ', le mystère est plus haut' : ', le mystère est plus bas') : ''}`}>
                            <div className="jm-tv">
                              {c.logo && <Logo src={c.logo} />}
                              {c.flag && <img className="jm-flag" src={`https://flagcdn.com/w80/${c.flag}.png`} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}
                              {c.value && <b><span className="jm-l">{c.value}</span><span className="jm-s">{(c.short ?? c.value).replace(' cm', '').replace('#', '')}</span></b>}
                              {c.arrow && <em>{c.arrow}</em>}
                            </div>
                            {c.sub && <span className="jm-ts">{c.sub}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {!over && Array.from({ length: Math.max(0, MAX - tries) }, (_, i) => <div key={'e' + i} className={'jm-g jm-empty' + (i === 0 ? ' cur' : '')}>{tries + 1 + i}</div>)}
              </div>

            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────── bannière compacte pour l'accueil
export function JoueurMystereBanner() {
  const [state, setState] = useState<{ tries: number; over: boolean; won: boolean } | null>(null)
  const { today } = useServerDay()   // le jour vient du serveur (minuit, heure de Paris)
  useEffect(() => {
    if (!today) return
    try {
      const seed = today.day
      const ids = JSON.parse(localStorage.getItem('jj-' + seed) || '[]') as string[]
      const done = !!localStorage.getItem('jj-done-' + seed)
      const streakWon = readStats().last === seed && readStats().streak > 0
      setState({ tries: ids.length, over: done, won: done && streakWon })
    } catch { setState({ tries: 0, over: false, won: false }) }
  }, [today])
  const day = today?.n ?? ''
  return (
    <section className="jm jm-bn" aria-label="Joueur mystère">
      <style>{CSS}</style>
      <div className="jm-wrap">
        <Link href="/jeu-joueur" className="jm-ban">
          <div className="jm-ban-c"><span>?</span></div>
          <div className="jm-ban-t">
            <b>🕵️ Joueur mystère n° {day}</b>
            <span>{!state || state.tries === 0 ? 'Trouve le joueur NBA du jour en 8 essais.' : state.over ? (state.won ? 'Trouvé aujourd’hui ✓ Reviens demain !' : 'Raté aujourd’hui. Reviens demain !') : `En cours : ${state.tries} essai${state.tries > 1 ? 's' : ''} sur ${MAX}.`}</span>
          </div>
          <span className="jm-ban-b">{state && state.tries > 0 && !state.over ? 'Continuer' : state?.over ? 'Voir' : 'Jouer'} →</span>
        </Link>
      </div>
    </section>
  )
}

const CSS = `
.jm { background: ${NAVY}; padding: 32px 20px 48px; color: #fff; font-family: ${UI_FONT}; }
.jm * { box-sizing: border-box; }
.jm-wrap { max-width: var(--page-max, 1200px); margin: 0 auto; }
.jm-top { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0 0 18px; }
.jm-h2 { font-family: ${SURFQUEST}; font-weight: 400; font-size: 28px; letter-spacing: 1px; margin: 0 8px 0 0; text-transform: uppercase; }
.jm-chip { font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.08); color: #fff; }
.jm-chip.gold { border-color: #d4a017; color: #ffd98a; background: rgba(212,160,23,.12); }
.jm-chip.btn { cursor: pointer; color: #8db6ff; border-color: rgba(141,182,255,.55); background: transparent; font-family: inherit; }
.jm-chip.btn:hover { background: rgba(141,182,255,.12); }
.jm-help { border: 2px solid rgba(255,255,255,.2); background: rgba(255,255,255,.05); padding: 14px 18px; margin: 0 0 18px; font-size: 14px; line-height: 1.55; max-width: 760px; }
.jm-help p { margin: 0 0 8px; } .jm-help ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
.jm-help i { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; } .jm-help i.ok { background: #1fae4a; } .jm-help i.near { background: #d4a017; } .jm-help i.no { background: #2a3358; border: 1px solid #55608c; }
.jm-msg { color: rgba(255,255,255,.75); font-size: 15px; }
.jm-box { display: grid; grid-template-columns: 1fr; gap: 20px; border: 4px solid #fff; background: linear-gradient(160deg, #060c24 0%, #0a1740 60%, #0d2260 100%); padding: 16px; }
.jm-side { display: flex; gap: 14px; align-items: center; }
.jm-mc { width: 84px; flex: none; aspect-ratio: 5 / 7; perspective: 900px; }
.jm-mc-in { position: relative; width: 100%; height: 100%; transition: transform .8s cubic-bezier(.3,.7,.2,1); transform-style: preserve-3d; }
.jm-mc.on .jm-mc-in { transform: rotateY(180deg); }
.jm-mc-f { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border: 4px solid #d4a017; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; overflow: hidden; }
.jm-mc-front { background: radial-gradient(circle at 50% 35%, #1b3a8a 0%, #0a1740 70%); box-shadow: inset 0 0 40px rgba(0,0,0,.45); }
.jm-mc-front::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.18) 48%, transparent 66%); animation: jmShine 3.6s ease-in-out infinite; }
.jm-q { font-family: ${SURFQUEST}; font-size: 54px; line-height: 1; color: #ffd98a; text-shadow: 0 2px 0 rgba(0,0,0,.5); }
.jm-mc-front small { font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.jm-mc-back { transform: rotateY(180deg); background: linear-gradient(180deg, var(--team, #1b3a8a) 0%, #060c24 100%); padding: 6px; }
.jm-mc-back b { font-size: 12px; line-height: 1.15; } .jm-mc-back small { font-size: 9px; opacity: .8; } .jm-mc-back .jm-logo { position: absolute; right: 4px; top: 4px; width: 22px; height: 22px; }
.jm-mc-ph { width: 62%; aspect-ratio: 1; border-radius: 50%; object-fit: cover; object-position: top; background: #243063; border: 2px solid #fff; }
.jm-info { display: flex; flex-direction: column; gap: 8px; }
.jm-pips { display: flex; gap: 5px; flex-wrap: wrap; max-width: 200px; } .jm-pips i { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.4); display: block; } .jm-pips i.u { background: #55608c; border-color: #55608c; } .jm-pips i.w { background: #1fae4a; border-color: #1fae4a; } .jm-pips i.n { border-color: #ffd98a; animation: jmPulse 1.4s ease-in-out infinite; }
.jm-try { font-weight: 800; font-size: 15px; }
.jm-main { min-width: 0; }
.jm-side.fig { flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; text-align: center; }
.jm-figin { animation: jmDrop .8s cubic-bezier(.2,.8,.2,1) both; display: flex; justify-content: center; max-width: 100%; overflow: visible; padding-top: 26px; }
.jm-fign { display: flex; flex-direction: column; align-items: center; gap: 3px; } .jm-fign b { font-family: ${SURFQUEST}; font-weight: 400; font-size: 26px; letter-spacing: 1px; text-transform: uppercase; line-height: 1.1; } .jm-fign span { font-size: 13px; color: rgba(255,255,255,.75); }
.jm-fign em { font-style: normal; font-weight: 800; font-size: 13px; padding: 4px 12px; border-radius: 999px; margin-top: 4px; } .jm-fign em.w { background: #1fae4a; } .jm-fign em.l { background: #d6293e; }
.jm-fnl { color: #fff; text-decoration: none; } .jm-fnl:hover b { text-decoration: underline; text-underline-offset: 4px; }
.jm-cards { display: inline-block; margin-top: 6px; font-weight: 800; font-size: 13px; padding: 9px 18px; border-radius: 999px; background: #fff; color: ${NAVY}; text-decoration: none; } .jm-cards:hover { background: #ffd98a; }
@keyframes jmDrop { 0% { transform: translateY(-40px) scale(.92); opacity: 0; } 100% { transform: none; opacity: 1; } }
.jm-in { position: relative; margin: 0 0 14px; }
.jm-in input { width: 100%; padding: 14px 16px 14px 46px; font: 600 16px ${UI_FONT}; color: #fff; background: rgba(255,255,255,.07); border: 3px solid rgba(255,255,255,.7); outline: none; border-radius: 0; }
.jm-in input::placeholder { color: rgba(255,255,255,.5); } .jm-in input:focus { border-color: #ffd98a; background: rgba(255,255,255,.1); }
.jm-in-i { position: absolute; left: 14px; top: 13px; font-size: 18px; opacity: .8; pointer-events: none; }
.jm-sg { position: absolute; z-index: 20; left: 0; right: 0; top: 100%; margin: 0; padding: 0; list-style: none; background: #0a1030; border: 3px solid #ffd98a; border-top: 0; max-height: 340px; overflow-y: auto; box-shadow: 0 14px 30px rgba(0,0,0,.55); }
.jm-sg li { display: flex; align-items: center; gap: 10px; padding: 7px 12px; cursor: pointer; } .jm-sg li.on { background: #16306d; }
.jm-sg li b { font-size: 14px; font-weight: 700; } .jm-sg li span { margin-left: auto; font-size: 12px; opacity: .75; display: inline-flex; align-items: center; gap: 6px; flex: none; }
.jm-ph, .jm-sg li img, .jm-gh img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; object-position: top; background: #243063; flex: none; display: inline-block; }
.jm-hd { object-fit: contain !important; object-position: center !important; background: transparent !important; }
.jm-ph { display: grid !important; place-items: center; font: 800 12px ${UI_FONT}; color: #aab3d1; }
.jm-logo { width: 22px; height: 22px; object-fit: contain; flex: none; }
.jm-none, .jm-hint { font-size: 13px; color: rgba(255,255,255,.65); margin: 0 0 12px; }
.jm-list { display: grid; gap: 10px; container-type: inline-size; }
.jm-g { display: grid; gap: 4px; }
.jm-cols { display: block; padding: 0 0 6px; margin: 0 0 2px; border-bottom: 2px solid rgba(255,255,255,.3); } .jm-cn { display: none; }
.jm-cols .jm-tiles span { text-align: center; font-size: 10px; font-weight: 800; letter-spacing: .02em; text-transform: uppercase; color: rgba(255,255,255,.8); white-space: nowrap; overflow: hidden; }
.jm-g.jm-empty { display: grid; place-items: center; height: 74px; border: 2px dashed rgba(255,255,255,.22); color: rgba(255,255,255,.4); font-size: 18px; font-weight: 800; }
.jm-g.jm-empty.cur { border-color: #ffd98a; color: #ffd98a; animation: jmPulse 1.4s ease-in-out infinite; }
.jm-gh { display: flex; align-items: center; gap: 10px; min-width: 0; } .jm-gh div { display: flex; flex-direction: column; min-width: 0; } .jm-gh b { font-size: 15px; } .jm-gh span { font-size: 12px; color: rgba(255,255,255,.6); }
.jm-tiles { display: grid; grid-template-columns: repeat(8, 1fr); gap: 3px; }
.jm-l { display: none; } .jm-s { display: inline; } .jm-t small { font-size: 7px; letter-spacing: .04em; } .jm-t .jm-ts { display: none; }
.jm-t { min-height: 46px; padding: 6px 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-align: center; border: 2px solid transparent; position: relative; min-width: 0; }
.jm-t small { font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; opacity: .75; }
.jm-tv { display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; } .jm-tv b { font-size: 15px; line-height: 1.1; font-weight: 800; } .jm-tv em { font-style: normal; font-size: 20px; font-weight: 900; line-height: 1; }
.jm-flag { width: 34px; height: 24px; object-fit: cover; border: 1px solid rgba(255,255,255,.5); display: block; } .jm-ts { font-size: 10px; opacity: .85; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.jm-t.ok { background: #1fae4a; } .jm-t.near { background: #d4a017; color: #1a1200; } .jm-t.no { background: #2a3358; border-color: #3a4672; }
.jm-t.fresh { animation: jmFlip .55s cubic-bezier(.3,.7,.2,1) both; }
@container (min-width: 620px) { .jm-g, .jm-cols { display: grid; grid-template-columns: 190px 1fr; align-items: center; gap: 10px; } .jm-cn { display: block; } .jm-g.jm-empty { display: grid; grid-template-columns: none; height: 66px; } .jm-t { min-height: 58px; } .jm-tiles { gap: 6px; } .jm-l { display: inline; } .jm-s { display: none; } .jm-t small { font-size: 9px; letter-spacing: .1em; } .jm-t .jm-ts { display: block; } }
.jm-end { position: relative; overflow: hidden; margin: 0 0 14px; padding: 20px 18px; border: 3px solid; text-align: center; background: rgba(255,255,255,.05); display: grid; gap: 10px; justify-items: center; }
.jm-end.w { border-color: #1fae4a; } .jm-end.l { border-color: #d6293e; }
.jm-end-t { font-family: ${SURFQUEST}; font-size: 28px; letter-spacing: 1px; text-transform: uppercase; } .jm-end-s { font-size: 14px; color: rgba(255,255,255,.8); }
.jm-bt { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
.jm-bt button { font: 800 13px ${UI_FONT}; padding: 10px 18px; border-radius: 999px; cursor: pointer; color: #8db6ff; background: transparent; border: 1px solid rgba(141,182,255,.55); } .jm-bt button.pri { background: #fff; color: ${NAVY}; border-color: #fff; }
.jm-next { font-size: 13px; color: rgba(255,255,255,.7); } .jm-next b { font-variant-numeric: tabular-nums; color: #ffd98a; font-size: 16px; }
.jm-stats { display: flex; gap: 22px; flex-wrap: wrap; justify-content: center; align-items: flex-end; margin-top: 6px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,.18); width: 100%; }
.jm-stats > div { display: flex; flex-direction: column; align-items: center; } .jm-stats b { font-size: 22px; } .jm-stats span { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.6); }
.jm-dist { flex-direction: row !important; align-items: flex-end; gap: 3px; height: 44px; } .jm-dist i { display: block; width: 10px; background: #1fae4a; min-height: 6px; }
.jm-conf { position: absolute; inset: 0; pointer-events: none; } .jm-conf i { position: absolute; top: -14px; width: 8px; height: 14px; animation: jmFall 2.4s ease-in both; }
.jm-foot { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 14px; } .jm-lk { background: none; border: 0; color: #8db6ff; cursor: pointer; font: 600 13px ${UI_FONT}; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
.jm-ban { display: flex; align-items: center; gap: 16px; border: 4px solid #fff; background: linear-gradient(135deg, #060c24, #0a1740 55%, #1b3a8a); padding: 14px 18px; color: #fff; text-decoration: none; }
.jm-ban:hover { border-color: #ffd98a; }
.jm-ban-c { width: 52px; aspect-ratio: 5/7; border: 3px solid #d4a017; background: radial-gradient(circle at 50% 35%, #1b3a8a, #0a1740 70%); display: grid; place-items: center; flex: none; } .jm-ban-c span { font-family: ${SURFQUEST}; font-size: 34px; color: #ffd98a; }
.jm-ban-t { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; } .jm-ban-t b { font-family: ${SURFQUEST}; font-weight: 400; font-size: 22px; letter-spacing: 1px; text-transform: uppercase; } .jm-ban-t span { font-size: 14px; color: rgba(255,255,255,.75); }
.jm-ban-b { font-weight: 800; font-size: 13px; padding: 10px 18px; border-radius: 999px; background: #fff; color: ${NAVY}; white-space: nowrap; }
.jm.jm-bn { padding-top: 12px; padding-bottom: 12px; }
.dd-blk .jm.jm-bn { padding: 0; background: transparent; } .dd-blk .jm-bn .jm-wrap { max-width: none; margin: 0 16px 14px; }
@media (min-width: 900px) {
  .jm-box { grid-template-columns: 250px 1fr; gap: 28px; padding: 22px; }
  .jm-side { flex-direction: column; align-items: stretch; position: sticky; top: 90px; align-self: start; }
  .jm-mc { width: 100%; } .jm-q { font-size: 96px; } .jm-mc-front small { font-size: 11px; } .jm-mc-back b { font-size: 18px; } .jm-mc-back small { font-size: 12px; } .jm-mc-back .jm-logo { width: 34px; height: 34px; right: 8px; top: 8px; }
  .jm-info { align-items: center; } .jm-pips { justify-content: center; }
}
@media (max-width: 520px) {
  .jm { padding: 14px 10px 28px; } .jm-top { margin: 0 0 10px; gap: 6px; } .jm-h2 { font-size: 22px; margin: 0 4px 0 0; } .jm-chip { font-size: 11px; padding: 5px 10px; }
  .jm-box { border: 0; background: none; padding: 0; gap: 10px; }
  .jm-side { gap: 12px; padding: 10px; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.04); }
  .jm-mc { width: 68px; } .jm-mc-f { border-width: 3px; } .jm-q { font-size: 38px; } .jm-mc-front small { display: none; } .jm-mc-back { padding: 3px; gap: 2px; } .jm-mc-back b { font-size: 9px; } .jm-mc-back small { display: none; } .jm-mc-back .jm-logo { width: 16px; height: 16px; }
  .jm-in { margin: 0 0 10px; } .jm-in input { padding: 12px 12px 12px 42px; } .jm-in-i { top: 11px; }
  .jm-hint { margin: 0 0 10px; }
  .jm-list { gap: 8px; } .jm-g { gap: 3px; } .jm-g.jm-empty { height: 66px; } .jm-cols .jm-tiles span { font-size: 9px; }
  .jm-ph, .jm-sg li img, .jm-gh img { width: 28px; height: 28px; } .jm-gh b { font-size: 14px; } .jm-gh span { font-size: 11px; }
  .jm-t { min-height: 44px; padding: 3px 1px; gap: 2px; border-width: 1px; } .jm-tv { gap: 1px; flex-direction: column; } .jm-tv b { font-size: 13px; } .jm-tv em { font-size: 13px; } .jm-flag { width: 26px; height: 18px; } .jm-logo { width: 18px; height: 18px; }
  .jm-end { padding: 14px 10px; } .jm-end-t { font-size: 22px; } .jm-end-s { font-size: 13px; } .jm-stats { gap: 14px; }
  /* fin de partie, version compacte : la figurine à gauche, le nom et le statut à droite ; récap resserré */
  .jm-side.fig { flex-direction: row; align-items: center; justify-content: flex-start; text-align: left; gap: 10px; padding: 8px 12px; }
  .jm-figin { padding-top: 4px; flex: none; }
  .jm-fign { align-items: flex-start; flex: 1; min-width: 0; } .jm-fign b { font-size: 20px; }
  .jm-end { padding: 10px; gap: 6px; margin-bottom: 10px; } .jm-end-t { font-size: 18px; } .jm-end-s { font-size: 11px; line-height: 1.35; }
  .jm-bt { gap: 6px; } .jm-bt button { padding: 8px 12px; font-size: 12px; }
  .jm-stats { margin-top: 2px; padding-top: 8px; gap: 12px; } .jm-stats b { font-size: 18px; } .jm-next { font-size: 12px; } .jm-next b { font-size: 14px; }
}
@media (max-width: 520px) { .jm.jm-bn { padding: 8px 12px; } .dd-blk .jm.jm-bn { padding: 0; } .jm-ban { gap: 10px; padding: 10px; } .jm-ban-c { width: 40px; } .jm-ban-c span { font-size: 26px; } .jm-ban-b { padding: 8px 12px; font-size: 12px; } .jm-ban-t b { font-size: 16px; } .jm-ban-t span { font-size: 12px; } }
@keyframes jmFlip { 0% { transform: rotateX(90deg) scale(.9); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes jmShine { 0%, 55% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@keyframes jmPulse { 0%, 100% { background: transparent; } 50% { background: rgba(255,217,138,.35); } }
@keyframes jmFall { to { transform: translateY(260px) rotate(540deg); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .jm-mc-in { transition: none; } .jm-mc-front::after, .jm-pips i.n, .jm-t.fresh, .jm-conf i { animation: none !important; } }
`
