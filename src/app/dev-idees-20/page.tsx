'use client'
/* eslint-disable react/jsx-key, @next/next/no-img-element */
import React from 'react'
import type { ReactNode } from 'react'

// PAGE LOCALE (non commitée) : idées 624 à 648, site plus réactif et plus rapide (galerie en priorité).
// Les maquettes sont des schémas d'intention : les durées et les poids dessinés ne sont PAS des mesures. Les constats « réels » (code, journaux) sont signalés comme tels.

const CSS = `
.mx { font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 110px;
  --bg:#070b18; --bg2:#0e1530; --bg3:#17214a; --border:#243063; --text:#f0f0f0; --text2:#aab3d1; }
.mx * { box-sizing: border-box; }
.mx .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.mx h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.mx .lead { max-width: 820px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 22px; }
.mx .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.mx .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 34px; }
.mx .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.mx .tags a:hover { background:#fff; color:#06122e; }
.mx .bay { margin: 0 0 54px; max-width: 1280px; }
.mx .bay > h2 { font-size: clamp(26px,3.8vw,40px); margin: 12px 0 6px; line-height: 1.05; }
.mx .bay > p.d { color: rgba(255,255,255,.7); max-width: 780px; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
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
.mx .t1 { font: 700 12.5px/1.3 system-ui; color:var(--text); }
.mx .row { display:flex; gap:10px; align-items:center; } .mx .col { display:flex; flex-direction:column; gap:6px; }
.mx .trk { position:relative; height:12px; background:#101a3d; flex:1; } .mx .trk i { position:absolute; top:0; height:100%; background:#2f6bff; } .mx .trk i.g { background:#1e9e57; } .mx .trk i.o { background:#c98a12; } .mx .trk i.r { background:#d6293e; }
.mx .lb { width: 92px; flex:none; font: 700 10.5px system-ui; color: var(--text2); }
.mx .box { border:2px solid rgba(255,255,255,.5); padding:6px 8px; font: 800 10.5px system-ui; letter-spacing:.05em; text-transform:uppercase; text-align:center; }
.mx .box.b { background:#2f6bff; border-color:#2f6bff; } .mx .box.g { background:#1e9e57; border-color:#1e9e57; } .mx .box.r { background:#d6293e; border-color:#d6293e; } .mx .box.k { background:#17214a; }
.mx .arr { font: 900 16px system-ui; color:#ffd98a; flex:none; }
.mx .ph { width: 150px; height: 250px; border:3px solid #fff; background:#070b18; padding:6px; display:flex; flex-direction:column; gap:5px; overflow:hidden; flex:none; }
.mx .sk { background:#17214a; } .mx .cd { aspect-ratio:5/7; background:linear-gradient(135deg,#0a2a66,#5b8def); }
.mx .ok { color:#3ddc97; } .mx .bad { color:#ff8a8a; } .mx .warn { color:#ffd84d; }
.mx .sum { border:3px solid #e0a526; background:rgba(224,165,38,.07); padding:18px; max-width:920px; }
.mx .sum ol { margin: 8px 0 0; padding-left: 20px; line-height: 1.6; font-size: 14px; }
`

