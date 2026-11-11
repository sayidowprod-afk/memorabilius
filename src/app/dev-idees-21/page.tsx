'use client'
/* eslint-disable react/jsx-key */
import React from 'react'
import type { ReactNode } from 'react'

// PAGE LOCALE (non commitée) : idées 649 à 669, rendre le site « TCG friendly » (Pokémon, Magic, Yu-Gi-Oh!, Lorcana…).
// Les maquettes sont des schémas d'intention avec des cartes fictives (aucune image officielle). Les constats « réels » viennent du code et de la base.

const CSS = `
.mx { font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 110px;
  --bg:#070b18; --bg2:#0e1530; --bg3:#17214a; --border:#243063; --text:#f0f0f0; --text2:#aab3d1; }
.mx * { box-sizing: border-box; }
.mx .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.mx h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.mx .lead { max-width: 840px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 22px; }
.mx .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.mx .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 34px; }
.mx .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.mx .tags a:hover { background:#fff; color:#06122e; }
.mx .bay { margin: 0 0 54px; max-width: 1280px; }
.mx .bay > h2 { font-size: clamp(26px,3.8vw,40px); margin: 12px 0 6px; line-height: 1.05; }
.mx .bay > p.d { color: rgba(255,255,255,.7); max-width: 800px; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
.mx .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 18px; }
.mx .fr { border: 3px solid rgba(255,255,255,.85); background: linear-gradient(135deg,#050912 0%,#08153b 60%,#0a2468 100%); padding: 16px; display:flex; flex-direction:column; gap: 12px; min-width:0; scroll-margin-top: 20px; }
.mx .fr.top { border-color:#e0a526; }
.mx .fr .hd { display:flex; gap:10px; align-items:flex-start; }
.mx .fr .no { flex-shrink:0; min-width:38px; height:34px; display:grid; place-items:center; background:#fff; color:#06122e; font: 900 15px system-ui; padding: 0 6px; } .mx .fr.top .no { background:#e0a526; }
.mx .fr h3 { margin: 0; font: 800 15px/1.2 system-ui; } .mx .fr .ds { margin: 3px 0 0; color: rgba(255,255,255,.66); font-size: 12.5px; line-height: 1.4; }
.mx .fr .pick { margin-left:auto; flex-shrink:0; font: 800 9px system-ui; letter-spacing:.14em; color:#ffd98a; border:2px solid #e0a526; padding: 3px 6px; text-transform:uppercase; }
.mx .meta { display:flex; gap:6px; flex-wrap:wrap; }
.mx .meta span { font: 800 9.5px system-ui; letter-spacing:.08em; text-transform:uppercase; border:2px solid rgba(255,255,255,.3); padding: 2px 6px; color: rgba(255,255,255,.75); }
.mx .stage { border: 2px solid rgba(255,255,255,.18); background: rgba(5,9,18,.55); padding: 14px; position:relative; overflow:hidden; flex:1; display:flex; flex-direction:column; justify-content:center; gap:10px; min-height: 130px; }
.mx .note { font: 400 11px/1.35 system-ui; color: rgba(255,255,255,.5); }
.mx .tiny { font: 700 10px system-ui; letter-spacing:.1em; text-transform:uppercase; color:var(--text2); }
.mx .t1 { font: 700 12.5px/1.3 system-ui; color:var(--text); } .mx .t2 { font: 400 11.5px/1.3 system-ui; color:var(--text2); }
.mx .row { display:flex; gap:10px; align-items:center; } .mx .col { display:flex; flex-direction:column; gap:6px; } .mx .w { flex-wrap:wrap; }
.mx .trk { position:relative; height:12px; background:#101a3d; flex:1; } .mx .trk i { position:absolute; top:0; left:0; height:100%; background:#2f6bff; } .mx .trk i.g { background:#1e9e57; } .mx .trk i.o { background:#c98a12; }
.mx .box { border:2px solid rgba(255,255,255,.5); padding:6px 8px; font: 800 10.5px system-ui; letter-spacing:.05em; text-transform:uppercase; text-align:center; }
.mx .box.b { background:#2f6bff; border-color:#2f6bff; } .mx .box.g { background:#1e9e57; border-color:#1e9e57; } .mx .box.r { background:#d6293e; border-color:#d6293e; } .mx .box.k { background:#17214a; } .mx .box.y { background:#e0a526; border-color:#e0a526; color:#1a1200; }
.mx .arr { font: 900 16px system-ui; color:#ffd98a; flex:none; }
.mx .inp { border:2px solid var(--border); background:var(--bg3); padding:6px 9px; font: 400 12px system-ui; color:var(--text2); } .mx .inp b { color:#fff; }
.mx .pill { display:inline-block; padding: 2px 7px; font: 800 10px system-ui; letter-spacing:.05em; text-transform:uppercase; color:#fff; white-space:nowrap; }
.mx .p-g { background:#1e9e57; } .mx .p-b { background:#2f6bff; } .mx .p-o { background:#c98a12; } .mx .p-r { background:#d6293e; } .mx .p-v { background:#7a2bff; } .mx .p-y { background:#e0a526; color:#1a1200; } .mx .p-k { background:#3a4577; }
.mx .tile { width: 92px; background:#17214a; padding:5px; display:flex; flex-direction:column; gap:4px; flex:none; }
.mx .tile .art { aspect-ratio: 5/7; display:grid; place-items:center; font: 800 9px system-ui; color: rgba(255,255,255,.85); text-align:center; padding:4px; }
.mx .a1 { background: linear-gradient(135deg,#7a2bff,#2f6bff); } .mx .a2 { background: linear-gradient(135deg,#c98a12,#e0a526); } .mx .a3 { background: linear-gradient(135deg,#1e9e57,#0a6a70); } .mx .a4 { background: linear-gradient(135deg,#d6293e,#8a1530); } .mx .a0 { background:#101a3d; border:2px dashed rgba(255,255,255,.25); color: rgba(255,255,255,.35); }
.mx .sum { border:3px solid #e0a526; background:rgba(224,165,38,.07); padding:18px; max-width:980px; }
.mx .sum ol { margin: 8px 0 0; padding-left: 20px; line-height: 1.6; font-size: 14px; }
`

