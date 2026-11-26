'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react'
import BobbleHero from '@/components/BobbleHero'
import { withKit, KIT_LABEL } from '@/lib/bobbleheads'
import { useKitCatalog } from '@/lib/useKitCatalog'
import type { BobbleFig } from '@/lib/bobbleheadsServer'

// PC en boîte de figurine (style Funko Pop) : fond aux couleurs de l'équipe, stats en haut à gauche (cliquables),
// maillot en haut à droite (changer la tenue / retirer), prénom en petit + nom en gros (script) en bas à droite.
// Joueur : le bobblehead dans la boîte. Équipe : le logo de l'équipe.

const lum = (hex: string) => {
  const h = hex.replace('#', ''); if (h.length < 6) return 0.5
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const dark = (hex: string) => { const h = hex.replace('#', ''); if (h.length < 6) return '#1d428a'; const c = [0, 2, 4].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * 0.55)); return `rgb(${c.join(',')})` }

export type FunkoProps = {
  kind: 'player' | 'team'
  first: string; last: string
  bg: string; accent: string               // couleur de fond (principale) et couleur du nom (secondaire)
  fig?: BobbleFig; kit?: string            // joueur : figurine + tenue
  logo?: string                            // équipe : logo
  badge?: string                           // joueur : logo de l'équipe (de la tenue affichée), dans un rond blanc en bas à gauche
  photo?: string | null                    // joueur sans figurine : photo en fond de boîte
  pct?: number                              // joueur : % de complétion (anneau vert autour des stats)
  top: ReactNodeLike                        // contenu du badge de stats (haut gauche)
  onStats?: () => void; statsTitle?: string
  side?: ReactNodeLike                      // équipe : pastille en haut à droite (joueurs de la franchise possédés / total)
  sidePct?: number; onSide?: () => void; sideTitle?: string
  onOpen?: () => void
  isOwner: boolean
  onKit?: (k: string) => void
  onRemove?: () => void
}
type ReactNodeLike = React.ReactNode

// équipes par lesquelles est passé chaque joueur (chargées à la première ouverture du menu)
const pastCache = new Map<string, string[]>()