const Tl = ({ rows }: { rows: { l: string; s: number; w: number; c?: string }[] }) => (
  <div className="col">{rows.map(r => <div className="row" key={r.l}><span className="lb">{r.l}</span><div className="trk"><i className={r.c} style={{ left: r.s + '%', width: r.w + '%' }} /></div></div>)}</div>
)
const Wt = ({ a, b, la = 'Aujourd’hui', lb = 'Après' }: { a: number; b: number; la?: string; lb?: string }) => (
  <div className="col">
    <div className="row"><span className="lb">{la}</span><div className="trk"><i className="r" style={{ left: 0, width: a + '%' }} /></div></div>
    <div className="row"><span className="lb">{lb}</span><div className="trk"><i className="g" style={{ left: 0, width: b + '%' }} /></div></div>
    <span className="note">Schéma d’intention, pas une mesure.</span>
  </div>
)
const Steps = ({ s, c = 'b' }: { s: string[]; c?: string }) => (
  <div className="row" style={{ flexWrap: 'wrap' }}>{s.map((x, i) => <React.Fragment key={x}>{i > 0 && <span className="arr">→</span>}<span className={`box ${i === s.length - 1 ? 'g' : c}`}>{x}</span></React.Fragment>)}</div>
)
const Two = ({ l, r, tl = 'Avant', tr = 'Après' }: { l: ReactNode; r: ReactNode; tl?: string; tr?: string }) => (
  <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
    <div className="col" style={{ alignItems: 'center' }}><span className="tiny bad">{tl}</span>{l}</div>
    <div className="col" style={{ alignItems: 'center' }}><span className="tiny ok">{tr}</span>{r}</div>
  </div>
)
const Grid4 = ({ sk }: { sk?: boolean }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>{[0, 1, 2, 3].map(i => <div key={i} className={sk ? 'sk' : 'cd'} style={{ aspectRatio: '5/7', opacity: sk ? 1 : 0.5 + i * 0.12 }} />)}</div>
const Ph = ({ children }: { children: ReactNode }) => <div className="ph">{children}</div>

type Idea = { n: number; t: string; d: string; top?: boolean; meta: [string, string, string]; m: ReactNode }
type Section = { id: string; title: string; desc: string; items: Idea[] }

const SECTIONS: Section[] = [
  { id: 'chargement', title: 'Galerie : arriver plus vite', desc: 'Constats dans le code : la galerie charge ses cartes côté navigateur avec select(\'*\') par tranches de 1000 lignes, après l’identification et le profil.', items: [
    { n: 624, t: 'Charger seulement les colonnes de la grille', top: true, meta: ['Effort moyen', 'Gain : fort', 'Risque : faible'], d: 'Aujourd’hui la grille demande toutes les colonnes de chaque carte (notes, liens, états…). On ne prend que nom, vignette, étiquettes et prix ; le reste se charge à l’ouverture de la carte.', m: <Wt a={90} b={30} la="Réponse actuelle" lb="Colonnes utiles" /> },
    { n: 625, t: 'Première page de cartes préparée par le serveur', top: true, meta: ['Effort moyen', 'Gain : fort', 'Risque : moyen'], d: 'Les ~24 premières cartes arrivent déjà dans la page, sans attendre « connexion → profil → cartes » côté navigateur. Le reste suit en arrière-plan.', m: <div className="col"><span className="tiny bad">Aujourd’hui : en cascade</span><Tl rows={[{ l: 'Identification', s: 0, w: 22 }, { l: 'Profil', s: 22, w: 18 }, { l: 'Cartes', s: 40, w: 40, c: 'o' }, { l: 'Affichage', s: 80, w: 10, c: 'r' }]} /><span className="tiny ok">Proposé : en parallèle</span><Tl rows={[{ l: 'Cartes (serveur)', s: 0, w: 35, c: 'g' }, { l: 'Affichage', s: 35, w: 10, c: 'g' }]} /></div> },
    { n: 626, t: 'Afficher tout de suite ce qui est gardé, puis mettre à jour', top: true, meta: ['Effort moyen', 'Gain : fort au retour', 'Risque : faible'], d: 'Quand tu reviens sur ta galerie, la dernière version est affichée à l’instant (gardée sur l’appareil), puis rafraîchie discrètement. Le mode hors ligne de l’appli le fait déjà : on l’étend au site.', m: <Steps s={['Ouverture', 'Version gardée affichée', 'Mise à jour discrète']} /> },
    { n: 627, t: 'Index de base de données et requêtes lentes', meta: ['Effort faible', 'Gain : moyen', 'Risque : très faible'], d: 'Un index sur (utilisateur, date) et (utilisateur, position) pour les cartes, puis vérification des requêtes les plus lentes avec les outils de Supabase.', m: <div className="col"><div className="box k">cartes_manuelles (user_id, created_at)</div><div className="box k">cartes_manuelles (user_id, position)</div><div className="box k">carte_tags (user_id, card_key)</div><span className="note">À vérifier d’abord : certains existent peut-être déjà.</span></div> },
    { n: 628, t: 'Pagination « à partir de la dernière carte vue »', meta: ['Effort moyen', 'Gain : moyen (gros comptes)', 'Risque : moyen'], d: 'Au lieu de demander « les lignes 1000 à 2000 », on demande « celles qui suivent la dernière reçue » : le temps reste stable même pour 3 000 cartes.', m: <Steps s={['Lot 1', 'Lot 2 dès le lot 1', 'Lot 3…']} /> },
    { n: 629, t: 'Squelette de grille aux vraies dimensions', meta: ['Effort faible', 'Gain : ressenti', 'Risque : très faible'], d: 'Pendant le chargement, des cases de la taille exacte des cartes : plus de saut de page quand les cartes arrivent.', m: <Two l={<Ph><div className="sk" style={{ height: 18 }} /><Grid4 sk /></Ph>} r={<Ph><div className="sk" style={{ height: 18 }} /><Grid4 /></Ph>} tl="Chargement" tr="Chargé (même mise en page)" /> },
  ] },
  { id: 'fluidite', title: 'Galerie : fluide à l’usage', desc: 'Constats dans le code : GalerieClient fait plus de 4 400 lignes et plus de 100 états ; la grille ajoute des pages au défilement sans jamais retirer de cartes.', items: [
    { n: 630, t: 'Découper la galerie en blocs indépendants', meta: ['Effort gros', 'Gain : fort', 'Risque : moyen'], d: 'Aujourd’hui un changement d’état peut refaire travailler toute la page. En blocs mémorisés (barre de filtres, grille, viewer), taper dans la recherche ne redessine que ce qui change.', m: <Two l={<div className="box k" style={{ padding: 22 }}>Tout se redessine</div>} r={<div className="col"><div className="box g">Filtres</div><div className="box k">Grille (inchangée)</div><div className="box k">Viewer (inchangé)</div></div>} /> },
    { n: 631, t: 'Frappe et filtres qui ne bloquent jamais', top: true, meta: ['Effort faible', 'Gain : fort sur gros comptes', 'Risque : faible'], d: 'La saisie reste instantanée ; la liste se met à jour juste après (fonction React prévue pour ça). Plus de lettre qui traîne avec 1 000+ cartes.', m: <div className="col"><div className="box k" style={{ textAlign: 'left' }}>🔍 mai▌</div><Steps s={['Lettre affichée', 'Liste mise à jour']} /></div> },
    { n: 632, t: 'Grille virtualisée : seules les cartes visibles existent', top: true, meta: ['Effort moyen', 'Gain : très fort au défilement', 'Risque : moyen'], d: 'Seules ~20 cartes sont dessinées à la fois, quelle que soit la taille de la collection. Le défilement reste fluide à 3 000 cartes et la mémoire du téléphone est préservée.', m: <div className="row" style={{ justifyContent: 'center', gap: 18 }}><div className="col" style={{ width: 90, opacity: 0.45 }}>{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sk" style={{ height: 14 }} />)}<span className="note">hors écran</span></div><div className="col" style={{ width: 90 }}>{[1, 2, 3].map(i => <div key={i} className="cd" style={{ height: 40 }} />)}<span className="note ok">visibles</span></div></div> },
    { n: 633, t: 'Vignettes : flou d’attente et priorité aux premières', top: true, meta: ['Effort faible à moyen', 'Gain : ressenti', 'Risque : faible'], d: 'Constat : pendant mes captures, des vignettes restaient grises. Une version floue minuscule s’affiche aussitôt, devient nette quand l’image arrive, et les 6 premières sont chargées en priorité.', m: <div className="row" style={{ justifyContent: 'center' }}><div className="cd" style={{ width: 56, filter: 'blur(8px)' }} /><span className="arr">→</span><div className="cd" style={{ width: 56, filter: 'blur(3px)' }} /><span className="arr">→</span><div className="cd" style={{ width: 56 }} /></div> },
    { n: 634, t: 'Viewer 3D préchargé au toucher', top: true, meta: ['Effort faible', 'Gain : ouverture instantanée', 'Risque : faible'], d: 'Dès que le doigt ou la souris approche d’une carte, on prépare sa grande image et le module 3D. À l’ouverture, tout est déjà là.', m: <Steps s={['Doigt sur la carte', 'Image HD préparée', 'Ouverture instantanée']} /> },
    { n: 635, t: 'Trois tailles d’image bien séparées', meta: ['Effort moyen', 'Gain : moyen', 'Risque : faible'], d: 'Miniature (grille), image moyenne (viewer), pleine résolution (zoom seulement). Chaque écran ne télécharge que ce qu’il utilise.', m: <div className="col"><div className="row"><span className="lb">Grille</span><div className="trk"><i className="g" style={{ left: 0, width: 12 }} /></div></div><div className="row"><span className="lb">Viewer</span><div className="trk"><i className="b" style={{ left: 0, width: 45 }} /></div></div><div className="row"><span className="lb">Zoom</span><div className="trk"><i className="o" style={{ left: 0, width: 100 }} /></div></div><span className="note">Poids relatifs dessinés, pas mesurés.</span></div> },
  ] },
  { id: 'site', title: 'Tout le site', desc: 'Constats dans les journaux du serveur de développement : /api/pronos/resolve met de 2 à 7 s et /api/trades/summary jusqu’à 7 s (en développement, à confirmer en production).', items: [
    { n: 636, t: 'Navigation instantanée entre les pages', meta: ['Effort faible', 'Gain : ressenti', 'Risque : faible'], d: 'La page suivante est préparée dès le survol ou le toucher d’un lien, avec une petite transition fluide (accueil → galerie → trades).', m: <Steps s={['Survol d’un lien', 'Page préparée', 'Clic : affichage immédiat']} /> },
    { n: 637, t: 'Accueil : un seul appel regroupé', top: true, meta: ['Effort moyen', 'Gain : fort', 'Risque : moyen'], d: 'Compteurs, pronos, dernières activités : aujourd’hui plusieurs appels séparés dont certains sont lents. Un appel unique côté serveur, mis en cache 1 à 2 minutes.', m: <Two l={<div className="col"><div className="box r">pronos/resolve</div><div className="box r">trades/summary</div><div className="box r">compteurs</div><div className="box r">activités</div></div>} r={<div className="box g" style={{ padding: 28 }}>1 appel regroupé</div>} /> },
    { n: 638, t: 'Cache serveur pour les données publiques', meta: ['Effort faible', 'Gain : moyen', 'Risque : faible'], d: 'Setlist (1 058 collections), guides, sorties : des données qui changent rarement sont servies depuis un cache partagé et renouvelées en arrière-plan.', m: <Steps s={['1re visite : calcul', 'Visites suivantes : cache', 'Renouvelé en douce']} /> },
    { n: 639, t: 'Polices plus légères', meta: ['Effort faible', 'Gain : petit à moyen', 'Risque : très faible'], d: 'Les polices Surfquest en format web compressé (woff2) et limitées aux caractères utiles, avec affichage immédiat d’un texte de repli.', m: <Wt a={80} b={25} la="Fichiers .otf" lb="woff2 + sous-ensemble" /> },
    { n: 640, t: 'Moins de JavaScript au premier affichage', meta: ['Effort moyen', 'Gain : moyen', 'Risque : faible'], d: 'Auditer le poids du code envoyé au premier écran (outil d’analyse du bundle) et ne charger l’export vidéo, le Story, l’éditeur de tags… qu’au moment de s’en servir. Une partie est déjà chargée à la demande.', m: <Two l={<div className="box r" style={{ padding: 20 }}>Tout au départ</div>} r={<div className="col"><div className="box g">Essentiel</div><div className="box k">+ à la demande</div></div>} /> },
    { n: 641, t: 'Cache long sur toutes les photos envoyées', meta: ['Effort faible', 'Gain : moyen (visites répétées)', 'Risque : très faible'], d: 'Vérifier que chaque photo enregistrée dans le stockage porte un cache d’un an : une photo déjà vue n’est jamais retéléchargée.', m: <div className="box k" style={{ textAlign: 'left' }}>Cache-Control: public, max-age=31536000</div> },
  ] },
  { id: 'photo', title: 'Photo et ajout de cartes', desc: 'Hors reconnaissance IA, que je ne touche pas.', items: [
    { n: 642, t: 'Traiter la photo sans figer l’écran', meta: ['Effort moyen', 'Gain : fort sur téléphone modeste', 'Risque : moyen'], d: 'Le recadrage et la création des miniatures se font dans un processus à part du navigateur : le bouton et l’écran restent réactifs.', m: <Two l={<Tl rows={[{ l: 'Écran', s: 0, w: 70, c: 'r' }]} /> } r={<Tl rows={[{ l: 'Écran', s: 0, w: 10, c: 'g' }, { l: 'En fond', s: 0, w: 70 }]} />} tl="Écran gelé" tr="Écran libre" /> },
    { n: 643, t: 'Aide au cadrage plus légère', meta: ['Effort moyen', 'Gain : fort', 'Risque : faible'], d: 'Constat dans le code : le calcul peut bloquer l’écran environ 0,5 s. Le faire sur une image plus petite et hors de l’écran, quelques fois par seconde.', m: <Wt a={70} b={15} la="Blocage actuel" lb="Image réduite" /> },
    { n: 644, t: 'Envoi de la photo dès qu’elle est prise', meta: ['Effort moyen', 'Gain : fort', 'Risque : moyen'], d: 'L’envoi commence en tâche de fond pendant que tu remplis la fiche ; au moment d’enregistrer, il est déjà terminé.', m: <div className="col"><span className="tiny bad">Aujourd’hui</span><Tl rows={[{ l: 'Fiche', s: 0, w: 40 }, { l: 'Envoi', s: 40, w: 35, c: 'o' }]} /><span className="tiny ok">Proposé</span><Tl rows={[{ l: 'Fiche', s: 0, w: 40, c: 'g' }, { l: 'Envoi', s: 0, w: 35, c: 'g' }]} /></div> },
  ] },
  { id: 'app', title: 'Application Android', desc: 'Ce qui se voit au lancement de l’appli.', items: [
    { n: 645, t: 'Démarrage : le dernier écran connu, pas un cercle qui tourne', meta: ['Effort moyen', 'Gain : ressenti fort', 'Risque : faible'], d: 'Au lancement, l’accueil et la galerie gardés sur l’appareil s’affichent tout de suite, puis se mettent à jour. Fini l’écran vide de plusieurs secondes.', m: <Two l={<Ph><div style={{ margin: 'auto', width: 28, height: 28, border: '3px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} /></Ph>} r={<Ph><div className="sk" style={{ height: 16 }} /><Grid4 /></Ph>} tl="Aujourd’hui" tr="Proposé" /> },
    { n: 646, t: 'Vrai mode économie de données', meta: ['Effort faible', 'Gain : réseau lent', 'Risque : très faible'], d: 'Sur réseau lent ou économie de données : miniatures plus petites, animations coupées, vidéos jamais lancées automatiquement. Un réglage dans Paramètres pour le forcer.', m: <div className="row" style={{ flexWrap: 'wrap' }}><span className="box g">Miniatures réduites</span><span className="box g">Sans animations</span><span className="box g">Sans vidéo auto</span></div> },
  ] },
  { id: 'mesure', title: 'Mesurer pour de bon', desc: 'Sans chiffres chez les vrais membres, on optimise à l’aveugle.', items: [
    { n: 647, t: 'Mesures réelles chez les membres, dans /admin/stats', top: true, meta: ['Effort moyen', 'Gain : indirect mais décisif', 'Risque : faible'], d: 'Le temps d’affichage (LCP) et la réactivité (INP) de chaque page, mesurés chez les membres et affichés par page, par appareil et par jour. On voit ce qui est lent pour de vrai, et si une optimisation a servi.', m: <div className="col"><div className="row"><span className="lb">Galerie</span><span className="box k">LCP —</span><span className="box k">INP —</span></div><div className="row"><span className="lb">Accueil</span><span className="box k">LCP —</span><span className="box k">INP —</span></div><div className="row"><span className="lb">Trades</span><span className="box k">LCP —</span><span className="box k">INP —</span></div><span className="note">Exemple de tableau : les valeurs viendraient des visites réelles.</span></div> },
    { n: 648, t: 'Budget de performance avec alerte', meta: ['Effort faible', 'Gain : durable', 'Risque : très faible'], d: 'Une limite de poids et de temps par page : si un changement fait dépasser la limite, on est prévenu avant la mise en ligne.', m: <div className="row" style={{ flexWrap: 'wrap' }}><span className="box g">Galerie : sous la limite</span><span className="box r">Accueil : dépasse</span></div> },
  ] },
]

export default function DevIdees20() {
  return (
    <div className="mx">
      <style>{CSS}</style>
      <span className="eyebrow">Idées 624 → 648 · vitesse</span>
      <h1 className="sf">Un site plus réactif et plus rapide</h1>
      <p className="lead">25 pistes, la galerie en priorité. Chaque carte a un schéma d’intention : les durées et poids dessinés ne sont pas des mesures. Les constats appuyés sur le code ou les journaux sont signalés comme tels. Les cadres à bordure dorée sont ceux que je ferais en premier.</p>
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
          <p style={{ margin: 0, fontSize: 14 }}>Je commencerais par mesurer, puis par ce qui se voit tout de suite sur la galerie :</p>
          <ol>
            <li><b>647</b> : mesurer chez les vrais membres, pour savoir où l’on perd du temps et vérifier chaque gain.</li>
            <li><b>624 + 625 + 626</b> : une galerie qui arrive plus vite (moins de données, serveur, version gardée).</li>
            <li><b>633 + 634</b> : vignettes sans cases grises et viewer 3D qui s’ouvre instantanément. Peu d’effort, très visible.</li>
            <li><b>631 + 632</b> : recherche et défilement fluides sur les grosses collections.</li>
            <li><b>637</b> : l’accueil, dont certains appels sont lents.</li>
            <li>Le reste : à planifier selon ce que les mesures montrent.</li>
          </ol>
          <p className="note" style={{ marginTop: 12 }}>Je n’ai rien mesuré sur les vrais comptes : ces priorités viennent de la lecture du code et des journaux, à confirmer avec 647.</p>
        </div>
      </section>
    </div>
  )
}