const Steps = ({ s, c = 'b' }: { s: string[]; c?: string }) => <div className="row w">{s.map((x, i) => <React.Fragment key={x}>{i > 0 && <span className="arr">→</span>}<span className={`box ${i === s.length - 1 ? 'g' : c}`}>{x}</span></React.Fragment>)}</div>
const Two = ({ l, r, tl = 'Aujourd’hui', tr = 'Proposé' }: { l: ReactNode; r: ReactNode; tl?: string; tr?: string }) => (
  <div className="row w" style={{ alignItems: 'flex-start', justifyContent: 'center', gap: 16 }}>
    <div className="col" style={{ alignItems: 'center' }}><span className="tiny" style={{ color: '#ff8a8a' }}>{tl}</span>{l}</div>
    <div className="col" style={{ alignItems: 'center' }}><span className="tiny" style={{ color: '#3ddc97' }}>{tr}</span>{r}</div>
  </div>
)
const Tile = ({ a = 'a1', name, sub, pills }: { a?: string; name: string; sub?: string; pills?: ReactNode }) => (
  <div className="tile"><div className={`art ${a}`}>{name}</div>{sub && <span className="t2" style={{ fontSize: 10 }}>{sub}</span>}{pills}</div>
)
const Bar = ({ v, c = '' }: { v: number; c?: string }) => <div className="trk"><i className={c} style={{ width: v + '%' }} /></div>
const Field = ({ l, v }: { l: string; v: string }) => <div className="col" style={{ gap: 2 }}><span className="tiny">{l}</span><div className="inp"><b>{v}</b></div></div>

type Idea = { n: number; t: string; d: string; top?: boolean; meta: [string, string, string]; m: ReactNode }
type Section = { id: string; title: string; desc: string; items: Idea[] }

