'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 11 : 20 idees, plutot fiches, jauges, filtres et details de collection. Tout le style est ici, prefixe .ix.

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

/* 1 */
.ix .tagp { display:inline-block; position:relative; padding-top: 26px; } .ix .tagp:before { content:''; position:absolute; left:50%; top:0; width:2px; height:26px; background:#ffd54a; } .ix .tagp .t { background:#fff; padding: 8px 20px 8px 28px; clip-path: polygon(14px 0,100% 0,100% 100%,14px 100%,0 50%); } .ix .tagp .t b { font-size: 32px; display:block; line-height:.95; } .ix .tagp .t small { font: 700 10px system-ui; letter-spacing:.14em; text-transform:uppercase; }
/* 2 */
.ix .odo { display:flex; gap: 4px; } .ix .odo span { width: 48px; height: 72px; background:#050912; border: 3px solid #fff; display:flex; align-items:center; justify-content:center; font-size: 46px; position:relative; } .ix .odo span:after { content:''; position:absolute; left:0; right:0; top:50%; height:2px; background:rgba(255,255,255,.35); }
/* 3 */
.ix .spec { max-width: 420px; border: 3px solid #fff; } .ix .spec h4 { margin:0; background:#fff; padding: 7px 14px; font-size: 20px; } .ix .spec .r { display:flex; justify-content:space-between; padding: 7px 14px; border-top: 1px solid rgba(255,255,255,.2); font-size: 13px; } .ix .spec .r b { font-weight: 800; }
/* 4 */
.ix .pg { display:grid; grid-template-columns: repeat(3, 76px); gap: 8px; padding: 12px; border: 3px solid rgba(255,255,255,.4); background: rgba(255,255,255,.05); width: max-content; } .ix .pg .sl { aspect-ratio: 2.5/3.5; border: 2px solid rgba(255,255,255,.35); background: rgba(255,255,255,.07); position:relative; overflow:hidden; } .ix .pg .sl img { width:100%; height:100%; object-fit: cover; display:block; } .ix .pg .sl:after { content:''; position:absolute; inset:0; background: linear-gradient(135deg, rgba(255,255,255,.22), transparent 40%); }
/* 5 */
.ix .gauge { max-width: 460px; } .ix .gauge .bars { display:flex; gap: 3px; margin: 8px 0; } .ix .gauge .bars i { flex:1; height: 22px; background: rgba(255,255,255,.14); } .ix .gauge .bars i.on { background: #fff; } .ix .gauge .l { display:flex; justify-content:space-between; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; }
/* 6 */
.ix .heat { display:grid; grid-template-rows: repeat(7, 14px); grid-auto-flow: column; gap: 3px; } .ix .heat i { width: 14px; height: 14px; background: rgba(255,255,255,.1); } .ix .heat i.a { background: #2b4fa8; } .ix .heat i.b { background: #5b8def; } .ix .heat i.c { background: #fff; }
/* 7 */
.ix .bcard { width: 340px; max-width: 100%; aspect-ratio: 1.75; border: 3px solid #fff; display:flex; background: linear-gradient(135deg,#08153b,#0a2468); } .ix .bcard .l { flex:1; padding: 16px; display:flex; flex-direction:column; justify-content:space-between; font-size: 12px; } .ix .bcard .l b { font-size: 26px; line-height:.95; } .ix .bcard .qr { width: 96px; margin: 16px; background:#fff; padding:6px; align-self:center; } .ix .bcard .qr i { display:block; aspect-ratio:1; background: repeating-conic-gradient(#06122e 0 25%, #fff 0 50%) 0 0/16px 16px; }
/* 8 */
.ix .chips { display:flex; flex-wrap:wrap; gap: 8px; } .ix .chips span { border: 2px solid rgba(255,255,255,.5); padding: 6px 12px; font: 800 12px system-ui; letter-spacing:.08em; text-transform:uppercase; display:flex; gap: 8px; align-items:center; cursor:pointer; } .ix .chips span b { background: rgba(255,255,255,.18); padding: 1px 6px; font-size: 11px; } .ix .chips span.on { background:#fff; } .ix .chips span.on, .ix .chips span.on * { color:#06122e !important; } .ix .chips span.on b { background:#06122e; color:#fff !important; }
/* 9 */
.ix .sort { display:inline-flex; border: 3px solid #fff; } .ix .sort div { padding: 9px 16px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; border-right: 2px solid rgba(255,255,255,.4); } .ix .sort div:last-child { border-right:0; } .ix .sort div.on { background:#fff; } .ix .sort div.on, .ix .sort div.on * { color:#06122e !important; }
/* 10 */
.ix .vs { display:flex; align-items:center; gap: 16px; } .ix .vs .c { width: 120px; } .ix .vs .vb { font-size: 44px; color:#ffd54a !important; text-shadow: 0 0 20px rgba(255,213,74,.5); } .ix .vs .st { font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; margin-top: 8px; text-align:center; }
/* 11 */
.ix .tile { position:relative; width: 150px; } .ix .tile .sp { position:absolute; left:0; right:0; bottom:0; height: 44px; background: linear-gradient(transparent, rgba(5,9,18,.92)); display:flex; align-items:flex-end; padding: 6px; } .ix .tile .sp svg { width:100%; height: 28px; } .ix .tile .pr { position:absolute; top: 6px; right: 6px; background:#fff; padding: 2px 8px; font: 800 12px system-ui; }
/* 12 */
.ix .flag { position:relative; width: 130px; } .ix .flag .nw { position:absolute; top: 0; left: 0; background:#e5484d; padding: 4px 22px 4px 10px; font: 800 11px system-ui; letter-spacing:.14em; clip-path: polygon(0 0,100% 0,calc(100% - 10px) 50%,100% 100%,0 100%); }
/* 13 */
.ix .event { max-width: 560px; border: 3px solid #ffd54a; display:flex; align-items:stretch; } .ix .event .d { background:#ffd54a; padding: 10px 16px; text-align:center; } .ix .event .d b { display:block; font-size: 34px; line-height:.9; } .ix .event .d small { font: 800 11px system-ui; letter-spacing:.14em; } .ix .event .d, .ix .event .d * { color:#06122e !important; } .ix .event .i { padding: 10px 16px; } .ix .event .i b { font-size: 20px; }
/* 14 */
.ix .seg { display:inline-flex; background: rgba(255,255,255,.12); padding: 3px; gap: 3px; } .ix .seg div { width: 44px; height: 36px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size: 18px; } .ix .seg div.on { background:#fff; } .ix .seg div.on, .ix .seg div.on * { color:#06122e !important; }
/* 15 */
.ix .pl { max-width: 460px; border: 3px solid #fff; } .ix .pl .bd { background: linear-gradient(90deg,#c8102e 0 70%, #1d428a 70% 100%); padding: 18px 20px; display:flex; align-items:flex-end; justify-content:space-between; } .ix .pl .bd b { font-size: 36px; line-height:.9; } .ix .pl .bd i { font: 800 36px system-ui; opacity:.5; font-style: normal; } .ix .pl .g { display:grid; grid-template-columns: repeat(3,1fr); } .ix .pl .g div { padding: 10px 14px; border-right: 1px solid rgba(255,255,255,.2); } .ix .pl .g div:last-child { border:0; } .ix .pl .g b { font-size: 24px; display:block; } .ix .pl .g small { font: 700 10px system-ui; letter-spacing:.12em; text-transform:uppercase; opacity:.6; }
/* 16 */
.ix .spines { display:flex; gap: 6px; align-items:flex-end; } .ix .spines div { width: 54px; height: 190px; border: 3px solid #fff; display:flex; align-items:center; justify-content:center; } .ix .spines div span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 22px; letter-spacing:.06em; } .ix .spines div:nth-child(2) { height: 170px; background:#1d428a; } .ix .spines div:nth-child(3) { height: 205px; background:#fff; } .ix .spines div:nth-child(3) span { color:#06122e !important; }
/* 17 */
.ix .off { max-width: 520px; background:#ffd54a; padding: 9px 16px; display:flex; gap: 10px; align-items:center; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .off, .ix .off * { color:#06122e !important; }
/* 18 */
.ix .frame { position:relative; width: 230px; aspect-ratio: 2.5/3.5; background: rgba(255,255,255,.05); } .ix .frame i { position:absolute; width: 34px; height: 34px; border: 0 solid #fff; } .ix .frame i:nth-child(1) { left:-4px; top:-4px; border-width: 5px 0 0 5px; } .ix .frame i:nth-child(2) { right:-4px; top:-4px; border-width: 5px 5px 0 0; } .ix .frame i:nth-child(3) { left:-4px; bottom:-4px; border-width: 0 0 5px 5px; } .ix .frame i:nth-child(4) { right:-4px; bottom:-4px; border-width: 0 5px 5px 0; } .ix .frame span { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; font: 800 12px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.7; padding: 20px; }
/* 19 */
.ix .sheet { max-width: 380px; border-top: 4px solid #fff; background:#0a0f20; } .ix .sheet .grip { width: 44px; height: 4px; background: rgba(255,255,255,.4); margin: 10px auto; } .ix .sheet div.it { padding: 14px 20px; border-top: 1px solid rgba(255,255,255,.12); font-size: 15px; font-weight: 700; display:flex; gap: 12px; } .ix .sheet div.it.red, .ix .sheet div.it.red * { color:#ff6b6f !important; }
/* 20 */
.ix .box { max-width: 520px; border: 3px solid #fff; border-collapse: collapse; width:100%; } .ix .box th, .ix .box td { padding: 7px 12px; text-align:right; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,.18); } .ix .box th { background:#fff; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; } .ix .box th, .ix .box th * { color:#06122e !important; } .ix .box td:first-child, .ix .box th:first-child { text-align:left; } .ix .box tr.tot td { background: rgba(255,255,255,.12); font-weight: 800; }
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
  const [chip, setChip] = useState(0)
  const [sort, setSort] = useState(0)
  const [view, setView] = useState(0)
  const names = ['Étiquette de prix', 'Compteur à rouleaux', 'Fiche technique', 'Page de classeur', 'Jauge de set', 'Calendrier d’ajouts', 'Carte de visite', 'Filtres en puces', 'Tri segmenté', 'Face à face', 'Mini-courbe de prix', 'Drapeau Nouveau', 'Bandeau d’événement', 'Grille / liste', 'Fiche joueur', 'Dos de classeur', 'Hors ligne', 'Cadre de prise de vue', 'Feuille d’actions', 'Box score']
  const heat = Array.from({ length: 26 * 7 }, (_, i) => ((i * 7 + (i % 5) * 3 + (i % 11)) % 9 > 5 ? ['', 'a', 'b', 'c'][(i * 3) % 4] : ''))
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 11</h1>
      <p className="lead">Vingt nouvelles pistes autour des fiches, jauges, filtres et petits détails de collection. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Étiquette de prix" title="Le prix en étiquette de vitrine" desc="Le prix d'une carte à vendre s'affiche sur une étiquette blanche à pointe, suspendue par un fil doré, comme en boutique."><div className="tagp ink"><div className="t"><small>À vendre</small><b className="sf">45 €</b></div></div></Bay>
      <Bay id="s2" n="02 — Compteur à rouleaux" title="Le total de cartes en compteur à rouleaux" desc="Chaque chiffre dans sa case, avec une ligne de coupe, comme un odomètre. Les chiffres défilent à l'ouverture de l'accueil."><div className="odo wht">{'0599'.split('').map((d, i) => <span key={i} className="sf">{d}</span>)}</div></Bay>
      <Bay id="s3" n="03 — Fiche technique" title="Les infos d'une carte en fiche technique" desc="Année, marque, collection, tirage, numéro : un tableau net à filets fins, titre blanc. Plus lisible que des étiquettes en vrac."><div className="spec wht"><h4 className="sf ink">Jared McCain</h4>{[['Année', '2024-25'], ['Marque', 'Panini'], ['Collection', 'Contenders'], ['Tirage', '/149'], ['Numéro', '#12']].map(r => <div className="r" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b></div>)}</div></Bay>
      <Bay id="s4" n="04 — Page de classeur" title="Les cartes en pochettes brillantes" desc="Une page 3×3 : chaque emplacement a son reflet de pochette plastique, les vides restent en creux. Le classeur ressemble à un vrai classeur."><div className="pg">{[C.mccain, C.edwards, C.maxey, C.hawkins, C.mcw, C.luwawu].map(c => <div className="sl" key={c.nom}><img src={c.img} alt="" /></div>)}{[0, 1, 2].map(i => <div className="sl" key={i} />)}</div></Bay>
      <Bay id="s5" n="05 — Jauge de set" title="La progression d'un set en barres segmentées" desc="Une barre découpée en petits blocs, blancs quand la carte est possédée. On compte d'un coup d'œil, plus précis qu'une barre pleine."><div className="gauge wht"><div className="l"><span>2024-25 Contenders</span><span>14 / 20</span></div><div className="bars">{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < 14 ? 'on' : ''} />)}</div></div></Bay>
      <Bay id="s6" n="06 — Calendrier d'ajouts" title="Un calendrier d'activité façon heatmap" desc="26 semaines de petites cases : plus tu ajoutes de cartes un jour, plus la case est claire. Pratique pour la régularité et la flamme de série."><div className="heat">{heat.map((c, i) => <i key={i} className={c} />)}</div></Bay>
      <Bay id="s7" n="07 — Carte de visite" title="Ta carte de visite de collectionneur" desc="Format carte de crédit, nom en grand, nombre de cartes, QR vers ta galerie. À partager en image ou à imprimer pour les salons."><div className="bcard wht"><div className="l"><b className="sf">GKNNN</b><span>599 cartes · niveau 12<br />memorabilius.fr</span></div><div className="qr"><i /></div></div></Bay>
      <Bay id="s8" n="08 — Filtres en puces" title="Les filtres en puces avec compteur" desc="Rookie, Auto, Patch, Numérotée : chaque puce affiche le nombre de cartes concernées, la puce active se remplit en blanc."><div className="chips wht">{([['RC', 142], ['Auto', 38], ['Patch', 21], ['Numérotée', 87]] as [string, number][]).map((c, i) => <span key={c[0]} className={chip === i ? 'on' : ''} onClick={() => setChip(i)}>{c[0]}<b>{c[1]}</b></span>)}</div></Bay>
      <Bay id="s9" n="09 — Tri segmenté" title="Le tri en boutons collés" desc="Récent, Valeur, Nom, Année en un bloc à filets : l'option active passe en blanc. Remplace la liste déroulante."><div className="sort wht">{['Récent', 'Valeur', 'Nom', 'Année'].map((t, i) => <div key={t} className={sort === i ? 'on' : ''} onClick={() => setSort(i)}>{t}</div>)}</div></Bay>
      <Bay id="s10" n="10 — Face à face" title="Comparer deux cartes côte à côte" desc="Deux cartes, un « VS » doré au milieu, et sous chacune sa valeur et son tirage. Pour choisir quoi échanger."><div className="vs wht"><div className="c"><img className="card" src={C.edwards.img} alt="" /><div className="st">42 € · /99</div></div><div className="vb sf">VS</div><div className="c"><img className="card" src={C.maxey.img} alt="" /><div className="st">45 € · /149</div></div></div></Bay>
      <Bay id="s11" n="11 — Mini-courbe de prix" title="Une mini-courbe sur la vignette" desc="Au survol (ou en mode valeur), une petite courbe de l'évolution du prix apparaît en bas de la carte, avec le prix en coin."><div className="tile wht"><img className="card" src={C.mccain.img} alt="" /><span className="pr ink">38 €</span><div className="sp"><svg viewBox="0 0 120 28" preserveAspectRatio="none"><polyline points="0,22 20,18 40,20 60,12 80,14 100,6 120,4" fill="none" stroke="#3ddc97" strokeWidth="3" /></svg></div></div></Bay>
      <Bay id="s12" n="12 — Drapeau Nouveau" title="Un drapeau « Nouveau » sur les ajouts récents" desc="Les cartes ajoutées depuis ta dernière visite portent un petit drapeau rouge à pointe dans le coin, qui disparaît après consultation."><div className="flag wht"><img className="card" src={C.hawkins.img} alt="" /><span className="nw">NOUVEAU</span></div></Bay>
      <Bay id="s13" n="13 — Bandeau d'événement" title="Un bandeau d'événement avec la date en bloc" desc="Salon, concours, live : un bloc doré avec le jour, puis le titre et le lieu. S'affiche en haut de l'accueil quand un événement approche."><div className="event wht"><div className="d"><b className="sf">18</b><small>OCT.</small></div><div className="i"><b className="sf">Salon de Paris</b><div style={{ opacity: .7, fontSize: 13 }}>Porte de Versailles · 9 h – 18 h</div></div></div></Bay>
      <Bay id="s14" n="14 — Grille / liste" title="Le choix grille ou liste en pastilles" desc="Un petit bloc à trois icônes, l'actif en blanc, qui se souvient de ton choix. Plus discret que les réglages actuels."><div className="seg wht">{['▦', '☰', '▤'].map((x, i) => <div key={x} className={view === i ? 'on' : ''} onClick={() => setView(i)}>{x}</div>)}</div></Bay>
      <Bay id="s15" n="15 — Fiche joueur" title="La page joueur avec bandeau aux couleurs de l'équipe" desc="Nom géant sur un bandeau rouge et bleu, numéro de maillot en filigrane, puis trois chiffres : cartes possédées, valeur, meilleure carte."><div className="pl wht"><div className="bd"><b className="sf">Tyrese Maxey</b><i>0</i></div><div className="g"><div><b className="sf">75</b><small>Cartes</small></div><div><b className="sf">1 240 €</b><small>Valeur</small></div><div><b className="sf">/10</b><small>Meilleure</small></div></div></div></Bay>
      <Bay id="s16" n="16 — Dos de classeur" title="Les classeurs rangés sur une étagère, dos visibles" desc="Chaque classeur est un dos vertical avec son nom écrit dans la hauteur, de hauteurs différentes. On clique sur le dos pour l'ouvrir."><div className="spines wht"><div><span className="sf">Rookies</span></div><div><span className="sf">Hoops</span></div><div><span className="sf">Prizm</span></div><div><span className="sf">Autos</span></div></div></Bay>
      <Bay id="s17" n="17 — Hors ligne" title="Un bandeau « Hors ligne » franc" desc="Quand la connexion tombe : bandeau jaune plein en haut, « Hors ligne — tes modifications seront envoyées au retour du réseau »."><div className="off"><span>⚠</span><span>Hors ligne · tes modifications partiront au retour du réseau</span></div></Bay>
      <Bay id="s18" n="18 — Cadre de prise de vue" title="Quatre coins repères pour photographier la carte" desc="Dans le scanner, quatre angles épais blancs cadrent la zone ; ils passent au vert quand la carte est bien alignée."><div className="frame wht"><i /><i /><i /><i /><span>Place la carte dans le cadre</span></div></Bay>
      <Bay id="s19" n="19 — Feuille d'actions" title="Un menu d'actions qui monte du bas" desc="Un appui long sur une carte ouvre une feuille : Modifier, Partager, Mettre en vente, Supprimer (en rouge). Plus simple que des boutons sur chaque vignette."><div className="sheet wht"><div className="grip" /><div className="it">✏️ Modifier</div><div className="it">🔗 Partager</div><div className="it">🏷 Mettre en vente</div><div className="it red">🗑 Supprimer</div></div></Bay>
      <Bay id="s20" n="20 — Box score" title="Les stats en tableau façon feuille de match" desc="Par année : cartes, autos, rookies, valeur, avec une ligne de total surlignée. L'en-tête est blanc, comme un vrai box score."><table className="box wht"><thead><tr><th>Année</th><th>Cartes</th><th>Autos</th><th>RC</th><th>Valeur</th></tr></thead><tbody>{[['2024-25', 142, 12, 61, '2 140 €'], ['2023-24', 210, 18, 48, '3 020 €'], ['2022-23', 247, 8, 33, '1 890 €']].map(r => <tr key={String(r[0])}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}<tr className="tot"><td>Total</td><td>599</td><td>38</td><td>142</td><td>7 050 €</td></tr></tbody></table></Bay>
    </div>
  )
}
