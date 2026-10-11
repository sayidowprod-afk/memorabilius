'use client'
import React, { Fragment } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import { getTeamByName } from '@/lib/sportsTeams'
import { TAG_BASE, numTier, numShort, mix } from '@/lib/cardTags'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 42 : vraie vignette de la galerie (logo, couleurs de barre, fond du bas).

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const C = {
  mccain: { nom: 'Jared McCain', img: SB + '1787763372857_recto.jpg' },
  edwards: { nom: 'Anthony Edwards', img: SB + '1784235265864_recto.jpg' },
  mcw: { nom: 'Michael Carter-Williams', img: SB + '1781875894817_recto.jpg' },
  maxey: { nom: 'Tyrese Maxey', img: SB + '1781291200820_recto.jpg' },
  hawkins: { nom: 'Hersey Hawkins', img: SB + '1781534889963_recto.jpg' },
  luwawu: { nom: 'Luwawu-Cabarrot', img: SB + 'csv_1790632470730_4f41x1.jpg' },
}

const CSS = `
.ix { font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ix .ink, .ix .ink * { color: #06122e !important; }
.ix .wht, .ix .wht * { color: #fff !important; }
.ix h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.ix .lead { max-width: 740px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 30px; }
.ix .back { color:#fff; text-decoration:none; font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.ix .bay { margin: 0 0 46px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .bay h2 { font-size: clamp(26px,4vw,40px); margin: 12px 0 6px; line-height: 1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 700px; margin: 0 0 16px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,30px); position:relative; overflow:hidden; }
.ix .row { display:flex; gap: 24px; flex-wrap: wrap; align-items: flex-end; }
.ix .cap { font: 700 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.55); margin-top: 10px; }
.ix .card { display:block; aspect-ratio: 2.5/3.5; object-fit: cover; border-radius: 0; box-shadow: 0 14px 30px rgba(0,0,0,.5); width:100%; }
.ix .btn { background:#fff; color:#06122e !important; border:3px solid #fff; padding: 8px 16px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
.ix .btn.o { background: transparent; color:#fff !important; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* serie 42 : vraie vignette de la galerie (memes classes que le site), seules les variantes (mk-*) changent */
.ix .mk-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 1000px; }
.ix .mk-grid .card-item { flex: 0 0 calc(20% - 8px); max-width: calc(20% - 8px); }
@media (max-width: 900px) { .ix .mk-grid .card-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); } }
.ix .mk-note { font: 700 11px system-ui; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.55); margin: 0 0 10px; }
.ix .mk-lg { display: inline-flex; flex-shrink: 0; }
/* logos : variantes */
.ix .mk-g1 .gc-bot .gc-name .gc-logo { left: 8px; top: 9px; transform: none; }
.ix .mk-g2 .gc-slot { overflow: visible; }
.ix .mk-med { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; background: #0e1530; border: 2px solid var(--gt); display: flex; align-items: center; justify-content: center; z-index: 4; box-shadow: 0 0 0 3px #0e1530; }
.ix .mk-g3 .gc-bot .gc-name .gc-logo { left: 10px; padding-right: 9px; border-right: 1px solid rgba(255,255,255,.32); }
.ix .mk-g3 .gc-bot > div:first-child .gc-name { padding: 0 34px 0 50px; }
.ix .mk-g3 .gc-bot > div:first-child > p:not(.gc-name) { padding-left: 40px; }
.ix .mk-g4 .mk-above { display: flex; justify-content: center; margin-bottom: 3px; }
.ix .mk-g5 .gc-bot { overflow: hidden; }
.ix .mk-g5 .gc-bot .gc-name .gc-logo { left: -8px; opacity: .15; }
.ix .mk-g5 .gc-bot > div:first-child .gc-name { padding: 0 34px; }
.ix .mk-g6 .gc-bot .gc-name { padding: 0 !important; }
.ix .mk-g6 .mk-set { display: inline-flex; align-items: center; gap: 5px; }
.ix .mk-g7 .mk-corner { position: absolute; left: 6px; top: 6px; z-index: 3; padding: 4px; background: rgba(8,15,40,.82); border: 1px solid rgba(255,255,255,.4); display: flex; }
.ix .mk-g8 .mk-rt { position: absolute; top: 8px; right: 8px; display: flex; }
.ix .mk-g8 .gc-bot .gc-right { top: auto; bottom: 8px; }
.ix .mk-g8 .gc-bot > div:first-child .gc-name { padding: 0 30px; }
.ix .mk-g9 .mk-ft { position: absolute; left: 10px; bottom: 8px; display: flex; }
.ix .mk-g9 .gc-bot > div:first-child .gc-name { padding: 0 34px; }
/* barre d'atouts : variantes */
.ix .mk-bw .gs-mq b { color: var(--tc, #fff) !important; }
.ix .mk-bw .gs-mq i { color: var(--tc, #fff) !important; }
.ix .mk-dk .gs-seg { background: #0b1230 !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16) !important; }
.ix .mk-dk .gs-mq i { color: var(--ic) !important; }
.ix .mk-ch .gs-seg { background: #0b1230 !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16) !important; }
.ix .mk-ch .gs-mq b.ch { padding: 2px 6px 1px; color: var(--tc) !important; background: var(--k); }
.ix .mk-ch .gs-mq i { color: var(--ic) !important; }
/* bas de vignette : variantes du fond */
.ix .mk-d1 .gc-bot { background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 72%, transparent) 100%) !important; }
.ix .mk-d2 .gc-bot { background: linear-gradient(180deg, color-mix(in srgb, var(--gt) 50%, transparent) 0%, color-mix(in srgb, var(--gt) 16%, transparent) 100%) !important; }
.ix .mk-d3 .gc-bot { background: linear-gradient(180deg, transparent 0%, var(--gt) 100%) !important; text-shadow: 0 1px 3px rgba(0,0,0,.55); }
.ix .mk-d4 .gc-bot { background: radial-gradient(120% 95% at 50% 100%, color-mix(in srgb, var(--gt) 80%, transparent), transparent 72%) !important; }
.ix .mk-d5 .gc-bot { background: linear-gradient(165deg, color-mix(in srgb, var(--gt) 58%, transparent) 0%, color-mix(in srgb, var(--gt) 10%, transparent) 55%, color-mix(in srgb, var(--gt) 42%, transparent) 100%) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.22); }
.ix .mk-d6.card-item { background: linear-gradient(180deg, #0e1a44 0%, color-mix(in srgb, var(--gt) 48%, #0e1a44) 100%) !important; }
.ix .mk-d6 .gc-bot { background: none !important; }
.ix .mk-d7 .gc-bot { background: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 34%, transparent) 100%) !important; }
.ix .mk-d7 .gc-bot::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--gt); }
`
const DaBay = ({ id, n, title, desc, children }: { id: string; n: string; title: string; desc: string; children: React.ReactNode }) => (
  <section className="bay" id={id}>
    <span className="eyebrow">{n}</span>
    <h2 className="sf">{title}</h2>
    <p className="d">{desc}</p>
    <div className="stage">{children}</div>
  </section>
)