const SECTIONS: Section[] = [
  { id: 'base', title: 'Les fondations : un site qui parle TCG', desc: 'Constat dans le code : la fiche de carte est pensée sport (équipe, RC, AUTO, PATCH, grade). Le scan IA connaît déjà les TCG et les listes d’extensions existent (173 extensions Pokémon, 235 Magic dans la base), mais la fiche et les écrans, eux, restent sportifs.', items: [
    { n: 649, t: 'Choisir ce que l’on collectionne : Sport, TCG ou les deux', top: true, meta: ['Effort faible', 'Impact : fort', 'Risque : faible'], d: 'À l’inscription et dans les paramètres : « Je collectionne… ». Le choix adapte les vocabulaires, les filtres affichés et l’accueil. Quelqu’un qui ne joue qu’à Pokémon ne voit plus « RC » ni « Équipe ».', m: <div className="row w"><span className="box b">🏀 Sport</span><span className="box y">🎴 TCG</span><span className="box k">Les deux</span></div> },
    { n: 650, t: 'Fiche carte TCG : les bons champs', top: true, meta: ['Effort moyen', 'Impact : très fort', 'Risque : moyen'], d: 'Extension, numéro (025/165), rareté, langue, édition (1re édition…), finition (Holo, Reverse, Alt Art), état (NM, LP…). Ces champs remplacent équipe, RC, AUTO et PATCH quand la carte est un TCG. Sans toucher à la fiche sport.', m: <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}><Field l="Extension" v="Écarlate et Violet" /><Field l="Numéro" v="025 / 165" /><Field l="Rareté" v="Ultra rare" /><Field l="Langue" v="FR" /><Field l="Édition" v="1re édition" /><Field l="Finition" v="Holo" /><Field l="État" v="Near Mint" /><Field l="Gradation" v="PSA 9" /></div> },
    { n: 651, t: 'Vocabulaire et tuiles adaptés au jeu', top: true, meta: ['Effort moyen', 'Impact : fort', 'Risque : faible'], d: 'Sur une carte TCG, la tuile montre extension + numéro + rareté (et plus l’équipe). Les étiquettes RC/AUTO/PATCH laissent la place à Holo, 1re édition, Full Art… Les mêmes composants, un autre habillage.', m: <Two l={<Tile name="Carte sport" sub="Philadelphia 76ers" pills={<div className="row"><span className="pill p-o">RC</span><span className="pill p-g">AUTO</span></div>} />} r={<Tile a="a2" name="Carte TCG" sub="SV1 · 025/165" pills={<div className="row"><span className="pill p-v">Holo</span><span className="pill p-y">1re éd.</span></div>} />} /> },
    { n: 652, t: 'Scan IA : nom + numéro, vérifiés avec la liste de l’extension', meta: ['Effort moyen', 'Impact : fort', 'Risque : à valider avec toi'], d: 'Le scan sait déjà reconnaître une carte TCG, mais renvoie des champs sport. Idée : demander aussi le numéro d’extension, le comparer à nos listes (173 Pokémon, 235 Magic) et pré-remplir langue et rareté. Je ne touche pas à l’IA sans ton accord.', m: <Steps s={['Photo', 'IA : nom + n°', 'Vérifié dans la liste', 'Fiche pré-remplie']} /> },
    { n: 653, t: 'Ajouter un jeu = ajouter une configuration', meta: ['Effort moyen', 'Impact : fort', 'Risque : faible'], d: 'Pokémon et Magic d’abord, puis Yu-Gi-Oh!, Lorcana, One Piece… chaque jeu a sa liste de champs, ses raretés et ses listes d’extensions. Ajouter un jeu ne demande plus de réécrire des écrans.', m: <div className="row w"><span className="box y">Pokémon</span><span className="box y">Magic</span><span className="box k">Yu-Gi-Oh!</span><span className="box k">Lorcana</span><span className="box k">One Piece</span></div> },
  ] },
  { id: 'collection', title: 'Collectionner un TCG', desc: 'Les TCG se collectionnent par extension et par deck, avec beaucoup de doubles : l’avancement et les manquants comptent plus que l’équipe.', items: [
    { n: 654, t: 'Complétion par extension', top: true, meta: ['Effort faible à moyen', 'Impact : très fort', 'Risque : faible'], d: 'Ce que la Setlist fait déjà pour les cartes sport, relié à ta galerie : « 142 / 198 cartes de cette extension », les manquantes en gris, un « master set » (avec reverses et holos).', m: <div className="col"><div className="row"><span className="t1" style={{ width: 150 }}>Écarlate et Violet</span><Bar v={72} c="g" /><span className="t2">142/198</span></div><div className="row"><span className="t1" style={{ width: 150 }}>Évolutions à Paldea</span><Bar v={34} /><span className="t2">87/193</span></div><div className="row w"><Tile a="a1" name="025" /><Tile a="a0" name="026" /><Tile a="a3" name="027" /></div></div> },
    { n: 655, t: 'Classeurs à pochettes 3×3', meta: ['Effort moyen', 'Impact : moyen', 'Risque : faible'], d: 'Les classeurs thématiques existent déjà. Version TCG : pages de 9 ou 12 pochettes, une pochette vide pour chaque carte manquante, rangement par numéro d’extension.', m: <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 5, justifyContent: 'center' }}>{[1, 1, 0, 1, 1, 1, 0, 1, 1].map((x, i) => <div key={i} className={`tile art ${x ? ['a1', 'a2', 'a3', 'a4'][i % 4] : 'a0'}`} style={{ width: 56, aspectRatio: '5/7', padding: 2, display: 'grid', placeItems: 'center', fontSize: 9 }}>{x ? '' : '+'}</div>)}</div> },
    { n: 656, t: 'Mes doubles, ma liste de recherche', meta: ['Effort faible', 'Impact : fort', 'Risque : très faible'], d: 'La quantité existe déjà (×3). Un écran « Mes doubles » regroupe les cartes en plusieurs exemplaires, prêtes à échanger, et la liste de recherche (wishlist) se remplit depuis les manquants d’une extension.', m: <div className="row w"><Tile a="a2" name="Double" sub="×3" /><Tile a="a3" name="Double" sub="×2" /><span className="arr">→</span><span className="box g">À échanger</span></div> },
    { n: 657, t: 'Decks : « il me manque 7 cartes »', top: true, meta: ['Effort gros', 'Impact : fort (Magic, Pokémon, Yu-Gi-Oh!)', 'Risque : moyen'], d: 'Coller la liste d’un deck (texte copié d’un site de decks) : le site la compare à ta collection et affiche ce que tu as, ce qu’il te manque, et qui peut te le vendre ou l’échanger.', m: <div className="col"><div className="inp">4× Carte A · 4× Carte B · 3× Carte C …</div><div className="row"><Bar v={88} c="g" /><span className="t1">53/60</span></div><span className="box r">Manque : 7 cartes → chercher dans les annonces</span></div> },
    { n: 658, t: 'Prix de marché et valeur de la collection', meta: ['Effort gros', 'Impact : fort', 'Risque : coût et licence'], d: 'Prix par carte selon langue et état, valeur totale, évolution. Il faut choisir une source de données (accords et coûts à vérifier). Le site utilise déjà eBay pour les cartes sport.', m: <div className="col"><div className="row"><span className="t1" style={{ flex: 1 }}>Carte Holo 025/165 · FR · NM</span><span className="pill p-g">12 €</span></div><div className="row"><span className="t1" style={{ flex: 1 }}>Valeur de ma collection</span><span className="pill p-y">1 840 €</span></div><span className="note">Chiffres fictifs pour la maquette.</span></div> },
  ] },
  { id: 'communaute', title: 'Échanger et se mesurer entre joueurs', desc: 'Le site a déjà les échanges et un matching de wishlist. Pour les TCG, l’état, la langue et l’édition font la valeur d’une carte.', items: [
    { n: 659, t: 'Annonces et échanges avec état, langue, édition', top: true, meta: ['Effort moyen', 'Impact : très fort', 'Risque : faible'], d: 'Une annonce TCG affiche NM/LP, FR/EN/JP, 1re édition. Les filtres suivent. Les échanges « Pokémon » existent déjà comme catégorie : on les rend utilisables pour de vrai.', m: <div className="row"><Tile a="a2" name="Holo" pills={<div className="row w"><span className="pill p-g">NM</span><span className="pill p-b">FR</span></div>} /><Tile a="a1" name="Reverse" pills={<div className="row w"><span className="pill p-o">LP</span><span className="pill p-b">JP</span></div>} /></div> },
    { n: 660, t: 'Équilibrer un échange avec les prix', meta: ['Effort moyen', 'Impact : moyen', 'Risque : dépend de 658'], d: 'Quand deux membres s’échangent des cartes, le site affiche l’écart de valeur (« l’échange est équilibré à 5 € près »). Seulement à titre d’indication.', m: <div className="row w"><span className="box k">Je donne · 24 €</span><span className="arr">⇄</span><span className="box k">Je reçois · 21 €</span><span className="box y">Écart 3 €</span></div> },
    { n: 661, t: 'Badges et classements par jeu', meta: ['Effort moyen', 'Impact : moyen', 'Risque : faible'], d: 'Badges « Master set », « 1re édition », « Full Art » ; podium par jeu (qui a ajouté le plus de cartes Pokémon cette semaine ?).', m: <div className="row w"><span className="pill p-y">🏆 Master set</span><span className="pill p-v">✨ Full Art</span><span className="pill p-b">🥇 Podium Magic</span></div> },
  ] },
  { id: 'site', title: 'Accueil, recherche et guides', desc: 'Aujourd’hui la page d’accueil et les pages « joueur » parlent surtout de sport.', items: [
    { n: 662, t: 'Accueil à deux visages : Sport et TCG', top: true, meta: ['Effort moyen', 'Impact : fort', 'Risque : faible'], d: 'Selon le choix de 649, l’accueil met en avant les pépites, les sorties d’extensions et les classements du bon domaine. Un interrupteur discret permet de passer de l’un à l’autre.', m: <div className="row w"><span className="box b">🏀 Sport</span><span className="box y">🎴 TCG</span></div> },
    { n: 663, t: 'Pages « personnage » comme les pages joueur', meta: ['Effort moyen', 'Impact : moyen', 'Risque : faible'], d: 'Une page Pikachu ou Dracaufeu comme la page d’un joueur : cartes de la communauté, extensions où il apparaît. Les pages joueur, extensions et sets existent déjà pour les TCG dans le code.', m: <div className="row w"><Tile a="a2" name="Perso" sub="12 extensions" /><Tile a="a1" name="Perso" sub="34 cartes membres" /></div> },
    { n: 664, t: 'Recherche par nom, numéro, extension, rareté', meta: ['Effort moyen', 'Impact : fort', 'Risque : faible'], d: 'Une barre de recherche qui comprend « 025/165 », « écarlate holo » ou « 1re édition ».', m: <div className="inp"><b>025/165 holo</b> · Écarlate et Violet · FR</div> },
    { n: 665, t: 'Guides TCG', meta: ['Effort moyen', 'Impact : moyen', 'Risque : faible'], d: 'Reconnaître une fausse carte, comprendre les raretés, faire grader, ranger… Les guides existent, on y ajoute le TCG.', m: <div className="row w"><span className="box k">Raretés</span><span className="box k">Fausses cartes</span><span className="box k">Gradation</span></div> },
  ] },
  { id: 'croissance', title: 'Faire connaître le site aux joueurs de TCG', desc: 'Le TCG touche un public plus large et plus jeune. Ce public est très présent sur TikTok.', items: [
    { n: 666, t: 'Pubs TikTok TCG avec le générateur', top: true, meta: ['Effort faible', 'Impact : fort', 'Risque : faible'], d: 'Le générateur de pub tire déjà des cartes de ta galerie. Version TCG : thèmes « mes pulls », « ma collection par extension », écrans de l’appli en mode TCG. Hook adapté (« Tu collectionnes Pokémon ? »).', m: <Steps s={['Hook TCG', 'Écrans de l’appli TCG', 'Appel à l’action']} /> },
    { n: 667, t: 'Ouverture de pack et ajout en lot', meta: ['Effort moyen', 'Impact : fort', 'Risque : faible'], d: 'Après avoir ouvert un booster, photographier toutes les cartes d’un coup (l’ajout en lot existe) et les ranger dans l’extension. Une animation « ouverture de pack » existe déjà dans le site : à brancher.', m: <Steps s={['Je prends les cartes en photo', 'Ajout en lot', 'Pack ouvert']} /> },
  ] },
  { id: 'risques', title: 'Ce qu’il faut garder en tête', desc: 'Pas d’idées à faire ici, mais des décisions à prendre avant de s’engager.', items: [
    { n: 668, t: 'Données et droits des images', meta: ['Effort : cadrage', 'Impact : décisif', 'Risque : juridique'], d: 'Où prendre les listes de cartes et les images (sources libres comme Scryfall pour Magic, API Pokémon…) et ce qu’on a le droit d’afficher. Je ne peux pas juger la partie juridique : à vérifier source par source.', m: <div className="col"><div className="box k">Magic : source ouverte avec règles d’usage</div><div className="box k">Pokémon : API communautaire, à vérifier</div><div className="box r">Yu-Gi-Oh!, Lorcana : à étudier</div></div> },
    { n: 669, t: 'Capacité de la base de données', meta: ['Effort : technique', 'Impact : décisif', 'Risque : coût'], d: 'La base est déjà chargée (instance Micro, 14,8 M de lignes de cartes). Il vaut mieux appeler une source externe à la demande que tout copier chez nous. Un passage en Small avant d’ouvrir aux TCG est prudent.', m: <Two l={<div className="box r" style={{ padding: 18 }}>Tout copier : millions de lignes</div>} r={<div className="col"><div className="box g">Appel à la demande</div><div className="box k">+ cache des cartes utilisées</div></div>} tl="Risqué" tr="Plus léger" /> },
  ] },
]

