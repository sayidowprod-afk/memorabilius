'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour renforcer la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit. Remplace l'ancien /design-preview.
// Tout le style est ici, prefixe .ix-, pour ne rien changer sur les vraies pages.

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const C = {
  mccain: { nom: 'Jared McCain', meta: '2024-25 · Panini · Contenders Optic', img: SB + '1787763372857_recto.jpg' },
  edwards: { nom: 'Anthony Edwards', meta: '2020-21 · Panini · Chronicles', img: SB + '1784235265864_recto.jpg' },
  mcw: { nom: 'Michael Carter-Williams', meta: '2013-14 · Panini · Rising Tide', img: SB + '1781875894817_recto.jpg' },
  maxey: { nom: 'Tyrese Maxey', meta: '2020-21 · Court Kings', img: SB + '1781291200820_recto.jpg' },
  hawkins: { nom: 'Hersey Hawkins', meta: '2018-19 · Panini · Prizm', img: SB + '1781534889963_recto.jpg' },
  luwawu: { nom: 'Luwawu-Cabarrot', meta: '2016-17 · Gold Standard', img: SB + 'csv_1790632470730_4f41x1.jpg' },
}

const CSS = `
.ix { --bl:#003da6; --el:#2f6bff; --nuit:#050912; --marine:#08153b; font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ix h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.ix .lead { max-width: 720px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 30px; }
.ix .top { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.ix .back { color:#fff; text-decoration:none; font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.ix .bay { margin: 0 0 54px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .bay h2 { font-size: clamp(28px,4.4vw,44px); margin: 14px 0 6px; line-height: 1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 680px; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,34px); position:relative; overflow:hidden; }
.ix .row { display:flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
.ix .cap { font: 700 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.55); margin-top: 10px; }
.ix .card { display:block; aspect-ratio: 2.5/3.5; object-fit: cover; border-radius: 0; box-shadow: 0 20px 44px rgba(0,0,0,.55); }

/* 01 · eventail */
.ix .fanwrap { position: relative; height: 230px; width: 100%; }
.ix .fan { position:absolute; right: 8px; bottom: 6px; width: 132px; transform-origin: 50% 100%; }
.ix .fan.f0 { transform: rotate(7deg); z-index:3; } .ix .fan.f1 { transform: translateX(-52%) rotate(-3deg); z-index:2; } .ix .fan.f2 { transform: translateX(-104%) rotate(-13deg); z-index:1; }
.ix .hero { display:flex; align-items:center; justify-content:space-between; gap:16px; border: 3px solid rgba(255,255,255,.3); padding: 22px 24px; background: linear-gradient(135deg,#050912 0%,#08153b 48%,#003da6 100%); min-height: 220px; }
.ix .hero .k { font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .hero .n { font-size: clamp(60px,10vw,110px); line-height:.9; }
.ix .hero .fanwrap { width: 330px; flex-shrink:0; }
.ix .cascade { position:relative; width: 170px; height: 250px; }
.ix .cascade img { position:absolute; width: 120px; left:0; }
.ix .cascade img:nth-child(1){ top: 0; transform: rotate(-6deg); } .ix .cascade img:nth-child(2){ top: 34px; left: 22px; transform: rotate(2deg); } .ix .cascade img:nth-child(3){ top: 68px; left: 44px; transform: rotate(8deg); }

/* 02 · holo */
.ix .holo { width: 230px; perspective: 700px; }
.ix .holo-in { position:relative; transform-style: preserve-3d; transition: transform .12s ease-out; will-change: transform; }
.ix .holo-in::after { content:''; position:absolute; inset:0; pointer-events:none; mix-blend-mode: color-dodge; opacity:.0; transition: opacity .2s;
  background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.85) 0%, transparent 38%), linear-gradient(115deg, transparent 20%, rgba(80,160,255,.55) 38%, rgba(255,120,220,.5) 50%, rgba(255,230,90,.5) 62%, transparent 80%); background-size: 100% 100%, 220% 220%; background-position: 0 0, var(--bx,50%) var(--by,50%); }
.ix .holo:hover .holo-in::after { opacity:.55; }

/* 03 · filigrane */
.ix .wm { position:relative; display:flex; justify-content:center; align-items:center; min-height: 340px; }
.ix .wm .big { position:absolute; inset:auto; font-size: clamp(150px,26vw,300px); line-height: .8; color: transparent; -webkit-text-stroke: 3px rgba(255,255,255,.2); white-space: nowrap; letter-spacing: 0; }
.ix .wm .big.fill { color: rgba(47,107,255,.16); -webkit-text-stroke: 0; transform: translate(10px,12px); }
.ix .wm .card { position:relative; width: 200px; transform: rotate(-3deg); }

/* 04 · mosaique */
.ix .mosaic { display:grid; grid-template-columns: repeat(auto-fill, 14px); gap: 3px; max-width: 100%; }
.ix .mosaic i { width:14px; height:14px; border:1.5px solid rgba(255,255,255,.28); display:block; }
.ix .mosaic i.on { background: var(--el); border-color: var(--el); }
.ix .mosaic i.gold { background: #ffd700; border-color: #ffd700; }

/* 05 · medailles */
.ix .medals { display:grid; grid-template-columns: repeat(auto-fill, minmax(112px,1fr)); gap: 14px; }
.ix .medal { aspect-ratio: 1; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; clip-path: polygon(14% 0,86% 0,100% 14%,100% 86%,86% 100%,14% 100%,0 86%,0 14%); }
.ix .medal::before { content:''; position:absolute; inset:5px; clip-path: inherit; background: rgba(0,0,0,.28); }
.ix .medal .v { position:relative; font-size: 46px; line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,.35); }
.ix .medal .l { position:relative; font: 800 10px system-ui; letter-spacing:.14em; text-transform:uppercase; margin-top:4px; }
.ix .m-bronze { background: linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00); color:#2a1500; }
.ix .m-silver { background: linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555); color:#111; }
.ix .m-gold { background: linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b); color:#3d2800; }
.ix .m-locked { background: rgba(255,255,255,.1); color: rgba(255,255,255,.35); }
.ix .m-locked::before { background: transparent; }

/* 06 · lower-third */
.ix .lt { position:relative; width: min(100%, 360px); }
.ix .lt .card { width: 100%; }
.ix .lt .band { position:absolute; left:-14px; right:-14px; bottom: 26px; display:flex; align-items:stretch; filter: drop-shadow(0 8px 14px rgba(0,0,0,.5)); }
.ix .lt .yr { background: var(--el); padding: 8px 14px 8px 12px; font-size: 30px; line-height:1; display:flex; align-items:center; clip-path: polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%); }
.ix .lt .nm { background:#fff; color:#06122e; padding: 6px 22px 6px 20px; margin-left:-12px; flex:1; clip-path: polygon(12px 0,100% 0,100% 100%,0 100%); }
.ix .lt .nm b { display:block; font-size: 25px; line-height:1; } .ix .lt .nm span { font: 700 10px system-ui; letter-spacing:.12em; text-transform:uppercase; color:#456; }

/* 07 · billet d'echange */
.ix .ticket { display:flex; background:#fff; color:#06122e; max-width: 640px; position:relative;
  -webkit-mask: radial-gradient(circle 11px at 0 50%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 11px at 100% 50%, transparent 98%, #000) right / 51% 100% no-repeat;
          mask: radial-gradient(circle 11px at 0 50%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 11px at 100% 50%, transparent 98%, #000) right / 51% 100% no-repeat; }
.ix .ticket .tk { flex:1; padding: 18px 20px; display:flex; gap:14px; align-items:center; }
.ix .ticket .tk .card { width: 78px; box-shadow: 0 6px 14px rgba(0,0,0,.35); }
/* le theme sombre global force la couleur du texte des div : on la fixe explicitement (billet sur fond blanc) */
.ix .ticket .tk > div, .ix .ticket .tk b { color: #06122e !important; }
.ix .ticket .tk small { display:block; font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; color:#567; }
.ix .ticket .tk b { font-size: 24px; line-height: 1; display:block; margin-top:4px; }
.ix .ticket .mid { width: 0; border-left: 3px dashed #0a2468; margin: 10px 0; position:relative; }
.ix .ticket .mid span { position:absolute; top:50%; left:50%; transform: translate(-50%,-50%); background:#003da6; color:#fff; width: 38px; height: 38px; display:flex; align-items:center; justify-content:center; font-size: 22px; }
.ix .ticket .no { background: var(--bl); color:#fff; padding: 0 14px; display:flex; align-items:center; writing-mode: vertical-rl; font: 800 11px system-ui; letter-spacing:.2em; text-transform:uppercase; }

/* 08 · hero coupe diagonale */
.ix .heroes { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)); gap: 16px; }
.ix .dh { position:relative; min-height: 190px; padding: 22px 22px 22px 24px; color:#fff; overflow:hidden;
  background: linear-gradient(135deg, #050912 0%, var(--t) 130%); clip-path: polygon(0 0,100% 0,100% calc(100% - 26px),calc(100% - 26px) 100%,0 100%); border-left: 8px solid var(--t); }
.ix .dh::after { content:''; position:absolute; right:-40px; top:-10px; bottom:-10px; width: 150px; background: var(--t); opacity:.28; transform: skewX(-18deg); }
.ix .dh .k { font: 800 11px system-ui; letter-spacing:.18em; text-transform:uppercase; opacity:.85; }
.ix .dh .t { font-size: 46px; line-height:.95; margin: 8px 0 12px; position:relative; z-index:1; }
.ix .dh .s { display:flex; gap:18px; position:relative; z-index:1; } .ix .dh .s b { font-size: 30px; display:block; line-height:1; } .ix .dh .s span { font: 700 10px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.8; }

/* 09 · vitrine */
.ix .vit { position:relative; display:flex; justify-content:center; padding: 14px 0 70px; min-height: 420px; }
.ix .vit::before { content:''; position:absolute; top:-30px; left:50%; width: 440px; height: 520px; transform: translateX(-50%); pointer-events:none;
  background: conic-gradient(from 180deg at 50% 0%, transparent 150deg, rgba(160,200,255,.20) 168deg, rgba(255,255,255,.5) 180deg, rgba(160,200,255,.20) 192deg, transparent 210deg); filter: blur(2px); }
.ix .vit .col { position:relative; width: 210px; }
.ix .vit .card { width:100%; position:relative; z-index:1; }
.ix .vit .ref { position:absolute; left:0; right:0; top: 100%; transform: scaleY(-1); opacity:.35; -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,.9), transparent 55%); mask-image: linear-gradient(to top, rgba(0,0,0,.9), transparent 55%); }
.ix .vit .floor { position:absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 480px; height: 70px; background: radial-gradient(ellipse at 50% 0%, rgba(120,170,255,.40), transparent 70%); }

/* 10 · odometre */
.ix .odo { display:flex; gap:6px; align-items:flex-end; }
.ix .odo .dg { width: 62px; height: 92px; overflow:hidden; background: #fff; color:#06122e; position:relative; border: 3px solid #fff; }
.ix .odo .dg > div { transition: transform 1.6s cubic-bezier(.2,.9,.2,1); }
.ix .odo .dg span { display:flex; height: 86px; align-items:center; justify-content:center; font-size: 74px; line-height:1; }
.ix .btn { background:#fff; color:#06122e; border:3px solid #fff; padding: 9px 18px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
.ix .btn:hover { background: transparent; color:#fff; }

/* 11 · tampon */
.ix .stampwrap { position:relative; width: 190px; }
.ix .stampwrap .card { width:100%; }
.ix .stamp { position:absolute; right:-16px; top: 18px; transform: rotate(12deg); padding: 3px 10px 1px; border: 4px solid currentColor; font-size: 40px; line-height:1; letter-spacing: .02em; background: rgba(5,9,18,.55); backdrop-filter: blur(2px); }
.ix .stamp.gold { color:#ffd700; } .ix .stamp.silver { color:#e5e8ee; } .ix .stamp.bronze { color:#e0955a; } .ix .stamp.std { color:#b99bff; }
.ix .stamp::after { content:''; position:absolute; inset: 3px; border: 1.5px solid currentColor; opacity:.7; }

.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }
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

function Holo({ c }: { c: { img: string; nom: string } }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`)
    el.style.setProperty('--bx', `${px * 100}%`); el.style.setProperty('--by', `${py * 100}%`)
    el.style.transform = `rotateY(${(px - 0.5) * 22}deg) rotateX(${(0.5 - py) * 22}deg)`
  }
  const leave = () => { if (ref.current) ref.current.style.transform = '' }
  return (
    <div className="holo" onPointerMove={move} onPointerLeave={leave}>
      <div className="holo-in" ref={ref}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="card" src={c.img} alt={c.nom} style={{ width: '100%' }} />
      </div>
    </div>
  )
}