type PC = { n: string; v: string; s: string; img: string; team: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, team: 'Philadelphia 76ers' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', team: 'Minnesota Timberwolves' },
  { n: 'Hersey Hawkins', v: 'Power Brokers', s: '2006-07 Topps Bowman', img: C.hawkins.img, patch: true, num: '/99', team: 'Boston Celtics' },
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', img: C.maxey.img, auto: true, patch: true, num: '/25', team: 'Los Angeles Lakers' },
  { n: 'Luwawu-Cabarrot', v: 'Gold Standard', s: '2023-24 Panini Select', img: C.luwawu.img, team: 'Denver Nuggets' },
]
type At = { k: string; t: string; c: string }
const atsOf = (c: PC): At[] => {
  const a: At[] = []
  if (c.rc) a.push({ k: 'rc', t: 'RC', c: TAG_BASE.rc })
  if (c.patch) a.push({ k: 'patch', t: 'Patch', c: TAG_BASE.patch })
  if (c.auto) a.push({ k: 'auto', t: 'Auto', c: TAG_BASE.auto })
  if (c.num) { const tr = numTier(c.num); a.push({ k: 'num', t: numShort(c.num), c: tr === 'gold' ? '#ffd54a' : tr === 'silver' ? '#dfe6f2' : TAG_BASE.num }) }
  return a
}
const lum = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const onC = (h: string) => (lum(h) > 0.62 ? '#1a1200' : '#fff')
const topOf = (a: At[]) => a.find(x => x.k === 'num' && (x.c === '#ffd54a' || x.c === '#dfe6f2')) || a.find(x => x.k === 'auto') || a.find(x => x.k === 'patch') || a.find(x => x.k === 'rc') || a[a.length - 1]
const gl = (c: string) => `linear-gradient(180deg, ${mix(c, 0.22)} 0%, ${c} 55%, ${mix(c, -0.22)} 100%)`

