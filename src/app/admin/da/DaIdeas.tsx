'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 6 : les series precedentes sont integrees au site ou ecartees. Tout le style est ici, prefixe .ix.

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
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* 01 · toploader */
.ix .tlb { position:relative; width: 190px; padding: 16px 12px 22px; background: linear-gradient(135deg, rgba(255,255,255,.28), rgba(255,255,255,.08) 40%, rgba(255,255,255,.2)); border: 2px solid rgba(255,255,255,.55); box-shadow: 0 22px 44px rgba(0,0,0,.55), inset 0 0 0 5px rgba(255,255,255,.12); }
.ix .tlb::before { content:''; position:absolute; left: 8px; right: 8px; top: 6px; height: 7px; background: rgba(255,255,255,.35); }
.ix .tlb::after { content:''; position:absolute; inset:0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.35) 46%, transparent 58%); pointer-events:none; }
.ix .tlb .card { box-shadow:none; }
.ix .tlg { position:absolute; left: 50%; bottom: -12px; transform: translateX(-50%); background:#fff; padding: 3px 12px; font: 800 10px system-ui; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap; z-index:2; }

/* 02 · tapis */
.ix .mat { position:relative; height: 380px; background: radial-gradient(120% 120% at 50% 40%, #12306b, #091a3d 70%); border: 6px solid #0a1228; box-shadow: inset 0 0 60px rgba(0,0,0,.6); overflow:hidden; }
.ix .mat::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(45deg, rgba(255,255,255,.025) 0 2px, transparent 2px 6px); }
.ix .mat .scd { position:absolute; width: 96px; transition: transform .25s; box-shadow: 0 10px 20px rgba(0,0,0,.55); }
.ix .mat .scd:hover { transform: translateY(-14px) rotate(0deg) scale(1.12) !important; z-index: 20 !important; }
.ix .mat .scd .card { box-shadow:none; }

/* 03 · flamme */
.ix .flame { display:flex; align-items:center; gap: 26px; flex-wrap:wrap; }
.ix .flame svg { width: 150px; height: 190px; filter: drop-shadow(0 0 24px rgba(255,140,0,.75)); animation: ixflick 1.4s ease-in-out infinite; transform-origin: 50% 100%; }
@keyframes ixflick { 0%,100% { transform: scale(1,1) rotate(0); } 25% { transform: scale(1.03,.97) rotate(-1.5deg); } 55% { transform: scale(.98,1.04) rotate(1.5deg); } 80% { transform: scale(1.02,.99) rotate(-.8deg); } }
.ix .flame .n { font-size: 120px; line-height: .85; } .ix .flame .lb { font: 800 14px system-ui; letter-spacing:.24em; text-transform:uppercase; margin-top: 8px; }
.ix .flame .rec { font: 700 12px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.7; margin-top: 12px; }
@media (prefers-reduced-motion: reduce) { .ix .flame svg { animation: none; } }

/* 04 · autographes */
.ix .sigs { display:grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: 12px; }
.ix .sig { position:relative; height: 96px; overflow:hidden; background:#ddd; border: 3px solid #fff; }
.ix .sig img { position:absolute; left:0; width:100%; height: auto; bottom: -6%; transform: scale(1.7); transform-origin: 50% 82%; box-shadow:none; filter: contrast(1.15); }
.ix .sig b { position:absolute; left: 0; bottom: 0; background:#06122e; padding: 3px 9px; font: 800 10px system-ui; letter-spacing:.12em; text-transform:uppercase; color:#fff !important; }

/* 05 · maillot */
.ix .jersey { position:relative; width: 230px; height: 260px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; background: linear-gradient(160deg, var(--c), color-mix(in srgb, var(--c) 55%, #000));
  clip-path: polygon(0 12%, 22% 0, 36% 0, 42% 9%, 58% 9%, 64% 0, 78% 0, 100% 12%, 100% 28%, 84% 28%, 84% 100%, 16% 100%, 16% 28%, 0 28%); }
.ix .jersey::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(90deg, rgba(255,255,255,.07) 0 3px, transparent 3px 8px); }
.ix .jersey .nm { position:relative; font: 800 13px system-ui; letter-spacing:.2em; text-transform:uppercase; margin-top: 30px; }
.ix .jersey .no { position:relative; font-size: 128px; line-height: .85; text-shadow: 0 4px 0 rgba(0,0,0,.25); }
.ix .jersey .ct { position:relative; font: 800 11px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.85; margin-top: 8px; }

/* 06 · box score */
.ix .box { width:100%; max-width: 720px; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.ix .box th { text-align:right; padding: 8px 12px; font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; background:#fff !important; color:#06122e !important; }
.ix .box th:first-child { text-align:left; }
.ix .box td { text-align:right; padding: 9px 12px; font-size: 26px; line-height:1; border-bottom: 2px solid rgba(255,255,255,.14); }
.ix .box td:first-child { text-align:left; font: 800 14px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .box td i { display:inline-block; width: 12px; height: 12px; margin-right: 10px; background: var(--c); }
.ix .box tr:nth-child(even) td { background: rgba(255,255,255,.05); } .ix .box td.top { color:#ffd54a !important; }
.ix .box tfoot td { border-bottom: 0; border-top: 4px solid #fff; background: transparent !important; }

/* 07 · gratter */
.ix .scratch { position:relative; width: 230px; aspect-ratio: 2.5/3.5; touch-action:none; cursor: crosshair; }
.ix .scratch .card { position:absolute; inset:0; height:100%; }
.ix .scratch canvas { position:absolute; inset:0; width:100%; height:100%; }

/* 08 · suivi d'envoi */
.ix .steps { display:flex; max-width: 760px; }
.ix .stp { flex:1; position:relative; padding: 16px 12px 14px 26px; background: rgba(255,255,255,.08); margin-right: -1px; clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%); text-align:center; }
.ix .stp:first-child { clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%); }
.ix .stp.done { background: #1f9d55; } .ix .stp.now { background: #2f6bff; animation: ixpulse 1.6s ease-in-out infinite; }
@keyframes ixpulse { 50% { filter: brightness(1.25); } }
.ix .stp .ic { font-size: 26px; line-height:1; } .ix .stp b { display:block; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; margin-top: 6px; } .ix .stp small { font: 600 10px system-ui; opacity:.8; }
@media (prefers-reduced-motion: reduce) { .ix .stp.now { animation: none; } }

/* 09 · accreditation */
.ix .lanyard { position:relative; width: 270px; padding-top: 60px; }
.ix .lanyard::before { content:''; position:absolute; left: 50%; top: -400px; width: 26px; height: 460px; margin-left: -13px; background: repeating-linear-gradient(180deg, #2f6bff 0 14px, #1a47b8 14px 28px); }
.ix .lanyard .clip { position:absolute; left: 50%; top: 40px; width: 46px; height: 26px; margin-left: -23px; background: linear-gradient(180deg,#e6ebf5,#8d97ad); z-index: 2; }
.ix .pass { background:#fff; padding: 20px 18px 16px; text-align:center; box-shadow: 0 26px 50px rgba(0,0,0,.6); position:relative; border-top: 14px solid #08153b; }
.ix .pass .lvl { display:inline-block; background:#08153b; padding: 3px 12px; font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; color:#fff !important; }
.ix .pass .ph { width: 110px; height: 110px; margin: 12px auto 10px; border: 4px solid #06122e; background: linear-gradient(135deg,#0a2468,#2f6bff); display:flex; align-items:center; justify-content:center; font-size: 60px; color:#fff !important; }
.ix .pass .nm { font-size: 34px; line-height: .95; } .ix .pass .ac { font: 800 11px system-ui; letter-spacing:.2em; text-transform:uppercase; margin: 6px 0 12px; }
.ix .pass .qr { width: 86px; height: 86px; margin: 0 auto; background: repeating-conic-gradient(#06122e 0 25%, #fff 0 50%) 0 0 / 14px 14px; border: 6px solid #06122e; outline: 3px solid #fff; box-shadow: 0 0 0 5px #06122e; }
.ix .pass .bar { margin-top: 14px; background:#06122e; padding: 5px; font: 800 10px system-ui; letter-spacing:.18em; text-transform:uppercase; color:#fff !important; }

/* 10 · draft board */
.ix .draft { display:grid; grid-template-columns: repeat(5, 1fr); gap: 6px; max-width: 760px; }
.ix .pick { position:relative; padding: 8px 8px 8px 10px; background: var(--c); min-height: 96px; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; }
.ix .pick .no { font-size: 38px; line-height:.9; opacity:.95; } .ix .pick .pl { font: 800 11px system-ui; letter-spacing:.06em; text-transform:uppercase; line-height:1.15; }
.ix .pick .tm { font: 700 9px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.85; }
.ix .pick .card { position:absolute; right: -6px; bottom: -12px; width: 46px; transform: rotate(8deg); box-shadow: 0 6px 12px rgba(0,0,0,.5); }

/* 11 · galons */
.ix .ranks { display:grid; grid-template-columns: repeat(auto-fit, minmax(110px,1fr)); gap: 14px; max-width: 880px; }
.ix .rk { text-align:center; padding: 14px 6px; background: rgba(255,255,255,.06); border: 2px solid rgba(255,255,255,.18); }
.ix .rk .st { height: 74px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; gap: 3px; margin-bottom: 8px; }
.ix .rk .st i { display:block; width: 54px; height: 14px; background: var(--c); clip-path: polygon(0 55%, 50% 0, 100% 55%, 100% 100%, 50% 45%, 0 100%); }
.ix .rk b { display:block; font-size: 26px; line-height: 1; } .ix .rk small { font: 800 9px system-ui; letter-spacing:.16em; text-transform:uppercase; opacity:.7; }

/* 12 · ruban de chantier */
.ix .tape-card { position:relative; width: 180px; overflow:hidden; }
.ix .tape-card .card { filter: blur(6px) brightness(.6); transform: scale(1.06); }
.ix .tape { position:absolute; left: -30%; width: 160%; padding: 7px 0; background: repeating-linear-gradient(-45deg, #ffd54a 0 16px, #111 16px 32px); text-align:center; font: 800 13px system-ui; letter-spacing:.34em; text-transform:uppercase; box-shadow: 0 6px 14px rgba(0,0,0,.5); }
.ix .tape span { background:#ffd54a; color:#111 !important; padding: 2px 14px; }
.ix .tape.a { top: 34%; transform: rotate(-14deg); } .ix .tape.b { top: 58%; transform: rotate(10deg); }
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

function Scratch({ src }: { src: string }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const down = useRef(false)
  useEffect(() => {
    const c = cv.current; if (!c) return
    const r = c.getBoundingClientRect()
    c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2)
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, c.width, c.height)
    grad.addColorStop(0, '#9aa6bd'); grad.addColorStop(.35, '#e8edf7'); grad.addColorStop(.5, '#b9c4da'); grad.addColorStop(.75, '#f4f7fd'); grad.addColorStop(1, '#8895ae')
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(6,18,46,.55)'; g.font = `${Math.round(c.width * 0.16)}px Surfquest, Impact, sans-serif`; g.textAlign = 'center'
    g.fillText('GRATTE', c.width / 2, c.height / 2 - 8); g.font = `${Math.round(c.width * 0.07)}px system-ui`; g.fillText('TA CARTE DU JOUR', c.width / 2, c.height / 2 + 40)
  }, [])
  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!down.current) return
    const c = cv.current!; const r = c.getBoundingClientRect(); const g = c.getContext('2d')!
    g.globalCompositeOperation = 'destination-out'
    g.beginPath(); g.arc((e.clientX - r.left) * 2, (e.clientY - r.top) * 2, 34, 0, Math.PI * 2); g.fill()
  }
  return (
    <div className="scratch">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="card" src={src} alt="" />
      <canvas ref={cv} onPointerDown={e => { down.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); scratch(e) }} onPointerMove={scratch} onPointerUp={() => { down.current = false }} />
    </div>
  )
}

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 6</h1>
      <p className="lead">Douze nouvelles pistes, plus « objet » : toploader, tapis de table, flamme de série, mur d&apos;autographes, maillot, box score, carte à gratter, suivi d&apos;envoi, accréditation, draft board, galons, ruban de chantier. Chaque maquette est vivante : survole, gratte. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Toploader', '02 Tapis', '03 Flamme', '04 Autographes', '05 Maillot', '06 Box score', '07 Gratter', '08 Suivi d’envoi', '09 Accréditation', '10 Draft board', '11 Galons', '12 Ruban de chantier'].map((t, i) => <a key={t} href={`#o${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="o1" n="01 — Toploader" title="La carte dans son toploader" desc="Pour les cartes protégées : un boîtier rigide transparent avec reflet, bord supérieur épais et une étiquette sur le bas (nom du set ou note perso). Un rendu « objet » plus réaliste qu'une simple image, sans toucher à la carte.">
        <div className="row">
          <div className="tlb">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mccain.img} alt="" /><span className="tlg ink">Contenders Optic</span></div>
          <div className="tlb" style={{ width: 160 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.hawkins.img} alt="" /><span className="tlg ink">Prizm · Auto</span></div>
        </div>
      </Bay>

      <Bay id="o2" n="02 — Tapis" title="Étaler sa collection sur un tapis de table" desc="Une vue « tapis » : les cartes éparpillées sur un feutre marine, légèrement penchées, qui se soulèvent et se redressent au survol. Pour feuilleter une sélection comme si on triait ses cartes à la main.">
        <div className="mat">
          {ALL.concat(ALL).slice(0, 9).map((c, i) => (
            <div key={i} className="scd" style={{ left: `${6 + (i % 5) * 18 + (i > 4 ? 8 : 0)}%`, top: `${i > 4 ? 48 : 8}%`, transform: `rotate(${((i * 37) % 29) - 14}deg)`, zIndex: i }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="card" src={c.img} alt="" />
            </div>
          ))}
        </div>
        <div className="cap">Survole les cartes</div>
      </Bay>

      <Bay id="o3" n="03 — Flamme" title="La série de jours avec une vraie flamme" desc="Le « 53 jours de suite » devient une flamme qui vacille, le nombre en géant dessous, et le record personnel en petit. Plus la série est longue, plus la flamme est grande. Très motivant, très reconnaissable.">
        <div className="flame">
          <svg viewBox="0 0 100 130" aria-hidden>
            <defs><linearGradient id="fl1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff3b00" /><stop offset=".55" stopColor="#ff9a00" /><stop offset="1" stopColor="#ffe26a" /></linearGradient></defs>
            <path d="M50 4 C58 28 86 40 86 78 C86 108 68 126 50 126 C32 126 14 108 14 78 C14 58 26 50 30 34 C40 44 40 56 44 60 C50 44 46 24 50 4Z" fill="url(#fl1)" />
            <path d="M50 52 C56 68 70 78 70 96 C70 112 60 122 50 122 C40 122 30 112 30 96 C30 82 42 76 44 62 C48 68 48 60 50 52Z" fill="#fff3b0" opacity=".85" />
          </svg>
          <div><div className="n sf">53</div><div className="lb">jours de suite</div><div className="rec">Record : 61 jours · prochain palier : 60</div></div>
        </div>
      </Bay>

      <Bay id="o4" n="04 — Autographes" title="Un mur de signatures" desc="Pour les cartes dédicacées : on ne montre que le bas de la carte, zoomé sur la signature, en tuiles larges avec le nom du joueur. Un « livre d'or » des autographes de la collection, très différent de la grille de cartes.">
        <div className="sigs">
          {[C.hawkins, C.mccain, C.mcw, C.luwawu].map(c => (
            <div className="sig" key={c.nom}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /><b>{c.nom}</b></div>
          ))}
        </div>
      </Bay>

      <Bay id="o5" n="05 — Maillot" title="Le numéro de maillot en tête des pages joueur" desc="La fiche joueur s'ouvre sur un maillot aux couleurs de l'équipe : nom de famille en haut, gros numéro Surfquest, nombre de cartes en bas. Un repère immédiat, et un visuel fort pour le partage.">
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="jersey wht" style={{ ['--c' as string]: '#006bb6' }}><div className="nm">Maxey</div><div className="no sf">0</div><div className="ct">75 cartes</div></div>
          <div className="jersey wht" style={{ ['--c' as string]: '#7a3fbf' }}><div className="nm">Booker</div><div className="no sf">1</div><div className="ct">646 cartes</div></div>
        </div>
      </Bay>

      <Bay id="o6" n="06 — Box score" title="Les stats par équipe façon feuille de match" desc="Un tableau « box score » : une ligne par équipe avec carré de couleur, colonnes cartes / RC / auto / patch, meilleur score de chaque colonne en doré, total en pied. Dense, lisible, très sport.">
        <table className="box wht">
          <thead><tr><th>Équipe</th><th>Cartes</th><th>RC</th><th>Auto</th><th>Patch</th></tr></thead>
          <tbody>
            {([['76ers', '#006bb6', 212, 41, 14, 9], ['Suns', '#7a3fbf', 96, 22, 8, 3], ['Celtics', '#1f9d55', 74, 12, 5, 4], ['Lakers', '#e9b44c', 58, 9, 3, 2]] as (string | number)[][]).map(r => (
              <tr key={r[0] as string}><td><i style={{ ['--c' as string]: r[1] }} />{r[0]}</td>{[2, 3, 4, 5].map(k => <td key={k} className={(r[k] as number) === [212, 41, 14, 9][k - 2] ? 'top sf' : 'sf'}>{r[k]}</td>)}</tr>
            ))}
          </tbody>
          <tfoot><tr><td>Total</td><td className="sf">440</td><td className="sf">84</td><td className="sf">30</td><td className="sf">18</td></tr></tfoot>
        </table>
      </Bay>

      <Bay id="o7" n="07 — Gratter" title="Une carte à gratter pour les récompenses" desc="Quand on a une récompense (carte du jour, badge, bonus d'XP) : une pellicule argentée « GRATTE » à effacer du doigt pour révéler ce qu'il y a dessous. Interactif et ludique, sans gros développement.">
        <Scratch src={C.maxey.img} />
        <div className="cap">Gratte avec la souris ou le doigt</div>
      </Bay>

      <Bay id="o8" n="08 — Suivi d'envoi" title="Les échanges avec une barre d'étapes" desc="Un échange accepté se suit en quatre étapes fléchées : Accepté → Expédié → Reçu → Terminé, vert pour fait, bleu qui pulse pour l'étape en cours, gris pour la suite. On voit tout de suite où en est chaque trade.">
        <div className="steps wht">
          {[['✓', 'Accepté', '8 oct.', 'done'], ['📦', 'Expédié', '9 oct.', 'done'], ['📬', 'Reçu', 'en attente', 'now'], ['⭐', 'Terminé', '', '']].map(s => (
            <div key={s[1]} className={`stp ${s[3]}`}><div className="ic">{s[0]}</div><b>{s[1]}</b><small>{s[2]}</small></div>
          ))}
        </div>
      </Bay>

      <Bay id="o9" n="09 — Accréditation" title="Le profil comme un badge d'accréditation" desc="Pour partager son profil : un badge à lanière façon accréditation de salon, avec photo, pseudo, niveau (« COLLECTIONNEUR · NIV. 5 »), QR vers la galerie et bandeau noir en pied. Un objet qu'on a envie de poster.">
        <div className="lanyard">
          <div className="clip" />
          <div className="pass ink">
            <span className="lvl">Accès · Collectionneur</span>
            <div className="ph sf">G</div>
            <div className="nm sf">GKNNN_Cards</div>
            <div className="ac">Niveau 5 · 599 cartes</div>
            <div className="qr" />
            <div className="bar">memorabilius.fr</div>
          </div>
        </div>
      </Bay>

      <Bay id="o10" n="10 — Draft board" title="Une collection par équipe sur un tableau de draft" desc="Pour les sets et les équipes : cases numérotées (n° 1, 2, 3…), couleur de l'équipe, nom du joueur, mini-carte qui dépasse. Évoque la soirée de draft, idéal pour les rookies d'une année ou d'un set.">
        <div className="draft wht">
          {([['1', 'Wembanyama', 'Spurs', '#6b7380', C.maxey], ['2', 'Edwards', 'Wolves', '#0c4a8a', C.edwards], ['3', 'McCain', 'Sixers', '#006bb6', C.mccain], ['4', 'Carter-Williams', 'Sixers', '#006bb6', C.mcw], ['5', 'Maxey', 'Sixers', '#006bb6', C.hawkins]] as [string, string, string, string, { img: string }][]).map(p => (
            <div className="pick" key={p[0]} style={{ ['--c' as string]: p[3] }}>
              <div className="no sf">{p[0]}</div>
              <div><div className="pl">{p[1]}</div><div className="tm">{p[2]}</div></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="card" src={p[4].img} alt="" />
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="o11" n="11 — Galons" title="Le niveau en galons militaires" desc="Le niveau du collectionneur s'affiche en chevrons empilés comme des galons (1 chevron au niveau 1, jusqu'à 5, puis couleur or, puis diamant) à côté de l'avatar. Lisible et collectionnable : on veut gagner ses galons.">
        <div className="ranks wht">
          {[{ n: 1, c: '#c47a3a', l: 'Recrue', lv: 1 }, { n: 3, c: '#9aa6bd', l: 'Habitué', lv: 4 }, { n: 5, c: '#e9b44c', l: 'Confirmé', lv: 8 }, { n: 5, c: '#58c8ff', l: 'Expert', lv: 12 }].map(r => (
            <div className="rk" key={r.l}>
              <div className="st" style={{ ['--c' as string]: r.c }}>{Array.from({ length: r.n }, (_, i) => <i key={i} />)}</div>
              <b className="sf">Niv. {r.lv}</b><small>{r.l}</small>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="o12" n="12 — Ruban de chantier" title="Les cartes privées derrière un ruban de chantier" desc="Pour le propriétaire : les cartes privées sont floutées et barrées de rubans jaune et noir « PRIVÉ ». Impossible de les confondre avec les publiques, plus parlant que la petite pastille rouge actuelle.">
        <div className="row">
          <div className="tape-card">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.edwards.img} alt="" /><div className="tape a"><span>Privé</span></div><div className="tape b"><span>Privé</span></div></div>
          <div style={{ width: 180 }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mcw.img} alt="" /><div className="cap">Carte publique</div></div>
        </div>
      </Bay>
    </div>
  )
}