export default function DevIdees21() {
  return (
    <div className="mx">
      <style>{CSS}</style>
      <span className="eyebrow">Idées 649 → 669 · TCG</span>
      <h1 className="sf">Un site aussi à l’aise avec les TCG</h1>
      <p className="lead">21 pistes pour ouvrir Memorabilius aux jeux de cartes (Pokémon, Magic, Yu-Gi-Oh!, Lorcana…) sans abandonner le sport. Ce qui existe déjà : des listes d’extensions (173 Pokémon et 235 Magic dans la base), un scan IA qui connaît les TCG, une catégorie « Pokémon » dans les échanges. Ce qui manque : une fiche carte, des écrans et un accueil pensés TCG. Les cartes des maquettes sont fictives. Les cadres dorés sont ceux que je ferais en premier.</p>
      <div className="tags">{SECTIONS.map(s => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}<a href="#ordre">Mon ordre conseillé</a></div>
      {SECTIONS.map(s => (
        <section className="bay" id={s.id} key={s.id}>
          <h2 className="sf">{s.title}</h2>
          <p className="d">{s.desc}</p>
          <div className="grid">
            {s.items.map(i => (
              <div className={`fr${i.top ? ' top' : ''}`} id={`i${i.n}`} key={i.n}>
                <div className="hd"><span className="no">{i.n}</span><div><h3>{i.t}</h3><p className="ds">{i.d}</p></div>{i.top && <span className="pick">Prioritaire</span>}</div>
                <div className="meta">{i.meta.map(m => <span key={m}>{m}</span>)}</div>
                <div className="stage">{i.m}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="bay" id="ordre">
        <h2 className="sf">Mon ordre conseillé</h2>
        <div className="sum">
          <ol>
            <li><b>Cadrer</b> : choisir les jeux de départ (je proposerais Pokémon et Magic, déjà présents dans les listes) et décider de la source de données et des images (668, 669).</li>
            <li><b>Fondations (649 + 650 + 651)</b> : le choix « Sport / TCG », la fiche carte TCG et l’habillage des écrans. C’est le gros du travail, et tout le reste en dépend.</li>
            <li><b>Collectionner (654 + 656)</b> : la complétion par extension (la Setlist existe déjà) et les doubles. Ce sont les deux usages qui rendent un TCG vraiment utile.</li>
            <li><b>Échanger (659)</b> : annonces avec état, langue, édition.</li>
            <li><b>Faire connaître (662 + 666)</b> : accueil TCG et pubs TikTok TCG, quand les écrans sont prêts à être montrés.</li>
            <li>Ensuite seulement : decks (657), prix (658), classeurs (655), pages personnage (663).</li>
          </ol>
          <p className="note" style={{ marginTop: 12 }}>Je n’ai rien estimé en temps : je ne connais ni tes priorités ni ta disponibilité. Dis-moi les numéros qui t’intéressent.</p>
        </div>
      </section>
    </div>
  )
}
