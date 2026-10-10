'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 12 : 16 idees FONCTIONNELLES (teams, collection, echanges, joueurs) avec maquette. Tout le style est ici, prefixe .ix.

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
  const [view, setView] = useState(0)
  const names = ['Classement de team', 'Objectif collectif', 'Échanges de team', 'Hall of fame', 'Annonce épinglée', 'Résumé hebdo', 'Détecteur de doublons', 'Courbe de valeur', 'Vues enregistrées', 'Actions groupées', 'Inventaire assurance', 'Suivi de gradation', 'Échanges suggérés', 'Comparer', 'Cartes clés du joueur', 'Objectif équipe NBA']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 12</h1>
      <p className="lead">Cette fois des fonctions qui n&apos;existent pas encore (teams, collection, échanges, pages joueur), avec une maquette à la nouvelle DA. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Teams" title="Un classement interne de la team" desc="Un nouvel onglet : les membres classés par cartes, valeur ou ajouts de la semaine (on bascule d'un critère à l'autre). Ta ligne est surlignée. Donne un enjeu à la team et fait revenir les membres."><div className="pnl wht"><h4 className="sf">Classement · cette semaine</h4>{([['KathleenFR', '+34', 1], ['GKNNN', '+28', 0], ['T1T177', '+19', 0], ['Benlou33', '+11', 0]] as [string, string, number][]).map((r, i) => <div key={r[0]} className={'row2' + (r[0] === 'GKNNN' ? ' me' : '')}><span className="n sf">{i + 1}</span><span className="av sf">{r[0][0]}</span><b>{r[0]}</b><em>{r[1]} cartes</em></div>)}</div></Bay>
      <Bay id="s2" n="02 — Teams" title="Un objectif collectif de team" desc="La team se fixe un but commun (nombre de cartes ou compléter un set ensemble). Une grande jauge, le détail de ce que chaque membre a apporté, et les cartes encore manquantes que tu peux fournir."><div className="pnl wht"><h4 className="sf">Objectif · 2023-24 Prizm complet</h4><div className="pad"><div className="big sf">212 / 300</div><div className="bar"><i style={{ width: '71%' }} /></div><div className="sm">88 cartes manquantes · tu en as 6 à apporter</div></div><div className="row2"><span className="av sf">K</span><b>KathleenFR</b><em>74</em></div><div className="row2 me"><span className="av sf">G</span><b>GKNNN</b><em>51</em></div></div></Bay>
      <Bay id="s3" n="03 — Teams" title="Un onglet Échanges dans la team" desc="Les cartes à vendre ou à échanger des membres regroupées, avec le croisement automatique : « 3 membres cherchent une carte que tu possèdes »."><div className="pnl wht"><h4 className="sf">Échanges · 12 cartes</h4>{([[C.maxey, 'T1T177 la propose', 'Tu la cherches'], [C.edwards, 'KathleenFR la cherche', 'Tu l’as'], [C.mccain, 'Benlou33 la propose', '45 €']] as [{ nom: string; img: string }, string, string][]).map(r => <div className="match" key={r[0].nom}><img src={r[0].img} alt="" /><div style={{ flex: 1 }}><b>{r[0].nom}</b><div style={{ opacity: .7 }}>{r[1]}</div></div><span className="gold">{r[2]}</span></div>)}</div></Bay>
      <Bay id="s4" n="04 — Teams" title="Le hall of fame de la team" desc="Chaque membre épingle une carte phare. La page de la team les affiche toutes en mur, avec le nom du collectionneur dessous. C'est la vitrine de la team pour les nouveaux venus."><div className="grid4 wht" style={{ maxWidth: 520 }}>{[C.mccain, C.edwards, C.maxey, C.hawkins].map((c, i) => <div className="c" key={c.nom}><img className="card" src={c.img} alt="" /><small>{['GKNNN', 'KathleenFR', 'T1T177', 'Benlou33'][i]}</small></div>)}</div></Bay>
      <Bay id="s5" n="05 — Teams" title="Une annonce épinglée et un rendez-vous" desc="Les admins fixent un message en haut du feed, ou créent un rendez-vous (salon, live, soirée échange) avec une date et des boutons Je viens / Peut-être. On voit combien viennent."><div className="pin wht"><span className="sm">ÉPINGLÉ · SALON DE PARIS</span><div style={{ fontSize: 18, fontWeight: 800, margin: '6px 0' }}>Rendez-vous samedi 18 oct., 10 h, hall 2</div><div>9 membres viennent · 4 peut-être</div><div className="rsvp"><button className="btn">Je viens</button><button className="btn o">Peut-être</button></div></div></Bay>
      <Bay id="s6" n="06 — Teams" title="Un résumé hebdomadaire automatique" desc="Chaque lundi, le feed reçoit un bloc généré : cartes ajoutées, membres actifs, carte de la semaine (la plus likée). Aucun effort pour les admins, et le feed ne reste jamais vide."><div className="week wht"><span className="sm">Résumé · 4 – 10 oct.</span><div className="k"><div><div className="big sf">+84</div><span className="sm">Cartes</span></div><div><div className="big sf">9</div><span className="sm">Actifs</span></div><div><div className="big sf">31</div><span className="sm">Likes</span></div></div><div className="mini"><img className="card" src={C.mccain.img} alt="" /><div><div className="sm">Carte de la semaine</div><b>Jared McCain</b><div style={{ opacity: .7, fontSize: 13 }}>ajoutée par KathleenFR</div></div></div></div></Bay>
      <Bay id="s7" n="07 — Collection" title="Un détecteur de doublons" desc="Une liste de tes cartes en plusieurs exemplaires, avec la quantité et un bouton « Proposer à l'échange » qui prépare l'annonce. Aujourd'hui il faut les repérer à la main."><div className="pnl wht"><h4 className="sf">Doublons · 14 cartes</h4>{([[C.maxey, 3], [C.hawkins, 2], [C.mcw, 2]] as [{ nom: string; img: string }, number][]).map(r => <div className="doc" key={r[0].nom}><img src={r[0].img} alt="" /><b style={{ flex: 1 }}>{r[0].nom}</b><span className="x2">×{r[1]}</span><button className="btn o" style={{ padding: '5px 10px' }}>Échanger</button></div>)}</div></Bay>
      <Bay id="s8" n="08 — Collection" title="La courbe de valeur de la collection" desc="On enregistre la valeur totale chaque jour : courbe sur 30 jours, 6 mois ou 1 an, avec la variation. Il faut commencer à stocker l'historique maintenant pour qu'elle soit utile dans quelques mois."><div className="chart wht"><div className="big sf">7 050 €</div><span className="sm" style={{ color: '#3ddc97' }}>▲ +312 € ce mois-ci</span><svg viewBox="0 0 300 120" preserveAspectRatio="none"><polyline points="0,100 40,92 80,96 120,70 160,74 200,50 240,40 300,18" fill="none" stroke="#3ddc97" strokeWidth="3" /></svg></div></Bay>
      <Bay id="s9" n="09 — Collection" title="Des vues enregistrées dans la galerie" desc="Tu règles des filtres (RC, numérotées, année…), tu les enregistres sous un nom, et ils apparaissent comme onglets en haut de la galerie. Plus besoin de refaire les mêmes filtres à chaque visite."><div className="sv wht">{['Tout', 'Mes RC /25', 'À vendre', 'Sans classeur', 'Autos 2024'].map((t, i) => <span key={t} className={view === i ? 'on' : ''} onClick={() => setView(i)}>{t}</span>)}<span className="add">+ Enregistrer</span></div></Bay>
      <Bay id="s10" n="10 — Collection" title="Des actions groupées complètes" desc="On sait déjà tout supprimer en groupe. La barre de sélection ajoute : ranger dans un classeur, ajouter à une collection, mettre en vente, passer en privé."><div className="bulkbar"><b className="sf">12 cartes</b><span className="b">Classeur</span><span className="b">Collection</span><span className="b">Mettre en vente</span><span className="b">Privé</span><span className="b">Supprimer</span></div></Bay>
      <Bay id="s11" n="11 — Collection" title="Un inventaire PDF pour l'assurance" desc="Un document propre : photo, désignation, valeur de chaque carte, total en pied. À télécharger et garder en cas de vol ou de sinistre. Possible par classeur ou pour toute la collection."><div className="doc2"><div className="sf" style={{ fontSize: 22, marginBottom: 8 }}>Inventaire · 4 oct. 2026</div>{[['Jared McCain · Contenders /149', '45 €'], ['Tyrese Maxey · Court Kings', '38 €'], ['Anthony Edwards · Prizm', '42 €']].map(r => <div className="l" key={r[0]}><span>{r[0]}</span><b>{r[1]}</b></div>)}<div className="t sf"><span>Total</span><span>7 050 €</span></div></div></Bay>
      <Bay id="s12" n="12 — Collection" title="Un suivi de gradation" desc="Tu déclares l'envoi d'une carte chez PSA ou BGS : le site suit les étapes (envoyée, reçue, en cours, retournée) avec la date estimée, puis enregistre la note sur la carte. Il n'y a aujourd'hui qu'un guide, pas de suivi."><div className="tl wht">{[['Envoyée à PSA', '12 sept.', 1], ['Reçue et enregistrée', '19 sept.', 1], ['En évaluation', 'Retour estimé : 14 nov.', 0], ['Retournée · note', '', 0]].map(r => <div key={String(r[0])} className={'st' + (r[2] ? ' done' : '')}><b>{r[0]}</b><small>{r[1]}</small></div>)}</div></Bay>
      <Bay id="s13" n="13 — Échanges" title="Des échanges suggérés automatiquement" desc="Le site croise les wishlists et les doubles de deux membres et propose : « Toi et KathleenFR pouvez faire 2 contre 2 ». Un bouton ouvre l'échange déjà rempli. Plus loin que les alertes de wishlist actuelles."><div className="two wht"><div><h5>Tu donnes</h5><div className="mini"><img className="card" src={C.maxey.img} alt="" /><img className="card" src={C.hawkins.img} alt="" /></div></div><div><h5>Tu reçois</h5><div className="mini"><img className="card" src={C.edwards.img} alt="" /><img className="card" src={C.mccain.img} alt="" /></div></div></div><div style={{ marginTop: 12 }}><button className="btn">Proposer cet échange à KathleenFR</button></div></Bay>
      <Bay id="s14" n="14 — Échanges" title="Comparer ma collection avec un collectionneur" desc="Sur son profil : « il a 14 cartes que tu n'as pas, tu as 9 cartes qu'il n'a pas », avec les deux listes. Parfait pour préparer un échange sans tout parcourir."><div className="two wht"><div><h5>Il a, tu n'as pas · 14</h5><div className="mini"><img className="card" src={C.edwards.img} alt="" /><img className="card" src={C.mccain.img} alt="" /></div></div><div><h5>Tu as, il n'a pas · 9</h5><div className="mini"><img className="card" src={C.maxey.img} alt="" /><img className="card" src={C.mcw.img} alt="" /></div></div></div></Bay>
      <Bay id="s15" n="15 — Joueur" title="Les cartes clés d'un joueur" desc="Sur la page joueur : ses rookies et cartes marquantes, avec une pastille « Tu l'as » en vert ou « Il te manque » à côté de chacune, et un bouton pour l'ajouter à la wishlist."><div className="pcard wht"><img className="card" style={{ width: 90 }} src={C.maxey.img} alt="" /><div className="info"><b className="sf" style={{ fontSize: 22 }}>Tyrese Maxey · RC 2020-21</b><div><span className="own y">Tu l&apos;as</span></div><div style={{ marginTop: 12 }}><b>Prizm Silver RC</b><div><span className="own n">Il te manque · + Wishlist</span></div></div></div></div></Bay>
      <Bay id="s16" n="16 — Équipe NBA" title="Un objectif par équipe NBA" desc="Sur la page d'une équipe : une grille de ses joueurs, pleine pour ceux dont tu as au moins une carte. « 9 sur 15 », et un clic sur un joueur manquant l'ajoute à la wishlist."><div className="wht"><div className="sm" style={{ marginBottom: 8 }}>76ers · 9 / 15 joueurs</div><div className="roster12">{Array.from({ length: 15 }, (_, i) => <div key={i} className={i < 9 ? 'ok' : ''}>{i < 9 ? '✓' : '?'}</div>)}</div></div></Bay>
    </div>
  )
}
