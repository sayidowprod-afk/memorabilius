'use client'
import React, { Fragment } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import { getTeamByName } from '@/lib/sportsTeams'
import { TAG_BASE, numTier, numShort, mix } from '@/lib/cardTags'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 44 : la barre d'atouts des vignettes de la galerie.

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

/* serie 44 : barre d'atouts de la vignette de la galerie, memes classes que le site, seule la barre change (prefixe s4) */
.ix .mk-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 1000px; }
.ix .mk-grid .card-item { flex: 0 0 calc(20% - 8px); max-width: calc(20% - 8px); }
@media (max-width: 900px) { .ix .mk-grid .card-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); } }
.ix .s4 .gs-mq { align-items: stretch; }
.ix .s4 .gs-seg { align-items: stretch; text-shadow: none; box-shadow: none; background: transparent; }
.ix .s4 .gs-mq > span { align-items: stretch; }
.ix .s4 .w { position: relative; display: flex; align-items: center; padding: 0 var(--wp, 16px); font: 900 11.5px/1 system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; color: var(--t, #fff) !important; background: linear-gradient(90deg, color-mix(in srgb, var(--p), var(--a)) 0%, var(--a) 30%, var(--a) 70%, color-mix(in srgb, var(--n), var(--a)) 100%); }
.ix .s4 .w > span { display: inline-block; }
.ix .s4 .gs-mq .sep { align-self: center; width: 1px; height: 8px; background: rgba(255,255,255,.7); }
/* variantes */
.ix .s4 .vz-chips .w { background: var(--a); border-right: 1px solid rgba(255,255,255,.75); }
.ix .s4 .vz-out .gs-seg { box-shadow: inset 0 0 0 1px #fff; }
.ix .s4 .vz-fil .gs-seg { box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 #fff; }
.ix .s4 .vz-gloss .w::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 50%; background: linear-gradient(rgba(255,255,255,.42), rgba(255,255,255,.04)); pointer-events: none; }
.ix .s4 .vz-haz .w { background: repeating-linear-gradient(-45deg, var(--a) 0 6px, color-mix(in srgb, var(--a) 62%, #000) 6px 12px); text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.ix .s4 .vz-under .gs-seg { background: #0b1230; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
.ix .s4 .vz-under .w { background: none; color: var(--al) !important; box-shadow: inset 0 -3px 0 var(--a); }
.ix .s4 .vz-neon .gs-seg { background: #070d24; }
.ix .s4 .vz-neon .w { background: none; color: var(--al) !important; text-shadow: 0 0 5px var(--a), 0 0 11px var(--a); box-shadow: inset 0 1px 0 var(--a), inset 0 -1px 0 var(--a); }
.ix .s4 .vz-chev .w { margin-left: -6px; padding: 0 20px 0 16px; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%, 7px 50%); background: var(--a); }
.ix .s4 .vz-skew .w { transform: skewX(-18deg); margin: 0 2px; background: var(--a); } .ix .s4 .vz-skew .w > span { transform: skewX(18deg); }
.ix .s4 .vz-cap .gs-seg::before, .ix .s4 .vz-cap .gs-seg::after { content: ''; position: absolute; top: 0; bottom: 0; width: 4px; background: var(--gt); z-index: 3; }
.ix .s4 .vz-cap .gs-seg::before { left: 0; } .ix .s4 .vz-cap .gs-seg::after { right: 0; }
.ix .s4 .vz-two .w { background: linear-gradient(180deg, var(--a) 0 50%, color-mix(in srgb, var(--a) 68%, #000) 50% 100%); }
.ix .s4 .vz-light .gs-seg { background: #fff; box-shadow: inset 0 0 0 1px #fff; }
.ix .s4 .vz-light .w { background: none; color: var(--a) !important; box-shadow: inset 0 -2px 0 var(--a); }
.ix .s4 .vz-sheen .gs-seg::after { content: ''; position: absolute; top: 0; bottom: 0; width: 28%; left: -40%; z-index: 3; background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent); animation: s4sheen 6s ease-in-out infinite; }
@keyframes s4sheen { 0%, 55% { left: -40%; } 100% { left: 120%; } }
.ix .s4 .vz-dbl .gs-seg { box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 #fff, inset 1px 0 0 #fff, inset -1px 0 0 #fff; }
.ix .s4 .vz-dbl .w { box-shadow: inset 0 2px 0 rgba(8,21,59,.9), inset 0 -2px 0 rgba(8,21,59,.9); }
.ix .s4 .vz-glass .w { background: linear-gradient(180deg, color-mix(in srgb, var(--a) 70%, #fff) 0%, var(--a) 45%, color-mix(in srgb, var(--a) 70%, #000) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -1px 0 rgba(0,0,0,.4); }
@media (prefers-reduced-motion: reduce) { .ix .s4 .vz-sheen .gs-seg::after { animation: none; } }
`
const Bay44 = ({ id, n, title, desc, children }: { id: string; n: string; title: string; desc: string; children: React.ReactNode }) => (
  <section className="bay" id={id}>
    <span className="eyebrow">{n}</span>
    <h2 className="sf">{title}</h2>
    <p className="d">{desc}</p>
    <div className="stage"><div className="s4">{children}</div></div>
  </section>
)

type PC = { n: string; v: string; s: string; img: string; team: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, team: 'Philadelphia 76ers' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', team: 'Minnesota Timberwolves' },
  { n: 'Michael Carter-Williams', v: 'Fresh Paint', s: '2024-25 Court Kings', img: C.mcw.img, rc: true, auto: true, num: '/125', team: 'Philadelphia 76ers' },
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', img: C.maxey.img, auto: true, patch: true, num: '/25', team: 'Los Angeles Lakers' },
  { n: 'Luwawu-Cabarrot', v: 'Gold Standard', s: '2023-24 Panini Select', img: C.luwawu.img, team: 'Denver Nuggets' },
]
type At = { k: string; t: string; c: string }
const atsOf = (c: PC): At[] => {
  const a: At[] = []
  if (c.rc) a.push({ k: 'rc', t: 'RC', c: TAG_BASE.rc })
  if (c.patch) a.push({ k: 'patch', t: 'Patch', c: TAG_BASE.patch })
  if (c.auto) a.push({ k: 'auto', t: 'Auto', c: TAG_BASE.auto })
  if (c.num) { const tr = numTier(c.num); a.push({ k: 'num', t: numShort(c.num), c: tr === 'gold' ? '#ffd54a' : tr === 'silver' ? '#dfe6f2' : tr === 'bronze' ? '#e0925a' : TAG_BASE.num }) }
  return a
}
const lum = (h: string) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const dk = (c: string) => mix(c, -0.3)

type V44 = { id: string; cls: string; title: string; desc: string; sep?: 'star' | 'tick' | 'sq' | 'none'; wp?: number; dark?: boolean }
// Une barre : memes classes que le site (gc-slot / gs-strip / gs-seg / gs-mq), seul le contenu des mots change
function Card44({ c, v }: { c: PC; v: V44 }) {
  const tm = getTeamByName(c.team)
  const color = tm?.color || 'transparent'
  const ats = atsOf(c)
  const reps = Math.max(4, Math.ceil(20 / Math.max(1, ats.length)))
  const seq: At[] = Array.from({ length: reps }, () => ats).flat()
  const unit = (key: string) => (
    <span key={key}>{seq.map((x, i) => {
      const p = seq[(i - 1 + seq.length) % seq.length], n = seq[(i + 1) % seq.length]
      const base = v.dark ? x.c : dk(x.c)
      const st = { ['--a' as string]: v.dark ? x.c : dk(x.c), ['--p' as string]: v.dark ? p.c : dk(p.c), ['--n' as string]: v.dark ? n.c : dk(n.c), ['--al' as string]: mix(x.c, 0.45), ['--t' as string]: lum(base) > 0.62 ? '#1a1200' : '#fff', ['--wp' as string]: (v.wp ?? 16) + 'px' } as CSSProperties
      return (
        <Fragment key={i}>
          <em className="w" style={st}><span>{x.t}</span></em>
          {v.sep === 'tick' && <i className="sep" />}
          {v.sep === 'sq' && <i style={{ alignSelf: 'center', width: 5, height: 5, background: color, margin: '0 2px' }} />}
        </Fragment>
      )
    })}</span>
  )
  return (
    <div className={`card-item${c.num && numTier(c.num) !== 'std' ? ` gc-rare gc-${numTier(c.num)}` : ''} ${v.cls}`}
      style={{ borderRadius: 8, padding: 8, background: 'white', border: '2px solid #003DA6', boxSizing: 'border-box', position: 'relative', overflow: 'visible', ['--gt' as string]: color } as CSSProperties}>
      <div className={`holo-light${c.num && numTier(c.num) !== 'std' ? ` halo halo-${numTier(c.num)}` : ''}`} style={{ width: '100%', marginBottom: 6, position: 'relative' }}>
        <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.img} alt={c.n} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
      <div className="gc-slot">
        {tm && <div className="gc-bar" style={{ background: color }} />}
        {ats.length > 0 && <div className="gs-strip"><div className="gs-seg" style={{ ['--d' as string]: `${30 + ats.length * 4}s` } as CSSProperties}><div className="gs-mq">{unit('a')}{unit('b')}</div></div></div>}
        {tm && <span className="gc-med"><TeamBadge teamId={tm.id} size={24} /></span>}
      </div>
      <div className="gc-bot" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
        <div style={{ minWidth: 0 }}>
          <p className="gc-name" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="da-display" style={{ fontSize: 19, lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.n}</span>
          </p>
          <p style={{ fontSize: 10, color: '#003DA6', fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.v}</p>
          <p style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.s}</span></p>
        </div>
        <div className="gc-right"><div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><button style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '2px 4px', flexShrink: 0 }}><span style={{ fontSize: 16, lineHeight: 1 }}>🤍</span></button></div></div>
      </div>
    </div>
  )
}
const Grid44 = ({ v }: { v: V44 }) => <div className="mk-grid">{PCS.map(c => <Card44 key={c.n} c={c} v={v} />)}</div>

const VARS: V44[] = [
  { id: 's0', cls: '', title: 'Dégradé qui suit la barre : la bonne couleur sous chaque atout', desc: 'Le fond défile avec les mots : chaque atout a SA couleur derrière lui (orange sous RC, vert sous AUTO, bleu sous PATCH, doré sous 1/1, bronze sous /25), avec un fondu vers la couleur du voisin. Le texte passe en foncé sur les couleurs claires (or, argent). Fini les barres qui se ressemblent toutes.', sep: 'none' },
  { id: 's1', cls: 'vz-chips', title: 'Blocs de couleur nets séparés par un filet blanc', desc: 'Chaque atout est un bloc plein de sa couleur, séparé du suivant par un filet blanc fin. Très lisible, plus graphique.', sep: 'none' },
  { id: 's2', cls: 'vz-out', title: 'Dégradé qui suit + contour blanc fin', desc: 'Le même fond qui suit les mots, entouré d\'un liseré blanc de 1 px sur tout le pourtour, comme les cadres de la nouvelle DA.', sep: 'none' },
  { id: 's3', cls: 'vz-fil', title: 'Dégradé qui suit + filets blancs en haut et en bas', desc: 'Deux filets blancs fins (haut et bas) qui encadrent la barre sans fermer les côtés : effet bandeau.', sep: 'none' },
  { id: 's4', cls: 'vz-dbl', title: 'Double filet : blanc extérieur, marine intérieur', desc: 'Contour blanc fin puis filet marine, comme le double cadre de la nouvelle DA. Le filet marine sépare la couleur du blanc.', sep: 'none' },
  { id: 's5', cls: 'vz-gloss', title: 'Reflet brillant sur la moitié haute', desc: 'Dégradé qui suit les mots avec un reflet clair sur la moitié haute de chaque bloc : effet verre / métal.', sep: 'none' },
  { id: 's6', cls: 'vz-glass', title: 'Relief métal : clair en haut, sombre en bas', desc: 'Chaque bloc a un dégradé vertical clair vers sombre de sa couleur, avec filets de lumière : relief type étiquette métallique.', sep: 'none' },
  { id: 's7', cls: 'vz-two', title: 'Deux tons : moitié haute franche, moitié basse plus sombre', desc: 'Chaque bloc est coupé en deux bandes horizontales de ton différent. Style plat, très DA.', sep: 'none' },
  { id: 's8', cls: 'vz-haz', title: 'Rayures diagonales de la couleur de l\'atout', desc: 'Fond rayé en diagonale (comme une bande de circuit) à la couleur de chaque atout, texte avec ombre. Plus dynamique.', sep: 'none' },
  { id: 's9', cls: 'vz-skew', title: 'Blocs inclinés en parallélogrammes', desc: 'Les blocs sont inclinés, avec un petit espace entre eux, comme les rubans des maillots. Chaque atout reste dans sa couleur.', sep: 'none', wp: 18 },
  { id: 's10', cls: 'vz-chev', title: 'Chevrons qui s\'emboîtent', desc: 'Chaque atout est une flèche (chevron) qui s\'emboîte dans la suivante, comme une frise de navigation. Direction de lecture claire.', sep: 'none' },
  { id: 's11', cls: 'vz-under', title: 'Barre sombre, mots clairs soulignés de leur couleur', desc: 'Fond marine, mots dans leur couleur éclaircie et un soulignement épais de la couleur exacte. Plus sobre : la couleur est dans le trait.', sep: 'none', dark: true },
  { id: 's12', cls: 'vz-neon', title: 'Néon : mots lumineux et filets de la couleur de l\'atout', desc: 'Barre très sombre, mots qui rayonnent dans leur couleur, filet fin haut et bas en couleur. Effet enseigne lumineuse.', sep: 'none', dark: true },
  { id: 's13', cls: 'vz-light', title: 'Barre blanche : mots colorés soulignés', desc: 'Fond blanc, texte de chaque atout dans sa couleur (assombrie pour rester lisible), trait de soulignement de la même couleur. Contraste maximal avec le bloc sombre du dessous.', sep: 'none' },
  { id: 's14', cls: 'vz-cap', title: 'Dégradé qui suit + embouts de la couleur de l\'équipe', desc: 'Le fond qui suit les mots, avec deux embouts de 4 px à chaque extrémité à la couleur de l\'équipe (liée à la barre d\'équipe et au médaillon).', sep: 'none' },
  { id: 's15', cls: 'vz-sheen', title: 'Dégradé qui suit + reflet lumineux qui passe', desc: 'Même fond, avec un reflet blanc qui traverse la barre lentement toutes les 6 secondes (animation très douce, désactivée si le téléphone limite les animations).', sep: 'none' },
  { id: 's16', cls: '', title: 'Dégradé qui suit + séparateurs en filets verticaux', desc: 'Le fond qui suit les mots, mais les étoiles sont remplacées par de fins filets blancs verticaux. Plus sobre, plus net.', sep: 'tick', wp: 12 },
  { id: 's17', cls: '', title: 'Dégradé qui suit + petits carrés de la couleur de l\'équipe', desc: 'Les étoiles sont remplacées par de petits carrés de la couleur de l\'équipe (rappel de la barre du dessous).', sep: 'sq', wp: 12 },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 44 · La barre d&apos;atouts</h1>
      <p className="lead">18 idées pour la barre d&apos;atouts, sur la vraie vignette de la galerie (mêmes classes que le site : image, médaillon d&apos;équipe, barre d&apos;équipe, bloc du bas, cœur). Cinq cartes : 1 RC, RC + auto + 1/1 doré, RC + auto /125, auto + patch /25 bronze, et une sans atout. Le point commun de presque toutes : le fond défile avec les mots, avec la bonne couleur sous chaque atout, et le texte s&apos;adapte (foncé sur or/argent). Dis-moi les numéros.</p>
      <nav className="tags">{VARS.map((_, i) => <a key={i} href={`#${VARS[i].id}`}>S{i}</a>)}</nav>
      {VARS.map((v, i) => <Bay44 key={v.id} id={v.id} n={`S${i}`} title={v.title} desc={v.desc}><Grid44 v={v} /></Bay44>)}
    </div>
  )
}
