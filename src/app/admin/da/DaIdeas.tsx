'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 7. Tout le style est ici, prefixe .ix.

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const C = {
  mccain: { nom: 'Jared McCain', img: SB + '1787763372857_recto.jpg' },
  edwards: { nom: 'Anthony Edwards', img: SB + '1784235265864_recto.jpg' },
  mcw: { nom: 'Michael Carter-Williams', img: SB + '1781875894817_recto.jpg' },
  maxey: { nom: 'Tyrese Maxey', img: SB + '1781291200820_recto.jpg' },
  hawkins: { nom: 'Hersey Hawkins', img: SB + '1781534889963_recto.jpg' },
  luwawu: { nom: 'Luwawu-Cabarrot', img: SB + 'csv_1790632470730_4f41x1.jpg' },
}
const ALL = [C.mccain, C.edwards, C.mcw, C.maxey, C.hawkins, C.luwawu]

const CSS = `
.ix { --el:#2f6bff; font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ix .ink, .ix .ink * { color: #06122e !important; }
.ix .wht, .ix .wht * { color: #fff !important; }
.ix h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.ix .lead { max-width: 740px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 30px; }
.ix .back { color:#fff; text-decoration:none; font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.ix .bay { margin: 0 0 54px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .bay h2 { font-size: clamp(28px,4.4vw,44px); margin: 14px 0 6px; line-height: 1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 700px; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,34px); position:relative; overflow:hidden; }
.ix .row { display:flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
.ix .cap { font: 700 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.55); margin-top: 10px; }
.ix .card { display:block; aspect-ratio: 2.5/3.5; object-fit: cover; border-radius: 0; box-shadow: 0 16px 36px rgba(0,0,0,.5); width:100%; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* 01 recherche naturelle */
.ix .sbar { display:flex; align-items:center; gap:10px; background:#0a1030; border: 3px solid #fff; padding: 12px 16px; max-width: 620px; font-size: 20px; }
.ix .sbar i { font-style: normal; opacity:.6; } .ix .sbar b { font-weight: 700; }
.ix .chips { display:flex; flex-wrap:wrap; gap: 8px; margin-top: 12px; }
.ix .chips span { background: var(--c); padding: 6px 12px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; display:inline-flex; align-items:center; gap:8px; }
.ix .chips span u { text-decoration:none; opacity:.7; cursor:pointer; }
.ix .res { margin-top: 16px; display:flex; gap: 10px; } .ix .res .card { width: 74px; box-shadow:none; }

/* 02 carte du jour : serie */
.ix .week { display:grid; grid-template-columns: repeat(7, 1fr); gap: 8px; max-width: 700px; }
.ix .wd { aspect-ratio: 2.5/3.5; position:relative; border: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.05); display:flex; align-items:center; justify-content:center; }
.ix .wd img { position:absolute; inset:0; height:100%; box-shadow:none; } .ix .wd.miss { border-style:dashed; } .ix .wd.today { border-color:#ffd54a; box-shadow: 0 0 16px rgba(255,213,74,.6); }
.ix .wd small { position:absolute; left:0; right:0; bottom:-22px; text-align:center; font: 800 10px system-ui; letter-spacing:.14em; opacity:.7; }
.ix .wd b { font-size: 34px; opacity:.4; }

/* 03 pochette de set */
.ix .setcov { width: 230px; background: linear-gradient(160deg,#0a2468,#003da6 60%,#08153b); border: 3px solid #fff; padding: 16px 14px 18px; box-shadow: 0 24px 50px rgba(0,0,0,.55); }
.ix .setcov .y { font: 800 11px system-ui; letter-spacing:.2em; text-transform:uppercase; } .ix .setcov h4 { margin: 6px 0 12px; font-size: 38px; line-height:.92; }
.ix .setcov .pic { display:grid; grid-template-columns: repeat(3,1fr); gap: 5px; } .ix .setcov .pic .card { box-shadow:none; }
.ix .setcov .bar { margin-top: 14px; height: 10px; background: rgba(255,255,255,.2); } .ix .setcov .bar i { display:block; height:100%; width: 34%; background:#fff; }
.ix .setcov .nb { display:flex; justify-content:space-between; margin-top: 6px; font: 800 11px system-ui; letter-spacing:.12em; }

/* 04 duel de cartes */
.ix .duel { display:flex; align-items:center; gap: 0; flex-wrap:wrap; }
.ix .duel .side { text-align:center; width: 170px; } .ix .duel .vs { width: 64px; height:64px; margin: 0 -10px; z-index:2; background:#fff; clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); display:flex; align-items:center; justify-content:center; font-size: 26px; color:#06122e !important; }
.ix .duel ul { list-style:none; padding:0; margin: 10px 0 0; font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .duel li { padding: 5px 0; border-top: 2px solid rgba(255,255,255,.18); display:flex; justify-content:space-between; }
.ix .duel li.w { color:#ffd54a !important; }

/* 05 barre de progression de collection */
.ix .goal { max-width: 640px; }
.ix .goal .top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 8px; } .ix .goal .big { font-size: 64px; line-height:.9; } .ix .goal .lb { font: 800 12px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.8; }
.ix .track { position:relative; height: 26px; background: rgba(255,255,255,.12); border: 3px solid #fff; padding: 3px; } .ix .track i { display:block; height:100%; background: repeating-linear-gradient(90deg, #2f6bff 0 14px, #1a47b8 14px 16px); width: 60%; }
.ix .miles { position:relative; height: 34px; margin-top: 6px; } .ix .miles span { position:absolute; transform: translateX(-50%); font: 800 10px system-ui; letter-spacing:.1em; opacity:.75; text-align:center; }
.ix .miles span::before { content:''; display:block; width:2px; height:8px; background:#fff; margin: 0 auto 3px; }

/* 06 pop report */
.ix .pop { display:grid; grid-template-columns: repeat(auto-fit, minmax(90px,1fr)); gap: 8px; max-width: 760px; align-items:end; height: 200px; }
.ix .pop div { display:flex; flex-direction:column; justify-content:flex-end; align-items:center; height:100%; font: 800 11px system-ui; letter-spacing:.1em; }
.ix .pop i { display:block; width: 100%; background: linear-gradient(180deg,#2f6bff,#0a2468); margin-bottom: 6px; border-top: 4px solid #fff; } .ix .pop b { font-size: 22px; line-height:1; margin-bottom: 4px; }

/* 07 carte de visite */
.ix .biz { display:flex; width: 360px; max-width:100%; background:#fff; box-shadow: 0 22px 44px rgba(0,0,0,.55); aspect-ratio: 1.75/1; border-left: 12px solid #003da6; }
.ix .biz .l { flex:1; padding: 14px 14px; display:flex; flex-direction:column; justify-content:space-between; } .ix .biz h4 { margin:0; font-size: 30px; line-height:.92; }
.ix .biz small { font: 800 9px system-ui; letter-spacing:.16em; text-transform:uppercase; } .ix .biz .qr { width: 66px; height:66px; background: repeating-conic-gradient(#06122e 0 25%, #fff 0 50%) 0 0 / 11px 11px; border: 4px solid #06122e; }
.ix .biz .cards { width: 92px; position:relative; margin-right: 10px; } .ix .biz .cards img { position:absolute; width: 62px; box-shadow: 0 6px 12px rgba(0,0,0,.4); }

/* 08 onglets en classeur tabs */
.ix .stk { position:relative; height: 270px; max-width: 520px; }
.ix .stk .pg { position:absolute; left:0; right:0; background: var(--c); border: 3px solid #fff; padding: 12px 16px; height: 230px; transition: transform .25s; }
.ix .stk .pg b { position:absolute; top: -26px; left: var(--x); background: var(--c); border: 3px solid #fff; border-bottom: 0; padding: 4px 12px; font: 800 11px system-ui; letter-spacing:.14em; text-transform:uppercase; }
.ix .stk .pg:hover { transform: translateY(-12px); }

/* 09 jauge de rarete */
.ix .rar { max-width: 560px; }
.ix .rar .row2 { display:flex; align-items:center; gap: 12px; padding: 8px 0; border-bottom: 2px solid rgba(255,255,255,.14); }
.ix .rar .nm { width: 130px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .rar .bar { flex:1; height: 14px; background: rgba(255,255,255,.12); } .ix .rar .bar i { display:block; height:100%; background: var(--c); }
.ix .rar .pc { width: 60px; text-align:right; font-size: 22px; }

/* 10 calendrier de sorties */
.ix .rel { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; max-width: 840px; }
.ix .rl { background: rgba(255,255,255,.07); border: 2px solid rgba(255,255,255,.2); display:flex; gap: 10px; padding: 10px; align-items:center; }
.ix .rl .dt { background:#fff; padding: 4px 8px; text-align:center; flex-shrink:0; } .ix .rl .dt, .ix .rl .dt * { color:#06122e !important; } .ix .rl .dt b { display:block; font-size: 28px; line-height:.9; } .ix .rl .dt small { font: 800 9px system-ui; letter-spacing:.14em; }
.ix .rl .nm { font: 800 12px system-ui; letter-spacing:.06em; text-transform:uppercase; line-height:1.2; } .ix .rl .nm span { display:block; font-weight:600; opacity:.7; letter-spacing:.04em; text-transform:none; font-size:11px; }
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

export default function DaIdeas() {
  const [q, setQ] = useState(0)
  const queries = [
    { t: 'num en dessous de 25', chips: [['≤ /25', '#7c3aed']] },
    { t: 'iguodala rc auto 2005', chips: [['RC', '#e67e22'], ['AUTO', '#2e7d32'], ['2005', '#2f6bff']] },
    { t: 'cartes à vendre plus de 50 €', chips: [['À vendre', '#1f9d55'], ['≥ 50 €', '#e9b44c']] },
  ]
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 7</h1>
      <p className="lead">Dix nouvelles pistes, tournées vers l&apos;usage : recherche en phrases, série de cartes du jour, pochette de set, duel, objectif de collection, pop report, carte de visite, classeur en onglets, rareté, calendrier de sorties. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Recherche en phrases', '02 Semaine de cartes', '03 Pochette de set', '04 Duel', '05 Objectif', '06 Pop report', '07 Carte de visite', '08 Pages empilées', '09 Rareté', '10 Sorties'].map((t, i) => <a key={t} href={`#p${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="p1" n="01 — Recherche en phrases" title="Les filtres compris s'affichent en puces retirables" desc="Tu tapes une phrase (« num en dessous de 25 », « iguodala rc auto 2005 ») : chaque critère compris devient une puce colorée qu'on retire d'un clic, et les cartes correspondantes apparaissent dessous. On voit exactement ce que le site a compris.">
        <div className="row" style={{ marginBottom: 12 }}>{queries.map((x, i) => <button key={x.t} onClick={() => setQ(i)} style={{ background: q === i ? '#fff' : 'transparent', color: q === i ? '#06122e' : '#fff', border: '2px solid #fff', padding: '6px 12px', font: '800 11px system-ui', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>Exemple {i + 1}</button>)}</div>
        <div className="sbar"><i>🔍</i><b>{queries[q].t}</b></div>
        <div className="chips">{queries[q].chips.map(c => <span key={c[0]} style={{ ['--c' as string]: c[1] }}>{c[0]}<u>✕</u></span>)}</div>
        <div className="res">{[C.mccain, C.hawkins, C.mcw, C.maxey].map((c, i) => <div key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div>
      </Bay>

      <Bay id="p2" n="02 — Semaine de cartes" title="Les cartes du jour de la semaine, d'un coup d'œil" desc="Sous la carte du jour : les sept derniers jours en petites cartes (celles que tu as grattées dévoilées, les autres en pointillés avec un point d'interrogation). Une raison de ne pas rater un jour.">
        <div className="week" style={{ paddingBottom: 26 }}>
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d, i) => (
            <div key={d} className={`wd${[2, 5].includes(i) ? ' miss' : ''}${i === 6 ? ' today' : ''}`}>
              {![2, 5].includes(i) ? <>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={ALL[i % ALL.length].img} alt="" /></> : <b className="sf">?</b>}
              <small>{d}</small>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="p3" n="03 — Pochette de set" title="Chaque set a sa pochette" desc="La page d'un set s'ouvre sur une pochette : année, nom en grand, trois cartes du set, barre de complétion à segments et « 77 / 8 760 ». Plus joli et plus parlant qu'une simple ligne de titre.">
        <div className="setcov wht"><div className="y">2023-24</div><h4 className="sf">Hoops Premium Stock</h4><div className="pic">{[C.maxey, C.edwards, C.mccain].map((c, i) => <div key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div><div className="bar"><i /></div><div className="nb"><span>COMPLÉTION</span><span>77 / 8 760</span></div></div>
      </Bay>

      <Bay id="p4" n="04 — Duel" title="Comparer deux cartes face à face" desc="Deux cartes côte à côte, losange VS au centre, lignes de comparaison (année, tirage, valeur, grade) avec la meilleure en doré. Pour hésiter entre deux achats ou deux échanges.">
        <div className="duel wht">
          <div className="side">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.edwards.img} alt="" /><ul><li><span>Année</span><span>2020</span></li><li className="w"><span>Tirage</span><span>/99</span></li><li><span>Valeur</span><span>42 €</span></li></ul></div>
          <div className="vs sf">VS</div>
          <div className="side">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.maxey.img} alt="" /><ul><li><span>Année</span><span>2020</span></li><li><span>Tirage</span><span>/149</span></li><li className="w"><span>Valeur</span><span>95 €</span></li></ul></div>
        </div>
      </Bay>

      <Bay id="p5" n="05 — Objectif" title="Un objectif de collection avec ses jalons" desc="Tu te fixes « 700 cartes » : barre à segments, gros « 599 », jalons marqués sur la règle (100, 250, 500, 700) et le nombre restant. Se met à jour tout seul à chaque ajout.">
        <div className="goal wht"><div className="top"><div className="big sf">599</div><div className="lb">sur 700 cartes · 101 restantes</div></div><div className="track"><i style={{ width: '85.5%' }} /></div><div className="miles">{[[14, '100'], [36, '250'], [71, '500'], [100, '700']].map(m => <span key={m[1]} style={{ left: `${m[0]}%` }}>{m[1]}</span>)}</div></div>
      </Bay>

      <Bay id="p6" n="06 — Pop report" title="La répartition de ta collection en colonnes" desc="Un petit « pop report » façon société de gradation : colonnes par note (10, 9.5, 9…) ou par année, nombre au-dessus, la plus haute en tête. On voit la qualité de la collection, pas seulement la quantité.">
        <div className="pop wht">{[['10', 4], ['9.5', 9], ['9', 21], ['8.5', 12], ['8', 7], ['7', 3], ['Raw', 100]].map(p => <div key={p[0] as string}><b className="sf">{p[1]}</b><i style={{ height: `${Math.max(8, (p[1] as number) * (p[0] === 'Raw' ? 1.4 : 5.5))}%` }} />{p[0]}</div>)}</div>
      </Bay>

      <Bay id="p7" n="07 — Carte de visite" title="Une carte de visite du collectionneur" desc="Un visuel horizontal : pseudo, niveau, quelques cartes en éventail, QR vers la galerie. À partager sur les réseaux ou à imprimer et glisser dans une enveloppe d'échange.">
        <div className="biz ink"><div className="l"><div><small>Collectionneur · Niv. 5</small><h4 className="sf">GKNNN_Cards</h4></div><div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}><div className="qr" /><small>memorabilius.fr/<br />galerie/gknnn-cards</small></div></div><div className="cards">{[C.mcw, C.mccain, C.hawkins].map((c, i) => <div key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" style={{ left: i * 8, top: 14 + i * 22, transform: `rotate(${(i - 1) * 7}deg)` }} /></div>)}</div></div>
      </Bay>

      <Bay id="p8" n="08 — Pages empilées" title="Les collections comme des feuilles empilées" desc="Les collections de la galerie sont des feuilles décalées avec leur onglet en haut ; on survole une feuille et elle se soulève pour montrer ce qu'elle contient. Remplace la rangée de pastilles.">
        <div className="stk wht" style={{ paddingTop: 30 }}>
          {[['Philadelphia', '#006bb6', '0px', 0], ['Old School', '#1f9d55', '110px', 28], ['Rookies', '#e67e22', '210px', 56]].map(p => <div key={p[0] as string} className="pg" style={{ ['--c' as string]: p[1], ['--x' as string]: p[2], top: 30 + (p[3] as number) }}><b>{p[0]}</b></div>)}
        </div>
      </Bay>

      <Bay id="p9" n="09 — Rareté" title="Ta collection par niveau de rareté" desc="Une répartition simple : communes, numérotées, ≤ /99, ≤ /25, ≤ /10, 1/1, avec barre colorée (violet, bronze, argent, or) et pourcentage. Montre ce qui rend la collection spéciale.">
        <div className="rar wht">{[['Communes', 62, '#5b6b8c'], ['Numérotées', 15, '#7c3aed'], ['≤ /25', 4, '#cd7f32'], ['≤ /10', 2, '#c0c0c0'], ['1/1', 1, '#ffd700']].map(r => <div className="row2" key={r[0] as string}><div className="nm">{r[0]}</div><div className="bar"><i style={{ width: `${r[1]}%`, ['--c' as string]: r[2] }} /></div><div className="pc sf">{r[1]}%</div></div>)}</div>
      </Bay>

      <Bay id="p10" n="10 — Sorties" title="Le calendrier des sorties de produits" desc="Les prochaines sorties (Prizm, Optic, Topps Chrome…) en petites cartes avec la date en gros : tu sais ce qui arrive et tu peux t'abonner à un set pour être prévenu quand sa checklist est en ligne.">
        <div className="rel wht">{[['14', 'NOV', '2025-26 Prizm', 'Panini · NBA'], ['05', 'DÉC', 'Topps Chrome', 'Topps · NBA'], ['19', 'DÉC', 'Optic', 'Panini · NBA'], ['09', 'JAN', 'Select', 'Panini · NBA']].map(r => <div className="rl" key={r[2]}><div className="dt ink"><b className="sf">{r[0]}</b><small>{r[1]}</small></div><div className="nm">{r[2]}<span>{r[3]}</span></div></div>)}</div>
      </Bay>
    </div>
  )
}
