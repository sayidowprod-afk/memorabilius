'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 15 : fonds du hero + ameliorations visuelles du site, avec maquette. Tout le style est ici, prefixe .ix.

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

/* serie 12 */
.ix .pnl { max-width: 560px; border: 3px solid #fff; } .ix .pnl > h4 { margin: 0; background:#fff; padding: 7px 14px; font-size: 20px; } .ix .pnl > h4, .ix .pnl > h4 * { color:#06122e !important; }
.ix .row2 { display:flex; align-items:center; gap: 12px; padding: 9px 14px; border-top: 1px solid rgba(255,255,255,.16); font-size: 14px; } .ix .row2 .n { width: 24px; font-size: 22px; } .ix .row2 .av { width: 30px; height: 30px; background:#2f6bff; display:flex; align-items:center; justify-content:center; font-size: 15px; } .ix .row2 b { flex:1; } .ix .row2 em { font-style:normal; font-weight:800; } .ix .row2 .up { color:#3ddc97 !important; font-size: 12px; font-weight:800; }
.ix .row2.me { background: rgba(255,255,255,.12); }
.ix .big { font-size: 44px; line-height: .9; } .ix .bar { height: 18px; background: rgba(255,255,255,.14); margin: 10px 0 6px; position:relative; } .ix .bar i { position:absolute; left:0; top:0; bottom:0; background:#fff; } .ix .sm { font: 700 11px system-ui; letter-spacing:.12em; text-transform:uppercase; opacity:.7; }
.ix .pad { padding: 14px; }
.ix .mini { display:flex; gap: 8px; } .ix .mini img { width: 64px; } .ix .grid4 { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; } .ix .grid4 .c small { display:block; text-align:center; font: 700 10px system-ui; margin-top: 4px; opacity:.8; }
.ix .match { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.16); display:flex; gap: 12px; align-items:center; font-size: 13px; } .ix .match img { width: 38px; } .ix .match .gold { color:#ffd54a !important; font-weight:800; }
.ix .pin { border-left: 6px solid #ffd54a; background: rgba(255,213,74,.1); padding: 12px 16px; max-width: 560px; } .ix .pin .sm { color:#ffd54a !important; }
.ix .rsvp { display:flex; gap: 8px; margin-top: 10px; }
.ix .week { max-width: 560px; border: 3px solid #fff; padding: 16px; } .ix .week .k { display:grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 12px 0; }
.ix .sv { display:flex; gap: 8px; flex-wrap:wrap; } .ix .sv span { border: 2px solid #fff; padding: 7px 14px; font: 800 12px system-ui; letter-spacing:.08em; text-transform:uppercase; } .ix .sv span.on { background:#fff; } .ix .sv span.on, .ix .sv span.on * { color:#06122e !important; } .ix .sv span.add { border-style: dashed; opacity:.7; }
.ix .tl { max-width: 520px; position:relative; padding-left: 22px; } .ix .tl:before { content:''; position:absolute; left: 6px; top: 6px; bottom: 6px; width: 3px; background:#fff; } .ix .tl .st { position:relative; padding: 0 0 16px; font-size: 14px; } .ix .tl .st:before { content:''; position:absolute; left:-22px; top: 4px; width: 15px; height: 15px; background:#06122e; border: 3px solid #fff; } .ix .tl .st.done:before { background:#fff; } .ix .tl .st small { display:block; opacity:.65; font-size: 12px; }
.ix .chart { max-width: 560px; border: 3px solid #fff; padding: 14px; } .ix .chart svg { width:100%; height: 120px; display:block; }
.ix .doc { display:flex; gap: 12px; align-items:center; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.16); } .ix .doc img { width: 44px; } .ix .doc .x2 { background:#ffd54a; padding: 2px 8px; font: 800 12px system-ui; } .ix .doc .x2, .ix .doc .x2 * { color:#06122e !important; }
.ix .two { display:grid; grid-template-columns: 1fr 1fr; max-width: 560px; border: 3px solid #fff; } .ix .two > div { padding: 12px 14px; } .ix .two > div + div { border-left: 1px solid rgba(255,255,255,.25); } .ix .two h5 { margin: 0 0 8px; font: 800 11px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.7; }
.ix .bulkbar { max-width: 560px; background:#fff; display:flex; align-items:center; gap: 10px; padding: 10px 14px; flex-wrap:wrap; } .ix .bulkbar, .ix .bulkbar * { color:#06122e !important; } .ix .bulkbar b { font-size: 18px; margin-right: auto; } .ix .bulkbar span.b { border: 2px solid #06122e; padding: 5px 10px; font: 800 11px system-ui; letter-spacing:.08em; text-transform:uppercase; }
.ix .doc2 { max-width: 460px; background:#fff; padding: 18px; } .ix .doc2, .ix .doc2 * { color:#06122e !important; } .ix .doc2 .l { display:flex; justify-content:space-between; font-size: 12px; padding: 5px 0; border-bottom: 1px solid #ccd; } .ix .doc2 .t { display:flex; justify-content:space-between; margin-top: 10px; font-size: 26px; }
.ix .pcard { max-width: 560px; display:flex; gap: 14px; } .ix .pcard .info { flex:1; } .ix .own { font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; padding: 3px 8px; display:inline-block; margin-top: 6px; } .ix .own.y { background:#3ddc97; } .ix .own.y, .ix .own.y * { color:#06122e !important; } .ix .own.n { border: 2px solid #fff; }
.ix .roster12 { display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-width: 560px; } .ix .roster12 div { aspect-ratio: 1; display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,.3); font-size: 20px; } .ix .roster12 div.ok { background:#fff; } .ix .roster12 div.ok, .ix .roster12 div.ok * { color:#06122e !important; }
.ix .k3 { display:grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 14px; } .ix .gold { color:#ffd54a !important; font-size: 12px; }
.ix .bar { max-width: 640px; }
/* serie 14 : maquettes du hero d'accueil */
.ix .hro { position: relative; max-width: 760px; height: 230px; border: 3px solid #fff; overflow: hidden; background: linear-gradient(135deg, #050912 0%, #0a2468 100%); }
.ix .hro .tx { position: relative; z-index: 3; padding: 20px 24px; }
.ix .hro .k { font: 800 11px system-ui; letter-spacing: .2em; }
.ix .hro .n { font-size: 84px; line-height: .9; margin: 14px 0 4px; }
.ix .hro .l { font: 800 11px system-ui; letter-spacing: .2em; }
.ix .hro .la { font-size: 12px; margin-top: 12px; }
.ix .hro:after { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(90deg, rgba(5,9,18,.92) 0%, rgba(5,9,18,.55) 38%, transparent 70%); pointer-events: none; }
.ix .hro.h5:after, .ix .hro.h3:after { background: linear-gradient(90deg, rgba(5,9,18,.45) 0%, transparent 60%); }
.ix .hro .tiles { position: absolute; right: 0; top: 0; bottom: 0; width: 62%; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; padding: 6px; overflow: hidden; z-index: 1; opacity: .85; }
.ix .hro .tiles img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
.ix .hro .tiles img:nth-child(5n+2) { margin-top: -34px; } .ix .hro .tiles img:nth-child(5n+4) { margin-top: -62px; } .ix .hro .tiles img:nth-child(5n+3) { margin-top: -12px; }
.ix .hro .big1 { position: absolute; right: 30px; top: -30px; width: 260px; aspect-ratio: 2.5/3.5; object-fit: cover; transform: rotate(8deg); box-shadow: 0 20px 50px rgba(0,0,0,.6); z-index: 1; }
.ix .hro .court { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.ix .hro .strip { position: absolute; left: 0; right: 0; bottom: 8px; height: 96px; overflow: hidden; z-index: 1; opacity: .5; }
.ix .hro .strip > div { display: flex; gap: 8px; width: max-content; }
.ix .hro .strip img { height: 96px; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
.ix .hro.h5 { background: linear-gradient(100deg, #c8102e 0%, #1d428a 100%); }
.ix .hro .wm { position: absolute; right: 24px; top: -20px; font-size: 300px; line-height: 1; opacity: .22; z-index: 1; }
.ix .hro .pile { position: absolute; right: -20px; bottom: -60px; width: 330px; height: 300px; z-index: 1; }
.ix .hro .pile img { position: absolute; left: calc(var(--i) * 34px); bottom: calc(var(--i) * 4px); width: 130px; aspect-ratio: 2.5/3.5; object-fit: cover; transform: rotate(calc((var(--i) - 2) * 9deg)); box-shadow: 0 10px 28px rgba(0,0,0,.6); }
.ix .k4 { display: grid; grid-template-columns: repeat(4, 1fr); max-width: 620px; border: 3px solid #fff; } .ix .k4 > div { padding: 12px; text-align: center; border-right: 2px solid rgba(255,255,255,.22); } .ix .k4 > div:last-child { border-right: 0; } .ix .k4 b { display: block; font-size: 52px; line-height: .9; } .ix .k4 small { display: block; font: 800 11px system-ui; letter-spacing: .16em; margin-top: 4px; } .ix .k4 i { display: block; font-style: normal; font: 800 12px system-ui; color: #3ddc97 !important; min-height: 16px; margin-top: 2px; }
@media (max-width: 600px) { .ix .hro .n { font-size: 64px; }  .ix .hro .big1 { width: 190px; } .ix .hro .wm { font-size: 200px; } }
/* serie 15 */
.ix .hro.h7 { background: radial-gradient(ellipse at 75% 0%, #1b3a80 0%, #050912 70%); }
.ix .hro .spot { position: absolute; right: 90px; top: -20px; width: 340px; height: 300px; z-index: 1; background: conic-gradient(from 180deg at 50% 0%, transparent 150deg, rgba(255,235,170,.22) 180deg, transparent 210deg); }
.ix .hro .frames { position: absolute; right: 50px; top: 38px; z-index: 1; display: flex; gap: 14px; }
.ix .hro .frames img { width: 96px; aspect-ratio: 2.5/3.5; object-fit: cover; border: 3px solid #ffd54a; box-shadow: 0 0 0 3px #050912, 0 10px 24px rgba(0,0,0,.6); }
.ix .hro .holo { position: absolute; inset: 0; z-index: 1; background: linear-gradient(115deg, transparent 38%, rgba(255,90,160,.22) 44%, rgba(120,200,255,.28) 50%, rgba(140,255,170,.22) 56%, transparent 62%); }
.ix .hro .duo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; filter: grayscale(1) contrast(1.15); mix-blend-mode: screen; opacity: .45; z-index: 1; }
.ix .hro.h9 { background: #0a2fa8; }
.ix .hro .binder { position: absolute; right: 24px; top: 14px; z-index: 1; display: grid; grid-template-columns: repeat(4, 74px); gap: 8px; }
.ix .hro .binder > div { aspect-ratio: 2.5/3.5; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.05); overflow: hidden; } .ix .hro .binder img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ix .hro .amb { position: absolute; right: 70px; top: 28px; width: 130px; aspect-ratio: 2.5/3.5; object-fit: cover; z-index: 2; box-shadow: 0 14px 34px rgba(0,0,0,.6); }
.ix .hro .amb2 { position: absolute; right: -60px; top: -80px; width: 460px; aspect-ratio: 2.5/3.5; object-fit: cover; filter: blur(46px) saturate(1.5); opacity: .75; z-index: 1; }
.ix .hro .sky { position: absolute; inset: 0; z-index: 1; } .ix .hro .sky i { position: absolute; background: rgba(255,255,255,.75); border-radius: 50%; } .ix .hro .sky i.g { background: #ffd54a; box-shadow: 0 0 12px 3px rgba(255,213,74,.6); }
.ix .hdr { position: relative; max-width: 760px; height: 130px; border: 3px solid #fff; overflow: hidden; background: #050912; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px 22px; } .ix .hdr .ph { position: absolute; inset: 0; display: flex; opacity: .32; } .ix .hdr .ph img { flex: 1; min-width: 0; object-fit: cover; object-position: 50% 30%; } .ix .hdr:after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #050912 15%, transparent); } .ix .hdr * { position: relative; z-index: 2; } .ix .hdr .ph, .ix .hdr .ph img { position: absolute; } .ix .hdr .ph img { position: relative; } .ix .hdr b { font-size: 46px; line-height: .9; }
.ix .ban { max-width: 560px; border: 3px solid #fff; background: #08153b; position: relative; padding-bottom: 14px; } .ix .ban .cv { height: 110px; overflow: hidden; } .ix .ban .cv img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; opacity: .75; } .ix .ban .av { width: 64px; height: 64px; border-radius: 50%; background: #2f6bff; border: 4px solid #08153b; margin: -32px 0 0 20px; display: flex; align-items: center; justify-content: center; font-size: 28px; } .ix .ban b { display: block; margin: 6px 20px 0; font-size: 30px; } .ix .ban small { margin: 0 20px; opacity: .7; }
.ix .team { max-width: 640px; border: 3px solid #fff; padding: 22px; display: flex; gap: 20px; align-items: center; background: linear-gradient(100deg, #c8102e, #1d428a); position: relative; overflow: hidden; } .ix .team .lg { font-size: 130px; line-height: .8; opacity: .3; } .ix .team b { display: block; font-size: 38px; line-height: .95; margin: 4px 0 10px; } .ix .team .k3t { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; } .ix .team .k3t i { font-style: normal; font-size: 24px; display: block; line-height: 1; }
.ix .cover { position: relative; max-width: 640px; height: 170px; border: 3px solid #fff; overflow: hidden; } .ix .cover img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; opacity: .5; } .ix .cover .o { position: absolute; left: 20px; bottom: 16px; } .ix .cover b { display: block; font-size: 40px; line-height: .95; }
.ix .ld { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; } .ix .ld .m { position: relative; font-size: 90px; line-height: 1; color: rgba(255,255,255,.2) !important; } .ix .ld .m i { position: absolute; left: 0; right: 0; bottom: 0; height: 62%; background: rgba(255,255,255,.9); mix-blend-mode: overlay; }
.ix .tex { max-width: 460px; padding: 24px; border: 3px solid #fff; background-color: #08153b; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 1px, transparent 1px 7px); } .ix .tex b { display: block; font-size: 30px; } .ix .tex span { opacity: .7; font-size: 13px; }
.ix .tkt { position: relative; max-width: 520px; display: flex; align-items: center; gap: 14px; padding: 14px 22px; background: #0a0f20; border: 3px solid #fff; } .ix .tkt:before, .ix .tkt:after { content: ''; position: absolute; top: 50%; width: 22px; height: 22px; border-radius: 50%; background: #08153b; border: 3px solid #fff; transform: translateY(-50%); } .ix .tkt:before { left: -14px; } .ix .tkt:after { right: -14px; } .ix .tkt .side { display: flex; gap: 6px; } .ix .tkt .side img { width: 60px; aspect-ratio: 2.5/3.5; object-fit: cover; } .ix .tkt .mid { font-size: 34px; } .ix .tkt .stamp { position: absolute; right: 26px; bottom: 8px; border: 3px solid #ffd54a; color: #ffd54a !important; padding: 2px 8px; font-size: 16px; transform: rotate(-6deg); }
.ix .setc { display: flex; gap: 14px; align-items: center; max-width: 520px; border: 3px solid #fff; padding: 12px; } .ix .setc .cl { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 92px; flex-shrink: 0; } .ix .setc .cl img, .ix .setc .cl div { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; background: rgba(255,255,255,.08); } .ix .setc b { display: block; font-size: 22px; line-height: 1; } .ix .setc .bar { max-width: none; margin: 8px 0 4px; }
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

const Hero = ({ cls, children }: { cls: string; children?: React.ReactNode }) => (
  <div className={`hro wht ${cls}`}>
    {children}
    <div className="tx"><span className="k">MA GALERIE</span><div className="n sf">599</div><span className="l">CARTES</span><div className="la">Dernier ajout <b>Tyrese Maxey</b></div></div>
  </div>
)
const ALL = [C.mccain, C.edwards, C.maxey, C.hawkins, C.mcw, C.luwawu]
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: (i * 53) % 100, y: (i * 37 + (i % 7) * 11) % 100, r: 1 + (i % 4 === 0 ? 2 : 0) + (i % 11 === 0 ? 2 : 0), g: i % 9 === 0 }))

export default function DaIdeas() {
  const names = ['Mosaïque', 'Carte phare', 'Terrain', 'Bandes', 'Équipe favorite', 'Pile', 'Salle de musée', 'Reflet holo', 'Duotone', 'Grille de classeur', 'Lueur floue', 'Constellation', 'En-têtes de page', 'Bannière de profil', 'Page équipe NBA', 'Couverture de team', 'Chargement', 'Texture de fond', 'Chiffres qui roulent', 'Billet de trade', 'Notifs par jour', 'Couverture de set']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 15 · Visuel</h1>
      <p className="lead">01 à 06 : les fonds de « Ma galerie » déjà proposés (la mosaïque est corrigée). 07 à 12 : six nouveaux fonds. 13 à 22 : dix améliorations visuelles ailleurs sur le site. Dis-moi les numéros à faire.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Hero" title="Une mosaïque de tes cartes" desc="Une grille de tes cartes à droite du 599, en quinconce, fondue vers la gauche pour garder le chiffre lisible. Elle change à chaque ajout."><Hero cls="h1"><div className="tiles">{Array.from({ length: 20 }, (_, i) => <img key={i} src={ALL[i % 6].img} alt="" />)}</div></Hero></Bay>
      <Bay id="s2" n="02 — Hero" title="Ta carte phare en très grand" desc="Ta carte n°1 du Grail Wall en grand à droite, légèrement penchée, fondue dans le bleu."><Hero cls="h2"><img className="big1" src={C.mccain.img} alt="" /></Hero></Bay>
      <Bay id="s3" n="03 — Hero" title="Un tracé de terrain en filigrane" desc="Lignes de parquet très discrètes, adaptées au sport principal. Rien ne bouge."><Hero cls="h3"><svg className="court" viewBox="0 0 760 230" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2"><circle cx="560" cy="115" r="62" /><line x1="560" y1="0" x2="560" y2="230" /><rect x="700" y="68" width="90" height="94" /><path d="M700 36 A 130 130 0 0 0 700 194" /></g></svg></Hero></Bay>
      <Bay id="s4" n="04 — Hero" title="Deux bandes de cartes" desc="Deux rangées de tes cartes en bas du hero, à l'opacité réduite. Fixes sur mobile."><Hero cls="h4"><div className="strip"><div>{[...ALL, ...ALL].map((c, i) => <img key={i} src={c.img} alt="" />)}</div></div></Hero></Bay>
      <Bay id="s5" n="05 — Hero" title="Aux couleurs de ton équipe favorite" desc="Dégradé aux couleurs de l'équipe choisie dans le profil, avec son numéro en énorme filigrane."><Hero cls="h5"><span className="wm sf">76</span></Hero></Bay>
      <Bay id="s6" n="06 — Hero" title="Une pile de cartes qui déborde" desc="Des cartes empilées en désordre qui sortent du cadre par le bas à droite."><Hero cls="h6"><div className="pile">{ALL.slice(0, 5).map((c, i) => <img key={i} src={c.img} alt="" style={{ ['--i' as string]: i }} />)}</div></Hero></Bay>

      <Bay id="s7" n="07 — Nouveau hero" title="Une salle de musée sous projecteur" desc="Trois de tes cartes encadrées comme au Grail Wall, éclairées par un cône de lumière descendant. Très noble, très « collection ». Les cartes sont tes trois grails."><Hero cls="h7"><div className="spot" /><div className="frames">{[C.maxey, C.mccain, C.edwards].map(c => <img key={c.nom} src={c.img} alt="" />)}</div></Hero></Bay>
      <Bay id="s8" n="08 — Nouveau hero" title="Un reflet holographique qui balaie le cadre" desc="Une bande de lumière arc-en-ciel très fine passe en diagonale sur le hero, comme sur une carte holo. Fixe dans l'image, ou un seul passage à l'ouverture de la page."><Hero cls="h8"><div className="holo" /></Hero></Bay>
      <Bay id="s9" n="09 — Nouveau hero" title="Ta dernière carte en duotone plein fond" desc="La photo de ta dernière carte ajoutée, recadrée sur tout le hero et teintée en bleu et blanc (duotone). Un fond différent à chaque ajout, toujours dans la couleur du site."><Hero cls="h9"><img className="duo" src={C.hawkins.img} alt="" /></Hero></Bay>
      <Bay id="s10" n="10 — Nouveau hero" title="Une page de classeur en filigrane" desc="Une grille 3×3 de pochettes en creux derrière le chiffre, avec quelques-unes remplies par tes cartes. Rappelle les classeurs sans surcharger."><Hero cls="h10"><div className="binder">{Array.from({ length: 12 }, (_, i) => <div key={i}>{[1, 3, 4, 6, 9].includes(i) && <img src={ALL[i % 6].img} alt="" />}</div>)}</div></Hero></Bay>
      <Bay id="s11" n="11 — Nouveau hero" title="Une lueur floue tirée de ta dernière carte" desc="Ta dernière carte nette à droite, et sa propre image agrandie et floutée derrière elle qui colore tout le fond (effet « ambilight »). Le hero prend les couleurs de la carte."><Hero cls="h11"><img className="amb" src={C.mccain.img} alt="" /><img className="amb2" src={C.mccain.img} alt="" /></Hero></Bay>
      <Bay id="s12" n="12 — Nouveau hero" title="Une constellation : un point par carte" desc="Chaque carte est un point lumineux, les rares (RC, auto, numérotées) brillent en doré. Un ciel qui se remplit au fil de la collection : très graphique et facile à rendre léger."><Hero cls="h12"><div className="sky">{STARS.map((s, i) => <i key={i} className={s.g ? 'g' : ''} style={{ left: `${40 + s.x * 0.6}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2 }} />)}</div></Hero></Bay>

      <Bay id="s13" n="13 — Pages" title="Des en-têtes de page avec bandeau d'image" desc="Setlist, Trades, Wishlist, Galerie : un bandeau fin en haut avec une image liée à la page (cartes, classeur…) très assombrie derrière le titre. Les pages cessent d'être un titre nu sur fond bleu."><div className="hdr wht"><div className="ph"><img src={C.maxey.img} alt="" /><img src={C.edwards.img} alt="" /><img src={C.mccain.img} alt="" /></div><span className="sm">Collection</span><b className="sf">Setlist</b></div></Bay>
      <Bay id="s14" n="14 — Profil" title="Une bannière de profil choisie parmi tes cartes" desc="Sur ton profil public : une image large derrière l'avatar et le nom, choisie parmi tes cartes (recadrée), ou un dégradé aux couleurs de ton équipe. Ton profil a enfin une couverture, comme sur les réseaux."><div className="ban wht"><div className="cv"><img src={C.edwards.img} alt="" /></div><div className="av sf">G</div><b className="sf">GKNNN_CARDS</b><small>599 cartes · niveau 5</small></div></Bay>
      <Bay id="s15" n="15 — Équipe NBA" title="Un en-tête d'équipe aux couleurs de la franchise" desc="La page d'une équipe prend un grand dégradé rouge et bleu, le logo en filigrane, et trois chiffres : collectionneurs, cartes, joueurs. Elle ressemble à une page de club plutôt qu'à une liste."><div className="team wht"><div className="lg sf">76</div><div><span className="sm">NBA</span><b className="sf">Philadelphia 76ers</b><div className="k3t"><span><i className="sf">24</i> collectionneurs</span><span><i className="sf">1 665</i> cartes</span><span><i className="sf">381</i> joueurs</span></div></div></div></Bay>
      <Bay id="s16" n="16 — Teams" title="Une couverture pour chaque team" desc="Les fondateurs choisissent une image de couverture et une couleur pour la team. Elle s'affiche en grand en haut, avec le nombre de membres et le hall of fame en dessous."><div className="cover wht"><img src={C.hawkins.img} alt="" /><div className="o"><b className="sf">Sixers Collectors</b><span>24 membres · fondée en 2026</span></div></div></Bay>
      <Bay id="s17" n="17 — Chargement" title="Un chargement où le M se remplit" desc="Pendant le chargement du site : le logo M se remplit de blanc de bas en haut, au lieu d'une roue. Court, sobre, aux couleurs de la marque, et sans animation rapide."><div className="ld wht"><div className="m sf">M<i /></div><span className="sm">Chargement</span></div></Bay>
      <Bay id="s18" n="18 — Fond de site" title="Une texture discrète sur tout le fond" desc="Un léger grain et une trame de fines lignes diagonales sur le fond bleu des pages, comme du carton de classeur. À peine visible, mais le fond n'est plus un aplat."><div className="tex wht"><b className="sf">Texture de fond</b><span>Fine trame + grain, 4 % d&apos;opacité</span></div></Bay>
      <Bay id="s19" n="19 — Accueil" title="Des chiffres qui roulent à l'ouverture" desc="Le 599 et les stats RC / AUTO / PATCH / NUM comptent de zéro jusqu'à leur valeur en une seconde à l'ouverture de l'accueil (une seule fois par session). Pas d'animation continue."><div className="k4 wht">{([['0 → 599', 'CARTES'], ['0 → 119', 'RC'], ['0 → 29', 'AUTO'], ['0 → 91', 'NUM']] as [string, string][]).map(s => <div key={s[1]}><b className="sf" style={{ fontSize: 28 }}>{s[0]}</b><small>{s[1]}</small></div>)}</div></Bay>
      <Bay id="s20" n="20 — Trades" title="Chaque échange en billet découpé" desc="Dans la page Trades, chaque offre est un billet à bords crantés : tes cartes à gauche, celles de l'autre à droite, une flèche au milieu et un tampon de statut (En attente, Accepté, Refusé)."><div className="tkt wht"><div className="side"><img src={C.maxey.img} alt="" /><img src={C.hawkins.img} alt="" /></div><div className="mid sf">⇄</div><div className="side"><img src={C.edwards.img} alt="" /></div><span className="stamp sf">EN ATTENTE</span></div></Bay>
      <Bay id="s21" n="21 — Notifications" title="Les notifications rangées par jour" desc="En-têtes « Aujourd'hui », « Hier », « Cette semaine » avec un filet épais, et un petit compteur par jour. La liste est lisible d'un coup d'œil au lieu d'une pile continue."><div className="pnl wht"><h4 className="sf">Aujourd&apos;hui · 3</h4><div className="row2"><b>KathleenFR a aimé ta Maxey</b><em>14:02</em></div><div className="row2"><b>Nouveau commentaire sur Jared McCain</b><em>11:40</em></div><h4 className="sf" style={{ marginTop: 6 }}>Hier · 2</h4><div className="row2"><b>Offre d&apos;échange reçue</b><em>18:15</em></div></div></Bay>
      <Bay id="s22" n="22 — Setlist" title="Une couverture en collage sur chaque set" desc="Chaque set de la Setlist affiche un petit collage de TES cartes de ce set (ou une silhouette grisée s'il est vide) à côté du nom et de la jauge. On reconnaît les sets d'un coup d'œil."><div className="setc wht"><div className="cl"><img src={C.maxey.img} alt="" /><img src={C.hawkins.img} alt="" /><img src={C.mcw.img} alt="" /><div /></div><div><b className="sf">2024-25 Panini Select</b><div className="bar"><i style={{ width: '96%' }} /></div><span className="sm">288 / 300 cartes</span></div></div></Bay>
    </div>
  )
}
