'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 4 : les series precedentes sont integrees au site. Tout le style est ici, prefixe .ix.

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
.ix { --bl:#003da6; --el:#2f6bff; font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
/* le theme sombre global force la couleur du texte des div : sur les fonds clairs / fonces on la fixe explicitement */
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
.ix .btn { background:#fff; color:#06122e !important; border:3px solid #fff; padding: 9px 18px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
.ix .btn:hover { background: transparent; color:#fff !important; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* 01 · carte du jour */
.ix .cdj { display:grid; grid-template-columns: 200px 1fr; gap: 34px; align-items:center; border: 3px solid #fff; padding: 22px 26px; background: linear-gradient(135deg,#050912,#08153b 45%,#003da6); position:relative; }
.ix .cdj .day { position:absolute; top: -3px; left: -3px; background:#fff; padding: 6px 14px 4px; text-align:center; }
.ix .cdj .day b { display:block; font-size: 46px; line-height:.9; } .ix .cdj .day small { font: 800 9px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .cdj .card { transform: rotate(-4deg); margin-top: 26px; }
.ix .cdj h3 { margin: 0 0 8px; font-size: clamp(40px,6vw,68px); line-height:.92; }
.ix .cdj p { margin: 0 0 14px; max-width: 420px; opacity:.8; font-size: 14px; line-height:1.45; }

/* 02 · dos de carte */
.ix .back-card { width: 190px; aspect-ratio: 2.5/3.5; position:relative; background:
  linear-gradient(45deg, rgba(255,255,255,.05) 25%, transparent 25% 75%, rgba(255,255,255,.05) 75%) 0 0 / 22px 22px,
  linear-gradient(45deg, rgba(255,255,255,.05) 25%, transparent 25% 75%, rgba(255,255,255,.05) 75%) 11px 11px / 22px 22px,
  linear-gradient(160deg,#0a2468,#003da6 60%,#08153b);
  border: 8px solid #08153b; box-shadow: 0 0 0 2px #fff, 0 20px 40px rgba(0,0,0,.55); display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 14px; }
.ix .back-card::before { content:''; position:absolute; inset: 8px; border: 2px solid rgba(255,255,255,.6); }
.ix .back-card .lg { font-size: 30px; line-height: .9; text-align:center; position:relative; }
.ix .back-card .mono { width: 64px; height: 64px; border: 3px solid #fff; display:flex; align-items:center; justify-content:center; font-size: 42px; position:relative; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; }
.ix .back-card small { font: 800 8px system-ui; letter-spacing:.2em; text-transform:uppercase; position:relative; opacity:.8; }

/* 03 · face a face */
.ix .vs { display:grid; grid-template-columns: 1fr auto 1fr; align-items:stretch; max-width: 820px; }
.ix .vs .side { padding: 20px 24px; position:relative; }
.ix .vs .a { padding-right: 56px; background: linear-gradient(135deg,#050912,#003da6); clip-path: polygon(0 0,100% 0,calc(100% - 28px) 100%,0 100%); }
.ix .vs .b { padding-left: 56px; background: linear-gradient(225deg,#050912,#c0392b); clip-path: polygon(28px 0,100% 0,100% 100%,0 100%); text-align:right; }
.ix .vs .mid { width: 0; position:relative; z-index:2; }
.ix .vs .mid span { position:absolute; top:50%; left:50%; transform: translate(-50%,-50%); width: 70px; height:70px; display:flex; align-items:center; justify-content:center; background:#fff; color:#06122e !important; font-size: 40px; clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); }
.ix .vs h4 { margin:0 0 10px; font-size: 34px; line-height:1; }
.ix .vs .ln { display:flex; justify-content:space-between; align-items:baseline; font: 800 11px system-ui; letter-spacing:.14em; text-transform:uppercase; padding: 5px 0; border-top: 2px solid rgba(255,255,255,.22); }
.ix .vs .b .ln { flex-direction: row-reverse; } .ix .vs .ln b { font-size: 30px; letter-spacing:.02em; font-weight:400; } .ix .vs .win { color:#ffd54a !important; }

/* 04 · reliure */
.ix .binder { display:flex; max-width: 640px; background:#101a3c; border: 3px solid rgba(255,255,255,.25); position:relative; box-shadow: 0 20px 40px rgba(0,0,0,.5); }
.ix .binder .pg { flex:1; padding: 18px 20px 18px 30px; display:grid; grid-template-columns: repeat(3,1fr); gap: 8px; align-content:start; }
.ix .binder .pg + .pg { padding: 18px 30px 18px 20px; border-left: 3px solid #08102b; }
.ix .binder .pk { position:relative; aspect-ratio: 2.5/3.5; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.3); }
.ix .binder .pk .card { height:100%; box-shadow:none; }
.ix .binder .pk::after { content:''; position:absolute; inset:0; background: linear-gradient(120deg, rgba(255,255,255,.22), transparent 38%, transparent 70%, rgba(255,255,255,.1)); pointer-events:none; }
.ix .binder .rings { position:absolute; left:50%; top:0; bottom:0; width: 0; display:flex; flex-direction:column; justify-content:space-around; padding: 26px 0; }
.ix .binder .rings i { display:block; width: 38px; height: 14px; margin-left: -19px; background: linear-gradient(180deg,#e6ebf5,#8d97ad); box-shadow: 0 3px 6px rgba(0,0,0,.6); }

/* 05 · passeport */
.ix .passport { max-width: 640px; background: #eee9dc; padding: 22px; position:relative; border: 3px solid #b8923a; }
.ix .passport .h { display:flex; justify-content:space-between; align-items:baseline; border-bottom: 3px double #06122e; padding-bottom: 8px; margin-bottom: 14px; }
.ix .passport .h b { font-size: 34px; line-height:1; } .ix .passport .h small { font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; }
.ix .stamps { display:grid; grid-template-columns: repeat(auto-fill, minmax(110px,1fr)); gap: 12px; }
.ix .st { aspect-ratio: 1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; border: 4px solid var(--c); color: var(--c) !important; transform: rotate(var(--r)); opacity:.9; position:relative; mix-blend-mode: multiply; }
.ix .st::after { content:''; position:absolute; inset:4px; border: 1.5px solid var(--c); opacity:.7; }
.ix .st b { font-size: 34px; line-height:.9; color: var(--c) !important; } .ix .st small { font: 800 8px system-ui; letter-spacing:.16em; text-transform:uppercase; margin-top: 3px; color: var(--c) !important; }

/* 06 · quiz */
.ix .quiz { max-width: 760px; }
.ix .quiz .q { display:flex; gap: 22px; align-items:center; margin-bottom: 18px; }
.ix .quiz .q .card { width: 110px; flex-shrink:0; }
.ix .quiz .q h3 { margin:0; font-size: clamp(30px,4.6vw,48px); line-height:.95; }
.ix .timer { height: 10px; background: rgba(255,255,255,.14); margin-bottom: 18px; position:relative; }
.ix .timer i { position:absolute; inset:0 auto 0 0; width: 62%; background: linear-gradient(90deg,#2f6bff,#e9b44c); }
.ix .ans { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ix .ans button { all: unset; cursor:pointer; display:flex; align-items:center; gap: 14px; padding: 12px 16px; background: var(--c); clip-path: polygon(0 0,calc(100% - 16px) 0,100% 50%,calc(100% - 16px) 100%,0 100%); font: 800 15px system-ui; transition: transform .15s, filter .15s; }
.ix .ans button:hover { transform: translateX(4px); filter: brightness(1.12); }
.ix .ans button b { font-size: 34px; line-height:1; min-width: 28px; }

/* 07 · intercalaires */
.ix .dividers { display:flex; align-items:flex-end; gap: 0; border-bottom: 4px solid #fff; padding-left: 6px; flex-wrap: wrap; }
.ix .dv { position:relative; padding: 10px 22px 8px; font: 800 12px system-ui; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; background: var(--c); margin-right: -10px; clip-path: polygon(0 100%, 12px 0, calc(100% - 12px) 0, 100% 100%); transition: padding .15s; }
.ix .dv.on { padding-top: 18px; filter: none; z-index:3; } .ix .dv:not(.on) { filter: brightness(.62); z-index: 1; }
.ix .dvbody { background: rgba(255,255,255,.06); border: 2px solid rgba(255,255,255,.2); border-top: 0; padding: 18px; }

/* 08 · jauge de prix */
.ix .gauge { max-width: 640px; }
.ix .gauge .bar { position:relative; height: 16px; background: linear-gradient(90deg,#1f9d55,#e9b44c 60%,#e5484d); margin: 40px 0 8px; }
.ix .gauge .mk { position:absolute; top: -52px; transform: translateX(-50%); text-align:center; }
.ix .gauge .mk b { display:block; font-size: 26px; line-height:1; } .ix .gauge .mk::after { content:''; display:block; width: 3px; height: 20px; background:#fff; margin: 4px auto 0; }
.ix .gauge .mk small { font: 800 9px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.75; }
.ix .gauge .ticks { display:flex; justify-content:space-between; font: 700 11px system-ui; opacity:.6; }
.ix .gauge .you { position:absolute; top: -6px; width: 6px; height: 28px; background:#fff; box-shadow: 0 0 0 2px #08153b; transform: translateX(-50%); }
.ix .gauge .sales { display:flex; gap: 6px; margin-top: 16px; flex-wrap:wrap; }
.ix .gauge .sales span { padding: 5px 10px; background: rgba(255,255,255,.1); border: 2px solid rgba(255,255,255,.2); font: 800 12px system-ui; }

/* 09 · niveau superieur */
.ix .lvl { position:relative; display:flex; align-items:center; justify-content:center; flex-direction:column; min-height: 360px; text-align:center; }
.ix .lvl::before { content:''; position:absolute; inset: -40%; background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(47,107,255,.34) 0 7deg, transparent 7deg 18deg); animation: ixrot 24s linear infinite; mask-image: radial-gradient(circle, #000 0, transparent 62%); -webkit-mask-image: radial-gradient(circle, #000 0, transparent 62%); }
@keyframes ixrot { to { transform: rotate(360deg); } }
.ix .lvl .k { position:relative; font: 800 14px system-ui; letter-spacing:.3em; text-transform:uppercase; }
.ix .lvl .n { position:relative; font-size: 180px; line-height:.85; text-shadow: 0 0 40px rgba(47,107,255,.9); }
.ix .lvl .xp { position:relative; margin-top: 14px; width: 320px; height: 14px; border: 3px solid #fff; padding: 2px; } .ix .lvl .xp i { display:block; height:100%; width: 34%; background:#fff; }
.ix .lvl .sq { position:absolute; width: 12px; height: 12px; opacity:.9; }
@media (prefers-reduced-motion: reduce) { .ix .lvl::before, .ix .drop img { animation: none; } }

/* 10 · chevrons */
.ix .chev { position:relative; overflow:hidden; background:#fff; padding: 12px 0; margin: 10px 0; }
.ix .chev div { display:inline-block; white-space:nowrap; font-size: 38px; line-height:1; animation: ixmarch 18s linear infinite; }
.ix .chev.b { background: var(--el); } .ix .chev.c { background: transparent; border-block: 3px solid #fff; }
@keyframes ixmarch { to { transform: translateX(-50%); } }

/* 11 · recherche */
.ix .wanted { width: 300px; background:#eee3c8; padding: 14px 16px 16px; text-align:center; border: 6px double #3a2a0a; position:relative; transform: rotate(-2deg); box-shadow: 0 20px 40px rgba(0,0,0,.55); }
.ix .wanted .w { font-size: 64px; line-height:.88; color:#3a2a0a !important; letter-spacing:.04em; }
.ix .wanted .pic { margin: 8px auto 8px; width: 120px; position:relative; }
.ix .wanted .pic .card { filter: grayscale(1) contrast(1.15) sepia(.4); box-shadow: 0 0 0 3px #3a2a0a; }
.ix .wanted .pic::after { content:'?'; position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size: 90px; color: rgba(58,42,10,.6); }
.ix .wanted .nm { font-size: 24px; line-height:1; color:#3a2a0a !important; } .ix .wanted small { display:block; font: 800 9px system-ui; letter-spacing:.14em; text-transform:uppercase; color:#3a2a0a !important; margin-top: 4px; }
.ix .wanted .rw { margin-top: 10px; border-top: 3px double #3a2a0a; padding-top: 8px; font-size: 30px; color:#8a1c14 !important; line-height:1; }

/* 12 · confettis de cartes */
.ix .drop { position:relative; height: 340px; overflow:hidden; }
.ix .drop img { position:absolute; top: -90px; width: 56px; aspect-ratio: 2.5/3.5; object-fit:cover; box-shadow: 0 8px 16px rgba(0,0,0,.5); animation: ixfall 3.2s cubic-bezier(.3,.7,.4,1) both; }
@keyframes ixfall { 0% { transform: translateY(0) rotate(0); opacity:0; } 10% { opacity:1; } 100% { transform: translateY(460px) rotate(var(--r)); opacity:1; } }
.ix .drop .msg { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; z-index:2; }
.ix .drop .msg b { font-size: 70px; line-height:.9; text-shadow: 0 6px 30px rgba(0,0,0,.7); }
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
  const [tab, setTab] = useState(0)
  const [drop, setDrop] = useState(0)
  const tabs = [{ l: 'Philadelphia', c: '#006bb6' }, { l: 'Old School', c: '#1f9d55' }, { l: 'Rookies', c: '#e67e22' }, { l: 'Autos', c: '#7a3fbf' }]
  const stamps = [
    { b: 'RC', s: '100 rookie cards', c: '#c0392b', r: '-8deg' }, { b: '25', s: 'patchs', c: '#1f5fbf', r: '6deg' }, { b: '53', s: 'jours de suite', c: '#1f7a45', r: '-4deg' },
    { b: '1/1', s: 'carte unique', c: '#8a1c14', r: '9deg' }, { b: '5', s: 'échanges', c: '#6b2fa8', r: '-6deg' },
  ]

  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 4</h1>
      <p className="lead">Douze nouvelles pistes. Les séries précédentes sont intégrées au site (Grail Wall en musée, alertes en bandeau, rubans, main de cartes, radar, chargement, mur défilant, états vides…). Chaque maquette est vivante : survole, clique. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Carte du jour', '02 Dos de carte', '03 Face-à-face', '04 Reliure', '05 Passeport', '06 Quiz', '07 Intercalaires', '08 Jauge de prix', '09 Niveau supérieur', '10 Chevrons', '11 Recherché', '12 Pluie de cartes'].map((t, i) => <a key={t} href={`#m${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="m1" n="01 — Carte du jour" title="Une carte mise à l'honneur chaque jour" desc="Sur l'accueil : une carte de la communauté, choisie chaque jour, avec la date en grand dans un coin, le nom du collectionneur et un bouton pour aller voir. Une raison de revenir tous les jours.">
        <div className="cdj">
          <div className="day ink"><b className="sf">10</b><small>Oct. 2026</small></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="card" src={C.mcw.img} alt="" />
          <div>
            <span className="eyebrow">Carte du jour</span>
            <h3 className="sf" style={{ marginTop: 14 }}>Michael Carter-Williams</h3>
            <p>2013-14 Panini · Rising Tide Autographs · RC AUTO. Dans la collection de KathleenFR, parmi ses pièces maîtresses.</p>
            <button className="btn">Voir la collection</button>
          </div>
        </div>
      </Bay>

      <Bay id="m2" n="02 — Dos de carte" title="Un verso Memorabilius quand il n'y a pas de photo" desc="Les cartes sans verso ont un dos par défaut : treillis marine, double filet, monogramme M. La carte se retourne toujours sur quelque chose de beau, au lieu d'un vide.">
        <div className="row">
          <div className="back-card wht"><div className="mono sf">M</div><div className="lg sf">Memorabilius</div><small>Collection n° 599</small></div>
          <div style={{ width: 190 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mccain.img} alt="" /><div className="cap">Recto</div></div>
        </div>
      </Bay>

      <Bay id="m3" n="03 — Face-à-face" title="Comparer deux collections comme un combat" desc="Deux collectionneurs face à face : bloc bleu contre bloc rouge à coupe oblique, losange VS au centre, chiffres Surfquest ligne par ligne, avantage en doré. Pour comparer un ami, une équipe, ou un trade.">
        <div className="vs wht">
          <div className="side a"><h4 className="sf">GKNNN_Cards</h4>
            {[['Cartes', '599', true], ['RC', '119', true], ['Auto', '29', false], ['Patch', '23', false]].map(r => <div className="ln" key={r[0] as string}><span>{r[0]}</span><b className={`sf${r[2] ? ' win' : ''}`}>{r[1]}</b></div>)}</div>
          <div className="mid"><span className="sf">VS</span></div>
          <div className="side b"><h4 className="sf">KathleenFR</h4>
            {[['Cartes', '858', false], ['RC', '156', false], ['Auto', '29', true], ['Patch', '25', true]].map(r => <div className="ln" key={r[0] as string}><span>{r[0]}</span><b className={`sf${r[2] ? ' win' : ''}`}>{r[1]}</b></div>)}</div>
        </div>
      </Bay>

      <Bay id="m4" n="04 — Reliure" title="Le classeur avec ses anneaux" desc="Un classeur ouvert : deux pages de pochettes avec reflet de plastique, anneaux métalliques au centre, ombre portée. Le côté « vrai classeur » qui manque aux vues actuelles.">
        <div className="binder">
          {[0, 1].map(p => (
            <div className="pg" key={p}>
              {ALL.slice(p * 3, p * 3 + 3).concat(ALL.slice(p, p + 3)).map((c, i) => (
                <div className="pk" key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>
              ))}
            </div>
          ))}
          <div className="rings">{[0, 1, 2].map(i => <i key={i} />)}</div>
        </div>
      </Bay>

      <Bay id="m5" n="05 — Passeport" title="Les badges comme des tampons de passeport" desc="Les badges obtenus deviennent des tampons d'encre inclinés sur une page de passeport crème : « 100 rookie cards », « 53 jours de suite », « 1/1 »… Plus collectionnable qu'une grille d'icônes.">
        <div className="passport ink">
          <div className="h"><b className="sf">Passeport collectionneur</b><small>N° 000599 · GKNNN_Cards</small></div>
          <div className="stamps">
            {stamps.map(s => <div className="st" key={s.b} style={{ ['--c' as string]: s.c, ['--r' as string]: s.r }}><b className="sf">{s.b}</b><small>{s.s}</small></div>)}
          </div>
        </div>
      </Bay>

      <Bay id="m6" n="06 — Quiz" title="Le quiz en tuiles fléchées" desc="La question en grand Surfquest à côté de la carte mystère, une barre de temps qui se vide, et quatre réponses en flèches colorées A/B/C/D. Lisible de loin pour les directs et l'overlay OBS.">
        <div className="quiz wht">
          <div className="q">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.hawkins.img} alt="" /><h3 className="sf">Qui signe cette carte ?</h3></div>
          <div className="timer"><i /></div>
          <div className="ans">
            {[['A', 'Hersey Hawkins', '#2f6bff'], ['B', 'Charles Barkley', '#e67e22'], ['C', 'Andre Iguodala', '#1f9d55'], ['D', 'Maurice Cheeks', '#a45cff']].map(a => (
              <button key={a[0]} style={{ ['--c' as string]: a[2] }}><b className="sf">{a[0]}</b>{a[1]}</button>
            ))}
          </div>
        </div>
      </Bay>

      <Bay id="m7" n="07 — Intercalaires" title="Les collections comme des intercalaires de classeur" desc="Les onglets « Ma collection » (équipes, thèmes, rookies…) prennent la forme d'intercalaires à coupe oblique : l'actif remonte et s'éclaire, les autres restent assombris derrière.">
        <div className="dividers wht">
          {tabs.map((t, i) => (
            <div key={t.l} className={`dv${tab === i ? ' on' : ''}`} style={{ ['--c' as string]: t.c }} onClick={() => setTab(i)}>{t.l}</div>
          ))}
        </div>
        <div className="dvbody"><div className="cap" style={{ margin: 0 }}>Collection « {tabs[tab].l} » · clique un onglet</div></div>
      </Bay>

      <Bay id="m8" n="08 — Jauge de prix" title="Où se situe ta carte dans le marché" desc="Une jauge vert → rouge avec le bas, le médian et le haut des ventes eBay, un repère pour ta valeur et les dernières ventes en pastilles. On comprend en une seconde si la carte est bien cotée.">
        <div className="gauge">
          <div className="bar">
            {[{ l: 'Bas', v: '14 €', x: 10 }, { l: 'Médian', v: '32 €', x: 48 }, { l: 'Haut', v: '71 €', x: 90 }].map(m => <div className="mk" key={m.l} style={{ left: `${m.x}%` }}><small>{m.l}</small><b className="sf">{m.v}</b></div>)}
            <div className="you" style={{ left: '58%' }} title="Ta carte" />
          </div>
          <div className="ticks"><span>0 €</span><span>Ta valeur : 38 €</span><span>80 €</span></div>
          <div className="sales">{['34 € · 8 oct.', '29 € · 5 oct.', '41 € · 2 oct.', '31 € · 28 sept.'].map(s => <span key={s}>{s}</span>)}</div>
        </div>
      </Bay>

      <Bay id="m9" n="09 — Niveau supérieur" title="Un écran de montée de niveau" desc="Quand on passe un niveau : rayons bleus qui tournent, numéro géant en lueur, barre d'XP de la prochaine étape et carrés qui jaillissent. Un vrai moment de récompense.">
        <div className="lvl wht">
          {[[8, 12], [86, 20], [14, 74], [90, 70], [30, 90], [70, 8]].map((p, i) => <i className="sq" key={i} style={{ left: `${p[0]}%`, top: `${p[1]}%`, background: ['#fff', '#2f6bff', '#e9b44c'][i % 3], transform: `rotate(${i * 25}deg)` }} />)}
          <div className="k">Niveau supérieur</div>
          <div className="n sf">6</div>
          <div className="xp"><i /></div>
          <div className="cap" style={{ position: 'relative' }}>+20 XP · prochain niveau : 520 XP</div>
        </div>
      </Bay>

      <Bay id="m10" n="10 — Chevrons" title="Des séparateurs à chevrons qui défilent" desc="Entre les sections : une bande à chevrons animés « »» NOUVEAU »» » en blanc, en bleu ou en simple filet. Du rythme entre les blocs, très « annonce de match ».">
        <div className="chev ink"><div className="sf">{'»» Nouveautés »» Échanges »» Classeurs »» Badges »» Nouveautés »» Échanges »» Classeurs »» Badges '.repeat(2)}</div></div>
        <div className="chev b wht"><div className="sf">{'»» Scan IA »» Galerie 3D »» Prix eBay »» Gratuit '.repeat(4)}</div></div>
        <div className="chev c wht"><div className="sf">{'»»» '.repeat(60)}</div></div>
      </Bay>

      <Bay id="m11" n="11 — Recherché" title="La wishlist en affiche « Recherché »" desc="Chaque carte cherchée devient une affiche : « RECHERCHÉ » en gros, portrait en sépia avec un point d'interrogation, nom, set, et une « récompense » (le prix que tu es prêt à payer ou l'échange proposé).">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="wanted ink">
            <div className="w sf">Recherché</div>
            <div className="pic">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.luwawu.img} alt="" /></div>
            <div className="nm sf">Tyrese Maxey</div><small>2020-21 · Prizm Silver · RC</small>
            <div className="rw sf">Récompense : 40 €</div>
          </div>
          <div className="cap" style={{ maxWidth: 220 }}>Les cartes de la wishlist en vente par un collectionneur de la communauté s&apos;allument en doré.</div>
        </div>
      </Bay>

      <Bay id="m12" n="12 — Pluie de cartes" title="Des cartes qui tombent quand on en ajoute une" desc="À la place des confettis : des vraies cartes de ta galerie tombent du haut de l'écran en tournant, avec un message « +1 carte » en gros. Chaque ajout se fête.">
        <div className="drop" key={drop}>
          {Array.from({ length: 16 }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={ALL[i % ALL.length].img} alt="" style={{ left: `${(i * 6.4 + 3) % 94}%`, animationDelay: `${(i % 8) * 0.18}s`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (120 + i * 18)}deg` }} />
          ))}
          <div className="msg wht"><b className="sf">+1 carte</b><span style={{ fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', fontSize: 12, marginTop: 10 }}>Ta collection : 600</span></div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn" onClick={() => setDrop(d => d + 1)}>Rejouer ↻</button></div>
      </Bay>
    </div>
  )
}
