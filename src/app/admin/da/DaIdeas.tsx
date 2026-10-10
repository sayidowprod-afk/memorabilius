'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 13 : 16 idees fonctionnelles verifiees absentes du site, avec maquette. Tout le style est ici, prefixe .ix.

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
  const [era, setEra] = useState(0)
  const names = ['Franchise complète', 'Bilan achats / ventes', 'Fiches à compléter', 'Liens marché', 'Sélection partageable', 'Wishlist de poche', 'Teams pour toi', 'Collectionneurs proches', 'Statut d’échange', 'Digest e-mail', 'Alerte doublon', 'Provenance', 'Défi de team', 'Corbeille', 'Checklist du joueur', 'Rapports de set']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 13</h1>
      <p className="lead">Nouvelles fonctions, vérifiées absentes du site (pas de prix d&apos;achat, pas de corbeille, pas de checklist par joueur, etc.). Le 01 reprend ton idée d&apos;équipe NBA en version franchise complète. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Équipe NBA" title="La franchise complète : une carte de chaque joueur de son histoire" desc="Sur la page d'une équipe : TOUS les joueurs qui ont eu une carte sous ces couleurs, de la création à aujourd'hui, en grille. Plein = tu as au moins une carte, vide = il te manque. Filtre par décennie, compteur « 41 sur 312 », et un clic sur un joueur vide l'ajoute à la wishlist. Ton défi : une carte de chaque joueur."><div className="wht"><div className="sv" style={{ marginBottom: 12 }}>{['Tous', '2020s', '2010s', '2000s', '1990s', '1980s'].map((t, i) => <span key={t} className={era === i ? 'on' : ''} onClick={() => setEra(i)}>{t}</span>)}</div><div className="sm" style={{ marginBottom: 8 }}>76ers · 41 / 312 joueurs · 13 %</div><div className="bar"><i style={{ width: '13%' }} /></div><div className="roster12" style={{ gridTemplateColumns: 'repeat(8, 1fr)', maxWidth: 640 }}>{Array.from({ length: 24 }, (_, i) => <div key={i} className={[0, 2, 3, 7, 9, 12, 15, 20].includes(i) ? 'ok' : ''} style={{ fontSize: 13 }}>{[0, 2, 3, 7, 9, 12, 15, 20].includes(i) ? '✓' : '?'}</div>)}</div></div></Bay>
      <Bay id="s2" n="02 — Collection" title="Le bilan achats et ventes" desc="Aujourd'hui rien ne garde le prix d'achat. On ajoute un champ « payé » et « vendu à », puis une page bilan : dépensé, valeur actuelle, plus-value, ventes du mois. Pour savoir enfin si la collection coûte ou rapporte."><div className="pnl wht"><h4 className="sf">Bilan · 2026</h4><div className="k3"><div><div className="big sf">4 380 €</div><span className="sm">Dépensé</span></div><div><div className="big sf">7 050 €</div><span className="sm">Valeur</span></div><div><div className="big sf" style={{ color: '#3ddc97' }}>+2 670</div><span className="sm">Plus-value</span></div></div><div className="row2"><b>Ventes en octobre</b><em>6 cartes · 312 €</em></div></div></Bay>
      <Bay id="s3" n="03 — Collection" title="Les fiches à compléter" desc="Une jauge « 87 % de fiches complètes » et la liste des cartes où il manque l'année, le numéro, la collection ou le verso. Un clic ouvre la fiche. Des fiches complètes se retrouvent mieux, s'échangent mieux et remontent sur Google."><div className="pnl wht"><h4 className="sf">Fiches · 87 % complètes</h4><div className="pad"><div className="bar"><i style={{ width: '87%' }} /></div></div>{[['Tyrese Maxey', 'Numéro manquant'], ['Hersey Hawkins', 'Verso manquant'], ['Luwawu-Cabarrot', 'Année et collection']].map(r => <div className="row2" key={r[0]}><b>{r[0]}</b><em className="gold">{r[1]}</em></div>)}</div></Bay>
      <Bay id="s4" n="04 — Cartes" title="Le marché en un clic" desc="Sur chaque carte et dans la wishlist : boutons « Ventes eBay », « 130point », « Vinted » avec la recherche déjà remplie (joueur, année, collection, désignation Beckett). Fini de retaper le nom à chaque fois."><div className="sv wht"><span className="on">Ventes eBay</span><span>130point</span><span>Vinted</span><span>Cardmarket</span></div><div className="sm" style={{ marginTop: 10 }}>Recherche : « Jared McCain 2024-25 Contenders RC /149 »</div></Bay>
      <Bay id="s5" n="05 — Partage" title="Une sélection partageable par lien" desc="Tu coches 12 cartes, tu appuies sur Partager : un lien (et une image) qui montre exactement ces cartes avec ton pseudo. Pour Discord, Vinted ou un échange hors du site, sans tout envoyer en photos."><div className="two wht"><div><h5>12 cartes · GKNNN</h5><div className="mini"><img className="card" src={C.mccain.img} alt="" /><img className="card" src={C.maxey.img} alt="" /><img className="card" src={C.edwards.img} alt="" /></div></div><div><h5>Lien</h5><div style={{ fontSize: 13, wordBreak: 'break-all' }}>memorabilius.fr/s/ab12cd</div><button className="btn" style={{ marginTop: 10 }}>Copier</button></div></div></Bay>
      <Bay id="s6" n="06 — Wishlist" title="La wishlist de poche pour les salons" desc="Un mode plein écran : tes recherches une par une avec la photo et le budget max, disponible sans réseau, avec une case « acheté » qui la retire de la liste. Utile au salon où il n'y a pas de 4G."><div className="pnl wht" style={{ maxWidth: 380 }}><h4 className="sf">À chercher · 14</h4>{([[C.maxey, 'max 40 €'], [C.hawkins, 'max 15 €']] as [{ nom: string; img: string }, string][]).map(r => <div className="doc" key={r[0].nom}><img src={r[0].img} alt="" /><div style={{ flex: 1 }}><b>{r[0].nom}</b><div style={{ opacity: .7, fontSize: 12 }}>{r[1]}</div></div><button className="btn o" style={{ padding: '5px 10px' }}>Acheté</button></div>)}</div></Bay>
      <Bay id="s7" n="07 — Teams" title="Des teams recommandées selon ta collection" desc="Sur la page Teams : « 3 teams collectionnent les Sixers, comme toi », avec le nombre de membres et un bouton Rejoindre. Aujourd'hui il faut les chercher une par une."><div className="pnl wht"><h4 className="sf">Pour toi</h4>{[['Sixers Collectors', '24 membres', 'Comme toi : Maxey, Embiid'], ['Rookies FR', '58 membres', 'Comme toi : 142 RC']].map(r => <div className="match" key={r[0]}><div style={{ flex: 1 }}><b>{r[0]}</b><div style={{ opacity: .7 }}>{r[1]} · {r[2]}</div></div><button className="btn o" style={{ padding: '5px 10px' }}>Rejoindre</button></div>)}</div></Bay>
      <Bay id="s8" n="08 — Annuaire" title="Les collectionneurs proches de ta collection" desc="Dans l'annuaire : « KathleenFR a 18 cartes en commun avec toi » ou « collectionne Maxey comme toi », avec un bouton Suivre. L'annuaire devient un vrai moteur de rencontres entre collectionneurs."><div className="pnl wht"><h4 className="sf">Proches de toi</h4>{[['KathleenFR', '18 cartes en commun'], ['T1T177', 'Collectionne Maxey'], ['Benlou33', '12 de tes wishlist']].map(r => <div className="row2" key={r[0]}><span className="av sf">{r[0][0]}</span><b>{r[0]}</b><em style={{ fontSize: 12, opacity: .8 }}>{r[1]}</em></div>)}</div></Bay>
      <Bay id="s9" n="09 — Profil" title="Un statut « ouvert aux échanges » bien visible" desc="Un interrupteur sur ton profil : Ouvert aux échanges / En pause, avec tes 3 recherches prioritaires en tête. Les autres savent tout de suite s'il vaut la peine de t'écrire."><div className="pin wht" style={{ borderLeftColor: '#3ddc97' }}><span className="sm" style={{ color: '#3ddc97' }}>● OUVERT AUX ÉCHANGES</span><div style={{ margin: '6px 0' }}>Je cherche : Maxey Prizm Silver · Edwards Select · McCain /99</div></div></Bay>
      <Bay id="s10" n="10 — Notifications" title="Un digest e-mail hebdomadaire" desc="Un seul e-mail par semaine : les nouvelles cartes de tes abonnements, les cartes de ta wishlist apparues à l'échange, les likes reçus. Au lieu d'une notification à chaque événement, on te ramène une fois par semaine."><div className="doc2"><div className="sf" style={{ fontSize: 20, marginBottom: 6 }}>Ta semaine sur Memorabilius</div>{['3 cartes de ta wishlist sont à l’échange', 'KathleenFR a ajouté 34 cartes', '63 likes sur tes cartes'].map(l => <div className="l" key={l}><span>{l}</span></div>)}</div></Bay>
      <Bay id="s11" n="11 — Ajout" title="Une alerte doublon pendant l'ajout" desc="En saisissant ou scannant une carte que tu possèdes déjà (même joueur, année, collection, numéro) : « Tu l'as déjà ». Tu choisis : ajouter un 2e exemplaire ou annuler. Évite les doublons faits par erreur."><div className="pin wht"><span className="sm">DÉJÀ DANS TA COLLECTION</span><div style={{ margin: '6px 0' }}>Tyrese Maxey · 2020-21 Court Kings · #12</div><div className="rsvp"><button className="btn">Ajouter un 2e exemplaire</button><button className="btn o">Annuler</button></div></div></Bay>
      <Bay id="s12" n="12 — Cartes" title="La provenance d'une carte" desc="Un onglet « Histoire » sur chaque carte : acheté où, quand, à quel prix, par échange avec qui, avec une note. Tu peux garder l'histoire de tes cartes fétiches et la montrer."><div className="tl wht">{[['Acquise', 'Salon de Lyon · 12 mai 2025 · 38 €', 1], ['Échangée contre Edwards Select', 'KathleenFR · 3 sept. 2025', 1], ['Classée dans Rookies', '4 oct. 2026', 1]].map(r => <div key={String(r[0])} className="st done"><b>{r[0]}</b><small>{r[1]}</small></div>)}</div></Bay>
      <Bay id="s13" n="13 — Teams" title="Un défi mensuel dans la team" desc="Les admins lancent « Meilleure rookie des années 2010 ». Chacun poste une carte, les membres votent d'un like, le vainqueur du mois rejoint le hall of fame. Donne une raison de revenir chaque mois."><div className="pnl wht"><h4 className="sf">Défi d&apos;octobre · Meilleure rookie 2010s</h4>{[[C.maxey, 'T1T177', 12], [C.mccain, 'GKNNN', 9]].map(r => <div className="doc" key={(r[0] as { nom: string }).nom}><img src={(r[0] as { img: string }).img} alt="" /><div style={{ flex: 1 }}><b>{(r[0] as { nom: string }).nom}</b><div style={{ opacity: .7, fontSize: 12 }}>{r[1] as string}</div></div><span className="x2">♥ {r[2] as number}</span></div>)}</div></Bay>
      <Bay id="s14" n="14 — Sécurité" title="Une corbeille de 30 jours" desc="Une carte supprimée par erreur n'est plus perdue : elle va dans une corbeille 30 jours, avec « Restaurer » en un clic. La suppression est aujourd'hui définitive."><div className="pnl wht"><h4 className="sf">Corbeille · 2 cartes</h4>{[['Tyrese Maxey', 'supprimée il y a 2 j · reste 28 j'], ['Hersey Hawkins', 'supprimée il y a 9 j · reste 21 j']].map(r => <div className="row2" key={r[0]}><b>{r[0]}</b><em style={{ fontSize: 11, opacity: .7 }}>{r[1]}</em><button className="btn o" style={{ padding: '4px 10px' }}>Restaurer</button></div>)}</div></Bay>
      <Bay id="s15" n="15 — Joueur" title="La checklist complète d'un joueur" desc="Sur la page joueur : toutes les cartes recensées de lui dans les checklists (par année et par set), avec ce que tu possèdes coché. « 12 sur 140 cartes de Tyrese Maxey ». Le plus complet pour collectionner un joueur."><div className="pnl wht"><h4 className="sf">Tyrese Maxey · 12 / 140</h4>{[['2020-21 Prizm', '3 / 9'], ['2020-21 Court Kings', '2 / 6'], ['2021-22 Donruss', '1 / 14']].map(r => <div className="row2" key={r[0]}><b>{r[0]}</b><em>{r[1]}</em></div>)}</div></Bay>
      <Bay id="s16" n="16 — Setlist" title="Un rapport de set à emporter" desc="Pour un set : un PDF d'une page « Il te manque 14 cartes » avec numéros, joueurs, et cases à cocher, à emporter au salon. Prolonge l'impression de setlist existante avec le seul contenu utile : les manquantes."><div className="doc2"><div className="sf" style={{ fontSize: 20, marginBottom: 6 }}>2024-25 Contenders · il manque 14</div>{['#07 Bronny James', '#12 Jared McCain', '#23 Zach Edey'].map(l => <div className="l" key={l}><span>☐ {l}</span></div>)}</div></Bay>
    </div>
  )
}