type Bar = 'blue' | 'top' | 'metal' | 'span' | 'indep' | 'dark' | 'frame' | 'chips'
// Reproduit exactement le markup de la vignette de GalerieClient.tsx ; seuls les parametres de variante changent
function Real({ c, lg = 0, bar = 'blue', cls = '' }: { c: PC; lg?: number; bar?: Bar; cls?: string }) {
  const tm = getTeamByName(c.team)
  const color = tm?.color || 'transparent'
  const ats = atsOf(c)
  const reps = Math.max(4, Math.ceil(20 / Math.max(1, ats.length)))
  const top = ats.length ? topOf(ats) : null
  const logoSz = lg === 3 ? 30 : lg === 5 ? 96 : lg === 2 ? 24 : lg === 4 ? 24 : lg === 6 ? 14 : lg === 7 ? 20 : lg === 8 ? 22 : lg === 9 ? 20 : 17
  const mark = tm ? <span className="gc-logo"><TeamBadge teamId={tm.id} size={logoSz} /></span> : null
  const free = tm ? <span className="mk-lg"><TeamBadge teamId={tm.id} size={logoSz} /></span> : null
  const unitFor = (list: At[], key: string, o?: { stars?: boolean; chips?: boolean; txt?: string }) => (
    <span key={key}>{Array.from({ length: reps }, (_, r) => r).map(r => (
      <Fragment key={r}>{list.map(x => (
        <Fragment key={x.k}>
          {o?.chips ? <b className="ch" style={{ ['--k' as string]: x.c, ['--tc' as string]: onC(x.c) } as CSSProperties}>{x.t}</b> : <b style={{ color: o?.txt || mix(x.c, 0.5) }}>{x.t}</b>}
          <i style={o?.stars ? { ['--ic' as string]: x.c } as CSSProperties : undefined}>✦</i>
        </Fragment>))}</Fragment>))}</span>
  )
  const seg = (list: At[], bg: string, d: string, o?: { stars?: boolean; chips?: boolean; txt?: string }, extra?: CSSProperties) => (
    <div className="gs-seg" style={{ background: bg, ['--d' as string]: d, ...extra } as CSSProperties}><div className="gs-mq">{unitFor(list, 'a', o)}{unitFor(list, 'b', o)}</div></div>
  )
  let strip: React.ReactNode = null
  let barCls = ''
  if (ats.length && top) {
    const d = `${30 + ats.length * 4}s`
    if (bar === 'blue') strip = seg(ats, 'linear-gradient(180deg,#1a55c4,#003da6 55%,#002b78)', d)
    else if (bar === 'top') { strip = seg(ats, gl(top.c), d, { txt: onC(top.c) }) }
    else if (bar === 'metal') {
      const tr = c.num ? numTier(c.num) : 'std'
      const mc = tr === 'gold' ? '#ffd54a' : tr === 'silver' ? '#dfe6f2' : tr === 'bronze' ? '#e0925a' : top.c
      strip = seg(ats, gl(mc), d, { txt: onC(mc) })
    }
    else if (bar === 'span') strip = seg(ats, ats.length === 1 ? gl(ats[0].c) : `linear-gradient(90deg, ${ats.map(a => a.c).join(', ')})`, d, { txt: '#fff' }, { textShadow: '0 1px 2px rgba(0,0,0,.45)' })
    else if (bar === 'indep') strip = ats.map((a, i) => <Fragment key={a.k}>{seg([a], gl(a.c), `${26 + i * 7}s`, { txt: onC(a.c) })}</Fragment>)
    else if (bar === 'dark') { strip = seg(ats, '#0b1230', d, { stars: true }); barCls = 'mk-dk' }
    else if (bar === 'frame') strip = seg(ats, 'linear-gradient(180deg,#1a55c4,#003da6 55%,#002b78)', d, undefined, { boxShadow: `inset 0 2px 0 ${top.c}, inset 0 -2px 0 ${top.c}` })
    else if (bar === 'chips') { strip = seg(ats, '#0b1230', d, { chips: true, stars: true }); barCls = 'mk-ch' }
  }
  return (
    <div className={`card-item${c.num && numTier(c.num) !== 'std' ? ` gc-rare gc-${numTier(c.num)}` : ''} mk-g${lg} ${barCls} ${cls}`}
      style={{ borderRadius: 8, padding: 8, background: 'white', border: '2px solid #003DA6', boxSizing: 'border-box', position: 'relative', overflow: 'visible', ['--gt' as string]: color } as CSSProperties}>
      <div className={`holo-light${c.num && numTier(c.num) !== 'std' ? ` halo halo-${numTier(c.num)}` : ''}`} style={{ width: '100%', marginBottom: 6, position: 'relative' }}>
        <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt={c.n} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {lg === 7 && <span className="mk-corner">{free}</span>}
      </div>
      <div className="gc-slot">
        {tm && <div className="gc-bar" style={{ background: color }} />}
        {strip && <div className="gs-strip">{strip}</div>}
        {lg === 2 && <span className="mk-med">{free}</span>}
      </div>
      <div className="gc-bot" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
        <div style={{ minWidth: 0 }}>
          {lg === 4 && <div className="mk-above">{free}</div>}
          <p className="gc-name" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
            {(lg === 0 || lg === 1 || lg === 3 || lg === 5) && mark}
            <span className="da-display" style={{ fontSize: 19, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
          </p>
          <p style={{ fontSize: 10, color: '#003DA6', fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.v}</p>
          <p style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {lg === 6 ? <span className="mk-set">{free}<span>{c.s}</span></span> : <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.s}</span>}
          </p>
        </div>
        {lg === 8 && <span className="mk-rt">{free}</span>}
        {lg === 9 && <span className="mk-ft">{free}</span>}
        <div className="gc-right">
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '2px 4px', flexShrink: 0 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>🤍</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
const Grid = ({ children }: { children: React.ReactNode }) => <div className="mk-grid">{children}</div>

const LOGOS: [string, string][] = [
  ['Le logo comme sur le site aujourd\'hui (référence)', 'Pour comparer : exactement la vignette en ligne, logo 17 px à gauche, centré dans le bloc du bas.'],
  ['Logo dans le coin haut gauche du bloc, symétrique du cœur', 'Le logo est rangé en haut à gauche du bloc, à la même hauteur et à la même marge que le cœur en haut à droite. Le nom reste parfaitement centré.'],
  ['Médaillon rond sur la barre d\'équipe', 'Le logo (24 px) est dans un médaillon rond à liseré de la couleur de l\'équipe, posé à gauche sur la barre d\'équipe, à cheval entre l\'image et le bloc. Il se rattache à la barre d\'où il vient.'],
  ['Logo plus grand en colonne à gauche, filet vertical', 'Logo de 30 px centré sur la hauteur du bloc, séparé du texte par un filet vertical. Une vraie colonne « équipe » ; le texte est décalé à droite.'],
  ['Logo centré au-dessus du nom', 'Un écusson de 24 px centré au-dessus du nom. Tout est sur l\'axe central ; le bloc gagne environ 26 px de hauteur.'],
  ['Logo géant en filigrane derrière le texte', 'Logo de 96 px à 15 % d\'opacité à gauche derrière le texte, coupé par le bord : on devine l\'équipe sans encombrement.'],
  ['Petit logo devant la ligne du set', 'Le logo (14 px) passe devant « année + set », le nom est enfin parfaitement centré et seul.'],
  ['Logo en pastille dans le coin haut gauche de l\'image', 'Le logo (20 px) dans un petit carré sombre à liseré blanc dans le coin haut gauche de l\'image. Le bloc du bas est libéré.'],
  ['Logo à droite en haut, cœur en bas à droite', 'Le logo (22 px) prend la place du cœur en haut à droite, le cœur descend en bas à droite.'],
  ['Logo en bas à gauche du bloc, aligné sur le cœur', 'Le logo (20 px) en bas à gauche, à la hauteur de la ligne du set ; le cœur est en haut à droite : les deux coins sont occupés, le texte reste centré.'],
]
const BARS: [Bar, string, string][] = [
  ['blue', 'Barre bleue actuelle (référence)', 'Comme en ligne : fond bleu, mots dans leur couleur. Le bleu domine et toutes les barres se ressemblent.'],
  ['top', 'Barre à la couleur de l\'atout principal', 'Toute la barre prend la couleur de l\'atout principal (auto vert, patch bleu, RC orange, numéroté bas doré/argenté). Texte clair ou foncé selon la couleur.'],
  ['metal', 'Couleur de l\'atout, métal pour les tirages bas', 'Un tirage bas (or, argent, bronze) rend la barre métallique ; sinon la couleur de l\'atout principal. Les pièces rares ressortent.'],
  ['span', 'Dégradé horizontal qui traverse les couleurs de tous les atouts', 'Dégradé de gauche à droite : orange, vert, bleu, violet… selon les atouts de la carte. Plus d\'atouts, plus de couleurs.'],
  ['indep', 'Un segment défilant par atout, chacun de sa couleur', 'La barre est découpée en segments égaux, un par atout, chacun de sa couleur et à sa vitesse.'],
  ['dark', 'Barre sombre : mots ET étoiles dans la couleur de chaque atout', 'Fond marine à filet fin ; chaque mot et chaque étoile ✦ prend la couleur de son atout. Discret mais coloré.'],
  ['frame', 'Barre bleue avec liserés haut et bas aux couleurs de l\'atout principal', 'On garde le bleu de la marque, encadré de deux filets de 2 px dans la couleur de l\'atout principal.'],
  ['chips', 'Chaque mot dans une étiquette colorée qui défile', 'Sur fond sombre, chaque atout est une petite étiquette pleine de sa couleur, suivie d\'une étoile de la même couleur.'],
]
const BGS: [string, string][] = [
  ['d1', 'Fondu plus vif de l\'équipe vers le bas (72 %)'],
  ['d2', 'Fondu inversé : couleur d\'équipe en haut sous la barre, qui s\'éteint vers le bas'],
  ['d3', 'Fondu jusqu\'à la couleur pleine de l\'équipe en bas'],
  ['d4', 'Halo de la couleur de l\'équipe derrière le nom'],
  ['d5', 'Fondu diagonal à deux tons avec filet clair en haut'],
  ['d6', 'Toute la vignette teintée (haut marine, bas couleur de l\'équipe)'],
  ['d7', 'Fondu actuel + filet plein de la couleur d\'équipe tout en bas'],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 42 · Logo, couleurs de barre et fond du bas</h1>
      <p className="lead">Cette fois les maquettes utilisent exactement le balisage et les styles de la vignette de la galerie (mêmes classes que le site : barre d&apos;équipe, barre d&apos;atouts qui défile par-dessus, bloc du bas, cœur). Seule la variante change. G = placement du logo d&apos;équipe, B = couleurs de la barre d&apos;atouts, F = fond du bas de vignette. Les variantes B et F gardent le logo actuel.</p>
      <nav className="tags">{LOGOS.map((_, i) => <a key={i} href={`#g${i}`}>G{i}</a>)}{BARS.map((_, i) => <a key={i} href={`#b${i}`}>B{i}</a>)}{BGS.map((_, i) => <a key={i} href={`#f${i + 1}`}>F{i + 1}</a>)}</nav>
      {LOGOS.map((d, i) => <DaBay key={d[0]} id={`g${i}`} n={`G${i}`} title={d[0]} desc={d[1]}><Grid>{PCS.map(c => <Real key={c.n} c={c} lg={i} />)}</Grid></DaBay>)}
      {BARS.map((d, i) => <DaBay key={d[1]} id={`b${i}`} n={`B${i}`} title={d[1]} desc={d[2]}><Grid>{PCS.map(c => <Real key={c.n} c={c} bar={d[0]} />)}</Grid></DaBay>)}
      {BGS.map((d, i) => <DaBay key={d[1]} id={`f${i + 1}`} n={`F${i + 1}`} title={d[1]} desc="Même vignette que le site, seul le fond du bloc du bas change."><Grid>{PCS.map(c => <Real key={c.n} c={c} cls={`mk-${d[0]}`} />)}</Grid></DaBay>)}
    </div>
  )
}
