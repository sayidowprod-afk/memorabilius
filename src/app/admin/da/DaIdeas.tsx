'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 5 : les series precedentes sont integrees au site ou ecartees. Tout le style est ici, prefixe .ix.

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

/* 01 · journal */
.ix .tl { position:relative; max-width: 640px; padding-left: 38px; }
.ix .tl::before { content:''; position:absolute; left: 10px; top: 4px; bottom: 4px; width: 4px; background: rgba(255,255,255,.3); }
.ix .ev { position:relative; margin-bottom: 22px; }
.ix .ev::before { content:''; position:absolute; left: -36px; top: 4px; width: 16px; height: 16px; background: var(--c); border: 3px solid #08153b; box-shadow: 0 0 0 2px #fff; }
.ix .ev .d { font-size: 28px; line-height: 1; } .ix .ev .d small { font: 800 10px system-ui; letter-spacing:.16em; opacity:.65; margin-left: 8px; }
.ix .ev p { margin: 4px 0 8px; font-size: 14px; opacity:.88; } .ix .ev .th { display:flex; gap: 6px; }
.ix .ev .th img { width: 46px; box-shadow: 0 4px 10px rgba(0,0,0,.5); }

/* 02 · exemplaires recenses */
.ix .pop { display:grid; grid-template-columns: 150px 1fr; gap: 28px; align-items:start; }
.ix .pop .n { font-size: 84px; line-height:.85; } .ix .pop .lb { font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; opacity:.8; margin: 6px 0 14px; }
.ix .grid149 { display:grid; grid-template-columns: repeat(auto-fill, 13px); gap: 3px; }
.ix .grid149 i { width: 13px; height: 13px; display:block; border: 1.5px solid rgba(255,255,255,.25); }
.ix .grid149 i.on { background: var(--el); border-color: var(--el); } .ix .grid149 i.me { background:#ffd700; border-color:#ffd700; box-shadow: 0 0 10px rgba(255,215,0,.8); }

/* 03 · tournoi */
.ix .bracket { display:flex; align-items:center; gap: 0; max-width: 700px; }
.ix .rd { display:flex; flex-direction:column; justify-content:space-around; gap: 14px; }
.ix .rd .cc { width: 70px; position:relative; } .ix .rd .cc img { box-shadow:none; border: 3px solid rgba(255,255,255,.35); }
.ix .rd .cc.w img { border-color:#ffd700; box-shadow: 0 0 16px rgba(255,215,0,.6); } .ix .rd .cc.l img { filter: grayscale(1) brightness(.6); }
.ix .link { width: 44px; align-self:stretch; display:flex; flex-direction:column; justify-content:space-around; }
.ix .link i { display:block; flex:1; margin: 36px 0; border: 3px solid rgba(255,255,255,.35); border-left: 0; }
.ix .fin { margin-left: 8px; text-align:center; } .ix .fin .cc { width: 110px; } .ix .fin .cc img { border: 4px solid #ffd700; box-shadow: 0 0 26px rgba(255,215,0,.7); }
.ix .fin small { display:block; font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; margin-bottom: 8px; color:#ffd700 !important; }

/* 04 · etagere */
.ix .shelves { display:flex; flex-direction:column; gap: 34px; max-width: 640px; }
.ix .shelf { position:relative; padding: 0 16px; display:flex; gap: 14px; align-items:flex-end; }
.ix .shelf .it { width: 92px; transform-origin: 50% 100%; } .ix .shelf .it:nth-child(1) { transform: rotate(-3deg); } .ix .shelf .it:nth-child(3) { transform: rotate(2.5deg); } .ix .shelf .it:nth-child(4) { transform: rotate(-1.5deg); }
.ix .shelf .it img { box-shadow: 8px 6px 14px rgba(0,0,0,.55); }
.ix .shelf::after { content:''; position:absolute; left: 0; right: 0; bottom: -14px; height: 14px; background: linear-gradient(180deg,#a8742a,#6b4514); box-shadow: 0 10px 18px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.25); }
.ix .shelf .lbl { position:absolute; left: 16px; bottom: -34px; font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; opacity:.7; }

/* 05 · loupe */
.ix .loupe { position:relative; width: 260px; cursor: none; touch-action:none; }
.ix .loupe .lens { position:absolute; width: 120px; height: 120px; border: 4px solid #fff; border-radius: 50%; pointer-events:none; background-repeat:no-repeat; box-shadow: 0 10px 30px rgba(0,0,0,.6), inset 0 0 0 2px #08153b; opacity:0; transition: opacity .12s; }
.ix .loupe:hover .lens { opacity:1; }

/* 06 · centrage */
.ix .center { position:relative; width: 230px; margin: 28px 0 0 54px; }
.ix .center .g { position:absolute; background: rgba(47,255,160,.9); }
.ix .center .gv { top: 0; bottom: 0; width: 2px; } .ix .center .gh { left: 0; right: 0; height: 2px; }
.ix .center .lab { position:absolute; font: 800 11px system-ui; letter-spacing:.08em; background: #08153b; padding: 2px 6px; border: 2px solid rgba(47,255,160,.9); color: #7dffc8 !important; }
.ix .verdict { margin-top: 14px; display:inline-block; background: #12b76a; padding: 7px 14px; font: 800 13px system-ui; letter-spacing:.1em; text-transform:uppercase; }

/* 07 · paquet */
.ix .packwrap { position:relative; width: 170px; height: 440px; }
.ix .pack { position:absolute; left:0; right:0; bottom:0; height: 250px; background: linear-gradient(135deg,#0a2468,#2f6bff 45%,#9db8ff 52%,#2f6bff 58%,#0a2468); z-index: 3;
  clip-path: polygon(0 8px, 6% 0, 12% 8px, 18% 0, 24% 8px, 30% 0, 36% 8px, 42% 0, 48% 8px, 54% 0, 60% 8px, 66% 0, 72% 8px, 78% 0, 84% 8px, 90% 0, 96% 8px, 100% 0, 100% 100%, 0 100%); display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 10px; border-bottom: 4px solid #fff; }
.ix .pack .lg { font-size: 30px; line-height:.9; text-align:center; } .ix .pack small { font: 800 9px system-ui; letter-spacing:.2em; opacity:.85; text-transform:uppercase; }
.ix .packcards img { position:absolute; left: 50%; bottom: 130px; width: 100px; margin-left: -50px; z-index: 2; animation: ixout 1.1s cubic-bezier(.2,.8,.3,1) both !important; }
@keyframes ixout { 0% { transform: translateY(70px) rotate(0); opacity: 0; } 100% { transform: translateY(var(--y)) translateX(var(--x)) rotate(var(--r)); opacity: 1; } }

/* 08 · plaque de salon */
.ix .sign { width: 340px; background:#fff; padding: 20px 20px 16px; text-align:center; box-shadow: 0 24px 50px rgba(0,0,0,.6); border: 6px solid #08153b; outline: 3px solid #fff; }
.ix .sign .big { font-size: 40px; line-height: .9; margin-bottom: 12px; }
.ix .sign .qr { width: 170px; height: 170px; margin: 0 auto 12px; background: repeating-conic-gradient(#06122e 0 25%, #fff 0 50%) 0 0 / 22px 22px; border: 10px solid #06122e; outline: 4px solid #fff; box-shadow: 0 0 0 7px #06122e; }
.ix .sign .th { display:flex; justify-content:center; gap: 8px; margin: 12px 0; } .ix .sign .th img { width: 56px; box-shadow: 0 4px 10px rgba(0,0,0,.4); }
.ix .sign .url { background:#06122e; padding: 6px; font: 800 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color:#fff !important; }

/* 09 · histogramme de miniatures */
.ix .histo { display:flex; align-items:flex-end; gap: 10px; height: 330px; padding-bottom: 26px; position:relative; border-bottom: 4px solid #fff; overflow-x:auto; }
.ix .hcol { display:flex; flex-direction:column-reverse; align-items:center; width: 50px; flex-shrink:0; position:relative; }
.ix .hcol img { width: 44px; margin-top: -42px; box-shadow: 0 2px 6px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.4); }
.ix .hcol img:first-child { margin-top: 0; }
.ix .hcol .yr { position:absolute; bottom: -24px; font: 800 11px system-ui; letter-spacing:.06em; } .ix .hcol .ct { position:absolute; top: -18px; font-size: 20px; line-height: 1; display:none; }

/* 10 · balance */
.ix .scale { max-width: 600px; text-align:center; }
.ix .beam-wrap { position:relative; height: 230px; }
.ix .beam { position:absolute; left: 50%; top: 30px; width: 460px; margin-left: -230px; height: 10px; background: linear-gradient(180deg,#f1dc9a,#b8923a); transform-origin: 50% 50%; transition: transform .6s cubic-bezier(.3,1.4,.5,1); box-shadow: 0 4px 10px rgba(0,0,0,.5); }
.ix .pan { position:absolute; top: 8px; width: 150px; transform-origin: 50% 0; transition: transform .6s cubic-bezier(.3,1.4,.5,1); }
.ix .pan .rope { height: 80px; margin: 0 auto; width: 76px; border-left: 2px solid #d9dde8; border-right: 2px solid #d9dde8; transform: perspective(60px) rotateX(-10deg); clip-path: polygon(50% 0, 100% 100%, 0 100%); background: rgba(255,255,255,.1); }
.ix .pan .tray { background: linear-gradient(180deg,#f1dc9a,#b8923a); padding: 8px 8px 6px; display:flex; flex-direction:column; align-items:center; gap: 4px; clip-path: polygon(0 0,100% 0,88% 100%,12% 100%); }
.ix .pan .tray img { width: 54px; box-shadow:none; } .ix .pan .tray b { font-size: 28px; line-height:1; color:#2a1c00 !important; }
.ix .post { position:absolute; left: 50%; top: 28px; width: 14px; margin-left: -7px; height: 190px; background: linear-gradient(90deg,#8a6420,#e4c46c,#8a6420); }
.ix .base { position:absolute; left: 50%; bottom: 0; width: 160px; margin-left: -80px; height: 16px; background: linear-gradient(180deg,#e4c46c,#6b4514); }
.ix .slider { width: 100%; max-width: 380px; accent-color: var(--el); margin-top: 18px; }
.ix .fair { display:inline-block; margin-top: 10px; padding: 6px 14px; font: 800 12px system-ui; letter-spacing:.12em; text-transform:uppercase; }

/* 11 · couleurs */
.ix .swatches { display:flex; flex-wrap:wrap; gap: 8px; margin-bottom: 18px; }
.ix .swatches button { all: unset; cursor:pointer; width: 44px; height: 44px; background: var(--c); outline: 3px solid transparent; outline-offset: 2px; position:relative; }
.ix .swatches button.on { outline-color:#fff; }
.ix .swatches button span { position:absolute; bottom: -18px; left:0; right:0; text-align:center; font: 800 8px system-ui; letter-spacing:.1em; opacity:.7; text-transform:uppercase; }
.ix .tbanner { border: 3px solid var(--c); padding: 20px 24px; max-width: 700px; display:flex; justify-content:space-between; align-items:flex-end; gap: 16px; flex-wrap:wrap; transition: background .3s, border-color .3s;
  background: radial-gradient(120% 140% at 100% 100%, color-mix(in srgb, var(--c) 85%, transparent), transparent 62%), linear-gradient(135deg,#050912, color-mix(in srgb, var(--c) 30%, #08153b) 55%, var(--c) 135%); }
.ix .tbanner h3 { margin:0; font-size: 56px; line-height:.9; } .ix .tbanner .st { display:flex; gap: 22px; } .ix .tbanner .st b { font-size: 40px; line-height:1; display:block; } .ix .tbanner .st small { font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.8; }

/* 12 · compte a rebours */
.ix .clock { display:inline-block; background:#0a0a0a; border: 6px solid #2a2a2a; padding: 18px 24px 14px; box-shadow: 0 20px 40px rgba(0,0,0,.6), inset 0 0 0 2px #000; }
.ix .clock .dg { display:flex; align-items:flex-end; gap: 8px; }
.ix .clock .u { text-align:center; } .ix .clock .v { font-size: 88px; line-height:.9; color:#ff3b30 !important; text-shadow: 0 0 22px rgba(255,59,48,.85); position:relative; display:block; font-variant-numeric: tabular-nums; }
.ix .clock .v::after { content:''; position:absolute; inset:0; background: radial-gradient(circle, rgba(10,10,10,.85) 38%, transparent 42%) 0 0/4px 4px; pointer-events:none; }
.ix .clock .l { font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; color:#7a2a26 !important; margin-top: 4px; }
.ix .clock .sep { font-size: 70px; line-height:.9; color:#ff3b30 !important; text-shadow: 0 0 18px rgba(255,59,48,.8); padding-bottom: 20px; }
.ix .clock .evt { text-align:center; margin-bottom: 10px; font: 800 12px system-ui; letter-spacing:.24em; text-transform:uppercase; color:#e9b44c !important; }
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

function Loupe({ src }: { src: string }) {
  const [pos, setPos] = useState({ x: 0, y: 0, px: 0, py: 0 })
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top, px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height })
  }
  const Z = 3
  return (
    <div className="loupe" onPointerMove={move}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card" src={src} alt="" draggable={false} />
      <div className="lens" style={{ left: pos.x - 60, top: pos.y - 60, backgroundImage: `url(${src})`, backgroundSize: `${260 * Z}px ${364 * Z}px`, backgroundPosition: `${-(pos.px * 260 * Z - 60)}px ${-(pos.py * 364 * Z - 60)}px` }} />
    </div>
  )
}

export default function DaIdeas() {
  const [pack, setPack] = useState(0)
  const [diff, setDiff] = useState(35) // 0..100 : 50 = equilibre
  const [team, setTeam] = useState(0)
  const [left, setLeft] = useState(2 * 86400 + 14 * 3600 + 37 * 60 + 12)
  useEffect(() => { const id = setInterval(() => setLeft(l => (l > 0 ? l - 1 : 0)), 1000); return () => clearInterval(id) }, [])
  const two = (n: number) => String(n).padStart(2, '0')
  const dd = Math.floor(left / 86400), hh = Math.floor((left % 86400) / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60

  const teams = [{ n: 'Sixers', c: '#006bb6' }, { n: 'Suns', c: '#7a3fbf' }, { n: 'Celtics', c: '#1f9d55' }, { n: 'Lakers', c: '#e9b44c' }, { n: 'Bulls', c: '#d4202c' }, { n: 'Knicks', c: '#f58426' }, { n: 'Heat', c: '#98002e' }, { n: 'Nets', c: '#4a4f57' }]
  const years = [2013, 2016, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
  const counts = [2, 3, 2, 4, 6, 5, 4, 6, 8, 3]
  const valA = Math.round(60 + (diff - 50) * 1.2), valB = 95
  const gap = Math.abs(valA - valB)
  // le cote le plus cher descend (rotation positive = sens horaire = plateau de droite vers le bas)
  const tilt = Math.max(-14, Math.min(14, (valB - valA) * 0.2))
  const fair = gap <= 12

  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 5</h1>
      <p className="lead">Douze nouvelles pistes, plus orientées « fonctions » : fil d&apos;activité, exemplaires recensés, tournoi, étagère, loupe, centrage, ouverture de paquet, plaque de salon, balance d&apos;échange… Chaque maquette est vivante : survole, clique, bouge le curseur. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Journal', '02 Exemplaires', '03 Tournoi', '04 Étagère', '05 Loupe', '06 Centrage', '07 Paquet', '08 Plaque de salon', '09 Histogramme', '10 Balance', '11 Couleurs', '12 Compte à rebours'].map((t, i) => <a key={t} href={`#n${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="n1" n="01 — Journal" title="Le fil d'activité en frise verticale" desc="La page Activité devient une frise : un carré coloré par événement (ajout, échange, badge), la date en Surfquest, une phrase et les miniatures des cartes concernées. Se lit comme un journal de bord.">
        <div className="tl">
          {[
            { d: '10 Oct.', t: 'Aujourd\'hui', p: 'KathleenFR a ajouté 3 cartes à sa collection.', c: '#2f6bff', imgs: [C.maxey, C.edwards, C.mccain] },
            { d: '08 Oct.', t: 'Il y a 2 j', p: 'Échange conclu avec Benlou33 : Hersey Hawkins contre Luwawu-Cabarrot.', c: '#1f9d55', imgs: [C.hawkins, C.luwawu] },
            { d: '05 Oct.', t: 'Il y a 5 j', p: 'Badge débloqué : 100 rookie cards.', c: '#e9b44c', imgs: [C.mcw] },
          ].map(e => (
            <div className="ev" key={e.d} style={{ ['--c' as string]: e.c }}>
              <div className="d sf">{e.d}<small>{e.t}</small></div>
              <p>{e.p}</p>
              <div className="th">{e.imgs.map((c, i) => <div key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="n2" n="02 — Exemplaires recensés" title="Combien d'exemplaires de cette carte existent sur le site" desc="Sur une carte numérotée /149 : une grille de 149 carrés, bleus pour les exemplaires recensés chez des collectionneurs, un carré doré pour le tien. On voit la rareté réelle, pas seulement le tirage.">
        <div className="pop">
          <div>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.luwawu.img} alt="" /></div>
          <div>
            <div className="n sf">7</div>
            <div className="lb">exemplaires recensés sur 149</div>
            <div className="grid149">{Array.from({ length: 149 }, (_, i) => <i key={i} className={i === 38 ? 'me' : [4, 12, 26, 55, 71, 104].includes(i) ? 'on' : ''} />)}</div>
            <div className="cap">Le carré doré, c&apos;est le tien (n° 039)</div>
          </div>
        </div>
      </Bay>

      <Bay id="n3" n="03 — Tournoi" title="Voter pour la plus belle carte, en tableau" desc="Un événement communautaire « Card Madness » : huit cartes, quarts, demis, finale, avec les vainqueurs en doré et les éliminées en gris. Tout le monde vote à chaque tour, le tableau avance chaque jour.">
        <div className="bracket">
          <div className="rd">{ALL.slice(0, 4).map((c, i) => <div key={i} className={`cc ${i % 2 ? 'l' : 'w'}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div>
          <div className="link"><i /><i /></div>
          <div className="rd">{[C.mccain, C.maxey].map((c, i) => <div key={i} className={`cc ${i ? 'l' : 'w'}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div>
          <div className="link"><i style={{ margin: '70px 0' }} /></div>
          <div className="fin"><small>Finale</small><div className="cc">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mccain.img} alt="" /></div></div>
        </div>
      </Bay>

      <Bay id="n4" n="04 — Étagère" title="Les classeurs et collections sur une étagère en bois" desc="La vue « bibliothèque » des classeurs et des collections : des cartes debout, légèrement penchées, sur une planche de bois avec ombre et étiquette. Plus chaleureux qu'une grille.">
        <div className="shelves">
          {[{ l: 'Court Kings', cs: [C.maxey, C.edwards, C.mccain, C.hawkins] }, { l: 'Rookies', cs: [C.mcw, C.luwawu, C.maxey, C.edwards] }].map(s => (
            <div className="shelf" key={s.l}>
              {s.cs.map((c, i) => <div className="it" key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}
              <span className="lbl">{s.l}</span>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="n5" n="05 — Loupe" title="Inspecter une carte à la loupe" desc="Une loupe ronde suit le doigt ou la souris et grossit trois fois la zone : coins, surface, signature, numérotation. Pour la fiche, l'estimation de gradation et les photos de carte à vendre.">
        <Loupe src={C.hawkins.img} />
        <div className="cap">Passe la souris sur la carte</div>
      </Bay>

      <Bay id="n6" n="06 — Centrage" title="Des repères de centrage sur la carte" desc="Pour l'estimation de gradation : traits verts à gauche/droite et en haut/bas, ratios en pastilles (52/48), verdict en une ligne. Le centrage devient visible au lieu de rester une impression.">
        <div className="center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="card" src={C.mccain.img} alt="" />
          <i className="g gv" style={{ left: '6%' }} /><i className="g gv" style={{ right: '6.5%' }} /><i className="g gh" style={{ top: '4.5%' }} /><i className="g gh" style={{ bottom: '4%' }} />
          <span className="lab" style={{ top: '48%', left: '-8px', transform: 'translateX(-100%)' }}>G 52</span>
          <span className="lab" style={{ top: '48%', right: '-8px', transform: 'translateX(100%)' }}>D 48</span>
          <span className="lab" style={{ left: '40%', top: '-12px', transform: 'translateY(-100%)' }}>H 51</span>
          <span className="lab" style={{ left: '40%', bottom: '-12px', transform: 'translateY(100%)' }}>B 49</span>
        </div>
        <div style={{ height: 22 }} /><div className="verdict wht">Centrage 52/48 · excellent</div>
      </Bay>

      <Bay id="n7" n="07 — Paquet" title="L'ajout de plusieurs cartes comme une ouverture de paquet" desc="Quand on ajoute un lot de cartes : un paquet scellé, déchiré en haut, d'où les cartes sortent une à une avant de se ranger dans la galerie. Un petit rituel de collectionneur.">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="packwrap" key={pack}>
            <div className="packcards">
              {[C.mccain, C.maxey, C.edwards].map((c, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="card" src={c.img} alt="" style={{ animationDelay: `${0.3 + i * 0.35}s`, ['--y' as string]: `${-140 - i * 4}px`, ['--x' as string]: `${(i - 1) * 62 + 44}px`, ['--r' as string]: `${(i - 1) * 12}deg` }} />
              ))}
            </div>
            <div className="pack wht"><div className="lg sf">Memorabilius</div><small>Lot de 3 cartes</small></div>
          </div>
          <button className="btn" onClick={() => setPack(p => p + 1)}>Ouvrir ↻</button>
        </div>
      </Bay>

      <Bay id="n8" n="08 — Plaque de salon" title="Un panneau à imprimer pour les salons de cartes" desc="Un visuel A5 prêt à imprimer ou à afficher sur une tablette : « SCANNE POUR VOIR MA COLLECTION », QR géant, nom du collectionneur, trois cartes phares et l'adresse. Idéal pour les card shows.">
        <div className="sign ink">
          <div className="big sf">Scanne pour voir ma collection</div>
          <div className="qr" />
          <div className="sf" style={{ fontSize: 26, lineHeight: 1 }}>GKNNN_Cards</div>
          <div className="th">{[C.mcw, C.luwawu, C.mccain].map((c, i) => <div key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}</div>
          <div className="url">memorabilius.fr/galerie/gknnn-cards</div>
        </div>
      </Bay>

      <Bay id="n9" n="09 — Histogramme" title="Ta collection par année, en piles de cartes" desc="Dans les stats : un histogramme où chaque barre est une pile de vraies miniatures (plus tu as de cartes cette année-là, plus la pile monte). On voit les périodes qui t'intéressent sans lire un chiffre.">
        <div className="histo">
          {years.map((y, k) => (
            <div className="hcol" key={y}>
              {Array.from({ length: counts[k] }, (_, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} className="card" src={ALL[(i + k) % ALL.length].img} alt="" />
              ))}
              <span className="yr">{y}</span>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="n10" n="10 — Balance" title="La balance d'un échange" desc="Pour proposer ou juger un trade : une balance dorée qui penche du côté le plus cher, valeurs sous chaque plateau, verdict « équilibré » ou « écart de X € ». Bouge le curseur pour voir.">
        <div className="scale">
          <div className="beam-wrap">
            <div className="post" /><div className="base" />
            <div className="beam" style={{ transform: `rotate(${tilt}deg)` }} />
            <div className="pan" style={{ left: 'calc(50% - 230px - 75px + 0px)', transform: `translateY(${(50 - diff) * 0.0}px)` }}>
              <div style={{ transform: `translateY(${Math.sin((tilt * Math.PI) / 180) * -230}px)`, transition: 'transform .6s cubic-bezier(.3,1.4,.5,1)' }}>
                <div className="rope" /><div className="tray">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.edwards.img} alt="" /><b className="sf">{valA} €</b></div>
              </div>
            </div>
            <div className="pan" style={{ left: 'calc(50% + 230px - 75px)' }}>
              <div style={{ transform: `translateY(${Math.sin((tilt * Math.PI) / 180) * 230}px)`, transition: 'transform .6s cubic-bezier(.3,1.4,.5,1)' }}>
                <div className="rope" /><div className="tray">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.maxey.img} alt="" /><b className="sf">{valB} €</b></div>
              </div>
            </div>
          </div>
          <input className="slider" type="range" min={0} max={100} value={diff} onChange={e => setDiff(Number(e.target.value))} aria-label="Valeur" />
          <div><span className={`fair wht`} style={{ background: fair ? '#12b76a' : '#e5484d' }}>{fair ? 'Échange équilibré' : `Écart de ${gap} €`}</span></div>
        </div>
      </Bay>

      <Bay id="n11" n="11 — Couleurs d'équipe" title="Choisir la couleur de son profil par équipe" desc="Au lieu d'un sélecteur de couleur libre : une palette de couleurs d'équipe (maillots) avec aperçu en direct du bandeau de profil. Plus rapide et plus joli, et ça raconte quelle équipe tu collectionnes.">
        <div className="swatches">{teams.map((t, i) => <button key={t.n} className={team === i ? 'on' : ''} style={{ ['--c' as string]: t.c }} onClick={() => setTeam(i)} aria-label={t.n}><span>{t.n}</span></button>)}</div>
        <div style={{ height: 8 }} />
        <div className="tbanner wht" style={{ ['--c' as string]: teams[team].c }}>
          <div><div className="cap" style={{ marginTop: 0 }}>Aperçu du profil</div><h3 className="sf">GKNNN_Cards</h3></div>
          <div className="st"><div><b className="sf">599</b><small>Cartes</small></div><div><b className="sf">119</b><small>RC</small></div><div><b className="sf">29</b><small>Auto</small></div></div>
        </div>
      </Bay>

      <Bay id="n12" n="12 — Compte à rebours" title="Le compte à rebours des événements façon shot clock" desc="Pour les événements (salons, sorties de sets, quiz en direct) : un grand compte à rebours rouge à pastilles lumineuses, jours / heures / minutes / secondes, dans un boîtier noir de salle.">
        <div className="clock">
          <div className="evt">Salon Paris Cartes · dans</div>
          <div className="dg">
            {[[dd, 'Jours'], [hh, 'Heures'], [mm, 'Min'], [ss, 'Sec']].map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                {i > 0 && <span className="sep sf">:</span>}
                <div className="u"><span className="v sf">{two(u[0] as number)}</span><div className="l">{u[1]}</div></div>
              </div>
            ))}
          </div>
        </div>
      </Bay>
    </div>
  )
}
