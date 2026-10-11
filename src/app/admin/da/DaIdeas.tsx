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

/* serie 36 : atouts sobres, dans la DA (prefixe iq-) */
.ix .iq-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; max-width: 900px; }
.ix .iq { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; }
.ix .iq .ph { position: relative; overflow: hidden; } .ix .iq img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .iq .bar { height: 4px; margin: 8px -7px 0; background: var(--tc, #2f8bff); }
.ix .iq .tx { padding: 8px 2px 9px; } .ix .iq .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .iq .nm .t { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .iq .st { font: 500 11px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 3px; } .ix .iq .ic { display: inline-flex; gap: 8px; font-size: 14px; flex-shrink: 0; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
.ix .iq-old { padding: 8px; border: 2px solid #1a5fd0; border-radius: 10px; background: #0d1530; } .ix .iq-old .nm { font: 800 13px system-ui; }
/* A : typographique */
.ix .a-ty { margin-top: 6px; font: 900 10px system-ui; letter-spacing: .14em; text-transform: uppercase; } .ix .a-ty i { font-style: normal; opacity: .4; margin: 0 5px; }
.ix .a-sqr { margin-top: 7px; display: flex; gap: 10px; flex-wrap: wrap; font: 800 10px system-ui; letter-spacing: .14em; text-transform: uppercase; color: #fff !important; } .ix .a-sqr span { display: inline-flex; align-items: center; gap: 5px; } .ix .a-sqr span::before { content: ''; width: 7px; height: 7px; background: var(--k); }
.ix .a-line { display: flex; justify-content: space-between; align-items: baseline; gap: 6px; margin-top: 3px; } .ix .a-line .st { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .a-line .r { font: 900 10px system-ui; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; } .ix .a-line .r i { font-style: normal; opacity: .4; margin: 0 3px; }
.ix .a-sf { margin-top: 5px; font-size: 15px; line-height: 1; letter-spacing: .05em; } .ix .a-sf i { font-style: normal; opacity: .4; margin: 0 6px; }
.ix .a-mono { margin-top: 6px; font: 800 10px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.85) !important; display: flex; align-items: center; } .ix .a-mono i { width: 1px; height: 10px; background: rgba(255,255,255,.4); margin: 0 8px; font-size: 0; } .ix .a-mono b { font-weight: 900; }
/* B : filigranes */
.ix .b-wm { position: absolute; left: 0; right: 0; bottom: -4px; text-align: center; font-size: 62px; line-height: .8; color: transparent !important; -webkit-text-stroke: 2px var(--wc); opacity: .85; mix-blend-mode: screen; pointer-events: none; }
.ix .b-two .l { position: absolute; left: 6px; bottom: -2px; font-size: 40px; line-height: .8; color: transparent !important; -webkit-text-stroke: 1.5px var(--wc); opacity: .9; pointer-events: none; } .ix .b-two .rr { position: absolute; right: 4px; bottom: -6px; font-size: 76px; line-height: .8; color: transparent !important; -webkit-text-stroke: 2px var(--cc); filter: drop-shadow(0 0 8px var(--cg)); pointer-events: none; }
.ix .b-vert { position: absolute; right: 2px; top: 0; bottom: 0; width: 46px; display: flex; align-items: center; justify-content: center; pointer-events: none; } .ix .b-vert span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 64px; line-height: 1; color: transparent !important; -webkit-text-stroke: 2px var(--wc); opacity: .9; white-space: nowrap; }
.ix .b-fill { position: absolute; left: 0; right: 0; bottom: 6px; text-align: center; font-size: 54px; line-height: .8; color: rgba(255,255,255,.3) !important; mix-blend-mode: overlay; letter-spacing: .08em; pointer-events: none; text-shadow: 0 2px 10px rgba(0,0,0,.35); }
.ix .b-num { position: absolute; left: 0; right: 0; bottom: -10px; text-align: center; font-size: 110px; line-height: .8; color: transparent !important; -webkit-text-stroke: 2.5px var(--cc); filter: drop-shadow(0 0 10px var(--cg)); pointer-events: none; }
/* C : etiquettes sobres */
.ix .c-w { position: absolute; z-index: 2; background: #fff; color: #06122e !important; font-size: 14px; line-height: 1; padding: 5px 9px 3px; letter-spacing: .06em; } .ix .c-w.bl { left: 0; bottom: 0; } .ix .c-w.tl { left: 0; top: 0; } .ix .c-g { position: absolute; z-index: 2; right: 0; bottom: 0; font-size: 18px; line-height: 1; padding: 5px 10px 3px; background: var(--cc); color: #1a1000 !important; }
.ix .c-box { position: absolute; top: 7px; left: 7px; z-index: 2; display: inline-flex; align-items: center; border: 1px solid rgba(255,255,255,.85); background: rgba(5,9,18,.72); font: 900 10px system-ui; letter-spacing: .12em; text-transform: uppercase; color: #fff !important; } .ix .c-box span { padding: 5px 8px 4px; border-right: 1px solid rgba(255,255,255,.4); } .ix .c-box span:last-child { border-right: 0; }
.ix .c-band { margin: 0 -7px; display: flex; align-items: center; justify-content: space-between; padding: 5px 9px 4px; border-top: 1px solid rgba(255,255,255,.7); background: #0d1a4a; font: 800 10px system-ui; letter-spacing: .18em; text-transform: uppercase; color: #fff !important; } .ix .c-band b { font-size: 16px; font-weight: 400; letter-spacing: .04em; font-family: 'Surfquest', Impact, sans-serif; color: var(--cc) !important; }
.ix .c-over { position: absolute; left: 0; right: 0; bottom: 0; padding: 26px 9px 8px; background: linear-gradient(0deg, rgba(5,9,18,.95), rgba(5,9,18,.55) 60%, transparent); font-size: 13px; line-height: 1; letter-spacing: .1em; color: #fff !important; }
.ix .c-big { font-size: 24px; line-height: .9; flex-shrink: 0; color: var(--cc) !important; } .ix .c-big.none { display: none; }
.ix .c-ul { display: flex; height: 3px; gap: 2px; margin-top: 5px; } .ix .c-ul span { flex: 1; background: var(--k); max-width: 36px; }
.ix .c-vline { display: grid; grid-template-columns: 3px 1fr; gap: 8px; margin-top: 6px; } .ix .c-vline .v { display: flex; flex-direction: column; gap: 2px; } .ix .c-vline .v span { flex: 1; background: var(--k); }
.ix .c-spine { border-left: 4px solid var(--sc); }
.ix .c-code { position: absolute; top: 0; left: 0; width: 30px; height: 30px; z-index: 2; display: flex; align-items: center; justify-content: center; background: #fff; color: #06122e !important; font-size: 20px; line-height: 1; padding-top: 2px; }
/* D : ruban en coin en bannieres pleines */
.ix .d-rib { position: absolute; top: 10px; left: -7px; display: grid; gap: 4px; justify-items: start; z-index: 2; filter: drop-shadow(2px 3px 0 rgba(0,0,0,.45)); }
.ix .d-ban { position: relative; min-width: 66px; padding: 5px 14px 4px 11px; font: 900 11px/1 system-ui; letter-spacing: .14em; text-transform: uppercase; color: var(--t) !important; background: var(--b); }
.ix .d-ban.fish { clip-path: polygon(0 0, 100% 0, calc(100% - 8px) 50%, 100% 100%, 0 100%); padding-right: 18px; }
.ix .d-ban.fold::before { content: ''; position: absolute; left: 0; bottom: -6px; width: 7px; height: 6px; background: var(--f); clip-path: polygon(0 0, 100% 0, 100% 100%); }
.ix .d-ban.wht { background: #fff; color: #06122e !important; padding-left: 15px; } .ix .d-ban.wht::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--b); }
.ix .d-ban.sqf { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 14px; letter-spacing: .06em; padding: 5px 14px 3px 11px; }
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
const lite = (k: K, c: PC) => (k === 'num' && numTier(c.num) !== 'std' ? TIERC[numTier(c.num)] : mix(TAG_BASE[k], 0.45))
const long = (k: K, c: PC) => (k === 'rc' ? 'Rookie' : k === 'auto' ? 'Autographe' : k === 'patch' ? 'Patch' : numShort(c.num) || 'Num')
const short = (k: K, c: PC) => (k === 'rc' ? 'RC' : k === 'auto' ? 'Auto' : k === 'patch' ? 'Patch' : numShort(c.num) || 'Num')
const topKind = (c: PC): K | null => { const ks = kinds(c); if (ks.includes('num') && numTier(c.num) !== 'std') return 'num'; if (ks.includes('auto')) return 'auto'; if (ks.includes('patch')) return 'patch'; if (ks.includes('num')) return 'num'; if (ks.includes('rc')) return 'rc'; return null }
const tierVars = (c: PC): CSSProperties => { const t = numTier(c.num); return { ['--cc' as string]: t === 'std' ? '#8fb4ff' : TIERC[t], ['--cg' as string]: TIERG[t] } as CSSProperties }
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>
const digits = (c: PC) => (c.num ? (c.num.startsWith('/') ? c.num.slice(1) : c.num.split('/')[1] || c.num) : '')
type Slots = { over?: React.ReactNode; mid?: React.ReactNode; tx?: React.ReactNode; style?: CSSProperties; cls?: string; nm?: React.ReactNode; after?: React.ReactNode }
const Card = ({ c, over, mid, tx, style, cls, nm, after }: { c: PC } & Slots) => (
  <div className={`iq ${cls || ''}`} style={style}>
    <div className="ph"><img className="im" src={c.img} alt="" />{over}</div>{mid}
    <div className="bar" style={{ ['--tc' as string]: c.tc }} />
    {tx ?? <div className="tx"><div className="nm"><span className="t">{c.n}</span>{nm}<Ic /></div><div className="st">{c.s}</div>{after}</div>}
  </div>
)
const Row = ({ children }: { children: React.ReactNode }) => <div className="iq-row">{children}</div>
const words = (c: PC, f: (k: K) => string, sep: React.ReactNode) => kinds(c).map((k, i) => <React.Fragment key={k}>{i > 0 && sep}<b style={{ color: lite(k, c), fontWeight: 900 }}>{f(k)}</b></React.Fragment>)

const dBan = (k: K, c: PC): CSSProperties => {
  const t = numTier(c.num)
  const rare = k === 'num' && t !== 'std'
  return { ['--b' as string]: rare ? RARE_FX[t as 'gold' | 'silver' | 'bronze'].bg : TAG_BASE[k], ['--t' as string]: rare ? RARE_FX[t as 'gold' | 'silver' | 'bronze'].fg : '#fff', ['--f' as string]: rare ? '#6b4a00' : mix(TAG_BASE[k], -0.55) } as CSSProperties
}
const Dr = ({ c, cls, nm }: { c: PC; cls?: string; nm?: boolean }) => (
  <div className="d-rib">{kinds(c).map(k => <span key={k} className={`d-ban ${cls || ''}`} style={dBan(k, c)}>{nm ? long(k, c) : short(k, c)}</span>)}</div>
)
type Idea = { group: string; title: string; desc: string; render: (c: PC) => React.ReactNode }
const IDEAS: Idea[] = [
  { group: 'D · Ruban en coin en bannières', title: 'Bannières pleines, bout droit (le 01 sans transparence)', desc: 'Même ruban en coin que l\'idée 01 de la série précédente, mais chaque atout est une bannière pleine et opaque dans sa couleur franche (orange, vert, bleu, violet, or pour un tirage rare), texte blanc en capitales, largeur identique, ombre portée. Plus aucune pastille teintée ni transparente.', render: c => <Card c={c} over={<Dr c={c} />} /> },
  { group: 'D · Ruban en coin en bannières', title: 'Bannières en queue d\'hirondelle', desc: 'Les mêmes bannières pleines mais avec le bout droit échancré en V comme un vrai ruban. Un peu plus de caractère, toujours net et opaque.', render: c => <Card c={c} over={<Dr c={c} cls="fish" />} /> },
  { group: 'D · Ruban en coin en bannières', title: 'Bannières avec pli (ruban qui s\'enroule derrière l\'image)', desc: 'Chaque bannière dépasse à gauche du cadre avec un petit pli plus foncé en dessous, comme un ruban qui passe derrière la carte. L\'effet de volume reste sobre et très reconnaissable.', render: c => <Card c={c} over={<Dr c={c} cls="fold" />} /> },
  { group: 'D · Ruban en coin en bannières', title: 'Bannières blanches avec un bloc de couleur à gauche', desc: 'Dans l\'esprit des repères blancs du site : bannière blanche pleine, texte marine, avec un bloc de 6 px de la couleur de l\'atout sur son bord gauche. Moins de couleur vive, plus de DA.', render: c => <Card c={c} over={<Dr c={c} cls="wht" />} /> },
  { group: 'D · Ruban en coin en bannières', title: 'Bannières pleines en Surfquest, mots en toutes lettres', desc: 'Les bannières pleines passent en Surfquest 14 px avec les mots en entier (ROOKIE, AUTOGRAPHE, PATCH, /25) : plus larges, plus lisibles de loin, plus DA. Elles couvrent un peu plus de l\'image.', render: c => <Card c={c} over={<Dr c={c} cls="sqf" nm />} /> },

  { group: 'A · Typographique', title: 'Les atouts écrits en couleur sous le nom (idée gardée)', desc: 'Aucune pastille : une ligne de petites capitales sous le set, chaque mot dans sa couleur, séparés par des points. La plus légère, et très lisible en grille dense.', render: c => <Card c={c} after={kinds(c).length ? <div className="a-ty">{words(c, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { group: 'A · Typographique', title: 'Déclinaison : petits carrés de couleur + texte blanc', desc: 'Le texte reste blanc (sobre) et seule la couleur de l\'atout vient d\'un petit carré plein de 7 px devant chaque mot. Le code couleur est là sans colorer le texte.', render: c => <Card c={c} after={kinds(c).length ? <div className="a-sqr">{kinds(c).map(k => <span key={k} style={{ ['--k' as string]: solid(k, c) } as CSSProperties}>{short(k, c)}</span>)}</div> : undefined} /> },
  { group: 'A · Typographique', title: 'Déclinaison : sur la ligne du set, alignés à droite', desc: 'Pas de ligne en plus : l\'année / set à gauche et les atouts à droite sur la même ligne, en petites capitales colorées. La vignette ne grandit pas du tout.', render: c => <Card c={c} tx={<div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div><div className="a-line"><div className="st">{c.s}</div><div className="r">{words(c, k => short(k, c), <i>·</i>)}</div></div></div>} /> },
  { group: 'A · Typographique', title: 'Déclinaison : en Surfquest 15 px', desc: 'La même ligne mais en Surfquest plus gros (15 px) : plus de personnalité DA, et le tirage (/25, 1/1) se lit mieux. Couleurs adoucies.', render: c => <Card c={c} after={kinds(c).length ? <div className="a-sf sq">{words(c, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { group: 'A · Typographique', title: 'Déclinaison : tout blanc, séparé par des traits fins', desc: 'Le plus sobre : tout en blanc, séparé par des filets verticaux d\'un pixel (« RC | AUTO | /25 »). Seul le tirage garde sa couleur de rareté. Aucun code couleur à apprendre.', render: c => <Card c={c} after={kinds(c).length ? <div className="a-mono">{kinds(c).map((k, i) => <React.Fragment key={k}>{i > 0 && <i>|</i>}<b style={k === 'num' && numTier(c.num) !== 'std' ? { color: TIERC[numTier(c.num)] } : { color: '#fff' }}>{short(k, c)}</b></React.Fragment>)}</div> : undefined} /> },

  { group: 'B · Filigrane', title: 'Mot géant en lettres creuses au bas de l\'image (idée gardée)', desc: 'L\'atout principal en très gros, en contour seul, au bas de l\'image (« AUTO », « RC »…). Très graphique, on voit la carte à travers.', render: c => { const k = topKind(c); return <Card c={c} over={k ? <div className="b-wm sq" style={{ ['--wc' as string]: solid(k, c) } as CSSProperties}>{short(k, c)}</div> : undefined} /> } },
  { group: 'B · Filigrane', title: 'Déclinaison : deux filigranes, l\'atout à gauche et le tirage à droite', desc: 'L\'atout principal en lettres creuses de 40 px à gauche, et le chiffre du tirage en 76 px à droite avec un halo à la couleur de la rareté (25, 99, 1). Les deux informations les plus précieuses, en deux gestes.', render: c => { const k = topKind(c); return <Card c={c} over={<>{k && <div className="l sq" style={{ ['--wc' as string]: solid(k, c) } as CSSProperties}>{short(k, c)}</div>}{c.num && <div className="rr sq" style={tierVars(c)}>{digits(c)}</div>}</>} cls="b-two" /> } },
  { group: 'B · Filigrane', title: 'Déclinaison : mot vertical géant sur le bord droit', desc: 'Le mot est écrit à la verticale, en creux, le long du bord droit de l\'image : comme un titre de tranche. Laisse le bas de la carte (souvent le nom imprimé) parfaitement libre.', render: c => { const k = topKind(c); return <Card c={c} over={k ? <div className="b-vert sq" style={{ ['--wc' as string]: solid(k, c) } as CSSProperties}><span>{short(k, c)}</span></div> : undefined} /> } },
  { group: 'B · Filigrane', title: 'Déclinaison : mot plein translucide, sans contour', desc: 'Même position mais en blanc translucide fondu dans l\'image (mode superposition), sans contour : encore plus discret, presque un tatouage de la photo. Aucune couleur.', render: c => { const k = topKind(c); return <Card c={c} over={k ? <div className="b-fill sq">{short(k, c)}</div> : undefined} /> } },
  { group: 'B · Filigrane', title: 'Déclinaison : seul le chiffre du tirage, en géant', desc: 'Uniquement pour les cartes numérotées : le chiffre du tirage (25, 99, 1) en 110 px creux, au bas de l\'image, avec le halo de rareté. Les cartes non numérotées restent nues. Le plus impactant pour les pièces rares.', render: c => <Card c={c} over={c.num ? <div className="b-num sq" style={tierVars(c)}>{digits(c)}</div> : undefined} /> },

  { group: 'C · Sobre', title: 'Étiquette blanche pleine collée dans le coin de l\'image', desc: 'Un petit bloc blanc plein (texte marine en Surfquest) collé au coin bas gauche de l\'image, comme les repères blancs du reste du site, avec le tirage en bloc doré / argent collé au coin opposé. Net, DA, sans effet.', render: c => <Card c={c} over={<>{kinds(c).filter(k => k !== 'num').length > 0 && <div className="c-w bl sq">{kinds(c).filter(k => k !== 'num').map(k => short(k, c)).join(' · ')}</div>}{c.num && <div className="c-g sq" style={tierVars(c)}>{numShort(c.num)}</div>}</>} /> },
  { group: 'C · Sobre', title: 'Même étiquette blanche, en haut à gauche, un seul bloc', desc: 'Un seul bloc blanc en haut à gauche contenant tout (« AUTO · PATCH · /25 »), collé aux deux bords comme le bloc de date de la carte du jour. Les cartes sans atout n\'ont rien.', render: c => <Card c={c} over={kinds(c).length ? <div className="c-w tl sq">{kinds(c).map(k => short(k, c)).join(' · ')}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Boîte à filet fin avec séparateurs (« RC | AUTO | /25 »)', desc: 'Une petite boîte transparente à filet blanc d\'un pixel, en haut à gauche de l\'image, avec des séparateurs fins entre chaque atout. Le style des boutons de la galerie, sans aucune couleur.', render: c => <Card c={c} over={kinds(c).length ? <div className="c-box">{kinds(c).map(k => <span key={k}>{short(k, c)}</span>)}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Bande basse fine sous l\'image : atouts à gauche, tirage à droite', desc: 'Une bande marine de 22 px entre l\'image et la barre d\'équipe, filet blanc en haut : les atouts en petites capitales espacées à gauche, le tirage en Surfquest à droite (doré, argent ou bleu selon la rareté). Les cartes sans atout n\'ont pas de bande.', render: c => <Card c={c} mid={kinds(c).length ? <div className="c-band" style={tierVars(c)}><span>{kinds(c).filter(k => k !== 'num').map(k => short(k, c)).join(' · ')}</span>{c.num && <b>{numShort(c.num)}</b>}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Texte blanc fin posé sur un dégradé au bas de l\'image', desc: 'Une seule ligne en Surfquest blanc 13 px sur un dégradé sombre au bas de l\'image : « AUTO · PATCH · /25 ». Aucun cadre, aucune couleur : la lecture la plus calme, intégrée à la photo.', render: c => <Card c={c} over={kinds(c).length ? <div className="c-over sq">{kinds(c).map(k => short(k, c)).join(' · ')}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Le tirage en grand à droite du nom', desc: 'Le tirage devient un chiffre Surfquest de 24 px à droite du nom (couleur selon la rareté : or, argent, bronze, bleu), et les autres atouts restent en petites capitales sous le set. Met le tirage en valeur sans rien ajouter à l\'image.', render: c => <Card c={c} nm={c.num ? <span className="c-big sq" style={tierVars(c)}>{numShort(c.num)}</span> : undefined} after={kinds(c).filter(k => k !== 'num').length ? <div className="a-ty">{words({ ...c, num: undefined }, k => short(k, c), <i>·</i>)}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Soulignement du nom en segments de couleur', desc: 'Aucun texte : sous le nom, un petit trait de 3 px découpé en un segment par atout (orange, vert, bleu, violet). Au survol on afficherait les noms. Le plus discret des codes couleur.', render: c => <Card c={c} after={kinds(c).length ? <div className="c-ul">{kinds(c).map(k => <span key={k} style={{ ['--k' as string]: solid(k, c) } as CSSProperties} />)}</div> : undefined} /> },
  { group: 'C · Sobre', title: 'Filet vertical segmenté à gauche des textes', desc: 'Un filet de 3 px à gauche du set, divisé en segments de couleur, et les atouts en capitales blanches à côté, comme une citation. Structure la zone de texte sans la gonfler.', render: c => <Card c={c} tx={<div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div>{kinds(c).length ? <div className="c-vline"><div className="v">{kinds(c).map(k => <span key={k} style={{ ['--k' as string]: solid(k, c) } as CSSProperties} />)}</div><div><div className="st" style={{ marginTop: 0 }}>{c.s}</div><div className="a-mono" style={{ marginTop: 3 }}>{kinds(c).map((k, i) => <React.Fragment key={k}>{i > 0 && <i>|</i>}<b>{short(k, c)}</b></React.Fragment>)}</div></div></div> : <div className="st">{c.s}</div>}</div>} /> },
  { group: 'C · Sobre', title: 'Liseré épais sur le bord gauche de toute la vignette', desc: 'Un trait de 4 px sur tout le bord gauche de la vignette, à la couleur de l\'atout principal (vert pour un auto, bleu patch, orange RC, doré 1/1), avec les atouts typographiques dessous. Pas un pixel de plus au contenu.', render: c => { const k = topKind(c); return <Card c={c} cls={k ? 'c-spine' : ''} style={k ? ({ ['--sc' as string]: solid(k, c) } as CSSProperties) : undefined} after={kinds(c).length ? <div className="a-ty">{words(c, k2 => short(k2, c), <i>·</i>)}</div> : undefined} /> } },
  { group: 'C · Sobre', title: 'Une lettre dans un carré blanc plein au coin (A · R · P · #)', desc: 'Un carré blanc de 30 px collé au coin haut gauche avec une seule lettre marine en Surfquest : A pour Auto, P pour Patch, R pour RC, # pour le tirage (la plus précieuse seulement). Minimal et reconnaissable à l\'usage.', render: c => { const k = topKind(c); return <Card c={c} over={k ? <div className="c-code sq">{k === 'rc' ? 'R' : k === 'auto' ? 'A' : k === 'patch' ? 'P' : '#'}</div> : undefined} /> } },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 36 · Atouts sobres</h1>
      <p className="lead">Épuré, sobre, efficace, dans la DA : angles droits, filets fins, blanc, Surfquest, un peu de couleur seulement quand elle aide. Le groupe D reprend le ruban en coin (01) avec des bannières pleines opaques au lieu de pastilles transparentes (5 variantes). Le groupe A garde l&apos;idée « typographique » (27) avec 4 déclinaisons, le groupe B garde le « filigrane » (23) avec 4 déclinaisons, le groupe C apporte 10 idées nouvelles. Chaque idée est montrée sur 4 cartes types : RC, auto-patch /25, patch /99, RC-auto 1/1.</p>
      <nav className="tags">{IDEAS.map((t, i) => <a key={t.title} href={`#i${i + 1}`}>{String(i + 1).padStart(2, '0')}</a>)}</nav>

      <Bay id="i0" n="00" title="Aujourd'hui, pour comparer" desc="Les pastilles teintées dans une rangée sous le nom : elles allongent la vignette et sont loin de la carte qu'elles qualifient."><Row>
        {PCS.map(c => <div key={c.n} className="iq iq-old"><img className="im" src={c.img} alt="" /><div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div><div className="st">{c.s}</div><div style={{ marginTop: 6 }}><CardTags rc={c.rc} auto={c.auto} patch={c.patch} num={c.num} size="sm" /></div></div></div>)}
      </Row></Bay>

      {IDEAS.map((d, i) => (
        <Bay key={d.title} id={`i${i + 1}`} n={String(i + 1).padStart(2, '0')} title={`${d.group} — ${d.title}`} desc={d.desc}><Row>{PCS.map(c => <React.Fragment key={c.n}>{d.render(c)}</React.Fragment>)}</Row></Bay>
      ))}
    </div>
  )
}