function Odometer({ value, tick }: { value: string; tick: number }) {
  const [shown, setShown] = useState(false)
  useEffect(() => { setShown(false); const t = setTimeout(() => setShown(true), 60); return () => clearTimeout(t) }, [tick])
  return (
    <div className="odo">
      {value.split('').map((ch, i) => {
        const d = parseInt(ch, 10)
        const target = Number.isNaN(d) ? 0 : d
        return (
          <div className="dg sf" key={i}>
            <div style={{ transform: `translateY(${shown ? -target * 86 : 0}px)`, transitionDelay: `${i * 120}ms` }}>
              {Array.from({ length: 10 }, (_, k) => <span key={k}>{k}</span>)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const MEDALS: { v: string; l: string; k: string }[] = [
  { v: '10', l: 'RC', k: 'bronze' }, { v: '25', l: 'Patch', k: 'silver' }, { v: '50', l: 'Auto', k: 'gold' },
  { v: '100', l: 'Num', k: 'gold' }, { v: '250', l: 'Cartes', k: 'locked' }, { v: '500', l: 'Cartes', k: 'locked' },
]

export default function DaIdeas() {
  const [tick, setTick] = useState(0)

  // mosaique : 300 cases, ~26 % possedees, quelques-unes en or (tirages rares) -- generateur deterministe
  const mosaic = useMemo(() => {
    let s = 7
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 300 }, () => { const r = rnd(); return r < 0.02 ? 'gold' : r < 0.28 ? 'on' : '' })
  }, [])
  const owned = mosaic.filter(Boolean).length

  return (
    <div className="ix">
      <style>{CSS}</style>
      <div className="top"><Link href="/admin" className="back">← Admin</Link></div>
      <h1 className="sf">Idées visuelles · Nouvelle DA</h1>
      <p className="lead">Onze pistes pour pousser la direction artistique : angles droits, doubles filets, Surfquest en grand, marine → bleu électrique, métaux or / argent / bronze. Chaque maquette est vivante (survole, clique). Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Éventail', '02 Reflet holo', '03 Filigrane', '04 Mosaïque', '05 Médailles', '06 Bandeau TV', '07 Billet', '08 Hero équipe', '09 Vitrine', '10 Compteur', '11 Tampon'].map((t, i) => <a key={t} href={`#i${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="i1" n="01 — Éventail" title="Les 3 dernières cartes, partout" desc="Déjà sur l'accueil : on le décline sur le profil public (en-tête), en cascade verticale pour les listes, et sur les têtes de classeur / d'équipe. Identité immédiate du collectionneur.">
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="hero" style={{ flex: '1 1 520px' }}>
            <div>
              <div className="k">Profil public</div>
              <div className="n sf">599</div>
              <div className="k">Cartes · Dernier ajout <b>Tyrese Maxey</b></div>
            </div>
            <div className="fanwrap">
              {[C.maxey, C.edwards, C.mccain].map((c, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} className={`card fan f${i}`} src={c.img} alt="" />
              )).reverse()}
            </div>
          </div>
          <div>
            <div className="cascade">
              {[C.hawkins, C.mcw, C.luwawu].map((c, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={i} className="card" src={c.img} alt="" />
              ))}
            </div>
            <div className="cap">Cascade (listes, classeurs)</div>
          </div>
        </div>
      </Bay>

      <Bay id="i2" n="02 — Reflet holo" title="La carte réagit au doigt" desc="Une lueur et un reflet arc-en-ciel suivent le pointeur (ou le doigt), avec une légère inclinaison 3D. Sur la galerie, la fiche, le partage. Coins toujours nets.">
        <div className="row">
          <Holo c={C.mccain} />
          <Holo c={C.hawkins} />
          <Holo c={C.mcw} />
        </div>
        <div className="cap">Survole les cartes</div>
      </Bay>

      <Bay id="i3" n="03 — Filigrane" title="Le numéro géant derrière la carte" desc="Le numéro de carte (ou l'année) en Surfquest, contour + ombre bleue, derrière la carte sur la fiche et le visualiseur. Ça donne du volume et de l'identité à chaque page carte.">
        <div className="wm">
          <div className="big fill sf">#244</div>
          <div className="big sf">#244</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="card" src={C.maxey.img} alt="" />
        </div>
      </Bay>

      <Bay id="i4" n="04 — Mosaïque" title="Une setlist qui se remplit" desc="Chaque carte du set = un petit carré : bleu quand tu l'as, doré pour les tirages rares, vide sinon. On voit d'un coup d'œil où on en est, bien plus parlant qu'une barre de progression.">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
          <span className="sf" style={{ fontSize: 64, lineHeight: 1 }}>{owned}</span>
          <span className="sf" style={{ fontSize: 28, opacity: .6 }}>/ 300</span>
          <span className="cap" style={{ margin: 0 }}>2023-24 Hoops Premium Stock</span>
        </div>
        <div className="mosaic">{mosaic.map((m, i) => <i key={i} className={m} />)}</div>
      </Bay>

      <Bay id="i5" n="05 — Médailles" title="Des badges frappés dans le métal" desc="Octogones à coins coupés, chiffre Surfquest gravé, métal bronze / argent / or : le même langage que les tirages rares. Les paliers non atteints restent en creux.">
        <div className="medals">
          {MEDALS.map(m => (
            <div key={m.v + m.l} className={`medal m-${m.k}`}>
              <div className="v sf">{m.v}</div>
              <div className="l">{m.l}</div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="i6" n="06 — Bandeau TV" title="Le nom façon retransmission sportive" desc="Un bandeau à coupes obliques, comme les incrustations de match : année en bleu, nom en blanc, set en petit. Pour les cartes partagées, le visualiseur, les exports vidéo et photo.">
        <div className="row" style={{ gap: 56 }}>
          <div className="lt">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.mccain.img} alt="" />
            <div className="band">
              <div className="yr sf">2024</div>
              <div className="nm"><b className="sf">Jared McCain</b><span>Contenders Optic · Season Ticket</span></div>
            </div>
          </div>
          <div className="lt" style={{ width: 'min(100%, 300px)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.hawkins.img} alt="" />
            <div className="band">
              <div className="yr sf">2018</div>
              <div className="nm"><b className="sf">Hersey Hawkins</b><span>Panini Prizm · Auto</span></div>
            </div>
          </div>
        </div>
      </Bay>

      <Bay id="i7" n="07 — Billet" title="L'échange comme un billet perforé" desc="Une proposition de trade devient un billet : deux cartes de part et d'autre de la perforation, flèche d'échange au centre, numéro sur le talon. Plus ludique que deux lignes de texte, et lisible tout de suite.">
        <div className="ticket">
          <div className="tk">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.edwards.img} alt="" />
            <div><small>Tu donnes</small><b className="sf">Anthony Edwards</b><small style={{ marginTop: 4 }}>2020-21 · Chronicles</small></div>
          </div>
          <div className="mid"><span className="sf">⇄</span></div>
          <div className="tk" style={{ justifyContent: 'flex-end', textAlign: 'right' }}>
            <div><small>Tu reçois</small><b className="sf">Tyrese Maxey</b><small style={{ marginTop: 4 }}>2020-21 · Court Kings</small></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.maxey.img} alt="" />
          </div>
          <div className="no">Trade n° 0042</div>
        </div>
      </Bay>

      <Bay id="i8" n="08 — Hero équipe" title="Un bandeau coupé en diagonale, aux couleurs de l'équipe" desc="Les en-têtes d'équipe et de joueur reprennent la couleur de l'équipe : bande à gauche, coin coupé, grosse typo. Tu reconnais l'équipe avant même de lire.">
        <div className="heroes">
          {[
            { t: '#006bb6', n: 'Sixers', a: '4 309', b: '796' },
            { t: '#7a3fbf', n: 'Suns', a: '2 112', b: '388' },
            { t: '#1f9d55', n: 'Celtics', a: '3 047', b: '521' },
          ].map(h => (
            <div key={h.n} className="dh" style={{ ['--t' as string]: h.t }}>
              <div className="k">Équipe</div>
              <div className="t sf">{h.n} collectors</div>
              <div className="s"><div><b className="sf">{h.a}</b><span>Cartes</span></div><div><b className="sf">{h.b}</b><span>RC</span></div></div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="i9" n="09 — Vitrine" title="La carte sous projecteur" desc="Pour la carte aléatoire, la page de partage et la carte du jour : faisceau de lumière, reflet au sol. Un moment « musée » quand on met une carte en avant.">
        <div className="vit">
          <div className="floor" />
          <div className="col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card" src={C.luwawu.img} alt="" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="card ref" src={C.luwawu.img} alt="" />
          </div>
        </div>
      </Bay>

      <Bay id="i10" n="10 — Compteur" title="Les chiffres qui défilent" desc="À l'ouverture de l'accueil et des stats, les chiffres Surfquest roulent comme un compteur de stade avant de s'arrêter sur la vraie valeur.">
        <div className="row" style={{ alignItems: 'center' }}>
          <Odometer value="599" tick={tick} />
          <Odometer value="119" tick={tick} />
          <button className="btn" onClick={() => setTick(t => t + 1)}>Rejouer ↻</button>
        </div>
      </Bay>

      <Bay id="i11" n="11 — Tampon" title="Le tirage tamponné sur la carte" desc="Un tampon /125 incliné dans le coin de la vignette, double contour, couleur selon la rareté (or 1/1, argent ≤10, bronze ≤25, violet sinon). Plus visible qu'une pastille quand la carte est petite.">
        <div className="row">
          {[
            { c: C.luwawu, s: '/149', k: 'std' }, { c: C.mccain, s: '/25', k: 'bronze' }, { c: C.hawkins, s: '/10', k: 'silver' }, { c: C.mcw, s: '1/1', k: 'gold' },
          ].map(x => (
            <div key={x.s} className="stampwrap" style={{ width: 150 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="card" src={x.c.img} alt="" />
              <div className={`stamp sf ${x.k}`} style={{ fontSize: 32 }}>{x.s}</div>
            </div>
          ))}
        </div>
      </Bay>
    </div>
  )
}
