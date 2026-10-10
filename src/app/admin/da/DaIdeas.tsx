'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 8 : 20 idees. Tout le style est ici, prefixe .ix.

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
.ix .bay { margin: 0 0 46px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .bay h2 { font-size: clamp(26px,4vw,40px); margin: 12px 0 6px; line-height: 1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 700px; margin: 0 0 16px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,30px); position:relative; overflow:hidden; }
.ix .row { display:flex; gap: 24px; flex-wrap: wrap; align-items: flex-end; }
.ix .cap { font: 700 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.55); margin-top: 10px; }
.ix .card { display:block; aspect-ratio: 2.5/3.5; object-fit: cover; border-radius: 0; box-shadow: 0 14px 30px rgba(0,0,0,.5); width:100%; }
.ix .btn { background:#fff; color:#06122e !important; border:3px solid #fff; padding: 8px 16px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }
.ix .lab { font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; }

/* 1 match wishlist */
.ix .match { display:flex; align-items:stretch; max-width: 560px; filter: drop-shadow(0 10px 20px rgba(0,0,0,.5)); }
.ix .match .ic { width: 64px; background:#ffd54a; display:flex; align-items:center; justify-content:center; font-size: 30px; clip-path: polygon(0 0,100% 0,calc(100% - 12px) 100%,0 100%); }
.ix .match .tx { flex:1; background:#fff; margin-left:-12px; padding: 12px 18px 12px 26px; display:flex; gap: 12px; align-items:center; clip-path: polygon(12px 0,100% 0,100% 100%,0 100%); }
.ix .match .tx img { width: 44px; box-shadow:none; } .ix .match .tx b { display:block; font-size: 26px; line-height:1; } .ix .match .tx span { font: 700 12px system-ui; }
/* 2 mur d'equipes */
.ix .teams { display:grid; grid-template-columns: repeat(auto-fill, minmax(110px,1fr)); gap: 8px; }
.ix .tm { padding: 10px 12px; background: var(--c); min-height: 74px; display:flex; flex-direction:column; justify-content:space-between; }
.ix .tm b { font-size: 34px; line-height:.9; } .ix .tm span { font: 800 10px system-ui; letter-spacing:.12em; text-transform:uppercase; }
/* 3 vote */
.ix .vote { max-width: 560px; display:grid; gap: 10px; }
.ix .vt { display:flex; align-items:center; gap: 12px; } .ix .vt img { width: 44px; box-shadow:none; flex-shrink:0; }
.ix .vt .bar { flex:1; height: 30px; background: rgba(255,255,255,.1); position:relative; } .ix .vt .bar i { position:absolute; inset:0 auto 0 0; background: var(--el); display:flex; align-items:center; padding-left: 10px; font: 800 12px system-ui; }
.ix .vt .bar i.win { background:#ffd54a; } .ix .vt .bar i.win, .ix .vt .bar i.win * { color:#06122e !important; }
.ix .vt .pc { width: 56px; text-align:right; font-size: 24px; }
/* 4 diaporama */
.ix .show { position:relative; height: 320px; background:#000; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.ix .show::before { content:''; position:absolute; inset:0; background: var(--bg) center/cover; filter: blur(30px) brightness(.45); transform: scale(1.3); }
.ix .show .card { position:relative; width: 170px; } .ix .show .cap2 { position:absolute; left: 18px; bottom: 14px; z-index:2; } .ix .show .cap2 b { font-size: 34px; line-height:.9; display:block; } .ix .show .dots { position:absolute; right: 18px; bottom: 18px; display:flex; gap:6px; z-index:2; } .ix .show .dots i { width: 10px; height: 10px; background: rgba(255,255,255,.4); } .ix .show .dots i.on { background:#fff; }
/* 5 spine */
.ix .spines { display:flex; align-items:flex-end; gap: 4px; height: 210px; padding: 0 10px; border-bottom: 12px solid #7a5420; }
.ix .sp { width: 46px; background: var(--c); display:flex; align-items:center; justify-content:center; writing-mode: vertical-rl; transform: rotate(180deg); font: 800 11px system-ui; letter-spacing:.16em; text-transform:uppercase; border: 2px solid rgba(255,255,255,.4); border-bottom:0; transition: transform .2s; cursor:pointer; }
.ix .sp:hover { transform: rotate(180deg) translateX(-14px); }
/* 6 donut */
.ix .donut { display:flex; gap: 28px; flex-wrap:wrap; align-items:center; }
.ix .donut .ring { width: 190px; height:190px; border-radius:50%; background: conic-gradient(#e67e22 0 46%, #2f6bff 46% 74%, #1f9d55 74% 90%, #a45cff 90% 100%); position:relative; }
.ix .donut .ring::after { content:''; position:absolute; inset: 40px; background:#08153b; border-radius:50%; } .ix .donut .mid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:2; } .ix .donut .mid b { font-size: 44px; line-height:.9; }
.ix .lg2 { display:grid; gap:8px; font: 800 12px system-ui; letter-spacing:.08em; text-transform:uppercase; } .ix .lg2 span { display:flex; gap:8px; align-items:center; } .ix .lg2 i { width:14px; height:14px; background: var(--c); display:inline-block; }
/* 7 onboarding */
.ix .onb { display:grid; grid-template-columns: repeat(3,1fr); gap: 10px; max-width: 760px; }
.ix .st3 { border: 3px solid #fff; padding: 14px; position:relative; } .ix .st3 .n { font-size: 54px; line-height:.85; opacity:.9; } .ix .st3 b { display:block; margin-top: 8px; font: 800 13px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .st3 p { margin: 4px 0 0; font-size: 12px; opacity:.75; }
.ix .st3.done { background:#1f9d55; border-color:#1f9d55; }
/* 8 jalon */
.ix .mile { position:relative; text-align:center; padding: 30px 10px; } .ix .mile .n { font-size: clamp(90px,16vw,170px); line-height:.85; text-shadow: 0 0 40px rgba(47,107,255,.9); } .ix .mile .bars { position:absolute; left:0; right:0; top:50%; height: 70%; transform: translateY(-50%); background: repeating-linear-gradient(90deg, rgba(47,107,255,.18) 0 8px, transparent 8px 22px); mask-image: radial-gradient(closest-side, #000, transparent); -webkit-mask-image: radial-gradient(closest-side, #000, transparent); }
/* 9 proches */
.ix .map { position:relative; height: 260px; background: linear-gradient(#0a1030,#0a1030) , repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 30px), repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px 30px); border: 3px solid rgba(255,255,255,.25); }
.ix .pin { position:absolute; transform: translate(-50%,-100%); text-align:center; } .ix .pin b { display:block; width: 38px; height:38px; background:#fff; color:#06122e !important; clip-path: polygon(0 0,100% 0,100% 72%,50% 100%,0 72%); font: 800 14px system-ui; padding-top: 8px; }
.ix .pin small { display:block; font: 800 9px system-ui; letter-spacing:.1em; margin-top:2px; }
/* 10 sparkline */
.ix .spark { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px,1fr)); gap: 10px; max-width: 800px; }
.ix .sk { display:flex; gap: 10px; align-items:center; border: 2px solid rgba(255,255,255,.2); padding: 8px; } .ix .sk img { width: 40px; box-shadow:none; } .ix .sk svg { width: 70px; height: 34px; } .ix .sk b { font-size: 22px; line-height:1; display:block; } .ix .sk span { font: 800 11px system-ui; }
/* 11 sceau */
.ix .seal { width: 150px; height: 150px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-direction:column; text-align:center; background: radial-gradient(circle at 35% 30%, #fff6a8, #ffd700 45%, #b8860b); color:#3d2800 !important; box-shadow: 0 10px 30px rgba(0,0,0,.5), inset 0 0 0 6px rgba(255,255,255,.35), inset 0 0 0 9px rgba(120,80,0,.5); transform: rotate(-8deg); }
.ix .seal * { color:#3d2800 !important; } .ix .seal b { font-size: 34px; line-height:.9; } .ix .seal small { font: 800 9px system-ui; letter-spacing:.16em; text-transform:uppercase; }
/* 12 swipe */
.ix .swipe { position:relative; width: 220px; height: 330px; } .ix .swipe .card { position:absolute; inset:0; height:100%; } .ix .swipe .card:nth-child(1) { transform: rotate(-6deg) scale(.95); } .ix .swipe .card:nth-child(2) { transform: rotate(5deg) scale(.97); } .ix .swipe .stp { position:absolute; top: 16px; left: 14px; z-index:3; border: 4px solid #1f9d55; color:#1f9d55 !important; padding: 2px 12px; font-size: 34px; transform: rotate(-14deg); background: rgba(5,9,18,.5); }
.ix .swbtn { display:flex; gap: 14px; margin-top: 16px; } .ix .swbtn span { width: 56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size: 26px; border: 3px solid currentColor; }
/* 13 postit */
.ix .pc { position:relative; width: 170px; } .ix .postit { position:absolute; right: -28px; bottom: 24px; width: 120px; padding: 10px 10px 12px; background:#ffe56b; transform: rotate(6deg); box-shadow: 0 8px 14px rgba(0,0,0,.45); font: 600 13px/1.25 'Segoe Print','Comic Sans MS',cursive; color:#3a3000 !important; }
.ix .postit * { color:#3a3000 !important; }
/* 14 classement */
.ix .lb { max-width: 520px; } .ix .lrow { display:flex; align-items:center; gap: 12px; padding: 9px 12px; border-bottom: 2px solid rgba(255,255,255,.12); } .ix .lrow .r { width: 34px; font-size: 28px; line-height:1; } .ix .lrow .a { width: 34px; height:34px; border-radius:50%; background: var(--c); flex-shrink:0; } .ix .lrow .nm { flex:1; font: 800 13px system-ui; letter-spacing:.06em; text-transform:uppercase; } .ix .lrow .v { font-size: 26px; } .ix .lrow.me { background: rgba(47,107,255,.35); }
.ix .lrow .d { font: 800 11px system-ui; width: 36px; text-align:right; } .ix .up { color:#3ddc97 !important; } .ix .dn { color:#ff7a7a !important; }
/* 15 carriere */
.ix .career { position:relative; padding: 36px 0 10px; max-width: 760px; } .ix .career::before { content:''; position:absolute; left:0; right:0; top: 56px; height: 4px; background: rgba(255,255,255,.35); }
.ix .career .pts { display:flex; justify-content:space-between; } .ix .cp { position:relative; width: 90px; text-align:center; } .ix .cp i { display:block; width: 18px; height: 18px; background:#fff; margin: 0 auto 10px; border: 3px solid #08153b; box-shadow: 0 0 0 2px #fff; } .ix .cp img { width: 58px; margin: 0 auto 6px; box-shadow:none; } .ix .cp b { font-size: 22px; line-height:1; display:block; } .ix .cp small { font: 700 10px system-ui; opacity:.7; }
/* 16 doublons */
.ix .dups { display:flex; gap: 34px; flex-wrap:wrap; } .ix .dp { position:relative; width: 118px; } .ix .dp .card { position:absolute; left:0; top:0; width:100%; } .ix .dp .card:nth-child(1) { transform: translate(14px,14px) rotate(4deg); filter: brightness(.7); } .ix .dp .card:nth-child(2) { transform: translate(7px,7px) rotate(2deg); filter: brightness(.85); } .ix .dp .box { position:relative; width:100%; aspect-ratio:2.5/3.5; } .ix .dp .box .card { position:relative; }
.ix .dp .x { position:absolute; top:-12px; right:-12px; z-index:4; background:#ffd54a; color:#06122e !important; font-size: 26px; padding: 2px 9px; clip-path: polygon(0 0,100% 0,100% 80%,60% 100%,0 80%); }
/* 17 viseur */
.ix .vis { position:relative; width: 240px; aspect-ratio: 2.5/3.5; } .ix .vis .card { height:100%; filter: brightness(.7); } .ix .vis i { position:absolute; width: 32px; height: 32px; border: 0 solid #2fffa0; animation: ixbl 1.2s ease-in-out infinite; } @keyframes ixbl { 50% { transform: scale(.88); } }
.ix .vis i:nth-of-type(1) { left:-8px; top:-8px; border-width: 4px 0 0 4px; } .ix .vis i:nth-of-type(2) { right:-8px; top:-8px; border-width: 4px 4px 0 0; } .ix .vis i:nth-of-type(3) { left:-8px; bottom:-8px; border-width: 0 0 4px 4px; } .ix .vis i:nth-of-type(4) { right:-8px; bottom:-8px; border-width: 0 4px 4px 0; }
.ix .vis .ln { position:absolute; left:0; right:0; height: 3px; background:#2fffa0; box-shadow: 0 0 14px #2fffa0; animation: ixscan 2.2s ease-in-out infinite alternate; } @keyframes ixscan { from { top: 4%; } to { top: 96%; } }
/* 18 mosaique */
.ix .mosa { columns: 5 90px; column-gap: 6px; } .ix .mosa img { margin-bottom: 6px; width:100%; box-shadow:none; aspect-ratio: auto; }
/* 19 ticker cartes */
.ix .tick { overflow:hidden; background:#fff; padding: 8px 0; } .ix .tick div { display:inline-flex; gap: 22px; align-items:center; white-space:nowrap; animation: ixtk 30s linear infinite; } .ix .tick span { display:inline-flex; align-items:center; gap: 8px; font: 800 12px system-ui; letter-spacing:.08em; text-transform:uppercase; } .ix .tick img { width: 22px; box-shadow:none; } @keyframes ixtk { to { transform: translateX(-50%); } }
/* 20 statut du jour */
.ix .qd { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap: 10px; max-width: 760px; } .ix .qd div { border: 3px solid #fff; padding: 12px; } .ix .qd b { display:block; font-size: 46px; line-height:.9; } .ix .qd small { font: 800 10px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.75; }
@media (prefers-reduced-motion: reduce) { .ix .vis i, .ix .vis .ln, .ix .tick div { animation: none; } }
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
const I = ({ c, w }: { c: { img: string }; w?: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img className="card" src={c.img} alt="" style={w ? { width: w } : undefined} />
)

export default function DaIdeas() {
  const [slide, setSlide] = useState(0)
  useEffect(() => { const id = setInterval(() => setSlide(s => (s + 1) % 4), 2600); return () => clearInterval(id) }, [])
  const names = ['Match de wishlist', 'Mur d’équipes', 'Vote', 'Diaporama', 'Dos de classeurs', 'Anneau', 'Premiers pas', 'Jalon', 'Collectionneurs proches', 'Valeur en courbes', 'Sceau', 'Swipe d’échange', 'Post-it', 'Classement', 'Carrière', 'Doublons', 'Viseur', 'Mosaïque', 'Bandeau live', 'Chiffres du jour']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 8</h1>
      <p className="lead">Vingt nouvelles pistes, des plus petites aux plus ambitieuses : alertes, tableaux, objets, écrans de fonctions. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#q${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="q1" n="01 — Match de wishlist" title="Une carte de ta wishlist vient d'apparaître" desc="Quand un collectionneur ajoute une carte que tu cherches : un bandeau doré « TROUVÉE ! » avec la miniature, le nom et qui la possède. Plus visible qu'une notification texte.">
        <div className="match ink"><div className="ic">🎯</div><div className="tx"><I c={C.maxey} w={44} /><div><b className="sf">Trouvée !</b><span>Tyrese Maxey 2020-21 chez Benlou33</span></div></div></div>
      </Bay>
      <Bay id="q2" n="02 — Mur d'équipes" title="Ta collection par équipe en tuiles de couleur" desc="Une tuile par équipe, à ses couleurs, avec le nombre de cartes en gros : on voit d'un regard quelles équipes dominent. Un clic filtre la galerie.">
        <div className="teams wht">{([['76ers', '#006bb6', 212], ['Suns', '#7a3fbf', 96], ['Celtics', '#1f9d55', 74], ['Lakers', '#b8860b', 58], ['Bulls', '#d4202c', 41], ['Knicks', '#f58426', 36], ['Heat', '#98002e', 22], ['Nets', '#4a4f57', 14]] as [string, string, number][]).map(t => <div key={t[0]} className="tm" style={{ ['--c' as string]: t[1] }}><b className="sf">{t[2]}</b><span>{t[0]}</span></div>)}</div>
      </Bay>
      <Bay id="q3" n="03 — Vote" title="Voter pour la carte de la semaine" desc="Trois cartes en lice, barres de vote animées, pourcentage en gros, la gagnante en doré. Pour un rendez-vous communautaire chaque semaine.">
        <div className="vote wht">{([[C.mccain, 52, true], [C.hawkins, 31, false], [C.mcw, 17, false]] as [typeof C.mccain, number, boolean][]).map(v => <div className="vt" key={v[0].nom}><I c={v[0]} w={44} /><div className="bar"><i className={v[2] ? 'win' : ''} style={{ width: `${v[1]}%` }}>{v[0].nom}</i></div><div className="pc sf">{v[1]}%</div></div>)}</div>
      </Bay>
      <Bay id="q4" n="04 — Diaporama" title="Un mode présentation plein écran" desc="Pour un salon ou une tablette : la carte au centre sur son propre fond flouté, nom en grand en bas à gauche, points de progression. Défilement automatique.">
        <div className="show wht" style={{ ['--bg' as string]: `url(${ALL[slide].img})` }}><I c={ALL[slide]} /><div className="cap2"><b className="sf">{ALL[slide].nom}</b></div><div className="dots">{[0, 1, 2, 3].map(i => <i key={i} className={i === slide ? 'on' : ''} />)}</div></div>
      </Bay>
      <Bay id="q5" n="05 — Dos de classeurs" title="Les classeurs rangés en dos de livre" desc="La bibliothèque montre les classeurs de profil, par couleur, avec le titre vertical ; au survol un classeur sort un peu de l'étagère.">
        <div className="spines wht">{([['Court Kings', '#006bb6', 190], ['Rookies', '#e67e22', 150], ['Autos', '#7a3fbf', 200], ['Old School', '#1f9d55', 170], ['Prizm', '#d4202c', 185], ['PC Iguodala', '#b8860b', 160]] as [string, string, number][]).map(s => <div key={s[0]} className="sp" style={{ ['--c' as string]: s[1], height: s[2] }}>{s[0]}</div>)}</div>
      </Bay>
      <Bay id="q6" n="06 — Anneau" title="La répartition par sport en anneau" desc="Basket, foot, football US, hockey : un anneau coloré avec le total au centre et une légende en carrés. Remplace les barres quand on a plusieurs sports.">
        <div className="donut wht"><div className="ring"><div className="mid"><b className="sf">599</b><span className="lab">cartes</span></div></div><div className="lg2">{([['Basket', '#e67e22', '46 %'], ['Football', '#2f6bff', '28 %'], ['NFL', '#1f9d55', '16 %'], ['Autres', '#a45cff', '10 %']] as [string, string, string][]).map(l => <span key={l[0]}><i style={{ ['--c' as string]: l[1] }} />{l[0]} · {l[2]}</span>)}</div></div>
      </Bay>
      <Bay id="q7" n="07 — Premiers pas" title="Trois étapes pour bien démarrer" desc="Pour un nouveau compte : trois cases numérotées (ajouter une carte, choisir sa couleur, suivre un collectionneur) qui passent au vert à mesure qu'on les fait.">
        <div className="onb wht">{([['1', 'Ajoute une carte', 'Scanne ou prends en photo', true], ['2', 'Choisis ta couleur', 'Couleur d’équipe du profil', true], ['3', 'Suis un collectionneur', 'Découvre l’annuaire', false]] as [string, string, string, boolean][]).map(s => <div key={s[0]} className={`st3${s[3] ? ' done' : ''}`}><div className="n sf">{s[3] ? '✓' : s[0]}</div><b>{s[1]}</b><p>{s[2]}</p></div>)}</div>
      </Bay>
      <Bay id="q8" n="08 — Jalon" title="Un écran quand on atteint 600 cartes" desc="Un grand numéro entouré de rayons verticaux, « Cap des 600 cartes » : un moment de fête, avec un partage en un clic.">
        <div className="mile wht"><div className="bars" /><div className="lab" style={{ position: 'relative' }}>Cap franchi</div><div className="n sf" style={{ position: 'relative' }}>600</div><div className="lab" style={{ position: 'relative' }}>cartes dans ta collection</div></div>
      </Bay>
      <Bay id="q9" n="09 — Collectionneurs proches" title="Les collectionneurs près de chez toi" desc="Une carte stylisée avec des épingles carrées (nombre de cartes) : utile pour repérer des échanges en main propre ou un salon. Position approximative seulement, jamais d'adresse.">
        <div className="map wht">{([[22, 40, '212', 'Lyon'], [48, 68, '96', 'Grenoble'], [70, 30, '74', 'Dijon'], [82, 76, '41', 'Nice']] as [number, number, string, string][]).map(p => <div className="pin" key={p[3]} style={{ left: `${p[0]}%`, top: `${p[1]}%` }}><b className="sf">{p[2]}</b><small>{p[3]}</small></div>)}</div>
      </Bay>
      <Bay id="q10" n="10 — Valeur en courbes" title="La valeur des cartes qui bougent, en mini-courbes" desc="Chaque carte avec une mini-courbe sur 30 jours et la variation. Rien qu'une ligne, mais on voit tout de suite quelles cartes montent.">
        <div className="spark wht">{([[C.maxey, '+18 %', true, 'M0 28 L12 24 L24 26 L36 16 L48 18 L60 8 L70 4'], [C.hawkins, '−6 %', false, 'M0 6 L12 10 L24 8 L36 18 L48 16 L60 24 L70 28'], [C.mccain, '+9 %', true, 'M0 24 L12 20 L24 22 L36 18 L48 12 L60 14 L70 8']] as [typeof C.maxey, string, boolean, string][]).map(s => <div className="sk" key={s[0].nom}><I c={s[0]} w={40} /><svg viewBox="0 0 70 34"><path d={s[3]} fill="none" stroke={s[2] ? '#3ddc97' : '#ff7a7a'} strokeWidth="3" /></svg><div><b className="sf">{s[1]}</b><span>{s[0].nom}</span></div></div>)}</div>
      </Bay>
      <Bay id="q11" n="11 — Sceau" title="Un sceau « collection vérifiée »" desc="Pour les cartes dont la photo a été contrôlée (ou les collections ouvertes depuis un an) : un sceau doré incliné sur la fiche. Un gage de confiance pour les échanges.">
        <div className="row" style={{ alignItems: 'center' }}><div style={{ width: 140 }}><I c={C.mcw} /></div><div className="seal"><b className="sf">Vérifiée</b><small>Collection · 1 an</small></div></div>
      </Bay>
      <Bay id="q12" n="12 — Swipe d'échange" title="Parcourir les cartes à échanger en glissant" desc="Une pile de cartes à échanger : on glisse à droite pour « m'intéresse » (ajouté à une liste), à gauche pour passer. Tampon vert ou rouge selon le sens.">
        <div className="swipe wht"><I c={C.edwards} /><I c={C.maxey} /><div className="stp sf">Intéressé</div><I c={C.hawkins} /></div>
        <div className="swbtn"><span style={{ color: '#ff7a7a' }}>✕</span><span style={{ color: '#3ddc97' }}>♥</span></div>
      </Bay>
      <Bay id="q13" n="13 — Post-it" title="Une note perso collée sur la carte" desc="Les notes personnelles (déjà possibles) apparaissent comme un post-it jaune légèrement incliné sur la vignette, visible seulement par toi.">
        <div className="pc"><I c={C.luwawu} /><div className="postit">Échangée contre la Maxey — à renvoyer avant le 15 !</div></div>
      </Bay>
      <Bay id="q14" n="14 — Classement" title="Le classement hebdomadaire des collectionneurs" desc="Rang en gros, avatar, pseudo, total et flèche de progression ; ta ligne surlignée en bleu. Remonte la compétition amicale.">
        <div className="lb wht">{([['1', 'KathleenFR', '858', '▲2', true], ['2', 'T1T177', '821', '—', false], ['3', 'GKNNN_Cards', '599', '▲1', true], ['4', 'Benlou33', '540', '▼2', false]] as [string, string, string, string, boolean][]).map((r, i) => <div key={r[0]} className={`lrow${i === 2 ? ' me' : ''}`}><div className="r sf">{r[0]}</div><div className="a" style={{ ['--c' as string]: ['#e9b44c', '#9aa6bd', '#2f6bff', '#c47a3a'][i] }} /><div className="nm">{r[1]}</div><div className="v sf">{r[2]}</div><div className={`d ${r[3].startsWith('▲') ? 'up' : r[3].startsWith('▼') ? 'dn' : ''}`}>{r[3]}</div></div>)}</div>
      </Bay>
      <Bay id="q15" n="15 — Carrière" title="La carrière d'un joueur en frise" desc="Sur la page joueur : une ligne du temps par année avec la carte clé de chaque saison (rookie, meilleure année) et le nombre de cartes recensées.">
        <div className="career wht"><div className="pts">{([[C.mcw, '2013', '4'], [C.maxey, '2020', '75'], [C.edwards, '2022', '31'], [C.mccain, '2025', '12']] as [typeof C.mcw, string, string][]).map(p => <div className="cp" key={p[1]}><I c={p[0]} w={58} /><i /><b className="sf">{p[1]}</b><small>{p[2]} cartes</small></div>)}</div></div>
      </Bay>
      <Bay id="q16" n="16 — Doublons" title="Tes doublons en piles avec compteur" desc="Les cartes que tu as en plusieurs exemplaires s'affichent en pile décalée avec un « ×3 » doré : idéal pour préparer des échanges.">
        <div className="dups wht">{([[C.mccain, 3], [C.hawkins, 2], [C.maxey, 4]] as [typeof C.mccain, number][]).map(d => <div className="dp" key={d[0].nom}><div className="box"><I c={d[0]} /></div><div className="card" style={{ position: 'absolute', inset: 0, transform: 'translate(10px,10px) rotate(3deg)', filter: 'brightness(.6)', zIndex: -1 }} /><div className="x sf">×{d[1]}</div></div>)}</div>
      </Bay>
      <Bay id="q17" n="17 — Viseur" title="Un viseur animé pour le scanner" desc="Quatre coins verts qui respirent et un trait lumineux qui balaie la carte pendant l'analyse. On sait que l'IA travaille.">
        <div className="vis"><I c={C.mccain} /><i /><i /><i /><i /><div className="ln" /></div>
      </Bay>
      <Bay id="q18" n="18 — Mosaïque" title="Une galerie en mosaïque sans marges" desc="Option d'affichage : les cartes serrées en colonnes, sans nom ni cadre, pour voir beaucoup de cartes d'un coup, comme un mur.">
        <div className="mosa">{ALL.concat(ALL).concat(ALL).slice(0, 15).map((c, i) => <img key={i} src={c.img} alt="" style={{ aspectRatio: i % 4 === 1 ? '3.5/2.5' : '2.5/3.5', objectFit: 'cover' }} />)}</div>
      </Bay>
      <Bay id="q19" n="19 — Bandeau live" title="Les derniers ajouts de la communauté, en direct" desc="Un bandeau fin sous la barre du haut : de petites cartes et « KathleenFR a ajouté Tyrese Maxey » qui défilent. Donne le sentiment que le site est vivant.">
        <div className="tick ink"><div>{[...ALL, ...ALL, ...ALL, ...ALL].map((c, i) => <span key={i}><img src={c.img} alt="" />{['KathleenFR', 'T1T177', 'Benlou33', 'kevinllg'][i % 4]} · {c.nom}</span>)}</div></div>
      </Bay>
      <Bay id="q20" n="20 — Chiffres du jour" title="Les chiffres de la journée sur le tableau de bord" desc="Quatre cases : cartes ajoutées aujourd'hui sur le site, échanges, nouveaux collectionneurs, ta position. Un coup d'œil pour savoir si ça bouge.">
        <div className="qd wht">{([['+84', 'Cartes ajoutées'], ['23', 'Échanges'], ['+6', 'Nouveaux membres'], ['#3', 'Ton rang']] as [string, string][]).map(q => <div key={q[1]}><b className="sf">{q[0]}</b><small>{q[1]}</small></div>)}</div>
      </Bay>
    </div>
  )
}
