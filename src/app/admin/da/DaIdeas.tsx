'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 14 : accueil connecte (fond du hero + blocs), avec maquette. Tout le style est ici, prefixe .ix.

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
.ix .hro .mos { position: absolute; right: -30px; top: -40px; width: 480px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; transform: perspective(700px) rotateY(-22deg) rotateX(10deg) scale(1.15); opacity: .8; }
.ix .hro .mos img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
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
@media (max-width: 600px) { .ix .hro .n { font-size: 64px; } .ix .hro .mos { width: 360px; } .ix .hro .big1 { width: 190px; } .ix .hro .wm { font-size: 200px; } }
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

export default function DaIdeas() {
  const [short, setShort] = useState(0)
  const names = ['Fond mosaïque', 'Fond carte phare', 'Fond terrain', 'Fond bandes de cartes', 'Fond équipe favorite', 'Fond pile de cartes', 'Objectif de collection', 'Reprendre', 'À faire', 'Valeur + courbe', 'Alertes wishlist', 'Raccourcis perso', 'Sets presque finis', 'Salutation + événement', 'Cartes les plus likées', 'Réorganiser les blocs', 'Derniers ajouts', 'Stats cliquables']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 14 · Accueil connecté</h1>
      <p className="lead">Le tableau de bord d&apos;accueil : 6 façons de remplir le fond de « Ma galerie » (01 à 06), puis 12 idées pour les blocs. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Fond du hero" title="Une mosaïque de tes cartes en perspective" desc="Derrière le 599, une grille de tes cartes, inclinée en 3D, assombrie vers la gauche pour garder le chiffre lisible. On voit tout de suite que c'est TA collection, et elle change à chaque ajout."><Hero cls="h1"><div className="mos">{Array.from({ length: 24 }, (_, i) => <img key={i} src={ALL[i % 6].img} alt="" />)}</div></Hero></Bay>
      <Bay id="s2" n="02 — Fond du hero" title="Ta carte phare en très grand" desc="Ta carte n°1 du Grail Wall recadrée en grand à droite, légèrement penchée et fondue dans le bleu. Un seul visuel fort, très propre, et elle change quand tu changes de carte phare."><Hero cls="h2"><img className="big1" src={C.mccain.img} alt="" /></Hero></Bay>
      <Bay id="s3" n="03 — Fond du hero" title="Un tracé de terrain en filigrane" desc="Des lignes de parquet (cercle central, raquette, ligne à 3 points) en trait fin blanc très discret. Rien ne bouge, c'est léger sur mobile, et on adapte le tracé au sport principal (terrain, glace, pelouse)."><Hero cls="h3"><svg className="court" viewBox="0 0 760 230" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="2"><circle cx="560" cy="115" r="62" /><line x1="560" y1="0" x2="560" y2="230" /><rect x="700" y="68" width="90" height="94" /><path d="M700 36 A 130 130 0 0 0 700 194" /><rect x="310" y="68" width="-90" height="94" /></g></svg></Hero></Bay>
      <Bay id="s4" n="04" title="Deux bandes de cartes qui défilent très lentement" desc="Deux rangées de tes cartes en bas du hero, à l'opacité réduite. Sur mobile et pour qui réduit les animations, elles restent fixes (aucun effet « spasme »). Donne de la vie sans gêner la lecture."><Hero cls="h4"><div className="strip"><div>{[...ALL, ...ALL].map((c, i) => <img key={i} src={c.img} alt="" />)}</div></div></Hero></Bay>
      <Bay id="s5" n="05 — Fond du hero" title="Aux couleurs de ton équipe favorite" desc="Le hero prend un dégradé aux couleurs de l'équipe que tu as choisie dans ton profil, avec son numéro ou son logo en énorme filigrane. L'accueil devient personnel sans rien changer d'autre."><Hero cls="h5"><span className="wm sf">76</span></Hero></Bay>
      <Bay id="s6" n="06 — Fond du hero" title="Une pile de cartes qui déborde du cadre" desc="Des cartes empilées en désordre qui sortent par le bas à droite, avec des ombres. L'effet d'un tas de cartes posé sur la table, sans fond chargé. Remplace l'éventail actuel."><Hero cls="h6"><div className="pile">{ALL.slice(0, 5).map((c, i) => <img key={i} src={c.img} alt="" style={{ ['--i' as string]: i }} />)}</div></Hero></Bay>
      <Bay id="s7" n="07 — Collection" title="Un objectif de collection avec palier" desc="Sous le compteur, une jauge vers le prochain palier rond (600, 750, 1 000 cartes) avec « encore 1 carte ». Un but visible chaque jour, et un petit feu d'artifice quand on le passe."><div className="pnl wht"><h4 className="sf">Prochain palier · 600 cartes</h4><div className="pad"><div className="big sf">599 / 600</div><div className="bar"><i style={{ width: '99.8%' }} /></div><div className="sm">Encore 1 carte pour le palier</div></div></div></Bay>
      <Bay id="s8" n="08 — Bloc" title="Reprendre là où tu t'es arrêté" desc="Un bandeau en haut qui propose la dernière chose en cours : un set que tu consultais (« 2025-26 Topps, 12 / 300 »), une carte à compléter, un import commencé. Un clic et tu y es."><div className="pnl wht"><h4 className="sf">Reprendre</h4><div className="row2"><b>2025-26 Topps · setlist</b><em>12 / 300</em><button className="btn o" style={{ padding: '4px 10px' }}>Continuer</button></div><div className="row2"><b>Fiche à compléter · Tyrese Maxey</b><em className="gold">numéro manquant</em><button className="btn o" style={{ padding: '4px 10px' }}>Ouvrir</button></div></div></Bay>
      <Bay id="s9" n="09 — Bloc" title="Trois actions utiles, calculées pour toi" desc="« 12 cartes sans classeur », « 8 fiches incomplètes », « 3 cartes sans valeur » : le tableau de bord repère ce qui mérite ton attention et propose un bouton pour chaque point. Il se vide quand tout est rangé."><div className="pnl wht"><h4 className="sf">À faire</h4>{[['12 cartes sans classeur', 'Ranger'], ['8 fiches incomplètes', 'Compléter'], ['3 cartes sans valeur', 'Estimer']].map(r => <div className="row2" key={r[0]}><b>{r[0]}</b><button className="btn o" style={{ padding: '4px 10px' }}>{r[1]}</button></div>)}</div></Bay>
      <Bay id="s10" n="10 — Bloc" title="La valeur de la collection avec sa courbe" desc="Une tuile avec la valeur totale, la variation sur 30 jours et une mini-courbe. Il faudra enregistrer la valeur chaque jour pour la dessiner, donc le mieux est de commencer à stocker l'historique maintenant."><div className="chart wht"><div className="big sf">7 050 €</div><span className="sm" style={{ color: '#3ddc97' }}>▲ +312 € sur 30 jours</span><svg viewBox="0 0 300 120" preserveAspectRatio="none"><polyline points="0,100 40,92 80,96 120,70 160,74 200,50 240,40 300,18" fill="none" stroke="#3ddc97" strokeWidth="3" /></svg></div></Bay>
      <Bay id="s11" n="11 — Bloc" title="Les cartes de ta wishlist apparues à l'échange" desc="Un bandeau doré : « 2 cartes de ta wishlist sont à l'échange chez des collectionneurs », avec leurs vignettes. Le site te prévient au lieu que tu doives vérifier."><div className="pin wht"><span className="sm">WISHLIST · 2 CARTES DISPONIBLES</span><div className="mini" style={{ margin: '10px 0' }}><img className="card" src={C.maxey.img} alt="" /><img className="card" src={C.hawkins.img} alt="" /></div><button className="btn">Voir</button></div></Bay>
      <Bay id="s12" n="12 — Bloc" title="Tes raccourcis, choisis par toi" desc="Les trois boutons (Scanner de prix, Ajouter une carte, Trades) deviennent personnalisables : un mode « modifier » où tu choisis jusqu'à quatre raccourcis parmi Setlist, Wishlist, Messages, Classeurs, Expo…"><div className="sv wht">{['Scanner de prix', 'Ajouter une carte', 'Trades'].map((t, i) => <span key={t} className={short === i ? 'on' : ''} onClick={() => setShort(i)}>{t}</span>)}<span className="add">+ Setlist</span><span className="add">✎ Modifier</span></div></Bay>
      <Bay id="s13" n="13 — Bloc" title="Les sets presque terminés" desc="Les trois setlists que tu as le plus avancées avec « il te manque 4 cartes ». Ça donne envie de finir et ça pointe directement vers les cartes à chercher."><div className="pnl wht"><h4 className="sf">Presque finis</h4>{[['2024-25 Panini Select', '96 %', 4], ['2023-24 Prizm', '91 %', 9], ['2025-26 Hoops', '88 %', 12]].map(r => <div className="row2" key={String(r[0])}><b>{r[0]}</b><em>{r[1]}</em><span className="sm">il manque {r[2]}</span></div>)}</div></Bay>
      <Bay id="s14" n="14 — Bloc" title="Une salutation qui sait ce qui se passe" desc="« Content de te revoir » devient contextuel : « Salon de Paris dans 8 jours », « Joyeux anniversaire sur Memorabilius, 1 an ! », « Ta série est à 60 jours demain ». Un seul message à la fois, le plus pertinent."><div className="event wht"><div className="d"><b className="sf">8</b><small>JOURS</small></div><div className="i"><b className="sf">Salon de Paris</b><div style={{ opacity: .7, fontSize: 13 }}>18 oct. · Porte de Versailles</div></div></div></Bay>
      <Bay id="s15" n="15 — Bloc" title="Tes cartes les plus likées de la semaine" desc="Trois vignettes avec le nombre de likes reçus cette semaine. Un petit retour sur ce qui plaît dans ta galerie, et un lien direct pour remercier ou répondre aux commentaires."><div className="grid4 wht" style={{ maxWidth: 420 }}>{[C.mccain, C.edwards, C.maxey].map((c, i) => <div className="c" key={c.nom}><img className="card" src={c.img} alt="" /><small>♥ {[18, 11, 7][i]}</small></div>)}</div></Bay>
      <Bay id="s16" n="16 — Tableau" title="Réorganiser et masquer les blocs" desc="Un bouton « Personnaliser » fait apparaître des poignées pour remonter ou descendre chaque bloc (Niveau, Badge, Défi, Activité…) et un œil pour le masquer. Chacun a l'accueil qu'il veut."><div className="pnl wht">{['Niveau et XP', 'Prochain badge', 'Défi du jour', 'Activité récente'].map((t, i) => <div className="row2" key={t}><span style={{ opacity: .6 }}>⋮⋮</span><b>{t}</b><span>{i === 3 ? '🚫' : '👁'}</span></div>)}</div></Bay>
      <Bay id="s17" n="17 — Bloc" title="Les derniers ajouts en bande horizontale" desc="Sous le hero, tes six dernières cartes en vignettes, la plus récente en premier avec un « Nouveau ». Un coup d'œil sur ce que tu viens d'ajouter, et un clic ouvre la carte dans le visualiseur."><div className="mini wht" style={{ maxWidth: 560 }}>{ALL.map((c, i) => <div key={c.nom} style={{ position: 'relative', flex: 1 }}><img className="card" src={c.img} alt="" />{i === 0 && <span style={{ position: 'absolute', left: 0, top: 0, background: '#e5484d', padding: '2px 6px', font: '800 9px system-ui' }}>NEW</span>}</div>)}</div></Bay>
      <Bay id="s18" n="18 — Bloc" title="Les stats RC / AUTO / PATCH / NUM cliquables, avec leur évolution" desc="Chaque tuile ouvre la galerie déjà filtrée, et affiche en petit « +3 cette semaine » (ou rien si pas de changement). Les chiffres deviennent des raccourcis et montrent la progression."><div className="k4 wht">{([['119', 'RC', '+3'], ['29', 'AUTO', '+1'], ['23', 'PATCH', ''], ['91', 'NUM', '+2']] as [string, string, string][]).map(s => <div key={s[1]}><b className="sf">{s[0]}</b><small>{s[1]}</small><i>{s[2]}</i></div>)}</div></Bay>
    </div>
  )
}
