'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 43 : pages /setlist (liste et detail).

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

/* serie 43 : ameliorations de /setlist (liste L1-L9) et d'une setlist (detail D1-D8), prefixe s3- */
.ix .s3 { max-width: 1000px; }
.ix .s3 * { box-sizing: border-box; }
.ix .s3 .box { border: 3px solid rgba(255,255,255,.85); background: linear-gradient(135deg,#050912 0%,#08153b 60%,#0a2468 100%); }
.ix .s3 .sec { font: 800 11px system-ui; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.6); margin: 0 0 8px; }
.ix .s3 .sf2 { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ix .s3 .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 900px) { .ix .s3 .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.ix .s3 .tile { border: 2px solid rgba(255,255,255,.7); background: #0a1330; display: flex; flex-direction: column; min-width: 0; }
.ix .s3 .tile .th { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 10px; background: var(--c); color: #fff; font: 800 10px system-ui; letter-spacing: .14em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
.ix .s3 .tile .tb { padding: 10px 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.ix .s3 .tile .nm { font: 400 22px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; }
.ix .s3 .tile .pc { font: 400 44px/.9 'Surfquest', Impact, sans-serif; color: var(--c); }
.ix .s3 .tile .pc small { font-size: 18px; }
.ix .s3 .tile .ft { font: 700 11px system-ui; opacity: .75; }
.ix .s3 .seg { display: grid; grid-template-columns: repeat(20, 1fr); gap: 2px; height: 8px; }
.ix .s3 .seg i { background: rgba(255,255,255,.14); } .ix .s3 .seg i.on { background: var(--c); }
.ix .s3 .bar { height: 8px; background: rgba(255,255,255,.14); } .ix .s3 .bar i { display: block; height: 100%; background: var(--c); }
.ix .s3 .chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ix .s3 .chip { padding: 8px 14px; border: 2px solid rgba(255,255,255,.55); font: 800 12px system-ui; letter-spacing: .08em; text-transform: uppercase; background: transparent; color: #fff; }
.ix .s3 .chip.on { background: #fff; color: #06122e; } .ix .s3 .chip em { font-style: normal; opacity: .65; margin-left: 6px; }
.ix .s3 .btn2 { display: inline-block; padding: 10px 16px; background: #fff; color: #06122e; border: 3px solid #fff; font: 800 12px system-ui; letter-spacing: .1em; text-transform: uppercase; }
.ix .s3 .btn2.o { background: transparent; color: #fff; }
.ix .s3 .hero { display: grid; grid-template-columns: auto 1fr; gap: 26px; align-items: center; padding: 22px 26px; }
.ix .s3 .ring { width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(#3ddc97 calc(var(--p) * 1%), rgba(255,255,255,.14) 0); display: grid; place-items: center; }
.ix .s3 .ring > div { width: 118px; height: 118px; border-radius: 50%; background: #08153b; display: grid; place-items: center; text-align: center; }
.ix .s3 .ring b { font: 400 40px/1 'Surfquest', Impact, sans-serif; } .ix .s3 .ring small { display: block; font: 700 10px system-ui; letter-spacing: .14em; opacity: .7; }
.ix .s3 .sp { display: grid; gap: 8px; } .ix .s3 .sp > div { display: grid; grid-template-columns: 70px 1fr 44px; gap: 10px; align-items: center; font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; }
@media (max-width: 700px) { .ix .s3 .hero { grid-template-columns: 1fr; justify-items: center; } .ix .s3 .sp { width: 100%; } }
.ix .s3 .years { display: flex; gap: 6px; align-items: flex-end; height: 120px; overflow-x: auto; padding: 4px 2px 0; }
.ix .s3 .yr { flex: 0 0 46px; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 4px; font: 800 10px system-ui; }
.ix .s3 .yr .col { width: 100%; background: var(--c); height: calc(var(--p) * 1% + 6px); } .ix .s3 .yr.on .col { outline: 3px solid #fff; outline-offset: 2px; }
.ix .s3 .heat { display: grid; grid-template-columns: repeat(16, 1fr); gap: 4px; } .ix .s3 .heat i { aspect-ratio: 1; background: var(--c); opacity: var(--o, 1); border: 1px solid rgba(255,255,255,.2); }
.ix .s3 .next { display: grid; gap: 10px; } .ix .s3 .nx { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; border: 2px solid rgba(255,255,255,.5); background: rgba(255,255,255,.04); }
.ix .s3 .nx b { font: 400 22px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; } .ix .s3 .nx span.t { font: 700 12px system-ui; opacity: .75; }
.ix .s3 table { width: 100%; border-collapse: collapse; } .ix .s3 th { text-align: left; font: 800 10px system-ui; letter-spacing: .14em; text-transform: uppercase; opacity: .6; padding: 8px 10px; border-bottom: 2px solid rgba(255,255,255,.3); }
.ix .s3 td { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.14); font: 600 13px system-ui; vertical-align: middle; } .ix .s3 td.n { font: 400 18px 'Surfquest', Impact, sans-serif; text-transform: uppercase; }
.ix .s3 td .bar { min-width: 90px; }
.ix .s3 .steps { display: grid; grid-template-columns: repeat(3, 1fr); } .ix .s3 .steps > div { padding: 14px 16px; border-right: 2px solid rgba(255,255,255,.25); } .ix .s3 .steps > div:last-child { border-right: 0; }
.ix .s3 .steps b { display: block; font: 400 44px/.9 'Surfquest', Impact, sans-serif; } .ix .s3 .steps small { font: 800 10px system-ui; letter-spacing: .12em; text-transform: uppercase; opacity: .8; } .ix .s3 .steps .k { font: 800 10px system-ui; letter-spacing: .16em; color: #3ddc97; margin-bottom: 4px; }
@media (max-width: 700px) { .ix .s3 .steps { grid-template-columns: 1fr; } .ix .s3 .steps > div { border-right: 0; border-bottom: 2px solid rgba(255,255,255,.25); } }
.ix .s3 .dh { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: stretch; }
@media (max-width: 700px) { .ix .s3 .dh { grid-template-columns: 1fr; } }
.ix .s3 .dh .big { padding: 18px 22px; } .ix .s3 .dh h4 { margin: 0; font: 400 clamp(34px,5vw,56px)/.95 'Surfquest', Impact, sans-serif; text-transform: uppercase; }
.ix .s3 .kp { display: flex; flex-wrap: wrap; margin-top: 12px; } .ix .s3 .kp > div { padding: 6px 18px 6px 0; margin-right: 18px; border-right: 2px solid rgba(255,255,255,.25); } .ix .s3 .kp > div:last-child { border-right: 0; }
.ix .s3 .kp b { display: block; font: 400 30px/1 'Surfquest', Impact, sans-serif; } .ix .s3 .kp small { font: 800 10px system-ui; letter-spacing: .12em; text-transform: uppercase; opacity: .7; }
.ix .s3 .cells { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 5px; }
.ix .s3 .cell { aspect-ratio: 1; display: grid; place-items: center; font: 800 12px system-ui; border: 2px solid rgba(255,255,255,.35); position: relative; }
.ix .s3 .cell.own { background: #3ddc97; border-color: #3ddc97; color: #04230f; } .ix .s3 .cell.rc::after { content: 'RC'; position: absolute; right: -2px; top: -2px; background: #ff9d3d; color: #1a0e00; font: 900 7px system-ui; padding: 1px 3px; }
.ix .s3 .rows { display: grid; } .ix .s3 .row { display: grid; grid-template-columns: 56px 1fr auto; gap: 14px; align-items: center; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.16); }
.ix .s3 .row.nt { grid-template-columns: 1fr auto; }
.ix .s3 .row .th2 { width: 56px; aspect-ratio: 2.5/3.5; background: rgba(255,255,255,.06); border: 2px dashed rgba(255,255,255,.35); display: grid; place-items: center; font: 400 22px 'Surfquest', Impact, sans-serif; opacity: .8; overflow: hidden; } .ix .s3 .row .th2 img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ix .s3 .row.own .th2 { border: 2px solid #3ddc97; opacity: 1; } .ix .s3 .row b { font: 400 22px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; display: block; } .ix .s3 .row span.t { font: 600 12px system-ui; opacity: .7; }
.ix .s3 .pill { display: inline-block; padding: 5px 10px; border: 2px solid rgba(255,255,255,.6); font: 800 10px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .s3 .pill.g { background: #3ddc97; border-color: #3ddc97; color: #04230f; }
.ix .s3 .sticky { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 16px; background: #fff; color: #06122e; margin-top: 12px; font: 800 13px system-ui; flex-wrap: wrap; }
.ix .s3 .sticky .btn2 { background: #06122e; border-color: #06122e; color: #fff; }
.ix .s3 .grp { font: 400 20px 'Surfquest', Impact, sans-serif; text-transform: uppercase; padding: 8px 14px; background: rgba(255,255,255,.1); display: flex; justify-content: space-between; align-items: baseline; } .ix .s3 .grp small { font: 800 10px system-ui; letter-spacing: .12em; opacity: .7; }
.ix .s3 .ms { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; } .ix .s3 .m { border: 2px solid rgba(255,255,255,.4); padding: 14px 10px; text-align: center; opacity: .55; } .ix .s3 .m.on { opacity: 1; border-color: #ffd54a; box-shadow: 0 0 16px rgba(255,213,74,.35); }
.ix .s3 .m b { display: block; font: 400 34px/1 'Surfquest', Impact, sans-serif; } .ix .s3 .m small { font: 800 10px system-ui; letter-spacing: .12em; text-transform: uppercase; }
@media (max-width: 700px) { .ix .s3 .ms { grid-template-columns: repeat(2, 1fr); } }
.ix .s3 .poster { max-width: 420px; padding: 20px; text-align: center; border: 3px solid #fff; background: linear-gradient(160deg,#050912,#003da6); } .ix .s3 .poster h5 { margin: 0 0 4px; font: 400 36px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; } .ix .s3 .poster ul { list-style: none; padding: 0; margin: 14px 0; text-align: left; font: 700 13px system-ui; } .ix .s3 .poster li { padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,.2); display: flex; justify-content: space-between; }
`
const Bay43 = ({ id, n, title, desc, children }: { id: string; n: string; title: string; desc: string; children: React.ReactNode }) => (
  <section className="bay" id={id}>
    <span className="eyebrow">{n}</span>
    <h2 className="sf">{title}</h2>
    <p className="d">{desc}</p>
    <div className="stage"><div className="s3">{children}</div></div>
  </section>
)
type SS = { n: string; y: string; b: string; t: number; o: number }
const SETS: SS[] = [
  { n: 'Prizm', y: '2023-24', b: 'Panini', t: 750, o: 612 },
  { n: 'Hoops', y: '2023-24', b: 'Panini', t: 300, o: 288 },
  { n: 'Donruss Optic', y: '2022-23', b: 'Panini', t: 200, o: 91 },
  { n: 'Topps Chrome', y: '2021-22', b: 'Topps', t: 150, o: 150 },
  { n: 'Select', y: '2020-21', b: 'Panini', t: 300, o: 47 },
  { n: 'Skybox', y: '1995-96', b: 'Fleer/Skybox', t: 331, o: 12 },
  { n: 'Upper Deck', y: '1991-92', b: 'Upper Deck', t: 500, o: 0 },
  { n: 'Fleer', y: '1988-89', b: 'Fleer', t: 132, o: 121 },
]
const pc = (s: SS) => Math.round((s.o / s.t) * 100)
const colOf = (p: number) => (p >= 100 ? '#ffd54a' : p >= 80 ? '#3ddc97' : p >= 40 ? '#ff9d3d' : p > 0 ? '#4aa3ff' : '#6b7794')
const cv = (c: string) => ({ ['--c' as string]: c }) as CSSProperties
const Seg = ({ p }: { p: number }) => <div className="seg">{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.round(p / 5) ? 'on' : ''} />)}</div>
const Tile = ({ s, mode = 'seg' }: { s: SS; mode?: 'seg' | 'bar' }) => {
  const p = pc(s); const c = colOf(p)
  return (
    <div className="tile" style={cv(c)}>
      <div className="th"><span>{s.y}</span><span>{p >= 100 ? '★ Complète' : s.b}</span></div>
      <div className="tb">
        <div className="nm">{s.n}</div>
        <div className="pc">{p}<small>%</small></div>
        {mode === 'seg' ? <Seg p={p} /> : <div className="bar"><i style={{ width: p + '%' }} /></div>}
        <div className="ft">{s.o} / {s.t} · {s.t - s.o === 0 ? 'rien à chercher' : `il en manque ${s.t - s.o}`}</div>
      </div>
    </div>
  )
}
const Grid43 = ({ list, mode }: { list: SS[]; mode?: 'seg' | 'bar' }) => <div className="grid">{list.map(s => <Tile key={s.n} s={s} mode={mode} />)}</div>
const Chips = ({ items }: { items: [string, number | string, boolean][] }) => <div className="chips" style={{ marginBottom: 14 }}>{items.map(x => <span key={x[0]} className={'chip' + (x[2] ? ' on' : '')}>{x[0]}<em>{x[1]}</em></span>)}</div>

const HEAT = [0, 4, 12, 20, 33, 52, 70, 91, 100, 45, 82, 61]
const SPORTS: [string, number, string][] = [['NBA', 62, '#3ddc97'], ['NFL', 31, '#ff9d3d'], ['Baseball', 12, '#4aa3ff'], ['Hockey', 0, '#6b7794']]
const YEARS: [string, number][] = [['91', 0], ['92', 4], ['95', 12], ['96', 20], ['00', 33], ['09', 52], ['15', 70], ['20', 16], ['21', 100], ['22', 45], ['23', 82], ['24', 61]]

const LIST: [string, string, React.ReactNode][] = [
  ['Tuile « album » : gros pourcentage et barre en 20 blocs', 'Chaque collection devient une tuile : bandeau de couleur (selon l\'avancement) avec l\'année et la marque, nom en Surfquest, gros pourcentage, barre découpée en 20 blocs de 5 % et phrase « il en manque N ». Plus lisible que la fine barre actuelle ; la couleur change avec la progression et passe à l\'or à 100 %.', <Grid43 list={SETS} />],
  ['Bandeau de synthèse : anneau de progression et avancement par sport', 'En tête de page, un bandeau avec un anneau de progression globale, le nombre de cartes validées, et une barre par sport. On voit tout de suite où l\'on en est avant de choisir une collection.', (
    <div className="box hero">
      <div className="ring" style={{ ['--p' as string]: 54 } as CSSProperties}><div><span><b>54%</b><small>GLOBAL</small></span></div></div>
      <div>
        <div className="sec">2 468 cartes validées · 8 setlists commencées</div>
        <div className="sp">{SPORTS.map(x => <div key={x[0]} style={cv(x[2])}><span>{x[0]}</span><div className="bar"><i style={{ width: x[1] + '%' }} /></div><b className="sf2" style={{ fontSize: 16 }}>{x[1]}%</b></div>)}</div>
      </div>
    </div>)],
  ['Raccourcis intelligents : presque complètes, en cours, à démarrer', 'Des onglets avec compteur au-dessus de la grille : « Presque finies (80 % et plus) », « En cours », « Pas commencées », « Complètes ». Un clic isole les collections utiles, sans passer par le tri.', (
    <>
      <Chips items={[['Toutes', 8, true], ['Presque finies', 2, false], ['En cours', 3, false], ['Pas commencées', 2, false], ['Complètes', 1, false]]} />
      <Grid43 list={SETS.filter(s => pc(s) >= 80)} mode="bar" />
    </>)],
  ['Frise des saisons : une colonne par année avec son avancement', 'Remplace la liste d\'années par une frise horizontale : chaque année est une colonne dont la hauteur et la couleur reflètent l\'avancement moyen. On repère d\'un coup d\'œil les saisons à compléter ; la saison choisie est entourée.', (
    <>
      <div className="years">{YEARS.map((x, i) => <div key={i} className={'yr' + (i === 10 ? ' on' : '')} style={cv(colOf(x[1]))}><div className="col" style={{ ['--p' as string]: x[1] } as CSSProperties} /><span>{x[0]}</span></div>)}</div>
      <p className="sec" style={{ marginTop: 14 }}>Saison 2023-24 · 2 collections · 82 % complétées</p>
      <Grid43 list={SETS.slice(0, 2)} mode="bar" />
    </>)],
  ['Carte thermique : toutes les collections d\'un coup d\'œil', 'Une mosaïque de petits carrés, un par collection, colorés selon l\'avancement (gris vide, bleu début, orange à mi-chemin, vert presque fini, or complet). Idéal pour les gros collectionneurs avec des centaines de sets ; survol = nom, clic = ouverture.', (
    <>
      <div className="heat">{Array.from({ length: 96 }, (_, i) => { const p = HEAT[(i * 7) % 12]; return <i key={i} style={{ ['--c' as string]: colOf(p), ['--o' as string]: p === 0 ? 0.4 : 1 } as CSSProperties} /> })}</div>
      <div className="chips" style={{ marginTop: 12 }}>{([['Vide', 0], ['moins de 40 %', 12], ['40 à 79 %', 52], ['80 % et plus', 90], ['100 %', 100]] as [string, number][]).map(x => <span key={x[0]} className="chip" style={{ borderColor: colOf(x[1]) }}>{x[0]}</span>)}</div>
    </>)],
  ['Bloc « Prochaines à finir » avec bouton wishlist', 'En haut de la page, les 3 collections les plus proches de la complétion avec le nombre de cartes manquantes et deux actions : voir les manquantes ou les ajouter d\'un coup à la wishlist. Motive à finir ce qui est presque fait.', (
    <div className="next">{SETS.filter(s => pc(s) < 100).sort((a, b) => (b.o / b.t) - (a.o / a.t)).slice(0, 3).map(s => <div key={s.n} className="nx" style={cv(colOf(pc(s)))}>
      <div><b>{s.y} {s.n}</b><div className="bar" style={{ margin: '8px 0 6px' }}><i style={{ width: pc(s) + '%' }} /></div><span className="t">{pc(s)} % · il manque {s.t - s.o} cartes</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className="btn2 o" style={{ padding: '8px 12px' }}>Voir</span><span className="btn2" style={{ padding: '8px 12px' }}>+ Wishlist</span></div>
    </div>)}</div>)],
  ['Filtre par marque en pastilles avec compteur', 'Une rangée de pastilles Panini, Topps, Upper Deck, Fleer… avec le nombre de collections. Plus rapide que la recherche texte pour naviguer par éditeur.', (
    <>
      <Chips items={[['Toutes', 8, false], ['Panini', 4, true], ['Topps', 1, false], ['Upper Deck', 1, false], ['Fleer', 2, false]]} />
      <Grid43 list={SETS.filter(s => s.b === 'Panini')} mode="bar" />
    </>)],
  ['Vue liste compacte (tableau) en alternative à la grille', 'Un bouton Grille / Liste. En liste : année, collection, barre, possédées / total et manquantes. Parfait pour trier et comparer des dizaines de collections.', (
    <>
      <div className="chips" style={{ marginBottom: 12 }}><span className="chip">Grille</span><span className="chip on">Liste</span></div>
      <table><thead><tr><th>Année</th><th>Collection</th><th>Avancement</th><th>Possédées</th><th>Manque</th></tr></thead>
        <tbody>{SETS.map(s => <tr key={s.n} style={cv(colOf(pc(s)))}><td>{s.y}</td><td className="n">{s.n}</td><td><div className="bar"><i style={{ width: pc(s) + '%' }} /></div></td><td>{s.o}/{s.t}</td><td>{s.t - s.o}</td></tr>)}</tbody></table>
    </>)],
  ['Synchronisation en 3 étapes lisibles', 'Remplace la barre de synchro par trois blocs : (1) Synchroniser, (2) nouvelles cartes validées, (3) cartes à placer. Chaque étape indique son état et son action.', (
    <div className="box steps">
      <div><div className="k">ÉTAPE 1</div><b>2 468</b><small>cartes validées</small><div style={{ marginTop: 10 }}><span className="btn2" style={{ padding: '8px 12px' }}>Synchroniser</span></div></div>
      <div><div className="k">ÉTAPE 2</div><b>+14</b><small>nouvelles cartes placées</small></div>
      <div><div className="k">ÉTAPE 3</div><b>9</b><small>cartes à placer à la main</small><div style={{ marginTop: 10 }}><span className="btn2 o" style={{ padding: '8px 12px' }}>Les placer →</span></div></div>
    </div>)],
]

const NAMES = ['Michael Jordan', 'Scottie Pippen', 'Hakeem Olajuwon', 'Charles Barkley', 'Shaquille O\'Neal', 'Kobe Bryant']
const TEAMS = ['Bulls', 'Bulls', 'Rockets', 'Suns', 'Magic', 'Lakers']
const IMGS = [C.mccain.img, C.edwards.img, C.hawkins.img, C.maxey.img, C.luwawu.img, C.mcw.img]
const Cells = ({ n, mod = 7, rc = 11 }: { n: number; mod?: number; rc?: number }) => <div className="cells">{Array.from({ length: n }, (_, i) => <span key={i} className={'cell' + ((i * 37) % mod < mod - 2 ? ' own' : '') + (i % rc === 3 ? ' rc' : '')}>{i + 1}</span>)}</div>
const DET: [string, string, React.ReactNode][] = [
  ['En-tête de setlist : pourcentage géant et indicateurs', 'Un grand titre en Surfquest, un anneau de pourcentage et des indicateurs : possédées, manquantes, RC, auto. Boutons d\'action directement dessous : ajouter les manquantes à la wishlist, copier la liste, imprimer.', (
    <div className="dh">
      <div className="box big">
        <div className="sec">2023-24 · Panini</div>
        <h4>Prizm</h4>
        <div className="kp"><div><b>612</b><small>possédées</small></div><div><b>138</b><small>manquantes</small></div><div><b>41</b><small>RC</small></div><div><b>12</b><small>auto</small></div></div>
        <div className="seg" style={{ ...cv('#3ddc97'), marginTop: 14, height: 10 }}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < 16 ? 'on' : ''} />)}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><span className="btn2">+ Manquantes en wishlist</span><span className="btn2 o">Copier</span><span className="btn2 o">Imprimer</span></div>
      </div>
      <div className="box" style={{ display: 'grid', placeItems: 'center', padding: '0 26px' }}><div className="ring" style={{ ['--p' as string]: 82 } as CSSProperties}><div><span><b>82%</b><small>COMPLÈTE</small></span></div></div></div>
    </div>)],
  ['Grille de cases numérotées : un carré par carte de la checklist', 'Au lieu d\'une longue liste, une grille de cases numérotées : pleine et verte si possédée, vide si manquante, pastille RC orange. On voit les trous d\'un regard ; un clic sur une case ouvre la carte ou l\'ajoute à la wishlist.', <Cells n={100} />],
  ['Onglets de variations avec avancement propre', 'Les variations (Base, Silver, Gold, Red /149…) deviennent des onglets avec leur pourcentage. La variation la plus avancée est mise en avant et les vides sont grisés.', (
    <>
      <Chips items={[['Base', '96%', true], ['Silver', '48%', false], ['Gold /10', '10%', false], ['Red /149', '3%', false], ['Black 1/1', '0%', false]]} />
      <Cells n={60} mod={12} />
    </>)],
  ['Manquantes regroupées par équipe avec barre d\'action collante', 'Mode « manquantes » : cartes regroupées par équipe avec leur nombre, et une barre fixe en bas : « 138 cartes manquantes · Tout ajouter à la wishlist ». Utile en convention ou chez un vendeur.', (
    <>
      <div className="grp"><span>Bulls</span><small>2 MANQUANTES</small></div>
      <div className="rows">{[0, 1].map(i => <div key={i} className="row nt"><div><b>{NAMES[i]}</b><span className="t">#{12 + i * 9} · Base</span></div><span className="pill">☆ Wishlist</span></div>)}</div>
      <div className="grp"><span>Lakers</span><small>1 MANQUANTE</small></div>
      <div className="rows"><div className="row nt"><div><b>{NAMES[5]}</b><span className="t">#8 · Silver</span></div><span className="pill">☆ Wishlist</span></div></div>
      <div className="sticky"><span>138 cartes manquantes</span><span className="btn2">Tout ajouter à la wishlist</span></div>
    </>)],
  ['Lignes avec vignette : votre carte si possédée, silhouette sinon', 'Chaque ligne affiche à gauche la vignette de VOTRE carte (cadre vert) si vous l\'avez, ou une case en pointillé avec un ? sinon. Le joueur, l\'équipe, le numéro et une action (wishlist ou voir ma carte) complètent la ligne.', (
    <div className="rows">{NAMES.slice(0, 5).map((n, i) => { const own = i % 3 !== 1; return (
      <div key={n} className={'row' + (own ? ' own' : '')}>
        <div className="th2">{own ? <img src={IMGS[i]} alt="" /> : '?'}</div>
        <div><b>{n}</b><span className="t">#{i + 1} · {TEAMS[i]}{i === 2 ? ' · RC' : ''}</span></div>
        {own ? <span className="pill g">Possédée ✓</span> : <span className="pill">☆ Wishlist</span>}
      </div>) })}</div>)],
  ['Paliers de progression : 25, 50, 75 et 100 %', 'Quatre paliers au-dessus de la liste, qui s\'allument à mesure qu\'on avance, avec le nombre de cartes restantes jusqu\'au suivant. Donne un objectif concret et se rattache au système de badges.', (
    <div className="ms">{([['25%', true, 'Débutant'], ['50%', true, 'À mi-chemin'], ['75%', true, 'Presque'], ['100%', false, 'Complète']] as [string, boolean, string][]).map(x => <div key={x[0]} className={'m' + (x[1] ? ' on' : '')}><b>{x[0]}</b><small>{x[2]}{x[1] ? ' ✓' : ' · encore 138'}</small></div>)}</div>)],
  ['Filtre par équipe en pastilles avec nombre de manquantes', 'Le menu déroulant des équipes devient une rangée de pastilles (Bulls, Lakers, Spurs…) avec le nombre de cartes manquantes pour chacune. Un clic filtre, on voit tout de suite quelle équipe est à compléter.', (
    <>
      <Chips items={[['Toutes', 138, true], ['Bulls', 12, false], ['Lakers', 9, false], ['Spurs', 7, false], ['Rockets', 5, false], ['Suns', 4, false], ['Magic', 3, false]]} />
      <Cells n={40} mod={4} />
    </>)],
  ['Affiche « il me manque » à partager', 'Génère une affiche propre (collection, pourcentage, liste des manquantes) à envoyer à un ami, poster sur un groupe ou garder dans le téléphone en convention. Bouton Partager / Enregistrer en image.', (
    <div className="poster"><div className="sec">Il me manque</div><h5>2023-24 Prizm</h5><div className="sf2" style={{ fontSize: 15, opacity: 0.8 }}>82 % · 138 cartes</div>
      <ul>{NAMES.slice(0, 5).map((n, i) => <li key={n}><span>#{12 + i * 7} {n}</span><span style={{ opacity: 0.7 }}>{TEAMS[i]}</span></li>)}</ul>
      <span className="btn2">Partager l&apos;affiche</span></div>)],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 43 · Pages setlist</h1>
      <p className="lead">Idées pour améliorer la page /setlist (liste des collections, L1 à L9) et la page d&apos;une setlist (liste des cartes, D1 à D8). Données d&apos;exemple, rien n&apos;est lu ni écrit. Dis-moi les numéros à garder ou à combiner.</p>
      <nav className="tags">{LIST.map((_, i) => <a key={i} href={`#l${i + 1}`}>L{i + 1}</a>)}{DET.map((_, i) => <a key={i} href={`#d${i + 1}`}>D{i + 1}</a>)}</nav>
      {LIST.map((d, i) => <Bay43 key={d[0]} id={`l${i + 1}`} n={`L${i + 1}`} title={d[0]} desc={d[1]}>{d[2]}</Bay43>)}
      {DET.map((d, i) => <Bay43 key={d[0]} id={`d${i + 1}`} n={`D${i + 1}`} title={d[0]} desc={d[1]}>{d[2]}</Bay43>)}
    </div>
  )
}
