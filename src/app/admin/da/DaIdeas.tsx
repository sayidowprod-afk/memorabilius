'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import CardTags, { TagPill } from '@/components/CardTags'
import { TAG_BASE, numTier, numShort, RARE_FX, mix, rgba } from '@/lib/cardTags'

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

/* serie 37 : atouts lisibles sous l'image, aucune info sur la carte (prefixe iq-) */
.ix .iq-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; max-width: 900px; }
.ix .iq { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; }
.ix .iq .ph { position: relative; overflow: hidden; } .ix .iq img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .iq .bar { height: 4px; margin: 8px -7px 0; background: var(--tc, #2f8bff); }
.ix .iq .tx { padding: 8px 2px 9px; } .ix .iq .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .iq .nm .t { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .iq .st { font: 500 11px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 3px; } .ix .iq .ic { display: inline-flex; gap: 8px; font-size: 14px; flex-shrink: 0; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
.ix .iq-old { padding: 8px; border: 2px solid #1a5fd0; border-radius: 10px; background: #0d1530; } .ix .iq-old .nm { font: 800 13px system-ui; }
/* 1 reference */
.ix .t-ref { margin-top: 6px; font: 900 10px system-ui; letter-spacing: .14em; text-transform: uppercase; } .ix .t-ref i { font-style: normal; opacity: .4; margin: 0 5px; }
/* 2 plus gros et plus vif */
.ix .t-big { margin-top: 7px; font: 900 13px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .t-big i { font-style: normal; opacity: .45; margin: 0 6px; }
/* 3 Surfquest mots entiers */
.ix .t-sf { margin-top: 6px; font-size: 18px; line-height: 1.05; letter-spacing: .04em; } .ix .t-sf i { font-style: normal; opacity: .4; margin: 0 7px; }
/* 4 filet + carres */
.ix .t-sqr { margin-top: 8px; padding-top: 7px; border-top: 1px solid rgba(255,255,255,.25); display: flex; flex-wrap: wrap; gap: 6px 12px; font: 900 12px system-ui; letter-spacing: .12em; text-transform: uppercase; color: #fff !important; } .ix .t-sqr span { display: inline-flex; align-items: center; gap: 6px; } .ix .t-sqr span::before { content: ''; width: 10px; height: 10px; background: var(--k); }
/* 5 etiquettes carrees pleines */
.ix .t-box { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 4px; } .ix .t-box span { font: 900 11px/1 system-ui; letter-spacing: .12em; text-transform: uppercase; padding: 5px 8px 4px; background: var(--b); color: var(--t) !important; }
/* 6 bande segmentee */
.ix .t-seg { display: flex; margin: 0 -7px; } .ix .t-seg span { flex: 1; text-align: center; font: 900 11px system-ui; letter-spacing: .12em; text-transform: uppercase; padding: 6px 2px 5px; background: var(--b); color: var(--t) !important; border-right: 1px solid rgba(5,9,18,.55); } .ix .t-seg span:last-child { border-right: 0; }
/* 7 pied deux colonnes */
.ix .t-cols { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 8px; margin-top: 7px; padding-top: 7px; border-top: 1px solid rgba(255,255,255,.22); } .ix .t-cols .l { font: 900 11px system-ui; letter-spacing: .12em; text-transform: uppercase; } .ix .t-cols .l i { font-style: normal; opacity: .4; margin: 0 5px; } .ix .t-cols .r { font-size: 24px; line-height: .85; color: var(--cc) !important; text-shadow: 0 0 12px var(--cg); }
/* 8 soulignement colore */
.ix .t-ul { margin-top: 7px; display: flex; flex-wrap: wrap; gap: 3px 14px; font: 900 12px system-ui; letter-spacing: .1em; text-transform: uppercase; color: #fff !important; } .ix .t-ul span { padding-bottom: 3px; border-bottom: 3px solid var(--k); }
/* 9 ligne sur fond */
.ix .t-bg { margin: 0 -7px; padding: 6px 9px 5px; background: rgba(0,0,0,.38); border-top: 1px solid rgba(255,255,255,.14); font: 900 11px system-ui; letter-spacing: .14em; text-transform: uppercase; } .ix .t-bg i { font-style: normal; opacity: .4; margin: 0 6px; }
/* 10 tirage en grand a cote du nom */
.ix .t-nb { font-size: 26px; line-height: .9; flex-shrink: 0; color: var(--cc) !important; text-shadow: 0 0 12px var(--cg); } .ix .t-first { margin-top: 5px; font: 900 12px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .t-first i { font-style: normal; opacity: .45; margin: 0 6px; } .ix .t-first + .st { margin-top: 4px; }
/* 11 barre verticale */
.ix .t-bar { display: grid; grid-template-columns: 4px 1fr; gap: 9px; margin-top: 7px; } .ix .t-bar .v { display: flex; flex-direction: column; gap: 2px; } .ix .t-bar .v span { flex: 1; background: var(--k); } .ix .t-bar .l { font: 900 12px/1.5 system-ui; letter-spacing: .1em; text-transform: uppercase; }
/* telephone */
.ix .iq-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .iq-ph .iq-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .ix .iq-ph .iq .nm { font-size: 15px; } .ix .iq-ph .iq .st { font-size: 9px; }
@media (max-width: 800px) { .ix .iq-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type PC = { n: string; v?: string; s: string; img: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tc: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, tc: '#2f8bff' },
  { n: 'Tyrese Maxey', s: '1995-96 SkyBox Rookie', img: C.maxey.img, auto: true, patch: true, num: '/25', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Offensive Rebound LDR', s: '1989-90 Fleer', img: C.hawkins.img, patch: true, num: '/99', tc: '#2f8bff' },
  { n: 'Anthony Edwards', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', tc: '#4aa3df' },
]
type K = 'rc' | 'auto' | 'num' | 'patch'
const kinds = (c: PC) => ([c.rc && 'rc', c.auto && 'auto', c.num && 'num', c.patch && 'patch'].filter(Boolean) as K[])
const TIERC: Record<string, string> = { gold: '#ffd54a', silver: '#dfe6f2', bronze: '#e0925a' }
const TIERG: Record<string, string> = { gold: 'rgba(255,215,0,.5)', silver: 'rgba(220,230,245,.4)', bronze: 'rgba(224,146,90,.4)', std: 'rgba(108,151,255,.35)' }
const solid = (k: K, c: PC) => (k === 'num' ? (numTier(c.num) !== 'std' ? TIERC[numTier(c.num)] : TAG_BASE.num) : TAG_BASE[k])
const lite = (k: K, c: PC) => (k === 'num' && numTier(c.num) !== 'std' ? TIERC[numTier(c.num)] : mix(TAG_BASE[k], 0.5))
const long = (k: K, c: PC) => (k === 'rc' ? 'Rookie' : k === 'auto' ? 'Autographe' : k === 'patch' ? 'Patch' : numShort(c.num) || 'Num')
const short = (k: K, c: PC) => (k === 'rc' ? 'RC' : k === 'auto' ? 'Auto' : k === 'patch' ? 'Patch' : numShort(c.num) || 'Num')
const kv = (k: K, c: PC): CSSProperties => ({ ['--k' as string]: solid(k, c) } as CSSProperties)
const bt = (k: K, c: PC): CSSProperties => {
  const t = numTier(c.num); const rare = k === 'num' && t !== 'std'
  return { ['--b' as string]: rare ? RARE_FX[t as 'gold' | 'silver' | 'bronze'].bg : TAG_BASE[k], ['--t' as string]: rare ? RARE_FX[t as 'gold' | 'silver' | 'bronze'].fg : '#fff' } as CSSProperties
}
const tierVars = (c: PC): CSSProperties => { const t = numTier(c.num); return { ['--cc' as string]: t === 'std' ? '#8fb4ff' : TIERC[t], ['--cg' as string]: TIERG[t] } as CSSProperties }
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>
type Slots = { mid?: React.ReactNode; tx?: React.ReactNode; nm?: React.ReactNode; after?: React.ReactNode; before?: React.ReactNode }
const Card = ({ c, mid, tx, nm, after, before }: { c: PC } & Slots) => (
  <div className="iq">
    <div className="ph"><img className="im" src={c.img} alt="" /></div>{mid}
    <div className="bar" style={{ ['--tc' as string]: c.tc }} />
    {tx ?? <div className="tx"><div className="nm"><span className="t">{c.n}</span>{nm}<Ic /></div>{before}<div className="st">{c.s}</div>{after}</div>}
  </div>
)
const Row = ({ children }: { children: React.ReactNode }) => <div className="iq-row">{children}</div>
const words = (c: PC, f: (k: K) => string, sep: React.ReactNode) => kinds(c).map((k, i) => <React.Fragment key={k}>{i > 0 && sep}<b style={{ color: lite(k, c), fontWeight: 'inherit' }}>{f(k)}</b></React.Fragment>)

type Idea = { title: string; desc: string; render: (c: PC) => React.ReactNode }
const IDEAS: Idea[] = [
  { title: 'Référence : l\'idée 06 de la série précédente', desc: 'Les atouts en petites capitales colorées (10 px) sous le set. Complet, sobre, mais trop discret : c\'est ce que tu trouvais peu visible.', render: c => <Card c={c} after={kinds(c).length ? <div className="t-ref">{words(c, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { title: 'Plus gros et plus vif : 13 px, couleurs éclaircies', desc: 'Même ligne mais à 13 px au lieu de 10, avec des couleurs éclaircies pour mieux ressortir sur le fond bleu nuit, et placée entre le nom et le set. Aucun élément sur la carte.', render: c => <Card c={c} before={kinds(c).length ? <div className="t-big">{words(c, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { title: 'En Surfquest 18 px, mots entiers', desc: 'Les atouts écrits en toutes lettres en Surfquest 18 px (« ROOKIE · AUTOGRAPHE · PATCH · /25 »), chaque mot dans sa couleur. Il se lit presque comme le nom. Passe à la ligne sur mobile.', render: c => <Card c={c} before={kinds(c).length ? <div className="t-sf sq">{words(c, k => long(k, c), <i>·</i>)}</div> : undefined} /> },
  { title: 'Filet fin au-dessus + carrés de couleur de 10 px, texte blanc', desc: 'Une ligne séparée du set par un filet d\'un pixel : un carré plein de la couleur de l\'atout puis son nom en blanc gras 12 px. Le blanc est plus lisible que du texte coloré, la couleur reste lisible dans le carré.', render: c => <Card c={c} after={kinds(c).length ? <div className="t-sqr">{kinds(c).map(k => <span key={k} style={kv(k, c)}>{short(k, c)}</span>)}</div> : undefined} /> },
  { title: 'Étiquettes carrées pleines sous le nom (pas de pastilles, pas sur la carte)', desc: 'De petits rectangles pleins à angles droits, dans la couleur franche de chaque atout, texte blanc 11 px en capitales, sous le nom. Opaques et très visibles, mais sous l\'image : la carte n\'est jamais cachée.', render: c => <Card c={c} after={kinds(c).length ? <div className="t-box">{kinds(c).map(k => <span key={k} style={bt(k, c)}>{short(k, c)}</span>)}</div> : undefined} /> },
  { title: 'Bande pleine largeur sous l\'image, un segment par atout', desc: 'Une bande de 22 px collée sous l\'image, de la largeur de la vignette, découpée en segments égaux : un par atout, couleur pleine et texte blanc. Très visible et alignée sur toute la grille ; elle ajoute une ligne mais rien sur l\'image.', render: c => <Card c={c} mid={kinds(c).length ? <div className="t-seg">{kinds(c).map(k => <span key={k} style={bt(k, c)}>{short(k, c)}</span>)}</div> : undefined} /> },
  { title: 'Pied en deux colonnes : atouts à gauche, tirage en grand à droite', desc: 'Sous le set, un filet puis les atouts en capitales à gauche et le tirage en Surfquest 24 px à droite, aux couleurs de la rareté (or, argent, bronze, bleu). Les informations sont complètes et le tirage, ce qui fait la valeur, est gros.', render: c => <Card c={c} after={kinds(c).length ? <div className="t-cols"><div className="l">{words({ ...c, num: undefined }, k => short(k, c), <i>·</i>)}</div>{c.num && <div className="r sq" style={tierVars(c)}>{numShort(c.num)}</div>}</div> : undefined} /> },
  { title: 'Mots blancs soulignés d\'un trait épais coloré', desc: 'Les atouts en blanc gras 12 px, chacun souligné d\'un trait de 3 px dans sa couleur. Le texte reste blanc (très lisible) et la couleur est visible dans le trait. Aucun cadre.', render: c => <Card c={c} after={kinds(c).length ? <div className="t-ul">{kinds(c).map(k => <span key={k} style={kv(k, c)}>{short(k, c)}</span>)}</div> : undefined} /> },
  { title: 'Ligne sur un fond sombre pleine largeur', desc: 'La ligne typographique (capitales colorées, 11 px) est posée sur une bande plus sombre qui touche les deux bords de la vignette. Le contraste vient du fond : ça ressort sans ajouter de couleur aux blocs.', render: c => <Card c={c} mid={kinds(c).length ? <div className="t-bg">{words(c, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { title: 'Le tirage en grand à côté du nom, les autres atouts dessous', desc: 'Le tirage s\'écrit en Surfquest 26 px à droite du nom (1/1 doré, /25 bronze, /99 bleu…), les autres atouts en capitales colorées 12 px en dessous. Les deux infos clés se voient sans regarder le texte.', render: c => <Card c={c} nm={c.num ? <span className="t-nb sq" style={tierVars(c)}>{numShort(c.num)}</span> : undefined} before={kinds(c).filter(k => k !== 'num').length ? <div className="t-first">{words({ ...c, num: undefined }, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { title: 'Barre verticale segmentée + une ligne par atout', desc: 'Un filet de 4 px à gauche, découpé en segments de couleur, et chaque atout sur sa propre ligne, en blanc gras 12 px (« Rookie », « Autographe », « /25 »). On lit tout d\'un coup, sans deviner un code couleur. Plus haut si 3 atouts.', render: c => <Card c={c} tx={<div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div><div className="st">{c.s}</div>{kinds(c).length ? <div className="t-bar"><div className="v">{kinds(c).map(k => <span key={k} style={kv(k, c)} />)}</div><div className="l">{kinds(c).map(k => <div key={k}>{long(k, c)}</div>)}</div></div> : null}</div>} /> },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 37 · Atouts lisibles, rien sur la carte</h1>
      <p className="lead">Retour de ta part : le filigrane ne montre pas toutes les informations, les rubans prennent trop de place sur la carte, et l&apos;idée « typographique » est la plus juste mais trop discrète. Ici, toutes les idées gardent cette approche : tout est sous l&apos;image, rien ne recouvre la carte, toutes les informations sont là (RC, AUTO, PATCH, tirage), mais bien plus visibles (plus gros, plus de contraste, fonds pleins, filets). Chaque idée est montrée sur 4 cartes types.</p>
      <nav className="tags">{IDEAS.map((t, i) => <a key={t.title} href={`#i${i + 1}`}>{String(i + 1).padStart(2, '0')}</a>)}<a href="#i99">Mobile</a></nav>

      <Bay id="i0" n="00" title="Aujourd'hui, pour comparer" desc="Les pastilles teintées dans une rangée sous le nom : elles allongent la vignette et sont loin de la carte qu'elles qualifient."><Row>
        {PCS.map(c => <div key={c.n} className="iq iq-old"><img className="im" src={c.img} alt="" /><div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div><div className="st">{c.s}</div><div style={{ marginTop: 6 }}><CardTags rc={c.rc} auto={c.auto} patch={c.patch} num={c.num} size="sm" /></div></div></div>)}
      </Row></Bay>

      {IDEAS.map((d, i) => (
        <Bay key={d.title} id={`i${i + 1}`} n={String(i + 1).padStart(2, '0')} title={d.title} desc={d.desc}><Row>{PCS.map(c => <React.Fragment key={c.n}>{d.render(c)}</React.Fragment>)}</Row></Bay>
      ))}

      <Bay id="i99" n="Mobile" title="Téléphone : les 3 plus lisibles en 2 colonnes" desc="Trois idées en vignettes de téléphone (2 colonnes) : à gauche les carrés de couleur + texte blanc, au milieu les étiquettes carrées pleines, à droite la bande pleine largeur sous l'image. Dans les trois cas rien sur la carte et le texte reste à 11 px minimum."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="iq-ph"><Row>{PCS.map(c => <div key={c.n}>{IDEAS[3].render(c)}</div>)}</Row></div>
        <div className="iq-ph"><Row>{PCS.map(c => <div key={c.n}>{IDEAS[4].render(c)}</div>)}</Row></div>
        <div className="iq-ph"><Row>{PCS.map(c => <div key={c.n}>{IDEAS[5].render(c)}</div>)}</Row></div>
      </div></Bay>
    </div>
  )
}
