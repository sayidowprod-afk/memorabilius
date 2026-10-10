'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 9 : 20 idees, plutot tournees setlists / progression / partage. Tout le style est ici, prefixe .ix.

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
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }
.ix .lab { font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; }

/* 1 resultat de synchro */
.ix .sync { max-width: 520px; border: 3px solid #fff; background: linear-gradient(135deg,#050912,#003da6); }
.ix .sync .h { background:#fff; padding: 6px 14px; font: 800 11px system-ui; letter-spacing:.18em; text-transform:uppercase; color:#06122e !important; }
.ix .sync .b { display:grid; grid-template-columns: 1fr 1fr; } .ix .sync .b div { padding: 14px 16px; border-right: 2px solid rgba(255,255,255,.25); } .ix .sync .b div:last-child { border: 0; }
.ix .sync b { font-size: 54px; line-height:.9; display:block; } .ix .sync small { font: 800 10px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.8; }
.ix .sync .f { padding: 10px 16px; border-top: 2px solid rgba(255,255,255,.25); font: 700 12px system-ui; opacity:.85; }
/* 2 paliers de set */
.ix .tiers { max-width: 620px; } .ix .tbar { position:relative; height: 28px; background: rgba(255,255,255,.12); border: 3px solid #fff; padding: 3px; } .ix .tbar i { display:block; height:100%; width: 62%; background: repeating-linear-gradient(90deg,#2f6bff 0 14px,#1a47b8 14px 16px); }
.ix .tmk { position:relative; height: 62px; } .ix .tmk div { position:absolute; transform: translateX(-50%); text-align:center; font: 800 10px system-ui; letter-spacing:.1em; } .ix .tmk i { display:block; width: 30px; height: 30px; margin: 4px auto 3px; clip-path: polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%); background: var(--c); } .ix .tmk div.lock i { opacity:.35; filter: grayscale(1); }
/* 3 il t'en manque */
.ix .near { display:flex; gap: 16px; flex-wrap:wrap; }
.ix .nr { width: 210px; border: 3px solid #fff; padding: 12px; } .ix .nr h4 { margin: 0 0 6px; font-size: 22px; line-height:1; } .ix .nr .m { font-size: 52px; line-height:.9; color:#ffd54a !important; } .ix .nr small { font: 800 10px system-ui; letter-spacing:.12em; text-transform:uppercase; opacity:.8; }
.ix .nr .ghosts { display:flex; gap:4px; margin-top: 10px; } .ix .nr .ghosts i { width: 28px; aspect-ratio: 2.5/3.5; border: 2px dashed rgba(255,255,255,.5); display:block; }
/* 4 set complet */
.ix .done { position:relative; width: 230px; padding: 18px 14px 14px; text-align:center; background: linear-gradient(135deg,#b8860b,#ffd700 45%,#fff6a8 50%,#ffd700 55%,#b8860b); box-shadow: 0 0 40px rgba(255,215,0,.45); }
.ix .done, .ix .done * { color:#3d2800 !important; } .ix .done h4 { margin: 0; font-size: 40px; line-height:.9; } .ix .done b { font-size: 70px; line-height:.9; display:block; } .ix .done small { font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; }
/* 5 grille de numeros */
.ix .nums { display:grid; grid-template-columns: repeat(auto-fill, 30px); gap: 3px; max-width: 760px; }
.ix .nums i { width:30px; height:30px; font: 800 10px system-ui; font-style:normal; display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,.28); }
.ix .nums i.on { background:#2f6bff; border-color:#2f6bff; } .ix .nums i.rc { background:#e67e22; border-color:#e67e22; }
/* 6 palette de paralleles */
.ix .pals { display:flex; flex-wrap:wrap; gap: 8px; } .ix .pal { display:flex; align-items:center; gap: 8px; padding: 6px 12px 6px 6px; border: 2px solid rgba(255,255,255,.25); font: 800 11px system-ui; letter-spacing:.06em; text-transform:uppercase; } .ix .pal i { width: 22px; height: 22px; background: var(--c); border: 2px solid rgba(255,255,255,.6); } .ix .pal.own { background: rgba(47,107,255,.35); border-color:#2f6bff; }
/* 7 filtres */
.ix .fbar { display:flex; gap: 8px; flex-wrap:wrap; padding: 10px; background:#0a1030; border: 3px solid rgba(255,255,255,.3); } .ix .fbar span { padding: 7px 14px; border: 2px solid rgba(255,255,255,.4); font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; } .ix .fbar span.on { background:#fff; color:#06122e !important; } .ix .fbar .n { margin-left:auto; font-size: 22px; align-self:center; }
/* 8 hors ligne */
.ix .off { display:flex; align-items:center; gap: 12px; max-width: 560px; background:#ffd54a; padding: 10px 16px; } .ix .off, .ix .off * { color:#2a2000 !important; } .ix .off b { font: 800 13px system-ui; letter-spacing:.08em; text-transform:uppercase; } .ix .off span { font: 600 12px system-ui; } .ix .off i { width: 12px; height: 12px; background:#2a2000; animation: ixblink 1.2s infinite; } @keyframes ixblink { 50% { opacity:.2; } }
/* 9 story */
.ix .story { width: 210px; aspect-ratio: 9/16; position:relative; background: linear-gradient(170deg,#050912,#003da6); border: 3px solid #fff; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding: 14px 12px; text-align:center; }
.ix .story .card { width: 64%; } .ix .story .t { font-size: 38px; line-height:.9; } .ix .story small { font: 800 9px system-ui; letter-spacing:.2em; text-transform:uppercase; opacity:.8; }
/* 10 nouveautes */
.ix .news { max-width: 480px; border: 3px solid #fff; background:#0a1030; } .ix .news .h { display:flex; justify-content:space-between; align-items:center; background:#fff; padding: 8px 14px; } .ix .news .h b { font-size: 24px; color:#06122e !important; line-height:1; } .ix .news .h i { font: 800 10px system-ui; letter-spacing:.14em; color:#06122e !important; font-style:normal; }
.ix .news li { list-style:none; padding: 10px 14px; border-bottom: 2px solid rgba(255,255,255,.14); display:flex; gap: 10px; align-items:baseline; font-size: 13px; } .ix .news li b { background: var(--c); padding: 2px 8px; font: 800 9px system-ui; letter-spacing:.12em; text-transform:uppercase; flex-shrink:0; } .ix .news ul { margin:0; padding:0; }
/* 11 carte de joueur profil */
.ix .pcard { width: 250px; background: linear-gradient(160deg,#08153b,#003da6); border: 4px solid #fff; padding: 14px; } .ix .pcard .top { display:flex; justify-content:space-between; align-items:flex-start; } .ix .pcard h4 { margin: 0; font-size: 34px; line-height:.9; } .ix .pcard .ovr { font-size: 54px; line-height:.85; text-align:right; }
.ix .pcard .av { height: 120px; margin: 10px 0; background: linear-gradient(135deg,#2f6bff,#0a2468); display:flex; align-items:center; justify-content:center; font-size: 76px; border: 3px solid #fff; } .ix .pcard .st { display:grid; grid-template-columns: repeat(3,1fr); text-align:center; } .ix .pcard .st b { font-size: 26px; display:block; line-height:1; } .ix .pcard .st small { font: 800 9px system-ui; letter-spacing:.14em; opacity:.8; }
/* 12 cadres d'avatar */
.ix .frames { display:flex; gap: 22px; flex-wrap:wrap; } .ix .fr { text-align:center; } .ix .fr .av { width: 84px; height: 84px; border-radius:50%; background: #2f6bff; display:flex; align-items:center; justify-content:center; font-size: 36px; margin: 0 auto 8px; box-shadow: 0 0 0 5px var(--a), 0 0 0 8px #08153b, 0 0 0 10px var(--b); }
/* 13 nouveau */
.ix .newset { display:flex; align-items:center; gap: 12px; max-width: 520px; padding: 12px 14px; border: 3px solid #fff; position:relative; } .ix .newset .nw { background:#e63a6e; padding: 3px 10px; font: 800 10px system-ui; letter-spacing:.16em; text-transform:uppercase; } .ix .newset h4 { margin:0; font-size: 26px; line-height:1; flex:1; } .ix .newset small { font: 700 11px system-ui; opacity:.7; }
/* 14 duel setlist */
.ix .vs2 { max-width: 560px; } .ix .vs2 .r { display:grid; grid-template-columns: 1fr 74px 1fr; align-items:center; gap: 8px; margin: 8px 0; } .ix .vs2 .bar { height: 18px; background: rgba(255,255,255,.1); position:relative; } .ix .vs2 .bar i { position:absolute; top:0; bottom:0; background: var(--c); } .ix .vs2 .l .bar i { right:0; } .ix .vs2 .mid { text-align:center; font: 800 10px system-ui; letter-spacing:.12em; text-transform:uppercase; } .ix .vs2 .n { font-size: 20px; }
/* 15 suggestion */
.ix .sugg { display:flex; gap: 18px; align-items:center; border: 3px solid #fff; padding: 14px; max-width: 560px; } .ix .sugg .card { width: 90px; flex-shrink:0; } .ix .sugg h4 { margin: 0 0 6px; font-size: 28px; line-height:.95; } .ix .sugg p { margin: 0 0 8px; font-size: 13px; opacity:.8; } .ix .sugg .gain { display:inline-block; background:#1f9d55; padding: 3px 10px; font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; }
/* 16 provenance */
.ix .prov { position:relative; max-width: 460px; padding-left: 30px; } .ix .prov::before { content:''; position:absolute; left: 8px; top: 6px; bottom: 6px; width: 3px; background: rgba(255,255,255,.35); } .ix .pv { position:relative; margin-bottom: 16px; } .ix .pv::before { content:''; position:absolute; left: -29px; top: 3px; width: 13px; height: 13px; background:#fff; border: 3px solid #08153b; box-shadow: 0 0 0 2px #fff; } .ix .pv b { font-size: 22px; line-height:1; display:block; } .ix .pv small { font: 700 11px system-ui; opacity:.7; }
/* 17 bascule de theme */
.ix .tg { width: 130px; height: 62px; border: 3px solid #fff; position:relative; display:flex; align-items:center; background:#0a1030; cursor:pointer; } .ix .tg span { position:absolute; top: 3px; left: 3px; width: 50px; height: 50px; background:#fff; display:flex; align-items:center; justify-content:center; font-size: 26px; transition: transform .3s cubic-bezier(.3,1.4,.5,1); color:#06122e !important; } .ix .tg.light { background:#e9edf8; } .ix .tg.light span { transform: translateX(68px); background:#06122e; color:#fff !important; }
/* 18 pastille de synchro */
.ix .cloud { display:inline-flex; align-items:center; gap: 10px; border: 3px solid #fff; padding: 8px 14px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; } .ix .cloud i { width: 12px; height: 12px; background:#3ddc97; box-shadow: 0 0 10px #3ddc97; } .ix .cloud.sy i { background:#2f6bff; box-shadow: 0 0 10px #2f6bff; animation: ixblink .8s infinite; } .ix .cloud.er i { background:#e5484d; box-shadow: 0 0 10px #e5484d; }
/* 19 tampon coche */
.ix .chk { display:flex; flex-wrap:wrap; gap: 12px; } .ix .ck { width: 120px; border: 3px solid rgba(255,255,255,.3); padding: 10px; cursor:pointer; position:relative; text-align:center; font: 800 11px system-ui; letter-spacing:.08em; text-transform:uppercase; min-height: 70px; display:flex; align-items:center; justify-content:center; }
.ix .ck .st { position:absolute; inset:auto -8px -10px auto; transform: rotate(-12deg); border: 3px solid #3ddc97; color:#3ddc97 !important; padding: 0 8px; font-size: 24px; background: rgba(5,9,18,.7); opacity:0; transform: rotate(-12deg) scale(2.5); transition: all .25s cubic-bezier(.3,1.4,.5,1); } .ix .ck.on { border-color:#3ddc97; } .ix .ck.on .st { opacity:1; transform: rotate(-12deg) scale(1); }
/* 20 index A-Z */
.ix .az { display:flex; gap: 20px; max-width: 520px; } .ix .az .list { flex:1; } .ix .az .gr { font-size: 30px; line-height:1; border-bottom: 3px solid #fff; margin: 10px 0 4px; } .ix .az .p { padding: 6px 0; font: 700 14px system-ui; border-bottom: 1px solid rgba(255,255,255,.12); } .ix .az nav { display:flex; flex-direction:column; justify-content:space-between; font: 800 11px system-ui; letter-spacing:.04em; opacity:.8; }
@media (prefers-reduced-motion: reduce) { .ix .off i, .ix .cloud.sy i { animation: none; } }
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
  const [ck, setCk] = useState<number[]>([1])
  const [light, setLight] = useState(false)
  const names = ['Résultat de synchro', 'Paliers de set', 'Il t’en manque', 'Set complet', 'Grille de numéros', 'Palette de parallèles', 'Filtres capsules', 'Hors ligne', 'Story', 'Nouveautés', 'Carte de joueur', 'Cadres d’avatar', 'Nouveau set', 'Duel de setlist', 'Prochaine carte', 'Provenance', 'Bascule de thème', 'État de synchro', 'Tampon de coche', 'Index A-Z']
  const toggle = (i: number) => setCk(c => (c.includes(i) ? c.filter(x => x !== i) : [...c, i]))
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 9</h1>
      <p className="lead">Vingt nouvelles pistes, surtout autour des setlists, de la progression et du partage. Dis-moi les numéros à garder.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#r${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="r1" n="01 — Résultat de synchro" title="Un ticket de résultat après la synchronisation" desc="Après « Synchroniser », un ticket à deux colonnes : cartes inscrites au total et nouvelles cartes cochées, avec le détail (synchro / à la main) et le nombre de cartes non placées à traiter.">
        <div className="sync wht"><div className="h">Synchronisation terminée</div><div className="b"><div><b className="sf">231</b><small>Cartes inscrites</small></div><div><b className="sf">+48</b><small>Nouvelles</small></div></div><div className="f">dont 205 par synchro · 26 à la main — 31 cartes non placées</div></div>
      </Bay>
      <Bay id="r2" n="02 — Paliers de set" title="Des paliers de progression sur chaque set" desc="La barre d'un set porte des jalons à 25 %, 50 %, 75 % et 100 %, chacun avec un écusson métal (bronze, argent, or, diamant) qui s'allume en l'atteignant.">
        <div className="tiers wht"><div className="tbar"><i /></div><div className="tmk">{([[25, '#cd7f32', 0], [50, '#c0c0c0', 0], [75, '#ffd700', 1], [100, '#58c8ff', 1]] as [number, string, number][]).map(m => <div key={m[0]} className={m[2] ? 'lock' : ''} style={{ left: `${m[0] - (m[0] === 100 ? 4 : 0)}%` }}><i style={{ ['--c' as string]: m[1] }} />{m[0]} %</div>)}</div></div>
      </Bay>
      <Bay id="r3" n="03 — Il t'en manque" title="Les sets que tu peux finir bientôt" desc="Des fiches « Il t'en manque 3 » avec les cartes manquantes en pointillés : les sets presque complets passent en tête, avec un bouton pour voir les manquantes. Motive à finir.">
        <div className="near wht">{([['2023-24 Court Kings', 3, 5], ['2024-25 Optic Rated Rookies', 2, 6], ['2022-23 Hoops Base', 7, 9]] as [string, number, number][]).map(n => <div className="nr" key={n[0]}><h4 className="sf">{n[0]}</h4><div className="m sf">{n[1]}</div><small>cartes manquantes</small><div className="ghosts">{Array.from({ length: n[1] }, (_, i) => <i key={i} />)}</div></div>)}</div>
      </Bay>
      <Bay id="r4" n="04 — Set complet" title="Un set complété a droit à son sceau d'or" desc="Quand un set est fini à 100 % : la tuile passe en or métal avec « COMPLET » en grand et la date. Les sets terminés se rangent dans une vitrine du profil.">
        <div className="done"><small>2022-23 Optic</small><b className="sf">100%</b><h4 className="sf">Complet</h4><small>Terminé le 6 oct. 2026</small></div>
      </Bay>
      <Bay id="r5" n="05 — Grille de numéros" title="Un set vu comme une grille de numéros" desc="Chaque numéro de la checklist est une case : bleu si tu l'as, orange pour les rookies, vide sinon. On repère les trous d'un coup d'œil, par plage de numéros.">
        <div className="nums wht">{Array.from({ length: 120 }, (_, i) => <i key={i} className={[3, 7, 8, 12, 20, 21, 22, 40, 41, 55, 56, 57, 58, 90, 91, 100, 101, 102, 103, 110].includes(i) ? (i % 5 === 0 ? 'rc' : 'on') : ''}>{i + 1}</i>)}</div>
      </Bay>
      <Bay id="r6" n="06 — Palette de parallèles" title="Les parallèles d'un set en pastilles de couleur" desc="Chaque parallèle (Silver, Gold, Blue Ice…) devient une pastille à sa vraie couleur ; ceux que tu possèdes sont surlignés. Plus parlant qu'une liste de 31 noms.">
        <div className="pals wht">{([['Silver', '#c0c0c0', 1], ['Gold', '#ffd700', 1], ['Blue Ice', '#58c8ff', 0], ['Red', '#e5484d', 1], ['Green', '#1f9d55', 0], ['Pink', '#e63a6e', 0], ['Orange', '#f58426', 1], ['Black', '#222', 0]] as [string, string, number][]).map(p => <span key={p[0]} className={`pal${p[2] ? ' own' : ''}`}><i style={{ ['--c' as string]: p[1] }} />{p[0]}</span>)}</div>
      </Bay>
      <Bay id="r7" n="07 — Filtres capsules" title="Des filtres en capsules rectangulaires avec compteur" desc="Tout / Possédées / Manquantes / RC en capsules à angles droits ; la sélection se remplit en blanc et le nombre de cartes correspondantes s'affiche à droite en grand.">
        <div className="fbar wht">{['Tout', 'Possédées', 'Manquantes', 'RC'].map((f, i) => <span key={f} className={i === 1 ? 'on' : ''}>{f}</span>)}<b className="n sf">231</b></div>
      </Bay>
      <Bay id="r8" n="08 — Hors ligne" title="Un bandeau clair quand la connexion saute" desc="Une bande jaune en haut : « Hors ligne — tes modifications seront envoyées au retour du réseau », avec un petit voyant clignotant. Rassure au lieu de laisser un écran qui semble bloqué.">
        <div className="off"><i /><div><b>Hors ligne</b><br /><span>Tes cases cochées seront envoyées au retour du réseau.</span></div></div>
      </Bay>
      <Bay id="r9" n="09 — Story" title="Partager sa collection en story 9:16" desc="Un visuel vertical prêt pour Instagram : carte phare, « 599 CARTES » en grand, nom de collectionneur, adresse. Généré en un clic depuis le profil.">
        <div className="story wht"><small>Ma collection</small><I c={C.mccain} /><div><div className="t sf">599 cartes</div><small>GKNNN_Cards · memorabilius.fr</small></div></div>
      </Bay>
      <Bay id="r10" n="10 — Nouveautés" title="« Quoi de neuf » en liste d'étiquettes" desc="Une fenêtre à la première ouverture après une mise à jour : une ligne par nouveauté, avec une étiquette colorée (Nouveau, Corrigé, Amélioré). Remplace de longs patchnotes.">
        <div className="news wht"><div className="h"><b className="sf">Quoi de neuf</b><i>v. 10 oct.</i></div><ul>{([['Nouveau', '#2f6bff', 'Carte du jour à gratter'], ['Nouveau', '#2f6bff', 'Loupe pour inspecter'], ['Corrigé', '#1f9d55', 'Synchronisation des setlists'], ['Amélioré', '#e67e22', 'Scanner plus net']] as [string, string, string][]).map(n => <li key={n[2]}><b style={{ ['--c' as string]: n[1] }}>{n[0]}</b>{n[2]}</li>)}</ul></div>
      </Bay>
      <Bay id="r11" n="11 — Carte de joueur" title="Le profil en carte de joueur" desc="Une carte à l'ancienne : note générale (niveau) en haut à droite, pseudo, avatar, trois stats en pied. Un format de partage qui ressemble à ce qu'on collectionne.">
        <div className="pcard wht"><div className="top"><h4 className="sf">GKNNN<br />_Cards</h4><div className="ovr sf">87</div></div><div className="av sf">G</div><div className="st"><div><b className="sf">599</b><small>Cartes</small></div><div><b className="sf">119</b><small>RC</small></div><div><b className="sf">29</b><small>Auto</small></div></div></div>
      </Bay>
      <Bay id="r12" n="12 — Cadres d'avatar" title="Le niveau se voit sur le cadre de l'avatar" desc="L'avatar reçoit un double cercle métallique selon le niveau (bois, bronze, argent, or, diamant). On repère les vétérans dans une liste, sans lire un chiffre.">
        <div className="frames wht">{([['Niv. 1', '#8a5220', '#c8803c'], ['Niv. 5', '#9aa6bd', '#fff'], ['Niv. 10', '#e9b44c', '#fff6a8'], ['Niv. 20', '#58c8ff', '#fff']] as [string, string, string][]).map(f => <div className="fr" key={f[0]}><div className="av sf" style={{ ['--a' as string]: f[1], ['--b' as string]: f[2] }}>G</div><span className="lab">{f[0]}</span></div>)}</div>
      </Bay>
      <Bay id="r13" n="13 — Nouveau set" title="Un ruban « Nouveau » sur les sets récents" desc="Les sets ajoutés depuis moins de 30 jours portent une étiquette rose et leur date d'ajout. Sur la liste des setlists, on voit tout de suite ce qui vient d'arriver.">
        <div className="newset wht"><span className="nw">Nouveau</span><h4 className="sf">2025-26 Topps Chrome</h4><small>Ajouté il y a 4 jours</small></div>
      </Bay>
      <Bay id="r14" n="14 — Duel de setlist" title="Ma setlist face à celle d'un ami" desc="Deux barres opposées pour un même set : toi à gauche, lui à droite, avec les nombres au centre. Pratique pour savoir qui est le plus avancé, ou pour s'échanger les doublons.">
        <div className="vs2 wht">{([['Court Kings', 62, 41, 'Toi', 'KathleenFR'], ['Optic', 33, 58, '', '']] as [string, number, number, string, string][]).map(r => <div className="r" key={r[0]}><div className="l"><div className="bar"><i style={{ width: `${r[1]}%`, ['--c' as string]: '#2f6bff' }} /></div></div><div className="mid"><div className="n sf">{r[1]} · {r[2]}</div>{r[0]}</div><div><div className="bar"><i style={{ width: `${r[2]}%`, left: 0, ['--c' as string]: '#e63a6e' }} /></div></div></div>)}</div>
      </Bay>
      <Bay id="r15" n="15 — Prochaine carte" title="La prochaine carte à chercher" desc="Le site te propose la carte qui ferait avancer le plus un de tes sets, avec « +1,2 % » en pastille verte et un bouton pour la mettre en wishlist ou chercher des vendeurs.">
        <div className="sugg wht"><I c={C.maxey} /><div><h4 className="sf">Tyrese Maxey #157</h4><p>2023-24 Select — te rapproche de 62 % à 63 % du set.</p><span className="gain">+1,2 %</span></div></div>
      </Bay>
      <Bay id="r16" n="16 — Provenance" title="L'histoire d'une carte, de main en main" desc="Sur la fiche d'une carte échangée : une frise des propriétaires successifs (« Benlou33 → GKNNN_Cards »), avec les dates. Donne de la valeur aux cartes qui ont circulé.">
        <div className="prov wht">{([['GKNNN_Cards', 'Depuis le 8 oct. 2026 · échange'], ['Benlou33', '2025 – 2026'], ['Ajoutée sur le site', 'mars 2025']] as [string, string][]).map(p => <div className="pv" key={p[0]}><b className="sf">{p[0]}</b><small>{p[1]}</small></div>)}</div>
      </Bay>
      <Bay id="r17" n="17 — Bascule de thème" title="Clair / sombre en interrupteur à glissière" desc="Une glissière carrée avec soleil et lune qui se déplace d'un coin à l'autre, à la place du petit bouton rond. Cohérent avec les angles droits.">
        <div className={`tg${light ? ' light' : ''}`} onClick={() => setLight(l => !l)} role="switch" aria-checked={light}><span>{light ? '☀' : '☾'}</span></div><div className="cap">Clique</div>
      </Bay>
      <Bay id="r18" n="18 — État de synchro" title="Un voyant d'état pour la synchronisation" desc="Une pastille toujours visible : vert « À jour », bleu qui clignote « Synchronisation… », rouge « Erreur — réessayer ». On ne se demande plus si ça tourne.">
        <div className="row"><div className="cloud wht"><i />À jour</div><div className="cloud sy wht"><i />Synchronisation… 62 %</div><div className="cloud er wht"><i />Erreur · réessayer</div></div>
      </Bay>
      <Bay id="r19" n="19 — Tampon de coche" title="Cocher une carte la tamponne" desc="La case cochée se remplit d'un tampon vert « OK » qui tombe de haut avec un petit rebond. Simple, satisfaisant, et ça confirme que l'enregistrement a eu lieu.">
        <div className="chk wht">{['#1 Tatum', '#2 Brown', '#3 Porzingis', '#4 Pritchard'].map((t, i) => <div key={t} className={`ck${ck.includes(i) ? ' on' : ''}`} onClick={() => toggle(i)}>{t}<span className="st sf">OK</span></div>)}</div><div className="cap">Clique une case</div>
      </Bay>
      <Bay id="r20" n="20 — Index A-Z" title="Un index de lettres sur les listes de joueurs" desc="Dans les longues checklists : une colonne de lettres à droite pour sauter directement à une initiale, avec des en-têtes de lettre en grand dans la liste. Évite de faire défiler 600 lignes.">
        <div className="az wht"><div className="list">{[['A', ['Anthony Edwards', 'Andre Iguodala']], ['B', ['Brandon Miller', 'Bam Adebayo']], ['J', ['Jared McCain', 'Jrue Holiday']]].map(g => <div key={g[0] as string}><div className="gr sf">{g[0] as string}</div>{(g[1] as string[]).map(p => <div className="p" key={p}>{p}</div>)}</div>)}</div><nav>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => <span key={l}>{l}</span>)}</nav></div>
      </Bay>
    </div>
  )
}