export default function FunkoBox(p: FunkoProps) {
  const [menu, setMenu] = useState(false)
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(false)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true) }
  }, [menu])
  const mlb = !!p.fig?.sport   // joueur de baseball ou de football américain : seulement les équipes et tenues de sa ligue
  const catalog = useKitCatalog(p.fig?.sport ?? 'nba')
  // la boîte est dessinée en 224 x 280 puis mise à l'échelle de la largeur disponible (2 boîtes par ligne sur téléphone)
  const rootRef = useRef<HTMLDivElement>(null)
  const [sc, setSc] = useState(1)
  useEffect(() => {
    const el = rootRef.current; if (!el) return
    const upd = () => setSc(Math.max(0.3, el.offsetWidth / 224))
    upd()
    let ro: ResizeObserver | null = null
    try { ro = new ResizeObserver(upd); ro.observe(el) } catch { /* rien */ }
    return () => ro?.disconnect()
  }, [])
  const f = useMemo(() => (p.fig ? withKit({ ...p.fig, extra: catalog?.kits }, p.kit) : null), [p.fig, p.kit, catalog])
  const cur = p.kit || 'dom'
  const ownAb = p.fig?.body.team || ''
  const light = lum(p.accent) > 0.78
  const [team, setTeam] = useState<string>(ownAb)   // équipe affichée dans le menu (par défaut celle du joueur)
  const fullName = `${p.first} ${p.last}`.trim()
  const [past, setPast] = useState<string[]>(() => pastCache.get(fullName) || [])
  const openMenu = () => {
    if (!mlb && !pastCache.has(fullName)) fetch(`/api/player-teams?name=${encodeURIComponent(fullName)}`).then(r => (r.ok ? r.json() : { abbrs: [] })).then(d => { const a: string[] = Array.isArray(d?.abbrs) ? d.abbrs : []; pastCache.set(fullName, a); setPast(a) }).catch(() => {})
    setTeam(p.kit && p.kit.includes('-') ? p.kit.split('-')[0] : ownAb)
    setMenu(m => !m)
  }
  // contour toujours blanc ; si la couleur du nom est trop claire (blanc sur blanc), l'intérieur des lettres prend la couleur principale de l'équipe
  const line = '#ffffff'
  const fill = light ? (lum(p.bg) > 0.6 ? dark(p.bg) : p.bg) : p.accent
  return (
    <div className="fk" ref={rootRef} style={{ ['--fk-s' as string]: sc }} onClick={p.onOpen}>
      <div className="fk-box" data-kind={p.kind} style={{ ['--fk-bg' as string]: p.bg, ['--fk-fill' as string]: fill, ['--fk-line' as string]: line, ['--fk-first' as string]: dark(p.bg) }}>
      <div className="fk-field">
        <div className="fk-shine" />
        {f && <div className="fk-fig"><BobbleHero fig={f} name={`${p.first} ${p.last}`} height={250} /></div>}
        {p.photo && !p.fig && <img className="fk-photo" src={p.photo} alt="" draggable={false} />}
        {p.photo && !p.fig && <div className="fk-fade" />}
        {p.logo && <img className="fk-logo" src={p.logo} alt="" draggable={false} />}
        <div className="fk-plastic" />
      </div>
      <button type="button" className="fk-stats" style={{ ['--pct' as string]: Math.max(0, Math.min(100, p.pct || 0)) }} title={p.statsTitle} onClick={e => { e.stopPropagation(); p.onStats?.() }}>{p.top}</button>
      {p.kind === 'team' && p.side && (
        <button type="button" className="fk-stats fk-right" style={{ ['--pct' as string]: Math.max(0, Math.min(100, p.sidePct || 0)) }} title={p.sideTitle} onClick={e => { e.stopPropagation(); p.onSide?.() }}>{p.side}</button>
      )}
      {p.isOwner && !(p.kind === 'player' && p.fig) && (
        <button type="button" className="fk-x" title="Retirer ce PC" onClick={e => { e.stopPropagation(); p.onRemove?.() }} aria-label="Retirer ce PC">✕ Retirer</button>
      )}
      {p.kind === 'player' && !!p.fig && p.isOwner && (
        <>
          <button type="button" className="fk-jersey" title="Tenue / options" onClick={e => { e.stopPropagation(); openMenu() }} aria-label="Tenue et options">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M8.5 3 3 5.5l1.7 4.2 2.3-.9V21h10V8.8l2.3.9L21 5.5 15.5 3c-.4 1.3-1.8 2.2-3.5 2.2S8.9 4.3 8.5 3z" fill="currentColor" /></svg>
          </button>
        </>
      )}
      {p.badge && <div className="fk-badge"><img src={p.badge} alt="" draggable={false} onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} /></div>}
      <div className="fk-clip"><div className="fk-name">
        {p.first && <span className="fk-first" data-t={p.first}>{p.first}</span>}
        <span className="fk-last" data-t={p.last} style={{ fontSize: Math.max(24, Math.min(58, Math.floor(168 / (Math.max(p.last.length, 1) * 0.56)))) }}>{p.last}</span>
      </div></div>
      </div>
  {menu && (
    <>
      <div className="fk-menu" onClick={e => e.stopPropagation()}>
        {p.fig && (
          <>
            <b>Équipe</b>
            <select className="fk-sel" value={team} onChange={e => setTeam(e.target.value)}>
              {(() => {
                const all = catalog?.teams || [{ abbr: ownAb, name: ownAb }]
                const own = all.filter(t => t.abbr === ownAb)
                const pastT = all.filter(t => t.abbr !== ownAb && past.includes(t.abbr))
                const rest = all.filter(t => t.abbr !== ownAb && !past.includes(t.abbr))
                return (
                  <>
                    {own.length > 0 && <optgroup label="Équipe actuelle">{own.map(t => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}</optgroup>}
                    {pastT.length > 0 && <optgroup label="Équipes passées">{pastT.map(t => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}</optgroup>}
                    {rest.length > 0 && <optgroup label="Toutes les équipes">{rest.map(t => <option key={t.abbr} value={t.abbr}>{t.name}</option>)}</optgroup>}
                  </>
                )
              })()}
            </select>
            <b>Tenue</b>
            <div className="fk-kits">
              {(['dom', 'ext', 'alt', 'leg'] as const).map(k => {
                const id = team === ownAb ? k : `${team}-${k}`
                const ok = k === 'dom' && team === ownAb ? true : !!catalog?.kits[`${team}-${k}`]
                return <button key={k} type="button" disabled={!ok} className={id === cur ? 'on' : ''} title={ok ? KIT_LABEL[k] : 'Bientôt disponible'}
                  onClick={() => { p.onKit?.(id); setMenu(false) }}>{KIT_LABEL[k]}</button>
              })}
            </div>
          </>
        )}
        <button type="button" className="danger" onClick={() => { setMenu(false); p.onRemove?.() }}>Retirer ce PC</button>
      </div>
    </>
  )}
    </div>
  )
}
