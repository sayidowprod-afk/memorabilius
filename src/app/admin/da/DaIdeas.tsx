'use client'
import React from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 34 : pastilles, rubans et bandeaux sur les vignettes.

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

/* serie 39 : barre des onglets de la galerie (prefixe tb-) */
.ix .tb-w { max-width: 940px; }
.ix .tb-pn { margin-top: 0; border: 1px solid rgba(140,170,255,.25); background: linear-gradient(180deg, #0d1840, #0a1330); padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .ix .tb-pn div { height: 34px; background: #112060; border: 1px solid rgba(140,170,255,.3); display: flex; align-items: center; padding: 0 10px; font: italic 600 12px system-ui; color: rgba(255,255,255,.55); }
.ix .tb-bar { display: flex; }
.ix .tb-t { cursor: default; white-space: nowrap; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
/* 0 actuel */
.ix .tb-0 { gap: 26px; border-bottom: 3px solid rgba(255,255,255,.18); margin-bottom: 14px; } .ix .tb-0 .tb-t { position: relative; padding: 12px 4px 14px; font: 800 14px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.7); } .ix .tb-0 .tb-t.on { color: #4d8dff; } .ix .tb-0 .tb-t.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 3px; background: #fff; }
/* 1 surfquest */
.ix .tb-1 { gap: 28px; border-bottom: 3px solid rgba(255,255,255,.22); margin-bottom: 14px; } .ix .tb-1 .tb-t { position: relative; padding: 6px 0 12px; font-size: 24px; line-height: 1; color: rgba(255,255,255,.55); } .ix .tb-1 .tb-t.on { color: #fff; } .ix .tb-1 .tb-t.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; background: #fff; }
/* 2 segments */
.ix .tb-2 { border: 2px solid #fff; margin-bottom: 14px; } .ix .tb-2 .tb-t { flex: 1; text-align: center; padding: 11px 6px 9px; font-size: 17px; line-height: 1; border-right: 2px solid #fff; color: #fff; } .ix .tb-2 .tb-t:last-child { border-right: 0; } .ix .tb-2 .tb-t.on { background: #fff; color: #06122e !important; }
/* 3 compteurs */
.ix .tb-3 { gap: 26px; border-bottom: 3px solid rgba(255,255,255,.22); margin-bottom: 14px; } .ix .tb-3 .tb-t { position: relative; padding: 6px 0 12px; font-size: 22px; line-height: 1; color: rgba(255,255,255,.55); display: inline-flex; align-items: flex-start; gap: 6px; } .ix .tb-3 .tb-t small { font: 800 11px system-ui; letter-spacing: .04em; color: rgba(255,255,255,.5); background: rgba(255,255,255,.1); padding: 2px 5px; margin-top: -2px; } .ix .tb-3 .tb-t.on { color: #fff; } .ix .tb-3 .tb-t.on small { background: #fff; color: #06122e !important; } .ix .tb-3 .tb-t.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; background: #fff; }
/* 4 dossier */
.ix .tb-4 { gap: 4px; margin-bottom: -1px; position: relative; z-index: 2; } .ix .tb-4 .tb-t { padding: 11px 18px 9px; font-size: 18px; line-height: 1; color: rgba(255,255,255,.6); border: 1px solid rgba(140,170,255,.25); border-bottom: 0; background: rgba(255,255,255,.04); } .ix .tb-4 .tb-t.on { color: #fff; background: #0d1840; border-color: rgba(140,170,255,.55); border-top: 4px solid #fff; padding-top: 8px; margin-bottom: -1px; }
/* 5 bande */
.ix .tb-5 { border-top: 2px solid #fff; border-bottom: 2px solid #fff; margin-bottom: 14px; background: rgba(255,255,255,.04); } .ix .tb-5 .tb-t { flex: 1; text-align: center; padding: 11px 6px 9px; font-size: 17px; line-height: 1; color: rgba(255,255,255,.75); } .ix .tb-5 .tb-t.on { background: #fff; color: #06122e !important; }
/* 6 numerotes */
.ix .tb-6 { gap: 30px; margin-bottom: 14px; } .ix .tb-6 .tb-t { padding: 4px 0 8px; border-top: 3px solid rgba(255,255,255,.2); } .ix .tb-6 .tb-t b { display: block; font: 800 11px system-ui; letter-spacing: .2em; color: rgba(255,255,255,.5); margin: 7px 0 3px; } .ix .tb-6 .tb-t span { font-size: 20px; line-height: 1; color: rgba(255,255,255,.65); } .ix .tb-6 .tb-t.on { border-top-color: #fff; } .ix .tb-6 .tb-t.on b { color: #fff; } .ix .tb-6 .tb-t.on span { color: #fff; }
/* 7 accent */
.ix .tb-7 { gap: 4px; margin-bottom: 14px; } .ix .tb-7 .tb-t { padding: 11px 18px 9px; font-size: 18px; line-height: 1; color: rgba(255,255,255,.75); background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14); } .ix .tb-7 .tb-t.on { background: linear-gradient(180deg, #2f6bff, #1550e0); border-color: #6c97ff; color: #fff; box-shadow: 0 0 16px rgba(47,107,255,.4); }
/* 8 grands chiffres */
.ix .tb-8 { margin-bottom: 14px; border: 2px solid #fff; } .ix .tb-8 .tb-t { flex: 1; padding: 10px 6px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,.3); } .ix .tb-8 .tb-t:last-child { border-right: 0; } .ix .tb-8 .tb-t b { display: block; font-size: 32px; line-height: 1; font-weight: 400; color: rgba(255,255,255,.65); font-family: 'Surfquest', Impact, sans-serif; } .ix .tb-8 .tb-t i { display: block; font: 800 9px system-ui; letter-spacing: .16em; text-transform: uppercase; font-style: normal; color: rgba(255,255,255,.6); margin-top: 4px; } .ix .tb-8 .tb-t.on { background: #fff; } .ix .tb-8 .tb-t.on b, .ix .tb-8 .tb-t.on i { color: #06122e !important; }
/* 9 slashs */
.ix .tb-9 { gap: 0; align-items: baseline; margin-bottom: 14px; flex-wrap: wrap; } .ix .tb-9 .tb-t { font-size: 22px; line-height: 1.2; color: rgba(255,255,255,.5); padding-bottom: 4px; } .ix .tb-9 .tb-t.on { color: #fff; border-bottom: 5px solid #fff; } .ix .tb-9 .sl { font-size: 22px; color: rgba(255,255,255,.3); margin: 0 14px; font-family: 'Surfquest', Impact, sans-serif; }
/* telephone */
.ix .tb-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .tb-ph .tb-pn { grid-template-columns: 1fr; }
.ix .tb-g { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin-bottom: 10px; } .ix .tb-g .tb-t { padding: 11px 4px 9px; text-align: center; font-size: 15px; line-height: 1; border: 1px solid rgba(255,255,255,.3); color: rgba(255,255,255,.85); } .ix .tb-g .tb-t.on { background: #fff; color: #06122e !important; border-color: #fff; }
.ix .tb-sc { display: flex; gap: 20px; overflow: hidden; border-bottom: 3px solid rgba(255,255,255,.22); margin-bottom: 10px; -webkit-mask-image: linear-gradient(90deg, #000 78%, transparent); mask-image: linear-gradient(90deg, #000 78%, transparent); } .ix .tb-sc .tb-t { position: relative; padding: 6px 0 10px; font-size: 19px; line-height: 1; color: rgba(255,255,255,.55); flex-shrink: 0; } .ix .tb-sc .tb-t.on { color: #fff; } .ix .tb-sc .tb-t.on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -5px; height: 5px; background: #fff; }
.ix .tb-sg { display: flex; border: 2px solid #fff; margin-bottom: 10px; } .ix .tb-sg .tb-t { flex: 1; text-align: center; padding: 10px 2px 8px; font-size: 14px; line-height: 1; border-right: 1px solid rgba(255,255,255,.5); } .ix .tb-sg .tb-t:last-child { border-right: 0; } .ix .tb-sg .tb-t.on { background: #fff; color: #06122e !important; }
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

const TABS = [['Collection', '599', '🃏'], ['Classeurs', '12', '📒'], ['Objectifs', '3/10', '🎯'], ['Badges', '8', '🏅'], ['Commentaires', '4', '💬']] as const
const Panel = () => <div className="tb-pn"><div>Joueur, variation…</div><div>Équipe</div></div>
const Bar = ({ cls, on = 0, render }: { cls: string; on?: number; render: (t: readonly [string, string, string], i: number) => React.ReactNode }) => (
  <div className={`tb-bar ${cls}`}>{TABS.map((t, i) => <span key={t[0]} className={`tb-t${i === on ? ' on' : ''}`}>{render(t, i)}</span>)}</div>
)
const IDEAS: { title: string; desc: string; el: React.ReactNode }[] = [
  { title: 'Aujourd\'hui, pour comparer', desc: 'Petites icônes emoji, lettres espacées en gras, onglet actif en bleu avec un trait blanc de 3 px. La barre est en dehors du style des titres de la DA (Surfquest) et les emoji varient selon le téléphone.', el: <><Bar cls="tb-0" render={t => <>{t[2]} {t[0]}</>} /></> },
  { title: 'En Surfquest 24 px, sans emoji, trait blanc de 6 px', desc: 'Les mots passent en Surfquest 24 px (comme les titres du site), plus d\'emoji, l\'onglet actif en blanc avec un trait épais de 6 px qui rejoint le filet de la barre. Même logique que les onglets de la page d\'accueil.', el: <Bar cls="tb-1 sq" render={t => t[0]} /> },
  { title: 'Segments carrés pleine largeur, onglet actif plein blanc', desc: 'Un contrôle segmenté à double filet qui occupe toute la largeur, chaque onglet de même largeur, l\'actif en bloc blanc plein texte marine. Très net, très DA, et déjà utilisé pour la langue et les vues.', el: <Bar cls="tb-2 sq" render={t => t[0]} /> },
  { title: 'Onglets avec compteur en Surfquest', desc: 'Chaque onglet affiche le nombre d\'éléments (599 cartes, 12 classeurs, 3/10 objectifs, 8 badges, 4 commentaires) dans une petite étiquette ; celle de l\'onglet actif devient blanche. On voit le contenu sans cliquer.', el: <Bar cls="tb-3 sq" render={t => <>{t[0]}<small>{t[1]}</small></>} /> },
  { title: 'Onglets « dossier » reliés au panneau de filtres', desc: 'Les onglets ressemblent à des intercalaires : l\'actif a un liseré blanc épais en haut et se fond dans le panneau en dessous (même fond, pas de filet entre eux). La barre et le panneau forment un seul objet au lieu de deux blocs séparés.', el: <><Bar cls="tb-4 sq" render={t => t[0]} /><Panel /></> },
  { title: 'Bande pleine entre deux filets blancs', desc: 'Une bande sur toute la largeur, filets blancs en haut et en bas, les cinq onglets en parts égales, l\'actif en bloc blanc plein. Ressemble aux bandeaux du reste du site et marque bien la séparation avec le panneau.', el: <Bar cls="tb-5 sq" render={t => t[0]} /> },
  { title: 'Onglets numérotés 01 · 02 · 03…', desc: 'Chaque onglet a un filet de 3 px au-dessus, un petit numéro « 01 » en capitales espacées puis le nom en Surfquest. L\'actif a le filet et le texte en blanc, les autres sont grisés. Ambiance éditoriale, très DA.', el: <Bar cls="tb-6 sq" render={(t, i) => <><b>{String(i + 1).padStart(2, '0')}</b><span>{t[0]}</span></>} /> },
  { title: 'Onglets en cases pleines, l\'actif en bleu électrique', desc: 'Chaque onglet est une case à filet fin ; l\'actif passe en bleu électrique avec une légère lueur, comme les boutons de filtre actifs du panneau juste en dessous. Une seule couleur d\'état dans toute la page.', el: <Bar cls="tb-7 sq" render={t => t[0]} /> },
  { title: 'Grands chiffres : les onglets sont des compteurs', desc: 'Cinq tuiles de même largeur avec le nombre en Surfquest 32 px et le libellé dessous, comme les compteurs de l\'accueil et du profil ; l\'actif en bloc blanc. Informe et navigue en même temps, mais prend 56 px de haut.', el: <Bar cls="tb-8" render={t => <><b>{t[1]}</b><i>{t[0]}</i></>} /> },
  { title: 'Séparés par des barres obliques, l\'actif souligné', desc: 'Les noms en Surfquest 22 px séparés par de grandes barres obliques grises, l\'actif en blanc souligné de 5 px. Le plus léger et le plus typographique ; ne demande aucun cadre.', el: <div className="tb-bar tb-9 sq">{TABS.map((t, i) => <React.Fragment key={t[0]}>{i > 0 && <span className="sl">/</span>}<span className={`tb-t${i === 0 ? ' on' : ''}`}>{t[0]}</span></React.Fragment>)}</div> },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 39 · La barre des onglets de la galerie</h1>
      <p className="lead">La barre « Collection · Classeurs · Objectifs · Badges · Commentaires » au-dessus du panneau de filtres. Aujourd&apos;hui : emoji, lettres espacées, actif en bleu avec un trait blanc. Voici des versions plus proches de la DA (Surfquest, filets blancs, angles droits, blocs blancs pleins), avec leur lien visuel au panneau de filtres qui suit. Fait aussi pour le téléphone (5 onglets sur 390 px).</p>
      <nav className="tags">{IDEAS.map((t, i) => <a key={t.title} href={`#i${i}`}>{String(i).padStart(2, '0')}</a>)}<a href="#i99">Mobile</a></nav>

      {IDEAS.map((d, i) => (
        <Bay key={d.title} id={`i${i}`} n={String(i).padStart(2, '0')} title={d.title} desc={d.desc}><div className="tb-w">{d.el}{i !== 4 && <Panel />}</div></Bay>
      ))}

      <Bay id="i99" n="Mobile" title="Téléphone : 3 façons de loger 5 onglets" desc="À gauche : grille de 3 + 2 cases, tout visible, grandes zones tactiles. Au milieu : défilement horizontal avec dégradé de fondu à droite qui laisse deviner la suite, l'actif souligné. À droite : segments serrés en 5 colonnes (noms abrégés : Coll., Class., Obj., Badges, Comm.)."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="tb-ph"><div className="tb-g sq">{TABS.map((t, i) => <span key={t[0]} className={`tb-t${i === 0 ? ' on' : ''}`}>{t[0]}</span>)}</div><Panel /></div>
        <div className="tb-ph"><div className="tb-sc sq">{TABS.map((t, i) => <span key={t[0]} className={`tb-t${i === 0 ? ' on' : ''}`}>{t[0]}</span>)}</div><Panel /></div>
        <div className="tb-ph"><div className="tb-sg sq">{['Coll.', 'Class.', 'Obj.', 'Badges', 'Comm.'].map((t, i) => <span key={t} className={`tb-t${i === 0 ? ' on' : ''}`}>{t}</span>)}</div><Panel /></div>
      </div></Bay>
    </div>
  )
}
