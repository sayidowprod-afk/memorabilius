'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { TAG_BASE, numTier, numShort, mix } from '@/lib/cardTags'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 34 : pastilles, rubans et bandeaux sur les vignettes.

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

/* serie 41 : bandeau d'atouts plus beau, remplissage sans atout, degrade du bas (prefixe v4-) */
.ix .v4-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; max-width: 1000px; }
.ix .v4 { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 8px 8px 0; min-width: 0; }
.ix .v4 .ph img { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .v4 .bar { height: 4px; margin: 6px -8px 0; background: var(--tc); }
.ix .v4 .bt { position: relative; margin: 0 -8px; padding: 7px 8px 9px; text-align: center; background: var(--bg-b, none); box-shadow: var(--bs-b, none); border-bottom: var(--bb-b, 0); }
.ix .v4 .nm { display: flex; align-items: center; justify-content: center; gap: 5px; font: 400 17px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .v4 .nm img { width: 15px; height: 15px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
.ix .v4 .vr { font: italic 600 10px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .v4 .st { font: 500 10px system-ui; color: rgba(255,255,255,.7) !important; margin-top: 2px; padding: 0 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ix .v4 .ic { position: absolute; right: 7px; bottom: 5px; display: inline-flex; gap: 5px; font-size: 13px; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
/* bandeau */
.ix .gs { display: flex; gap: 2px; height: 17px; margin: 0 0 6px; }
.ix .gs .s { flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; font: 800 10px/1 system-ui; letter-spacing: .16em; text-transform: uppercase; color: var(--t) !important; white-space: nowrap; overflow: hidden; background: var(--g); box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 0 -1px 0 rgba(0,0,0,.28); text-shadow: 0 1px 1px rgba(0,0,0,.35); }
.ix .gs.sv-1 { }
.ix .gs.sv-2 { height: 14px; } .ix .gs.sv-2 .s { font-size: 8.5px; background: var(--c); box-shadow: none; text-shadow: none; letter-spacing: .18em; }
.ix .gs.sv-3 { gap: 0; } .ix .gs.sv-3 .s { background: var(--c); box-shadow: none; text-shadow: none; clip-path: polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%); margin-left: -3px; } .ix .gs.sv-3 .s:first-child { margin-left: 0; clip-path: polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%); }
.ix .gs.sv-4 .s { background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--l) !important; border-top: 2px solid var(--c); box-shadow: none; text-shadow: none; }
.ix .gs.sv-5 .s { background: var(--c); box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), inset 0 0 0 2px rgba(0,0,0,.18); text-shadow: none; }
.ix .gs.sv-6 .s { background: #fff; color: #06122e !important; border-bottom: 3px solid var(--c); box-shadow: none; text-shadow: none; }
.ix .gs.sv-7 .s { background: rgba(5,9,18,.88); color: #fff !important; box-shadow: inset 4px 0 0 var(--c), inset 0 0 0 1px rgba(255,255,255,.14); text-shadow: none; padding-left: 4px; }
.ix .gs.sv-8 .s { background: var(--c); box-shadow: none; text-shadow: none; clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%, 0 4px); }
.ix .gs.sv-9 { gap: 0; } .ix .gs.sv-9 .s { background: var(--c); box-shadow: none; text-shadow: none; border-right: 1px solid rgba(255,255,255,.5); } .ix .gs.sv-9 .s:last-child { border-right: 0; }
.ix .gs.sv-10 { height: 13px; } .ix .gs.sv-10 .s { font-size: 8px; letter-spacing: .22em; background: color-mix(in srgb, var(--c) 88%, #0a1330); box-shadow: inset 0 -2px 0 rgba(0,0,0,.25); text-shadow: none; }
/* remplissage sans atout */
.ix .gs .ghost { background: rgba(255,255,255,.06); color: rgba(255,255,255,.55) !important; letter-spacing: .22em; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); text-shadow: none; }
.ix .gs .team { background: linear-gradient(90deg, color-mix(in srgb, var(--tc) 55%, transparent), transparent 85%); color: rgba(255,255,255,.8) !important; letter-spacing: .2em; justify-content: flex-start; padding-left: 8px; box-shadow: none; text-shadow: none; }
.ix .gs .stripe { background: repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 3px, transparent 3px 7px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); text-shadow: none; }
.ix .gs .insert { background: color-mix(in srgb, #5aa9ff 16%, transparent); color: #7fb8ff !important; letter-spacing: .14em; font-style: italic; box-shadow: inset 0 0 0 1px rgba(90,169,255,.3); text-shadow: none; }
.ix .gs.none { height: 0; margin: 0; }
/* degrades du bas */
.ix .b1 { --bg-b: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 30%, transparent) 100%); }
.ix .b2 { --bg-b: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 22%, transparent) 100%); --bb-b: 2px solid var(--gt); }
.ix .b3 { --bs-b: inset 0 -18px 18px -14px color-mix(in srgb, var(--gt) 55%, transparent); }
.ix .b4 { --bg-b: linear-gradient(160deg, transparent 35%, color-mix(in srgb, var(--gt) 28%, transparent) 100%); }
.ix .b5 { border-image: linear-gradient(180deg, rgba(140,170,255,.35) 35%, var(--gt) 100%) 1; } .ix .b5 .bar { background: transparent; }
.ix .b6 { --bg-b: radial-gradient(ellipse 85% 70% at 50% 45%, color-mix(in srgb, var(--gt) 28%, transparent), transparent 75%); }
.ix .b7 { background: linear-gradient(180deg, #0a1330 52%, color-mix(in srgb, var(--gt) 24%, #0a1330) 100%); }
.ix .b8 { background: linear-gradient(180deg, #0a1330 40%, color-mix(in srgb, var(--gt) 20%, #0a1330) 100%); } .ix .b8 .bar { order: 9; position: absolute; left: 0; right: 0; bottom: 0; margin: 0; height: 4px; }
@media (max-width: 900px) { .ix .v4-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`
function Bay({ id, n, title, desc, children }: { id: string; n: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bay" id={id}>
      <span className="eyebrow">{n}</span>
      <h2 className="sf">{title}</h2>
      <p className="d">{desc}</p>
      <div className="stage">{children}</div>
    </section>
  )
}

type PC = { n: string; v?: string; s: string; img: string; y: string; br: string; no?: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tm: string; tc: string; ab: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', y: '2010-11', br: 'Panini Donruss', no: '#64', img: C.mccain.img, rc: true, tm: 'PHI', tc: '#2f8bff', ab: 'PHI' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', y: '2023-24', br: 'Panini Prizm', no: '#12', img: C.edwards.img, rc: true, auto: true, tm: 'MIN', tc: '#4aa3df', ab: 'MIN' },
  { n: 'Hersey Hawkins', v: 'Power Brokers', s: '2006-07 Topps Bowman', y: '2006-07', br: 'Topps Bowman', no: '#33', img: C.hawkins.img, patch: true, auto: true, num: '/35', tm: 'BOS', tc: '#1fb75a', ab: 'BOS' },
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', y: '2024-25', br: 'Court Kings', no: '#FP-TM', img: C.maxey.img, rc: true, auto: true, patch: true, num: '/25', tm: 'LAL', tc: '#fdb927', ab: 'LAL' },
  { n: 'Luwawu-Cabarrot', v: 'Gold Standard', s: '2023-24 Panini Select', y: '2023-24', br: 'Panini Select', no: '#5', img: C.luwawu.img, tm: 'DEN', tc: '#fec524', ab: 'DEN' },
]
type K = 'rc' | 'patch' | 'auto' | 'num'
const TIERC: Record<string, string> = { gold: '#ffd54a', silver: '#dfe6f2' }
const segsOf = (c: PC) => {
  const out: { k: K; t: string; c: string; dark?: boolean }[] = []
  if (c.rc) out.push({ k: 'rc', t: 'RC', c: TAG_BASE.rc })
  if (c.patch) out.push({ k: 'patch', t: 'Patch', c: TAG_BASE.patch })
  if (c.auto) out.push({ k: 'auto', t: 'Auto', c: TAG_BASE.auto })
  if (c.num) { const t = numTier(c.num); out.push({ k: 'num', t: numShort(c.num), c: t === 'gold' ? '#ffd54a' : t === 'silver' ? '#dfe6f2' : TAG_BASE.num, dark: t === 'gold' || t === 'silver' }) }
  return out
}
const gradOf = (c: string) => `linear-gradient(180deg, ${mix(c, 0.22)} 0%, ${c} 55%, ${mix(c, -0.22)} 100%)`
const segStyle = (s: { c: string; dark?: boolean }): CSSProperties => ({ ['--c' as string]: s.c, ['--g' as string]: gradOf(s.c), ['--l' as string]: mix(s.c, 0.55), ['--t' as string]: s.dark ? '#1a1000' : '#fff' } as CSSProperties)
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>

type Fill = 'year' | 'brand' | 'num' | 'team' | 'sport' | 'stripe' | 'insert' | 'none'
const fillNode = (c: PC, f: Fill): React.ReactNode => {
  if (f === 'none') return null
  if (f === 'stripe') return <span className="s stripe" />
  if (f === 'team') return <span className="s team" style={{ ['--tc' as string]: c.tc } as CSSProperties}>{c.ab} · Basketball</span>
  const t = f === 'year' ? c.y : f === 'brand' ? c.br : f === 'num' ? c.no : f === 'sport' ? 'Basketball' : c.v
  return <span className={`s ${f === 'insert' ? 'insert' : 'ghost'}`}>{t}</span>
}
const Cell = ({ c, sv = 1, fill = 'year', b = 1 }: { c: PC; sv?: number; fill?: Fill; b?: number }) => {
  const segs = segsOf(c)
  return (
    <div className={`v4 b${b}`} style={{ ['--gt' as string]: c.tc, ['--tc' as string]: c.tc } as CSSProperties}>
      <div className={`gs sv-${sv}${!segs.length && fill === 'none' ? ' none' : ''}`}>
        {segs.length ? segs.map(s => <span key={s.k} className="s" style={segStyle(s)}>{s.t}</span>) : fillNode(c, fill)}
      </div>
      <div className="ph"><img src={c.img} alt="" /></div>
      <div className="bar" />
      <div className="bt"><div className="nm"><img src={`/team-logos/nba-${c.tm}.png`} alt="" /><span>{c.n}</span></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div><Ic /></div>
    </div>
  )
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="v4-row">{children}</div>

const STRIPS = [
  ['Actuel (dégradé fin, relief)', 'Le bandeau tel qu\'il est en ligne : 17 px, dégradé vertical, filet de relief, lettres espacées.'],
  ['Plat et ultra fin (14 px)', 'Couleur unie sans relief, 14 px de haut, texte de 8,5 px. Le plus discret et le plus net.'],
  ['Segments inclinés', 'Les segments sont des parallélogrammes qui s\'emboîtent (bords inclinés de 7 px), sans espace entre eux : une bande dynamique, comme une pile de rubans.'],
  ['Filet de couleur + fond teinté', 'Pas de plein : un fond teinté à 18 % de la couleur, un filet épais de 2 px en haut et le texte en version claire. Plus léger visuellement, la couleur est discrète.'],
  ['Plein + double liseré intérieur', 'Couleur unie avec deux liserés intérieurs (un blanc, un sombre) comme un badge frappé. Plus soigné de près.'],
  ['Blocs blancs soulignés de couleur', 'Blocs blancs pleins avec le texte marine et un trait de 3 px de la couleur de l\'atout dessous : le style des repères blancs du site.'],
  ['Fond sombre + carré de couleur à gauche', 'Segments sombres à filet fin, un bloc de couleur de 4 px à gauche de chacun et le texte blanc. Très sobre ; les couleurs sont réduites à un repère.'],
  ['Coins coupés', 'Couleur unie, les quatre coins coupés de 4 px (forme de badge à pans coupés). Net et un peu graphique.'],
  ['Bande continue à séparateurs fins', 'Une seule bande sans espace, divisée par des filets blancs de 1 px. Se lit comme un seul objet qui change de largeur selon le nombre d\'atouts.'],
  ['Ultra fin 13 px mat', 'Couleur légèrement assombrie (mélangée au fond), texte de 8 px très espacé, ombre intérieure basse. Le moins visible, le plus élégant.'],
]
const FILLS: [Fill, string, string][] = [
  ['year', 'L\'année dans un segment gris (actuel)', 'Un segment gris discret avec l\'année de la carte.'],
  ['brand', 'La marque / le set', 'Le nom de la marque (« PANINI SELECT ») en gris : on connaît la gamme d\'un coup d\'œil.'],
  ['num', 'Le numéro de la carte', 'Le numéro (« #FP-TM ») dans le segment gris, à la place du bas de la vignette où tu ne voulais plus le voir.'],
  ['team', 'Équipe + sport en dégradé', 'Un dégradé de la couleur de l\'équipe qui s\'efface vers la droite, avec « MIN · Basketball » : le haut se colore sans prétendre à un atout.'],
  ['sport', 'Le sport', 'Un simple « BASKETBALL » en gris. Utile surtout pour les galeries multisports.'],
  ['stripe', 'Rayures neutres sans texte', 'Une bande de fines rayures diagonales grises : on voit que la place est réservée volontairement, sans rien écrire.'],
  ['insert', 'Le nom de l\'insert (ou de la variation) en bleu italique', 'L\'insert « Gold Standard » monte dans la bande, en bleu italique : même couleur que dans le bas, qui pourrait alors se raccourcir.'],
  ['none', 'Rien : la rangée disparaît et l\'image remonte', 'Pas de bande pour les cartes sans atout ; l\'image commence plus haut, donc elle n\'est plus alignée avec ses voisines.'],
]
const BOTS = [
  ['Actuel (30 % sur tout le bloc)', 'Dégradé vertical de la couleur de l\'équipe sur tout le bloc texte. Le fondu se voit surtout aux bords : c\'est ce qui paraît mal intégré.'],
  ['Plus léger + trait d\'équipe en pied', 'Dégradé à 22 % qui se termine sur un trait de 2 px de la couleur de l\'équipe en bas : le dégradé a une « ligne d\'arrivée » nette qui l\'ancre dans le cadre.'],
  ['Lueur de pied (sans remplissage)', 'Aucun fond : seulement une lueur de la couleur de l\'équipe qui monte de 18 px depuis le bord bas. Très naturel, comme un éclairage.'],
  ['Dégradé diagonal', 'Le dégradé part du coin bas droit en diagonale (160°) au lieu de monter à la verticale : moins « bloc de couleur », plus lumière.'],
  ['Dégradé dans le cadre (liseré qui se colore)', 'Le fond reste uni ; c\'est le liseré du cadre qui passe de bleu pâle en haut à la couleur de l\'équipe en bas (la barre de 4 px disparaît). L\'équipe se lit sur toute la hauteur.'],
  ['Halo derrière le nom', 'Un halo elliptique de la couleur de l\'équipe, centré derrière le nom : le nom est mis en valeur et le reste du bas reste sombre.'],
  ['Teinte de toute la carte', 'Le fond de la carte entière glisse de la couleur de base (en haut) vers une teinte de l\'équipe (en bas, 24 %), image et texte compris : le dégradé commence derrière l\'image, donc il n\'a plus de bord.'],
  ['Teinte de la carte + barre en pied', 'Même teinte de toute la carte (20 %) et la barre d\'équipe passe au tout bas du cadre, comme une plinthe.'],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 41 · Bandeau, espace vide, dégradé</h1>
      <p className="lead">Trois chantiers sur les vignettes de la galerie, montrés sur 5 cartes (1, 2, 3 et 4 atouts, et une sans atout) avec des équipes de couleurs différentes : A. rendre le bandeau d&apos;atouts plus beau et plus fin (10 variantes) ; B. remplir la rangée quand il n&apos;y a aucun atout (8 façons) ; C. mieux intégrer le dégradé du bas à la couleur d&apos;équipe (8 façons).</p>
      <nav className="tags">{STRIPS.map((_, i) => <a key={i} href={`#a${i + 1}`}>A{i + 1}</a>)}{FILLS.map((_, i) => <a key={i} href={`#b${i + 1}`}>B{i + 1}</a>)}{BOTS.map((_, i) => <a key={i} href={`#c${i + 1}`}>C{i + 1}</a>)}</nav>

      {STRIPS.map((d, i) => <Bay key={d[0]} id={`a${i + 1}`} n={`A${i + 1}`} title={d[0]} desc={d[1]}><Row>{PCS.map(c => <Cell key={c.n} c={c} sv={i + 1} />)}</Row></Bay>)}
      {FILLS.map((d, i) => <Bay key={d[1]} id={`b${i + 1}`} n={`B${i + 1}`} title={d[1]} desc={d[2]}><Row>{PCS.map(c => <Cell key={c.n} c={c} fill={d[0]} />)}</Row></Bay>)}
      {BOTS.map((d, i) => <Bay key={d[0]} id={`c${i + 1}`} n={`C${i + 1}`} title={d[0]} desc={d[1]}><Row>{PCS.map(c => <Cell key={c.n} c={c} b={i + 1} />)}</Row></Bay>)}
    </div>
  )
}
