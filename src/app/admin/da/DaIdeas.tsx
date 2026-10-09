'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 3 : les series precedentes sont integrees au site (reflet holo, billet d'echange, vitrine, pellicule, halo de rarete,
// alertes, Grail Wall encadre...). Tout le style est ici, prefixe .ix, pour ne rien changer sur les vraies pages.

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
/* le theme sombre global force la couleur du texte des div : sur les fonds clairs on la fixe explicitement */
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
.ix .btn.outline { background: transparent; color:#fff !important; border-color: rgba(255,255,255,.55); }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* 01 · cours de la collection */
.ix .quote { display:grid; grid-template-columns: auto 1fr; gap: 28px; align-items:end; }
.ix .quote .v { font-size: clamp(64px,10vw,120px); line-height:.9; }
.ix .quote .chg { display:inline-flex; align-items:center; gap:8px; margin-top: 8px; background:#12b76a; padding: 5px 12px; font: 800 14px system-ui; letter-spacing:.06em; }
.ix .quote .chg.dn { background:#e5484d; }
.ix .quote svg { width:100%; height: 150px; display:block; }
.ix .movers { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 8px; margin-top: 18px; }
.ix .mv { display:flex; align-items:center; gap:10px; padding: 7px 10px; border: 2px solid rgba(255,255,255,.18); background: rgba(255,255,255,.04); }
.ix .mv img { width: 30px; height: 42px; object-fit: cover; box-shadow: none; }
.ix .mv b { flex:1; font: 800 12px system-ui; letter-spacing:.04em; } .ix .mv span { font: 800 13px system-ui; }
.ix .up { color:#3ddc97 !important; } .ix .dn { color:#ff7a7a !important; }

/* 02 · coin corne */
.ix .curl { position:relative; width: 160px; cursor:pointer; }
.ix .curl .card { transition: clip-path .25s; clip-path: polygon(0 0,100% 0,100% calc(100% - 34px),calc(100% - 34px) 100%,0 100%); }
.ix .curl::after { content:''; position:absolute; right:0; bottom:0; width:34px; height:34px; transition: width .25s, height .25s;
  background: linear-gradient(315deg, transparent 50%, #c9d2e6 50%, #f4f6fb 100%); box-shadow: -4px -4px 10px rgba(0,0,0,.35); }
.ix .curl:hover .card { clip-path: polygon(0 0,100% 0,100% calc(100% - 78px),calc(100% - 78px) 100%,0 100%); }
.ix .curl:hover::after { width:78px; height:78px; }

/* 03 · rubans de coin */
.ix .sash { position:relative; width: 170px; overflow:hidden; }
.ix .sash .card { box-shadow:none; }
.ix .sash i { position:absolute; font: 800 10px system-ui; letter-spacing:.14em; text-transform:uppercase; padding: 4px 0; width: 120px; text-align:center; font-style: normal; color:#fff; box-shadow: 0 3px 8px rgba(0,0,0,.4); }
.ix .sash i.tl { top: 18px; left: -34px; transform: rotate(-45deg); }
.ix .sash i.tr { top: 18px; right: -34px; transform: rotate(45deg); }
.ix .sash i.bl { bottom: 20px; left: -34px; transform: rotate(45deg); }

/* 04 · main de cartes */
.ix .pick { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 10px; max-width: 760px; }
.ix .pick button { all: unset; cursor:pointer; position:relative; display:block; outline: 3px solid transparent; transition: outline-color .15s, transform .15s; }
.ix .pick button.on { outline-color: var(--el); transform: translateY(-6px); }
.ix .pick button.on::after { content:'✓'; position:absolute; top:4px; right:4px; background: var(--el); color:#fff; width: 22px; height:22px; display:flex; align-items:center; justify-content:center; font: 900 13px system-ui; }
.ix .tray { margin-top: 26px; display:flex; align-items:center; gap: 18px; background:#0a1030; border: 3px solid rgba(255,255,255,.3); padding: 12px 18px; flex-wrap:wrap; min-height: 118px; }
.ix .hand { position:relative; width: 190px; height: 92px; flex-shrink:0; }
.ix .hand img { position:absolute; bottom:-30px; width: 58px; transform-origin: 50% 160%; box-shadow: 0 6px 14px rgba(0,0,0,.55); }
.ix .tray .n { font-size: 44px; line-height:1; } .ix .tray .lb { font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.7; }

/* 05 · podium */
.ix .podium { display:flex; align-items:flex-end; justify-content:center; gap: 10px; max-width: 640px; margin: 0 auto; }
.ix .pod { flex:1; text-align:center; }
.ix .pod .av { width: 74px; height: 74px; border-radius: 50%; margin: 0 auto 8px; border: 3px solid #fff; background: var(--c); display:flex; align-items:center; justify-content:center; font-size: 30px; }
.ix .pod .nm { font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .pod .ct { font-size: 28px; line-height: 1.1; }
.ix .pod .bl { margin-top: 10px; display:flex; align-items:flex-start; justify-content:center; font-size: 84px; line-height: 1; padding-top: 6px; background: linear-gradient(180deg, var(--c), rgba(0,0,0,.35)); border: 3px solid rgba(255,255,255,.6); border-bottom: 0; color: rgba(255,255,255,.92); }

/* 06 · planche contact */
.ix .contact { background:#0c0f1c; padding: 14px; max-width: 700px; display:grid; grid-template-columns: repeat(auto-fill, minmax(62px,1fr)); gap: 6px; border: 3px solid rgba(255,255,255,.2); }
.ix .contact .t { position:relative; aspect-ratio: 2.5/3.5; background:#111; }
.ix .contact .t img { width:100%; height:100%; object-fit:cover; box-shadow:none; filter: grayscale(.35) contrast(1.05); }
.ix .contact .t small { position:absolute; bottom:2px; left:3px; font: 700 8px system-ui; letter-spacing:.1em; color:#e9b44c; text-shadow: 0 1px 2px #000; }
.ix .contact .t.sel::after { content:''; position:absolute; inset:-4px -3px; border: 3px solid #ff3b3b; border-radius: 48% 52% 50% 50% / 56% 50% 50% 44%; transform: rotate(-3deg); pointer-events:none; }

/* 07 · etiquette de prix */
.ix .tagrow { display:flex; gap: 44px; flex-wrap:wrap; padding: 6px 0 14px; }
.ix .pc { position:relative; width: 150px; }
.ix .ptag { position:absolute; right: -26px; top: 26px; width: 92px; transform: rotate(10deg); filter: drop-shadow(0 8px 12px rgba(0,0,0,.5)); transform-origin: 50% 0; }
.ix .ptag .body { background:#fff; padding: 20px 8px 8px; text-align:center; clip-path: polygon(50% 0, 100% 16%, 100% 100%, 0 100%, 0 16%); position:relative; }
.ix .ptag .body::before { content:''; position:absolute; left: 50%; top: 9px; width: 12px; height: 12px; margin-left:-6px; border-radius:50%; background:#0a2468; box-shadow: inset 0 0 0 3px #fff; }
.ix .ptag .body small { display:block; font: 800 8px system-ui; letter-spacing:.14em; text-transform:uppercase; } .ix .ptag .body b { display:block; font-size: 30px; line-height: 1; margin-top: 3px; }
.ix .ptag .str { position:absolute; left: 50%; top: -22px; width: 2px; height: 30px; background: #d9dde8; transform: rotate(-12deg); }

/* 08 · couverture */
.ix .cover { position:relative; width: min(100%, 400px); aspect-ratio: 3/4; background: linear-gradient(160deg,#0a2468,#003da6 60%,#08153b); overflow:hidden; border: 3px solid #fff; box-shadow: 0 24px 50px rgba(0,0,0,.55); }
.ix .cover .mast { position:absolute; top: 14px; left: 0; right: 0; text-align:center; font-size: 66px; line-height: .9; letter-spacing: .01em; }
.ix .cover .iss { position:absolute; top: 88px; left: 0; right: 0; display:flex; justify-content:space-between; padding: 0 14px; font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; border-block: 2px solid #fff; padding-block: 4px; margin: 0 14px; width: calc(100% - 28px); }
.ix .cover .pic { position:absolute; left: 50%; top: 128px; width: 44%; transform: translateX(-50%) rotate(-2deg); }
.ix .cover .cl { position:absolute; width: 30%; font-size: 24px; line-height: .95; } .ix .cover .cl small { display:block; font: 700 9px system-ui; letter-spacing:.1em; opacity:.8; margin-top: 4px; text-transform:uppercase; }
.ix .cover .cl.l { left: 14px; top: 150px; } .ix .cover .cl.r { right: 14px; top: 240px; text-align:right; }
.ix .cover .bar { position:absolute; left: 14px; bottom: 14px; right: 14px; display:flex; justify-content:space-between; align-items:flex-end; }
.ix .cover .bar .big { font-size: 46px; line-height: .9; }
.ix .cover .qr { width: 54px; height: 54px; background: repeating-conic-gradient(#fff 0 25%, #06122e 0 50%) 0 0 / 14px 14px; border: 4px solid #fff; }

/* 09 · radar */
.ix .radar { display:flex; gap: 30px; flex-wrap:wrap; align-items:center; }
.ix .radar svg { width: 320px; height: 300px; }
.ix .radar .lg { display:grid; gap: 8px; font: 800 12px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .radar .lg span { display:flex; align-items:center; gap:10px; } .ix .radar .lg i { width: 14px; height: 14px; display:inline-block; }

/* 10 · chargement */
.ix .loaders { display:flex; gap: 70px; flex-wrap:wrap; align-items:center; }
.ix .flipper { display:flex; gap: 8px; perspective: 500px; }
.ix .flipper i { width: 34px; height: 48px; background: linear-gradient(135deg,#fff,#9db8ff); display:block; animation: ixflip 1.2s ease-in-out infinite; transform-origin: 50% 50%; }
.ix .flipper i:nth-child(2) { animation-delay: .15s; } .ix .flipper i:nth-child(3) { animation-delay: .3s; }
@keyframes ixflip { 0% { transform: rotateY(0); } 50% { transform: rotateY(180deg); background: #2f6bff; } 100% { transform: rotateY(360deg); } }
.ix .sk { width: 120px; aspect-ratio: 2.5/3.5; background: rgba(255,255,255,.07); position:relative; overflow:hidden; border: 2px solid rgba(255,255,255,.14); }
.ix .sk::after { content:''; position:absolute; inset:0; background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.22) 50%, transparent 70%); transform: translateX(-100%); animation: ixsweep 1.4s linear infinite; }
@keyframes ixsweep { to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .ix .flipper i, .ix .sk::after, .ix .wallbg .col { animation: none; } }

/* 11 · mur defilant */
.ix .wallbg { position:relative; height: 330px; overflow:hidden; }
.ix .wallbg .cols { position:absolute; inset: -40px -20px; display:flex; gap: 14px; transform: rotate(-8deg) scale(1.05); }
.ix .wallbg .col { flex:1; display:flex; flex-direction:column; gap: 14px; animation: ixup 26s linear infinite; }
.ix .wallbg .col:nth-child(even) { animation-direction: reverse; animation-duration: 32s; }
.ix .wallbg .col img { width:100%; box-shadow:none; }
@keyframes ixup { to { transform: translateY(-50%); } }
.ix .wallbg::after { content:''; position:absolute; inset:0; background: linear-gradient(90deg, rgba(5,9,18,.94) 0%, rgba(5,9,18,.55) 55%, rgba(5,9,18,.85) 100%); }
.ix .wallbg .fg { position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; justify-content:center; padding: 0 clamp(18px,4vw,50px); gap: 12px; }
.ix .wallbg .fg h3 { margin:0; font-size: clamp(44px,7vw,84px); line-height:.92; }

/* 12 · etats vides */
.ix .empties { display:flex; gap: 40px; flex-wrap:wrap; align-items:center; }
.ix .ghost { width: 150px; aspect-ratio: 2.5/3.5; border: 3px dashed rgba(255,255,255,.4); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; transform: rotate(-4deg); position:relative; background: rgba(255,255,255,.04); }
.ix .ghost .q { font-size: 84px; line-height:1; color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.5); }
.ix .ghost small { font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.7; }
.ix .empties .txt h3 { margin:0 0 6px; font-size: 56px; line-height:.95; } .ix .empties .txt p { margin:0 0 14px; opacity:.75; max-width: 320px; font-size: 14px; }
.ix .e404 { position:relative; }
.ix .e404 .n { font-size: 150px; line-height:.8; } .ix .e404 img { position:absolute; width: 70px; right: -30px; top: -10px; transform: rotate(14deg); }
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
  const [hand, setHand] = useState<number[]>([1, 3])
  const toggle = (i: number) => setHand(h => (h.includes(i) ? h.filter(x => x !== i) : [...h, i]))

  // cours de la collection : serie deterministe
  const series = useMemo(() => {
    let s = 5
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    let v = 100
    return Array.from({ length: 40 }, () => (v += (rnd() - 0.42) * 6))
  }, [])
  const lo = Math.min(...series), hi = Math.max(...series)
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 600},${140 - ((v - lo) / (hi - lo)) * 120}`).join(' ')

  const radar = [{ l: 'RC', v: 0.82 }, { l: 'Auto', v: 0.55 }, { l: 'Patch', v: 0.4 }, { l: 'Num', v: 0.7 }, { l: 'Équipes', v: 0.62 }, { l: 'Sets', v: 0.35 }]
  const R = 110, cx = 160, cy = 150
  const ang = (i: number) => (-90 + (360 / radar.length) * i) * Math.PI / 180
  const poly = radar.map((r, i) => `${cx + Math.cos(ang(i)) * R * r.v},${cy + Math.sin(ang(i)) * R * r.v}`).join(' ')

  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 3</h1>
      <p className="lead">Douze nouvelles pistes. Les séries précédentes sont intégrées au site (reflet holo, billet d&apos;échange, vitrine, pellicule, halo de rareté, alertes, Grail Wall encadré). Chaque maquette est vivante : survole, clique. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Cours', '02 Coin corné', '03 Rubans', '04 Main de cartes', '05 Podium', '06 Planche contact', '07 Étiquette de prix', '08 Couverture', '09 Radar', '10 Chargement', '11 Mur défilant', '12 États vides'].map((t, i) => <a key={t} href={`#k${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="k1" n="01 — Cours de la collection" title="La valeur façon cours de bourse" desc="La valeur estimée de la collection en gros chiffre, la variation du mois en pastille verte ou rouge, une courbe, et les cartes qui ont le plus bougé. Pour le profil et la carte de collectionneur.">
        <div className="quote">
          <div>
            <div className="v sf">12 480 €</div>
            <span className="chg wht">▲ +3,2 % ce mois</span>
          </div>
          <svg viewBox="0 0 600 150" preserveAspectRatio="none" aria-hidden>
            <defs><linearGradient id="qg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2f6bff" stopOpacity=".55" /><stop offset="1" stopColor="#2f6bff" stopOpacity="0" /></linearGradient></defs>
            <polyline points={`0,150 ${pts} 600,150`} fill="url(#qg)" stroke="none" />
            <polyline points={pts} fill="none" stroke="#7aa2ff" strokeWidth="3" strokeLinejoin="miter" />
          </svg>
        </div>
        <div className="movers">
          {[{ c: C.maxey, v: '+18 %', up: true }, { c: C.mccain, v: '+9 %', up: true }, { c: C.hawkins, v: '−6 %', up: false }].map(m => (
            <div className="mv" key={m.c.nom}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.c.img} alt="" /><b>{m.c.nom}</b><span className={m.up ? 'up' : 'dn'}>{m.up ? '▲' : '▼'} {m.v}</span>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="k2" n="02 — Coin corné" title="Un coin qui se soulève pour montrer le verso" desc="Chaque vignette a un coin corné en bas à droite : au survol (ou au toucher) il se soulève et révèle le verso. Dit tout de suite que la carte a un dos, et invite à la retourner.">
        <div className="row">
          {[C.mccain, C.hawkins, C.edwards].map(c => (
            <div className="curl" key={c.nom}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>
          ))}
        </div>
        <div className="cap">Survole le coin des cartes</div>
      </Bay>

      <Bay id="k3" n="03 — Rubans de coin" title="Les statuts en rubans diagonaux" desc="« À vendre », « Échange », « Nouveau », « Cherchée » : au lieu de pastilles posées sur l'image, des rubans coupés dans les coins de la vignette. Lisibles sans cacher le visage du joueur.">
        <div className="row">
          <div className="sash">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mccain.img} alt="" /><i className="tl" style={{ background: '#1f9d55' }}>À vendre</i></div>
          <div className="sash">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.edwards.img} alt="" /><i className="tr" style={{ background: '#2f6bff' }}>Échange</i><i className="bl" style={{ background: '#e67e22' }}>Nouveau</i></div>
          <div className="sash">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.hawkins.img} alt="" /><i className="tl" style={{ background: '#7a3fbf' }}>Cherchée</i></div>
        </div>
      </Bay>

      <Bay id="k4" n="04 — Main de cartes" title="La sélection se range dans ta main" desc="En mode sélection (exporter, Multi-QR, classeur), les cartes cochées se rangent dans une « main » en éventail au bas de l'écran, avec le compteur géant et les actions. On voit ce qu'on tient.">
        <div className="pick">
          {ALL.map((c, i) => (
            <button key={i} className={hand.includes(i) ? 'on' : ''} onClick={() => toggle(i)} aria-label={c.nom}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="card" src={c.img} alt="" />
            </button>
          ))}
        </div>
        <div className="tray">
          <div className="hand">
            {hand.slice(0, 7).map((i, k, a) => {
              const m = (a.length - 1) / 2
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="card" src={ALL[i].img} alt="" style={{ left: `calc(50% - 29px + ${(k - m) * 30}px)`, transform: `rotate(${(k - m) * 9}deg)`, zIndex: k }} />
              )
            })}
          </div>
          <div><div className="n sf">{hand.length}</div><div className="lb">sélectionnée{hand.length > 1 ? 's' : ''}</div></div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn">Exporter</button><button className="btn outline">Multi-QR</button><button className="btn outline">Classeur</button>
          </div>
        </div>
      </Bay>

      <Bay id="k5" n="05 — Podium" title="Le top des collectionneurs sur un podium" desc="Pour l'annuaire et les classements : trois marches aux couleurs or / argent / bronze, avatars et compteurs en grand, numéro de rang gravé dans la marche.">
        <div className="podium">
          {[{ r: 2, c: '#9aa6bd', n: 'Kathleen', v: '858', h: 120, e: '🏀' }, { r: 1, c: '#e9b44c', n: 'GKNNN', v: '1 204', h: 168, e: '👑' }, { r: 3, c: '#c47a3a', n: 'Devin', v: '646', h: 88, e: '🃏' }].map(p => (
            <div className="pod" key={p.r}>
              <div className="av" style={{ ['--c' as string]: p.c }}>{p.e}</div>
              <div className="nm">{p.n}</div>
              <div className="ct sf">{p.v}</div>
              <div className="bl sf" style={{ ['--c' as string]: p.c, height: p.h }}>{p.r}</div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="k6" n="06 — Planche contact" title="Un set vu comme une planche contact" desc="Vue dense : toute la checklist ou la collection en miniatures noir et blanc, numéro d'image dessous, et un cercle rouge au feutre autour des cartes à rechercher. Très « photographe », très lisible.">
        <div className="contact">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className={`t${[3, 8, 14, 19].includes(i) ? ' sel' : ''}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ALL[(i * 5) % ALL.length].img} alt="" /><small>{String(i + 1).padStart(2, '0')}</small>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="k7" n="07 — Étiquette de prix" title="Le prix pendu à la carte" desc="Les cartes à vendre portent une vraie étiquette à ficelle, avec le prix en gros Surfquest, au lieu d'une pastille « à vendre ». Visible dans la galerie et sur les fiches.">
        <div className="tagrow">
          {[{ c: C.luwawu, p: '45 €' }, { c: C.mcw, p: '120 €' }, { c: C.maxey, p: '18 €' }].map(x => (
            <div className="pc" key={x.p}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="card" src={x.c.img} alt="" />
              <div className="ptag ink"><div className="str" /><div className="body"><small>À vendre</small><b className="sf">{x.p}</b></div></div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="k8" n="08 — Couverture de magazine" title="Un modèle d'export façon couverture" desc="Un nouveau modèle de partage : « une » de magazine avec le titre MEMORABILIUS, la carte au centre qui chevauche, des accroches de part et d'autre, le numéro, la date et un QR vers la galerie. Idéal pour les réseaux.">
        <div className="cover wht">
          <div className="mast sf">Memorabilius</div>
          <div className="iss"><span>N° 599</span><span>Octobre 2026</span><span>Édition collectionneur</span></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="card pic" src={C.mccain.img} alt="" />
          <div className="cl l sf">Le RC de l&apos;année<small>Jared McCain · Contenders Optic</small></div>
          <div className="cl r sf">Top 4 %<small>des collectionneurs</small></div>
          <div className="bar"><div className="big sf">GKNNN<br />_CARDS</div><div className="qr" /></div>
        </div>
      </Bay>

      <Bay id="k9" n="09 — Radar" title="Le profil de ta collection en radar" desc="Un radar à six axes (RC, auto, patch, num, équipes, sets) : on voit d'un coup d'œil si une collection est plutôt rookies, autographes ou numérotées. Pour le profil public et la comparaison entre collectionneurs.">
        <div className="radar">
          <svg viewBox="0 0 320 300" aria-hidden>
            {[0.25, 0.5, 0.75, 1].map(k => (
              <polygon key={k} points={radar.map((_, i) => `${cx + Math.cos(ang(i)) * R * k},${cy + Math.sin(ang(i)) * R * k}`).join(' ')} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
            ))}
            {radar.map((_, i) => <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(ang(i)) * R} y2={cy + Math.sin(ang(i)) * R} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />)}
            <polygon points={poly} fill="rgba(47,107,255,.45)" stroke="#7aa2ff" strokeWidth="3" strokeLinejoin="miter" />
            {radar.map((r, i) => (
              <g key={r.l}>
                <rect x={cx + Math.cos(ang(i)) * R * r.v - 4} y={cy + Math.sin(ang(i)) * R * r.v - 4} width="8" height="8" fill="#fff" />
                <text x={cx + Math.cos(ang(i)) * (R + 22)} y={cy + Math.sin(ang(i)) * (R + 22) + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="800" letterSpacing="1.5">{r.l.toUpperCase()}</text>
              </g>
            ))}
          </svg>
          <div className="lg">
            {radar.map(r => <span key={r.l}><i style={{ background: '#7aa2ff' }} />{r.l} · {Math.round(r.v * 100)}</span>)}
          </div>
        </div>
      </Bay>

      <Bay id="k10" n="10 — Chargement" title="Des chargements qui retournent des cartes" desc="Remplacer les ronds qui tournent par trois cartes qui se retournent à tour de rôle, et les barres grises par des silhouettes de cartes avec un reflet qui balaie. Le chargement devient du décor.">
        <div className="loaders">
          <div><div className="flipper"><i /><i /><i /></div><div className="cap">Indicateur</div></div>
          <div style={{ display: 'flex', gap: 12 }}><div className="sk" /><div className="sk" /><div className="sk" /></div>
        </div>
      </Bay>

      <Bay id="k11" n="11 — Mur défilant" title="Un mur de cartes qui défile derrière la bannière" desc="Derrière le titre de l'accueil (ou d'une page d'équipe), des colonnes de vraies cartes défilent en sens opposés, inclinées, sous un voile marine. Mouvement et richesse sans gêner la lecture.">
        <div className="wallbg">
          <div className="cols">
            {[0, 1, 2, 3, 4, 5, 6].map(k => (
              <div className="col" key={k}>
                {[...ALL, ...ALL, ...ALL, ...ALL].map((c, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} className="card" src={ALL[(i + k * 2) % ALL.length].img} alt="" />
                ))}
              </div>
            ))}
          </div>
          <div className="fg wht"><span className="eyebrow">Memorabilius</span><h3 className="sf">Ta collection,<br />en vrai.</h3></div>
        </div>
      </Bay>

      <Bay id="k12" n="12 — États vides" title="Les pages vides, avec une carte fantôme" desc="Quand il n'y a rien (aucune carte, aucun échange, 404) : une carte fantôme en pointillés avec un grand point d'interrogation en contour, un titre Surfquest et un bouton clair. Plus engageant qu'un texte gris.">
        <div className="empties">
          <div className="ghost"><span className="q sf">?</span><small>Carte manquante</small></div>
          <div className="txt"><h3 className="sf">0 carte ici</h3><p>Ajoute ta première carte avec le scanner : l&apos;IA remplit tout pour toi.</p><button className="btn">Scanner une carte</button></div>
          <div className="e404">
            <div className="n sf">404</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.hawkins.img} alt="" />
            <div className="cap">Page introuvable</div>
          </div>
        </div>
      </Bay>
    </div>
  )
}
