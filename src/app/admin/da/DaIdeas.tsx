'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 10 : 20 idees, plutot tournees messages / communaute / ecrans systeme. Tout le style est ici, prefixe .ix.

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

/* 1 bulles */
.ix .chat { max-width: 460px; display:flex; flex-direction:column; gap: 10px; }
.ix .bub { max-width: 78%; padding: 10px 16px; font-size: 14px; clip-path: polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 12px) 100%,0 100%); background:#fff; } .ix .bub, .ix .bub * { color:#06122e !important; }
.ix .bub.me { align-self:flex-end; background:#2f6bff; clip-path: polygon(0 0,100% 0,100% 100%,12px 100%,0 calc(100% - 10px)); } .ix .bub.me, .ix .bub.me * { color:#fff !important; }
.ix .bub small { display:block; font: 700 10px system-ui; letter-spacing:.1em; opacity:.6; margin-top: 3px; text-transform:uppercase; }
/* 2 frappe */
.ix .typing { display:inline-flex; gap: 6px; align-items:flex-end; padding: 10px 14px; border: 2px solid rgba(255,255,255,.4); } .ix .typing i { width: 16px; aspect-ratio: 2.5/3.5; background:#fff; display:block; animation: ixtp 1s ease-in-out infinite; } .ix .typing i:nth-child(2) { animation-delay: .15s; } .ix .typing i:nth-child(3) { animation-delay: .3s; } @keyframes ixtp { 50% { transform: translateY(-8px) rotate(6deg); } }
/* 3 recu */
.ix .rcpt { width: 300px; background:#fff; padding: 16px; position:relative; -webkit-mask: radial-gradient(circle 7px at 7px 100%, transparent 98%, #000) 0 0/14px 100%; mask: radial-gradient(circle 7px at 7px 100%, transparent 98%, #000) bottom/14px 14px repeat-x, linear-gradient(#000,#000) top/100% calc(100% - 7px) no-repeat; }
.ix .rcpt h4 { margin: 0 0 8px; font-size: 28px; line-height:.95; border-bottom: 3px dashed #06122e; padding-bottom: 8px; } .ix .rcpt .ln { display:flex; justify-content:space-between; font: 700 12px system-ui; padding: 4px 0; } .ix .rcpt .tt { border-top: 3px dashed #06122e; margin-top: 8px; padding-top: 8px; font-size: 26px; display:flex; justify-content:space-between; }
/* 4 roster */
.ix .roster { display:grid; grid-template-columns: repeat(auto-fill, minmax(124px,1fr)); gap: 10px; max-width: 820px; } .ix .rs { background: rgba(255,255,255,.07); border: 2px solid rgba(255,255,255,.2); padding: 12px 8px; text-align:center; position:relative; } .ix .rs .av { width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 6px; background: var(--c); display:flex; align-items:center; justify-content:center; font-size: 22px; } .ix .rs b { display:block; font: 800 11px system-ui; letter-spacing:.06em; text-transform:uppercase; } .ix .rs small { font: 700 10px system-ui; opacity:.7; } .ix .rs .no { position:absolute; top: 4px; left: 6px; font-size: 20px; opacity:.5; } .ix .rs .on { position:absolute; top: 8px; right: 8px; width: 9px; height: 9px; background:#3ddc97; }
/* 5 palette */
.ix .cmd { max-width: 560px; border: 3px solid #fff; background:#050912; } .ix .cmd .in { padding: 14px 16px; font-size: 20px; border-bottom: 3px solid #fff; } .ix .cmd .g { padding: 8px 16px 2px; font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; opacity:.6; } .ix .cmd .it { display:flex; align-items:center; gap: 10px; padding: 8px 16px; font: 700 13px system-ui; } .ix .cmd .it.sel { background:#fff; } .ix .cmd .it.sel, .ix .cmd .it.sel * { color:#06122e !important; } .ix .cmd .it img { width: 22px; box-shadow:none; } .ix .cmd .it kbd { margin-left:auto; font: 800 10px system-ui; border: 2px solid currentColor; padding: 0 6px; }
/* 6 bulletin */
.ix .bull { max-width: 520px; border: 3px solid #fff; } .ix .bull .h { background:#fff; padding: 8px 14px; display:flex; justify-content:space-between; align-items:baseline; } .ix .bull .h b { font-size: 26px; line-height:1; color:#06122e !important; } .ix .bull .h i { font: 800 10px system-ui; letter-spacing:.16em; color:#06122e !important; font-style:normal; }
.ix .bull .g { display:grid; grid-template-columns: repeat(3,1fr); } .ix .bull .g div { padding: 14px 12px; border-right: 2px solid rgba(255,255,255,.2); border-top: 2px solid rgba(255,255,255,.2); } .ix .bull .g div:nth-child(3n) { border-right:0; } .ix .bull b { font-size: 38px; line-height:.9; display:block; } .ix .bull small { font: 800 9px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.8; } .ix .bull .up { color:#3ddc97 !important; font: 800 11px system-ui; }
/* 7 demarrage */
.ix .splash { width: 220px; aspect-ratio: 9/16; background: linear-gradient(160deg,#050912,#003da6); border: 3px solid #fff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap: 18px; position:relative; overflow:hidden; } .ix .splash .m { width: 80px; height: 80px; border: 4px solid #fff; display:flex; align-items:center; justify-content:center; font-size: 60px; box-shadow: inset 0 0 0 4px #08153b, inset 0 0 0 6px #fff; animation: ixsplash 2.4s ease-in-out infinite; } @keyframes ixsplash { 50% { transform: scale(1.1) rotate(4deg); } }
.ix .splash .ld { width: 110px; height: 6px; background: rgba(255,255,255,.25); overflow:hidden; } .ix .splash .ld i { display:block; height:100%; width: 40%; background:#fff; animation: ixld 1.4s ease-in-out infinite; } @keyframes ixld { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
/* 8 langues */
.ix .langs { display:flex; gap: 8px; flex-wrap:wrap; } .ix .lg { width: 70px; border: 3px solid rgba(255,255,255,.35); text-align:center; padding: 8px 4px 6px; cursor:pointer; } .ix .lg.on { border-color:#fff; background: rgba(255,255,255,.14); } .ix .lg .f { height: 26px; display:flex; margin-bottom: 6px; } .ix .lg .f i { flex:1; background: var(--c); display:block; } .ix .lg b { font: 800 11px system-ui; letter-spacing:.14em; }
/* 9 anniversaire */
.ix .bday { position:relative; max-width: 460px; text-align:center; padding: 26px 18px; border: 3px solid #ffd54a; background: linear-gradient(135deg,#050912,#08153b); } .ix .bday .n { font-size: 110px; line-height:.8; color:#ffd54a !important; text-shadow: 0 0 30px rgba(255,213,74,.6); } .ix .bday .t { font: 800 13px system-ui; letter-spacing:.24em; text-transform:uppercase; margin-top: 10px; } .ix .bday .c { position:absolute; width: 10px; height: 10px; }
/* 10 ticker valeur */
.ix .vtick { display:flex; align-items:center; gap: 18px; flex-wrap:wrap; border: 3px solid #fff; padding: 12px 18px; max-width: 640px; } .ix .vtick .v { font-size: 46px; line-height:.9; } .ix .vtick .chg { padding: 4px 10px; background:#12b76a; font: 800 13px system-ui; } .ix .vtick svg { width: 150px; height: 44px; margin-left:auto; }
/* 11 temps mort */
.ix .tmo { max-width: 460px; text-align:center; padding: 24px; border: 3px dashed rgba(255,255,255,.5); } .ix .tmo .big { font-size: 78px; line-height:.85; } .ix .tmo p { margin: 10px 0 14px; font-size: 14px; opacity:.8; }
.ix .tmo .clk { display:inline-block; font-size: 30px; border: 3px solid #fff; padding: 2px 12px; margin-bottom: 8px; }
/* 12 tirer */
.ix .ptr { width: 220px; height: 150px; border: 3px solid rgba(255,255,255,.3); position:relative; overflow:hidden; display:flex; justify-content:center; padding-top: 14px; } .ix .ptr .pc { width: 40px; aspect-ratio: 2.5/3.5; background:#fff; animation: ixflipc 1.2s ease-in-out infinite; } @keyframes ixflipc { 0% { transform: rotateY(0); } 50% { transform: rotateY(180deg); background:#2f6bff; } 100% { transform: rotateY(360deg); } }
.ix .ptr small { position:absolute; left:0; right:0; bottom: 14px; text-align:center; font: 800 10px system-ui; letter-spacing:.18em; text-transform:uppercase; opacity:.7; }
/* 13 non lus */
.ix .unread { display:flex; gap: 22px; align-items:center; flex-wrap:wrap; } .ix .ur { position:relative; width: 48px; height: 48px; border: 3px solid #fff; display:flex; align-items:center; justify-content:center; font-size: 22px; } .ix .ur b { position:absolute; top: -10px; right: -12px; min-width: 24px; height: 24px; background:#e5484d; color:#fff !important; font: 800 12px system-ui; display:flex; align-items:center; justify-content:center; padding: 0 5px; clip-path: polygon(0 0,100% 0,100% 70%,70% 100%,0 100%); }
/* 14 etiquette de grading */
.ix .gl { width: 300px; background:#fff; display:grid; grid-template-columns: 1fr 74px; border-bottom: 5px solid #c8102e; } .ix .gl, .ix .gl * { color:#06122e !important; } .ix .gl .l { padding: 8px 10px; } .ix .gl small { display:block; font: 800 8px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .gl h4 { margin: 2px 0; font-size: 20px; line-height:1; } .ix .gl .gr { background:#06122e; display:flex; flex-direction:column; align-items:center; justify-content:center; } .ix .gl .gr b { font-size: 40px; line-height:.9; color:#fff !important; } .ix .gl .gr small { color:#fff !important; }
/* 15 garde */
.ix .cover2 { width: 240px; aspect-ratio: 3/4; background: var(--c); border: 4px solid #fff; padding: 16px; display:flex; flex-direction:column; justify-content:space-between; box-shadow: 8px 8px 0 rgba(0,0,0,.4); position:relative; } .ix .cover2::before { content:''; position:absolute; left: 24px; top:0; bottom:0; width: 4px; background: rgba(0,0,0,.3); } .ix .cover2 h4 { margin:0; font-size: 44px; line-height:.9; padding-left: 20px; } .ix .cover2 .pg { padding-left:20px; font: 800 11px system-ui; letter-spacing:.18em; text-transform:uppercase; } .ix .cover2 .lbl { background:#fff; margin-left: 20px; padding: 6px 10px; font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .cover2 .lbl, .ix .cover2 .lbl * { color:#06122e !important; }
/* 16 barre du bas */
.ix .tabbar { display:flex; max-width: 420px; background:#050912; border: 3px solid #fff; position:relative; } .ix .tabbar div { flex:1; padding: 12px 4px 10px; text-align:center; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; position:relative; opacity:.6; } .ix .tabbar div span { display:block; font-size: 22px; margin-bottom: 3px; } .ix .tabbar div.on { opacity:1; background: rgba(47,107,255,.25); } .ix .tabbar div.on::after { content:''; position:absolute; left:0; right:0; top:-3px; height: 5px; background:#fff; }
/* 17 trophee */
.ix .kofi { display:flex; align-items:center; gap: 16px; max-width: 520px; border: 3px solid #ffd54a; padding: 14px 16px; background: linear-gradient(135deg, rgba(255,213,74,.16), transparent); } .ix .kofi .tr { font-size: 56px; filter: drop-shadow(0 0 14px rgba(255,213,74,.7)); } .ix .kofi h4 { margin:0 0 4px; font-size: 28px; line-height:.95; } .ix .kofi p { margin:0 0 8px; font-size: 13px; opacity:.8; }
/* 18 confirmation */
.ix .conf { max-width: 420px; border: 4px solid #e5484d; background:#0a0f20; } .ix .conf .h { background:#e5484d; padding: 8px 16px; font: 800 12px system-ui; letter-spacing:.2em; text-transform:uppercase; } .ix .conf .b { padding: 16px; display:flex; gap: 14px; } .ix .conf .b .card { width: 70px; flex-shrink:0; filter: grayscale(.8); } .ix .conf h4 { margin: 0 0 6px; font-size: 26px; line-height:.95; } .ix .conf p { margin:0 0 12px; font-size: 13px; opacity:.8; } .ix .conf .ac { display:flex; gap: 8px; } .ix .conf .del { background:#e5484d; color:#fff !important; border: 3px solid #e5484d; padding: 7px 14px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; }
/* 19 visite */
.ix .tour { position:relative; max-width: 460px; height: 270px; background: rgba(255,255,255,.05); } .ix .tour .hl { position:absolute; left: 24px; top: 28px; width: 150px; height: 46px; border: 4px solid #ffd54a; box-shadow: 0 0 0 9999px rgba(5,9,18,.72); display:flex; align-items:center; justify-content:center; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; background:#003da6; } .ix .tour .tip { position:absolute; left: 24px; top: 94px; width: 260px; background:#fff; padding: 12px 14px; } .ix .tour .tip, .ix .tour .tip * { color:#06122e !important; } .ix .tour .tip b { font-size: 24px; line-height:1; display:block; margin-bottom: 4px; } .ix .tour .tip p { margin: 0 0 8px; font-size: 12px; } .ix .tour .tip .st { font: 800 10px system-ui; letter-spacing:.14em; }
/* 20 onglets collants */
.ix .stab { max-width: 640px; border-bottom: 4px solid #fff; display:flex; gap: 0; overflow-x:auto; } .ix .stab div { padding: 12px 18px 10px; font: 800 12px system-ui; letter-spacing:.12em; text-transform:uppercase; white-space:nowrap; opacity:.6; cursor:pointer; } .ix .stab div b { background:#fff; color:#06122e !important; margin-left: 8px; padding: 1px 7px; font-size: 11px; } .ix .stab div.on { opacity:1; background:#fff; } .ix .stab div.on, .ix .stab div.on * { color:#06122e !important; } .ix .stab div.on b { background:#06122e; color:#fff !important; }
@media (prefers-reduced-motion: reduce) { .ix .typing i, .ix .splash .m, .ix .splash .ld i, .ix .ptr .pc { animation: none; } }
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
  const [lang, setLang] = useState(0)
  const [tab, setTab] = useState(0)
  const names = ['Bulles de chat', 'Frappe en cours', 'Reçu d’échange', 'Roster d’amis', 'Recherche globale', 'Bulletin hebdo', 'Écran de démarrage', 'Langues', 'Anniversaire', 'Ticker de valeur', 'Temps mort', 'Tirer pour actualiser', 'Non lus', 'Étiquette gradée', 'Page de garde', 'Barre du bas', 'Soutenir', 'Confirmation', 'Visite guidée', 'Onglets à compteur']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 10</h1>
      <p className="lead">Vingt nouvelles pistes, surtout messagerie, communauté et écrans système (chargement, erreur, confirmation, visite guidée). Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="01 — Bulles de chat" title="Les messages en bandeaux à coin coupé" desc="Les bulles de la messagerie prennent la forme de bandeaux : blanc à gauche pour l'interlocuteur, bleu à droite pour toi, un coin coupé comme une pointe de bulle, heure en petites capitales.">
        <div className="chat"><div className="bub">Salut ! Ta Maxey /149 est toujours dispo ?<small>14:02</small></div><div className="bub me">Oui, je te la propose contre l&apos;Edwards.<small>14:05</small></div><div className="bub">Deal 🤝<small>14:06</small></div></div>
      </Bay>
      <Bay id="s2" n="02 — Frappe en cours" title="« Il écrit… » avec trois petites cartes" desc="À la place des trois points : trois mini-cartes qui sautent à tour de rôle. Le moment d'attente devient un détail de marque.">
        <div className="typing"><i /><i /><i /></div>
      </Bay>
      <Bay id="s3" n="03 — Reçu d'échange" title="Un échange conclu s'imprime comme un reçu" desc="Un ticket blanc à bords dentelés : numéro d'échange, cartes données et reçues, valeur estimée de chaque côté, total. À garder ou à partager comme preuve.">
        <div className="rcpt ink"><h4 className="sf">Échange n° 0042</h4><div className="ln"><span>Donné · Anthony Edwards</span><span>42 €</span></div><div className="ln"><span>Reçu · Tyrese Maxey</span><span>45 €</span></div><div className="tt sf"><span>Écart</span><span>+3 €</span></div></div>
      </Bay>
      <Bay id="s4" n="04 — Roster d'amis" title="Tes abonnements comme un effectif d'équipe" desc="La liste des collectionneurs suivis en cartes de joueurs : numéro, avatar, pseudo, nombre de cartes, voyant vert s'il est en ligne. Plus vivant qu'une liste de noms.">
        <div className="roster wht">{([['KathleenFR', 858, '#e63a6e', 1], ['T1T177', 821, '#2f6bff', 0], ['Benlou33', 540, '#1f9d55', 1], ['kevinllg', 322, '#e67e22', 0]] as [string, number, string, number][]).map((r, i) => <div className="rs" key={r[0]}><span className="no sf">{i + 1}</span>{r[3] ? <i className="on" /> : null}<div className="av sf" style={{ ['--c' as string]: r[2] }}>{r[0][0]}</div><b>{r[0]}</b><small>{r[1]} cartes</small></div>)}</div>
      </Bay>
      <Bay id="s5" n="05 — Recherche globale" title="Une recherche plein écran type palette de commandes" desc="Un champ en haut, des résultats groupés (Cartes, Joueurs, Collectionneurs, Sets) avec vignette, la ligne choisie en blanc et le raccourci clavier à droite. Remplace plusieurs recherches séparées.">
        <div className="cmd wht"><div className="in">maxey rc</div><div className="g">Cartes</div><div className="it sel"><img src={C.maxey.img} alt="" />Tyrese Maxey · 2020-21 Court Kings<kbd>↵</kbd></div><div className="it"><img src={C.mccain.img} alt="" />Jared McCain · 2024-25 Contenders</div><div className="g">Joueurs</div><div className="it">🏀 Tyrese Maxey — 75 cartes</div></div>
      </Bay>
      <Bay id="s6" n="06 — Bulletin hebdo" title="Le résumé de ta semaine en bulletin" desc="Une fiche de six cases : cartes ajoutées, échanges, likes, jours de série, niveau gagné, place au classement, chacune avec sa variation en vert ou rouge. Peut aussi partir par e-mail.">
        <div className="bull wht"><div className="h"><b className="sf">Ta semaine</b><i>4 – 10 OCT.</i></div><div className="g">{([['+84', 'Cartes', '▲ 12'], ['5', 'Échanges', '▲ 2'], ['63', 'Likes', '▲ 18'], ['7', 'Jours de suite', ''], ['+1', 'Niveau', ''], ['#3', 'Classement', '▲ 1']] as [string, string, string][]).map(c => <div key={c[1]}><b className="sf">{c[0]}</b><small>{c[1]}</small>{c[2] && <div className="up">{c[2]}</div>}</div>)}</div></div>
      </Bay>
      <Bay id="s7" n="07 — Écran de démarrage" title="Un splash d'application avec le M qui respire" desc="À l'ouverture de l'app : fond marine, monogramme M en double filet qui pulse doucement, barre de chargement qui glisse. Un lancement net, pas d'écran blanc.">
        <div className="splash wht"><div className="m sf">M</div><div className="sf" style={{ fontSize: 22 }}>Memorabilius</div><div className="ld"><i /></div></div>
      </Bay>
      <Bay id="s8" n="08 — Langues" title="Le sélecteur de langue en petits drapeaux carrés" desc="Cinq tuiles (FR, EN, DE, ES, IT) avec un drapeau à bandes simplifié et le code en dessous ; la langue active est entourée. Plus visuel que le menu déroulant.">
        <div className="langs wht">{([['FR', ['#0055a4', '#fff', '#ef4135']], ['EN', ['#012169', '#fff', '#c8102e']], ['DE', ['#111', '#dd0000', '#ffce00']], ['ES', ['#aa151b', '#f1bf00', '#aa151b']], ['IT', ['#009246', '#fff', '#ce2b37']]] as [string, string[]][]).map((l, i) => <div key={l[0]} className={`lg${lang === i ? ' on' : ''}`} onClick={() => setLang(i)}><div className="f">{l[1].map((c, k) => <i key={k} style={{ ['--c' as string]: c }} />)}</div><b>{l[0]}</b></div>)}</div>
      </Bay>
      <Bay id="s9" n="09 — Anniversaire" title="L'anniversaire du compte en grand" desc="Le jour des un an, deux ans… d'inscription : un « 2 » géant doré avec « ANS SUR MEMORABILIUS », quelques confettis carrés, et le bilan (cartes ajoutées, échanges).">
        <div className="bday wht">{([[10, 12, '#fff'], [88, 20, '#2f6bff'], [14, 74, '#ffd54a'], [86, 70, '#fff'], [50, 6, '#2f6bff']] as [number, number, string][]).map((p, i) => <i key={i} className="c" style={{ left: `${p[0]}%`, top: `${p[1]}%`, background: p[2], transform: `rotate(${i * 30}deg)` }} />)}<div className="n sf">2</div><div className="t">ans sur Memorabilius</div><div className="cap">599 cartes · 23 échanges</div></div>
      </Bay>
      <Bay id="s10" n="10 — Ticker de valeur" title="La valeur de la collection comme un cours en direct" desc="Montant en gros, variation du jour en pastille verte et mini-courbe à droite, dans un cadre fin. Se glisse en haut de la galerie du propriétaire.">
        <div className="vtick wht"><div className="v sf">12 480 €</div><span className="chg">▲ +0,8 %</span><svg viewBox="0 0 150 44"><polyline points="0,36 20,30 40,34 60,22 80,26 100,14 120,18 150,6" fill="none" stroke="#3ddc97" strokeWidth="3" /></svg></div>
      </Bay>
      <Bay id="s11" n="11 — Temps mort" title="L'écran d'erreur façon « temps mort »" desc="Quand le serveur ne répond pas : un grand « Temps mort » avec un chrono qui compte, une phrase rassurante et un bouton « Reprendre ». Dédramatise une panne.">
        <div className="tmo wht"><div className="clk sf">0:30</div><div className="big sf">Temps mort</div><p>Le site reprend son souffle. Tes cartes sont en sécurité.</p><button className="btn">Reprendre</button></div>
      </Bay>
      <Bay id="s12" n="12 — Tirer pour actualiser" title="Une carte qui se retourne pendant l'actualisation" desc="En tirant la liste vers le bas : une carte se retourne en boucle jusqu'à ce que les données arrivent, avec « Relâche pour actualiser » dessous. Remplace la roue qui tourne.">
        <div className="ptr wht"><div className="pc" /><small>Actualisation…</small></div>
      </Bay>
      <Bay id="s13" n="13 — Pastilles non lues" title="Les compteurs de non-lus en pastilles à coin coupé" desc="Messages, notifications, offres d'échange : icône carrée avec un badge rouge à coin coupé et le nombre. Même langage partout, jamais de rond qui jure avec le reste.">
        <div className="unread wht">{([['💬', 3], ['🔔', 12], ['🔄', 1]] as [string, number][]).map(u => <div className="ur" key={u[0]}>{u[0]}<b>{u[1]}</b></div>)}</div>
      </Bay>
      <Bay id="s14" n="14 — Étiquette gradée" title="Une étiquette façon société de gradation" desc="Pour les cartes gradées : une étiquette blanche (année, set, joueur, numéro) avec la note en grand dans un bloc sombre à droite et un liseré rouge. Reconnaissable par tous les collectionneurs.">
        <div className="gl"><div className="l"><small>2024-25 Contenders Optic</small><h4 className="sf">Jared McCain</h4><small>Season Ticket · RC AUTO</small></div><div className="gr"><b className="sf">10</b><small>Gem Mint</small></div></div>
      </Bay>
      <Bay id="s15" n="15 — Page de garde" title="Chaque classeur a sa page de garde" desc="À l'ouverture d'un classeur : couverture de la couleur choisie, reliure sur la gauche, titre en Surfquest et étiquette « 9 pages · 81 cartes ». Un vrai objet qu'on ouvre.">
        <div className="cover2 wht" style={{ ['--c' as string]: '#006bb6' }}><div className="pg">Classeur</div><h4 className="sf">Court Kings</h4><div className="lbl">9 pages · 81 cartes</div></div>
      </Bay>
      <Bay id="s16" n="16 — Barre du bas" title="La barre du bas avec un trait blanc sur l'onglet actif" desc="Trois onglets (Communauté, Ma galerie, Outils) : l'actif s'allume en bleu avec un trait blanc épais au-dessus. Plus lisible que le simple changement de couleur.">
        <div className="tabbar wht">{([['👥', 'Communauté', 0], ['🃏', 'Ma galerie', 1], ['🛠', 'Outils', 0]] as [string, string, number][]).map(t => <div key={t[1]} className={t[2] ? 'on' : ''}><span>{t[0]}</span>{t[1]}</div>)}</div>
      </Bay>
      <Bay id="s17" n="17 — Soutenir" title="Le soutien au projet avec un trophée doré" desc="Un encart sobre à cadre doré : trophée qui brille, « Soutiens Memorabilius », ce que ça finance (serveurs, nouvelles fonctions) et un bouton. Plus chaleureux qu'un simple lien.">
        <div className="kofi wht"><div className="tr">🏆</div><div><h4 className="sf">Soutiens Memorabilius</h4><p>Le site est gratuit, sans pub. Ton soutien paie les serveurs.</p><button className="btn">Soutenir</button></div></div>
      </Bay>
      <Bay id="s18" n="18 — Confirmation" title="Une confirmation de suppression qui montre la carte" desc="Avant de supprimer : cadre rouge, la carte en gris sur le côté, « Supprimer Jared McCain ? Cette action est définitive », deux boutons nets. On sait exactement ce qu'on efface.">
        <div className="conf wht"><div className="h">Attention</div><div className="b"><img className="card" src={C.mccain.img} alt="" /><div><h4 className="sf">Supprimer Jared McCain ?</h4><p>La carte et ses photos seront effacées. Action définitive.</p><div className="ac"><span className="del">Supprimer</span><button className="btn o">Annuler</button></div></div></div></div>
      </Bay>
      <Bay id="s19" n="19 — Visite guidée" title="Une visite guidée qui éclaire un bouton à la fois" desc="Pour les nouveaux : tout s'assombrit sauf le bouton expliqué (cadre doré), une bulle blanche donne la consigne avec « 2 / 4 » et un bouton Suivant. Remplace le long tutoriel.">
        <div className="tour"><div className="hl wht">Ajouter</div><div className="tip"><small className="st">ÉTAPE 2 / 4</small><b className="sf">Ajoute une carte</b><p>Scanne ou prends en photo : l&apos;IA remplit les infos.</p><button className="btn" style={{ background: '#06122e', borderColor: '#06122e', color: '#fff' }}>Suivant</button></div></div>
      </Bay>
      <Bay id="s20" n="20 — Onglets à compteur" title="Les onglets de galerie avec le nombre de cartes" desc="Collection, Classeurs, Objectifs, Badges, Commentaires : l'onglet actif se remplit en blanc, chaque onglet porte son compteur dans une petite étiquette. On voit le contenu avant d'ouvrir.">
        <div className="stab wht">{([['Collection', 599], ['Classeurs', 9], ['Objectifs', 4], ['Badges', 27], ['Commentaires', 12]] as [string, number][]).map((t, i) => <div key={t[0]} className={tab === i ? 'on' : ''} onClick={() => setTab(i)}>{t[0]}<b>{t[1]}</b></div>)}</div>
      </Bay>
    </div>
  )
}
