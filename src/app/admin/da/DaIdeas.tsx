'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { TAG_BASE, numTier, numShort } from '@/lib/cardTags'

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

/* serie 40 : atouts en bannieres fines sur la carte, atouts en haut a gauche, tirage en bas a droite (prefixe bn-) */
.ix .bn-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; max-width: 900px; }
.ix .bn-c { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; }
.ix .bn-c .ph { position: relative; overflow: hidden; } .ix .bn-c img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .bn-c .bar { height: 4px; margin: 8px -7px 0; background: var(--tc, #2f8bff); }
.ix .bn-c .tx { padding: 8px 2px 9px; } .ix .bn-c .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .bn-c .nm .t { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .bn-c .vr { font: italic 600 10px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .bn-c .st { font: 500 10px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 2px; } .ix .bn-c .ic { display: inline-flex; gap: 6px; font-size: 14px; }
.ix .bn-c .lg { width: 16px; height: 16px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
/* haut gauche */
.ix .tp { position: absolute; top: 0; left: 0; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 1px; } .ix .tp.row { flex-direction: row; }
.ix .tp .b { height: var(--h, 17px); display: inline-flex; align-items: center; padding: 0 7px; font: 900 10px system-ui; letter-spacing: .1em; text-transform: uppercase; background: var(--b); color: #fff !important; white-space: nowrap; }
.ix .tp .b.bevel { clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 100%, 0 100%); padding-right: 12px; }
.ix .tp .b.fish { clip-path: polygon(0 0, 100% 0, calc(100% - 6px) 50%, 100% 100%, 0 100%); padding-right: 13px; }
.ix .tp .b.sqr { width: var(--h, 17px); padding: 0; justify-content: center; letter-spacing: 0; }
.ix .tp .b.wht { background: #fff; color: #06122e !important; padding-left: 11px; box-shadow: inset 4px 0 0 var(--k); }
.ix .tp .b.tab { margin-left: 9px; }
.ix .tp .b.one { padding: 0 9px; }
.ix .tp.vt { flex-direction: column; gap: 1px; } .ix .tp.vt .b { writing-mode: vertical-rl; transform: rotate(180deg); width: 16px; height: auto; padding: 7px 0; justify-content: center; font-size: 9px; letter-spacing: .14em; }
.ix .stp { position: absolute; left: 0; right: 0; top: 0; z-index: 2; display: flex; } .ix .stp .b { flex: 1; text-align: center; height: 16px; line-height: 16px; font: 900 9px/16px system-ui; letter-spacing: .12em; text-transform: uppercase; background: var(--b); color: #fff !important; border-right: 1px solid rgba(5,9,18,.5); } .ix .stp .b:last-child { border-right: 0; }
/* bas droite : tirage */
.ix .bt { position: absolute; z-index: 2; right: 0; bottom: 0; font-size: 16px; line-height: 1; color: var(--ti) !important; }
.ix .bt.flush { padding: 4px 9px 2px; background: var(--ti); color: #1a1000 !important; }
.ix .bt.bevel { padding: 4px 9px 2px 15px; background: var(--ti); color: #1a1000 !important; clip-path: polygon(9px 0, 100% 0, 100% 100%, 0 100%); }
.ix .bt.cart { right: 6px; bottom: 6px; padding: 3px 8px 1px; border: 2px solid var(--ti); background: rgba(5,9,18,.92); box-shadow: 0 0 12px var(--tg); }
.ix .bt.strip { left: 0; padding: 3px 9px 1px; text-align: right; background: rgba(5,9,18,.9); border-top: 2px solid var(--ti); }
.ix .bt.seal { right: 6px; bottom: 6px; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 35% 30%, #1a2a66, #060b22); border: 3px solid var(--ti); box-shadow: 0 0 0 2px #060b22, 0 0 12px var(--tg); font-size: 14px; }
.ix .bt.wht { padding: 4px 9px 2px; background: #fff; color: #06122e !important; box-shadow: inset 0 -3px 0 var(--ti); padding-bottom: 5px; }
.ix .bt.out { right: 4px; bottom: -3px; font-size: 46px; line-height: .8; color: transparent !important; -webkit-text-stroke: 2px var(--ti); filter: drop-shadow(0 0 8px var(--tg)); }
.ix .bt.tilt { right: 6px; bottom: 8px; padding: 3px 9px 1px; background: var(--ti); color: #1a1000 !important; transform: rotate(-4deg); box-shadow: 2px 3px 0 rgba(0,0,0,.45); }
/* telephone */
.ix .bn-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .bn-ph .bn-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .ix .bn-ph .bn-c .nm { font-size: 15px; } .ix .bn-ph .tp .b { font-size: 9px; padding: 0 5px; } .ix .bn-ph .bt { font-size: 14px; }
@media (max-width: 800px) { .ix .bn-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type PC = { n: string; v?: string; s: string; img: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tm: string; tc: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, tm: 'PHI', tc: '#2f8bff' },
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', img: C.maxey.img, auto: true, patch: true, num: '/25', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Power Brokers', s: '2006-07 Topps Bowman', img: C.hawkins.img, patch: true, num: '/99', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', tm: 'MIN', tc: '#4aa3df' },
]
type K = 'rc' | 'auto' | 'patch'
const ks = (c: PC) => ([c.rc && 'rc', c.auto && 'auto', c.patch && 'patch'].filter(Boolean) as K[])
const lab = (k: K) => (k === 'rc' ? 'RC' : k === 'auto' ? 'Auto' : 'Patch')
const ini = (k: K) => (k === 'rc' ? 'R' : k === 'auto' ? 'A' : 'P')
const bgv = (k: K): CSSProperties => ({ ['--b' as string]: TAG_BASE[k], ['--k' as string]: TAG_BASE[k] } as CSSProperties)
const TIERC: Record<string, string> = { gold: '#ffd54a', silver: '#dfe6f2', bronze: '#e0925a' }
const TIERG: Record<string, string> = { gold: 'rgba(255,215,0,.5)', silver: 'rgba(220,230,245,.4)', bronze: 'rgba(224,146,90,.4)', std: 'rgba(108,151,255,.35)' }
const tv = (c: PC): CSSProperties => { const t = numTier(c.num); return { ['--ti' as string]: t === 'std' ? '#8fb4ff' : TIERC[t], ['--tg' as string]: TIERG[t] } as CSSProperties }
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>

type Top = 'flush' | 'row' | 'one' | 'bevel' | 'fish' | 'ini' | 'vert' | 'white' | 'strip' | 'tab'
type Bot = 'flush' | 'cart' | 'bevel' | 'strip' | 'seal' | 'white' | 'out' | 'tilt' | 'none'
const TopEl = ({ c, t, h }: { c: PC; t: Top; h?: number }) => {
  const list = ks(c); if (!list.length) return null
  const st = h ? ({ ['--h' as string]: `${h}px` } as CSSProperties) : undefined
  if (t === 'strip') return <div className="stp">{list.map(k => <span key={k} className="b" style={bgv(k)}>{lab(k)}</span>)}</div>
  if (t === 'one') { const k = list.includes('auto') ? 'auto' : list.includes('patch') ? 'patch' : 'rc'; return <div className="tp" style={st}><span className="b one" style={bgv(k)}>{list.map(lab).join(' · ')}</span></div> }
  if (t === 'vert') return <div className="tp vt">{list.map(k => <span key={k} className="b" style={bgv(k)}>{lab(k)}</span>)}</div>
  const cls = t === 'bevel' ? 'bevel' : t === 'fish' ? 'fish' : t === 'ini' ? 'sqr' : t === 'white' ? 'wht' : t === 'tab' ? 'tab' : ''
  return <div className={`tp${t === 'row' || t === 'ini' ? ' row' : ''}`} style={st}>{list.map(k => <span key={k} className={`b ${cls}`} style={bgv(k)}>{t === 'ini' ? ini(k) : lab(k)}</span>)}</div>
}
const BotEl = ({ c, b }: { c: PC; b: Bot }) => (c.num && b !== 'none' ? <div className={`bt sq ${b}`} style={tv(c)}>{numShort(c.num)}</div> : null)
const Cell = ({ c, top, bot, h }: { c: PC; top: Top; bot: Bot; h?: number }) => (
  <div className="bn-c">
    <div className="ph"><img className="im" src={c.img} alt="" /><TopEl c={c} t={top} h={h} /><BotEl c={c} b={bot} /></div>
    <div className="bar" style={{ ['--tc' as string]: c.tc }} />
    <div className="tx"><div className="nm"><img className="lg" src={`/team-logos/nba-${c.tm}.png`} alt="" /><span className="t">{c.n}</span><Ic /></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div></div>
  </div>
)
const Row = ({ children }: { children: React.ReactNode }) => <div className="bn-row">{children}</div>

type Idea = { title: string; desc: string; top: Top; bot: Bot; h?: number }
const IDEAS: Idea[] = [
  { title: 'Bannières fines collées au coin, empilées + tirage en bloc collé', desc: 'Les atouts sont des bandeaux pleins de 17 px de haut, collés au bord haut gauche et empilés avec 1 px d\'écart (RC orange, AUTO vert, PATCH bleu). Le tirage est un bloc plein collé au coin bas droit, aux couleurs de la rareté. Couvre environ 5 % de l\'image.', top: 'flush', bot: 'flush' },
  { title: 'Une seule rangée de bannières côte à côte en haut à gauche', desc: 'Les atouts sont alignés sur une seule ligne (RC | AUTO | PATCH), blocs pleins accolés, au lieu d\'être empilés : ils ne descendent que de 17 px au lieu de 17 à 53. Le tirage reste en bas à droite, bloc collé.', top: 'row', bot: 'flush' },
  { title: 'Une seule bannière combinée (« RC · AUTO · PATCH »)', desc: 'Un seul bloc, à la couleur de l\'atout le plus précieux, avec les atouts écrits dedans séparés par des points. C\'est la plus petite surface possible pour tout dire. Tirage en bloc collé bas droite.', top: 'one', bot: 'flush' },
  { title: 'Bannières biseautées (bout coupé en biais) des deux côtés', desc: 'Le bout droit des atouts est coupé en biais, et le bloc du tirage a son bout gauche coupé en biais : ils se répondent en diagonale (haut gauche, bas droite). Une forme de ruban sans pli, sobre.', top: 'bevel', bot: 'bevel' },
  { title: 'Bannières en queue d\'hirondelle + tirage biseauté', desc: 'Atouts avec le bout droit échancré en V comme un vrai ruban, tirage en bloc biseauté. Un peu plus décoratif, toujours plat et opaque.', top: 'fish', bot: 'bevel' },
  { title: 'Initiales en carrés de 18 px (R · A · P) + tirage en cartouche', desc: 'Les atouts sont réduits à une lettre dans un carré plein de 18 px, alignés en rangée au coin haut gauche : la surface la plus petite (jusqu\'à 56 px de large). Le tirage dans un cartouche sombre à liseré de rareté, détaché du bord.', top: 'ini', bot: 'cart', h: 18 },
  { title: 'Languette verticale sur le bord gauche', desc: 'Les atouts s\'écrivent à la verticale sur le bord gauche, 16 px de large : « RC », « AUTO », « PATCH » en blocs empilés qui descendent le long de l\'image. Ne prennent que le bord de l\'image. Tirage en bloc collé.', top: 'vert', bot: 'flush' },
  { title: 'Bannières blanches avec un bloc de couleur à gauche', desc: 'Dans l\'esprit des repères blancs du site : bannière blanche pleine, texte marine, avec un bloc de 4 px de la couleur de l\'atout à gauche. Tirage en bloc blanc avec un soulignement de la couleur de rareté.', top: 'white', bot: 'white' },
  { title: 'Bandes pleine largeur en haut et en bas de l\'image', desc: 'Une bande de 16 px sur le haut de l\'image, découpée en segments égaux (un par atout, couleur pleine), et une bande sombre de 16 px sur le bas avec le tirage aligné à droite et un liseré de rareté. Deux bandes nettes qui encadrent l\'image.', top: 'strip', bot: 'strip' },
  { title: 'Onglets légèrement décalés du bord + cartouche', desc: 'Les atouts sont des languettes qui pendent du bord haut, décalées de 9 px du coin comme les onglets d\'un classeur, empilées en rangée. Tirage en cartouche sombre à liseré de rareté.', top: 'tab', bot: 'cart' },
  { title: 'Bannières collées + cartouche sombre pour le tirage', desc: 'Atouts en bandeaux collés empilés (comme l\'idée 1), mais le tirage devient un cartouche sombre à double liseré, détaché du coin, avec un halo à la couleur de la rareté : plus discret qu\'un bloc plein, plus lumineux pour les tirages rares.', top: 'flush', bot: 'cart' },
  { title: 'Rangée de bannières + tirage biseauté', desc: 'Atouts en une seule rangée (idée 2) et tirage dont le bout gauche est coupé en biais (idée 4) : la combinaison la plus compacte avec un peu de forme.', top: 'row', bot: 'bevel' },
  { title: 'Bannières collées + médaillon rond pour le tirage', desc: 'Atouts en bandeaux collés (idée 1), tirage dans un petit médaillon rond de 42 px à anneau de la couleur de rareté, au coin bas droit. Seul élément arrondi : il attire l\'œil sur le tirage.', top: 'flush', bot: 'seal' },
  { title: 'Bannières collées + chiffre du tirage en creux', desc: 'Atouts en bandeaux collés (idée 1), tirage en gros chiffre creux (46 px) qui déborde du coin bas droit, avec halo de rareté. Très lisible, presque pas de surface pleine.', top: 'flush', bot: 'out' },
  { title: 'Bannières biseautées + cartouche', desc: 'Atouts biseautés (idée 4), tirage en cartouche à liseré (idée 6) : forme plus travaillée en haut, sobre en bas.', top: 'bevel', bot: 'cart' },
  { title: 'Rangée ultra fine de 13 px', desc: 'Même rangée que l\'idée 2 mais à 13 px de haut (texte 9 px) : la plus petite bannière lisible. Tirage en bloc collé. À réserver aux écrans grands ; sur mobile le texte serait trop fin.', top: 'row', bot: 'flush', h: 13 },
  { title: 'Une seule bannière blanche + tirage blanc', desc: 'Un seul bloc blanc plein (« RC · AUTO ») collé en haut à gauche, texte marine, et un bloc blanc collé en bas à droite avec le tirage et un soulignement coloré. Le plus calme et le plus DA : peu de couleurs, des blocs blancs comme sur le reste du site.', top: 'white', bot: 'white' },
  { title: 'Initiales + tirage en bloc collé', desc: 'Carrés d\'initiales (idée 6) et bloc plein collé pour le tirage : très petit en haut, franc en bas.', top: 'ini', bot: 'flush', h: 18 },
  { title: 'Bande haute segmentée + médaillon rond', desc: 'La bande de 16 px sur le haut (idée 9) et le médaillon rond pour le tirage en bas à droite : un cadre net en haut, un point d\'attention en bas.', top: 'strip', bot: 'seal' },
  { title: 'Onglets + chiffre en creux', desc: 'Onglets décalés (idée 10) et gros chiffre creux du tirage (idée 14) : tout est léger, le tirage fait l\'effet.', top: 'tab', bot: 'out' },
  { title: 'Bannières collées + étiquette de tirage légèrement penchée', desc: 'Atouts en bandeaux collés, tirage dans une étiquette pleine penchée de 4° avec une petite ombre, comme collée à la main. Une touche de vie sans surface supplémentaire.', top: 'flush', bot: 'tilt' },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 40 · Atouts en bannières sur la carte</h1>
      <p className="lead">RC, AUTO et PATCH en haut à gauche, le tirage en bas à droite, en bannières pleines et opaques (pas de pastilles transparentes), avec la plus petite surface possible sur la carte : 13 à 18 px de haut, collées aux bords. Chaque idée est montrée sur 4 cartes types (une RC, une auto-patch /25, un patch /99, un RC-auto 1/1), avec le nom, l&apos;insert, le set, la barre et le logo d&apos;équipe. Les couleurs et l&apos;effet or / argent / bronze viennent de ceux du site.</p>
      <nav className="tags">{IDEAS.map((t, i) => <a key={t.title} href={`#i${i + 1}`}>{String(i + 1).padStart(2, '0')}</a>)}<a href="#i99">Mobile</a></nav>

      {IDEAS.map((d, i) => (
        <Bay key={d.title} id={`i${i + 1}`} n={String(i + 1).padStart(2, '0')} title={d.title} desc={d.desc}><Row>{PCS.map(c => <Cell key={c.n} c={c} top={d.top} bot={d.bot} h={d.h} />)}</Row></Bay>
      ))}

      <Bay id="i99" n="Mobile" title="Téléphone : les idées 1, 8 et 9 en 2 colonnes" desc="Trois des idées en vignettes de téléphone (2 colonnes) : bannières collées, blocs blancs, bandes haut et bas. Texte de 9 px dans les bannières, mais les blocs pleins restent lisibles."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {[0, 7, 8].map(i => <div key={i} className="bn-ph"><Row>{PCS.map(c => <Cell key={c.n} c={c} top={IDEAS[i].top} bot={IDEAS[i].bot} h={IDEAS[i].h} />)}</Row></div>)}
      </div></Bay>
    </div>
  )
}
