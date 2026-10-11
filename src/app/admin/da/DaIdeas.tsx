'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 28 : Grail Wall sur mobile + mode clair.

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

/* serie 28 : Grail Wall, mobile + mode clair (prefixe gw-) */
.ix .gw-wall { position: relative; display: flex; flex-wrap: wrap; gap: 26px; justify-content: center; align-items: flex-start; padding: 40px 18px 44px; overflow: hidden; border: 3px solid rgba(255,255,255,.16);
  background: radial-gradient(70% 90% at 50% 0%, rgba(255,238,190,.13), transparent 62%), repeating-linear-gradient(90deg, rgba(255,255,255,.028) 0 2px, transparent 2px 7px), linear-gradient(180deg, #0c1334 0%, #08102b 100%); }
.ix .gw-wall::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 9px; background: linear-gradient(90deg, #6b5217, #e4c46c 50%, #6b5217); }
.ix .gw-wall.lt { border-color: #06122e; background: radial-gradient(70% 90% at 50% 0%, rgba(255,238,190,.7), transparent 62%), repeating-linear-gradient(90deg, rgba(6,18,46,.035) 0 2px, transparent 2px 7px), linear-gradient(180deg,#f4efe3 0%,#e4dcc8 100%); }
.ix .gw-fr { position: relative; width: var(--w, 130px); flex-shrink: 0; background: linear-gradient(145deg,#E8C25A,#E8C25Aaa 45%,#E8C25A); padding: 5px; outline: 1px solid rgba(0,0,0,.45); outline-offset: -1px; box-shadow: 0 0 22px rgba(232,194,90,.35); }
.ix .gw-fr::before { content: ''; position: absolute; top: -11px; left: 14%; right: 14%; height: 4px; background: #d9dde8; box-shadow: 0 0 0 1px rgba(0,0,0,.5); }
.ix .gw-wall.lt .gw-fr { box-shadow: 0 10px 14px rgba(70,48,0,.35); } .ix .gw-wall.lt .gw-fr::before { background: #7b8091; }
.ix .gw-in { background: #ece6d6; padding: 5px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.35); } .ix .gw-in img { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .gw-lb { margin: 6px -5px -5px; padding: 4px 6px 5px; background: linear-gradient(135deg,#d8b45a,#f1dc9a 45%,#b8923a); border-top: 1px solid rgba(0,0,0,.35); color: #2a1c00 !important; } .ix .gw-lb b { display: block; font: 800 9px system-ui; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #2a1c00 !important; } .ix .gw-lb i { display: block; font: 700 8px system-ui; color: #5a3f08 !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ix .gw-add { align-self: center; display: inline-flex; flex-direction: column; align-items: center; gap: 4px; min-height: 60px; padding: 10px 20px; border: 2px dashed rgba(228,196,108,.7); color: #e4c46c !important; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; } .ix .gw-add b { font-size: 28px; line-height: .8; font-weight: 400; font-family: 'Surfquest', Impact, sans-serif; color: #e4c46c !important; }
.ix .gw-wall.lt .gw-add, .ix .gw-wall.lt .gw-add b { border-color: #8a6a1a; color: #6b5217 !important; }
.ix .gw-ttl { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; } .ix .gw-ttl .t { font-size: 26px; line-height: 1; } .ix .gw-ttl small { font: 600 11px system-ui; color: rgba(255,255,255,.65); }
.ix .gw-ttl.lt .t, .ix .gw-ttl.lt small { color: #06122e !important; }
.ix .gw-lightbg { background: #f4f6fb; padding: 18px; } .ix .gw-lightbg .gw-ttl .t { color: #06122e !important; } .ix .gw-lightbg .gw-ttl small { color: #5b6478 !important; }
.ix .gw-ph { width: 300px; border: 4px solid #fff; background: #050912; } .ix .gw-ph .top { padding: 10px 12px 4px; } .ix .gw-ph .gw-wall { border-width: 2px; border-left: 0; border-right: 0; padding: 30px 10px 34px; gap: 18px; }
.ix .gw-ph.lt { background: #f4f6fb; }
.ix .gw-cap { font: 700 10px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); text-align: center; margin: 6px 0 0; }
/* carrousel */
.ix .gw-snap { display: flex; gap: 14px; overflow-x: auto; padding: 22px 10px 10px; scroll-snap-type: x mandatory; width: 100%; } .ix .gw-snap .gw-fr { scroll-snap-align: center; --w: 168px; }
.ix .gw-dots { display: flex; gap: 6px; justify-content: center; width: 100%; } .ix .gw-dots i { width: 18px; height: 4px; background: rgba(255,255,255,.3); } .ix .gw-dots i.on { background: #e4c46c; }
.ix .gw-wall.carousel { flex-direction: column; align-items: stretch; padding-left: 0; padding-right: 0; }
/* focus + vignettes */
.ix .gw-thumbs { display: flex; gap: 8px; justify-content: center; width: 100%; } .ix .gw-thumbs .gw-fr { --w: 48px; padding: 2px; box-shadow: none; } .ix .gw-thumbs .gw-fr::before, .ix .gw-thumbs .gw-lb { display: none; } .ix .gw-thumbs .gw-in { padding: 2px; } .ix .gw-thumbs .on { outline: 2px solid #fff; outline-offset: 2px; }
/* etageres */
.ix .gw-shelf { display: flex; justify-content: center; gap: 12px; width: 100%; padding-bottom: 10px; border-bottom: 5px solid #6b5217; margin-bottom: 14px; position: relative; } .ix .gw-shelf:last-child { margin-bottom: 0; }
/* eventail */
.ix .gw-fan { position: relative; height: 270px; width: 100%; display: flex; justify-content: center; } .ix .gw-fan .gw-fr { position: absolute; bottom: 0; transform-origin: 50% 120%; --w: 132px; }
/* visionneuse */
.ix .gw-view { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; } .ix .gw-arr { width: 40px; height: 56px; border: 2px solid #e4c46c; color: #e4c46c !important; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.ix .gw-count { font: 800 11px system-ui; letter-spacing: .14em; color: #e4c46c !important; text-align: center; width: 100%; }
/* liste */
.ix .gw-list { width: 100%; display: flex; flex-direction: column; gap: 10px; } .ix .gw-li { display: flex; align-items: center; gap: 12px; border: 1px solid rgba(228,196,108,.5); padding: 8px; background: rgba(255,255,255,.04); } .ix .gw-li .gw-fr { --w: 62px; padding: 3px; box-shadow: none; } .ix .gw-li .gw-fr::before, .ix .gw-li .gw-lb { display: none; } .ix .gw-li .gw-in { padding: 3px; } .ix .gw-li .nm { font-size: 20px; line-height: 1; } .ix .gw-li small { display: block; font: 600 11px system-ui; color: rgba(255,255,255,.6); margin-top: 4px; }
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

const GC = [
  { n: 'Andre Iguodala', s: 'Signature Shots', img: C.mccain.img },
  { n: 'Jrue Holiday', s: 'Rookie', img: C.maxey.img },
  { n: 'Dario Saric', s: 'Flawless', img: C.edwards.img },
  { n: 'Michael Carter-Williams', s: 'Prizm', img: C.mcw.img },
  { n: 'Hersey Hawkins', s: 'Upper Deck', img: C.hawkins.img },
]
const Fr = ({ i, w, style, nolabel }: { i: number; w?: number; style?: React.CSSProperties; nolabel?: boolean }) => (
  <div className="gw-fr" style={{ ['--w' as string]: w ? `${w}px` : undefined, ...style }}>
    <div className="gw-in"><img src={GC[i].img} alt="" />{!nolabel && <div className="gw-lb"><b>{GC[i].n}</b><i>{GC[i].s}</i></div>}</div>
  </div>
)
const Add = ({ label = 'Choisir une carte (3/5)' }: { label?: string }) => <div className="gw-add"><b>+</b>{label}</div>
const Ttl = ({ lt }: { lt?: boolean }) => <div className={`gw-ttl${lt ? ' lt' : ''}`}><span>💎</span><span className="t sf">Grail Wall</span><small>— Les pièces maîtresses</small></div>

export default function DaIdeas() {
  const names = ['Mobile actuel', 'Carrousel', 'Focus + vignettes', 'Étagères', 'Éventail', 'Visionneuse', 'Liste', 'Desktop 1 · 3 · 5', 'Mode clair']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 28 · Grail Wall sur mobile</h1>
      <p className="lead">Fait directement sur le site : jusqu&apos;à 5 cadres, les places vides ne s&apos;affichent plus (les cadres se centrent) et un seul bouton « + Choisir une carte » apparaît pour le propriétaire ; mode clair retravaillé. Ici : des idées pour le téléphone, où 5 cadres de 152 px ne tiennent pas côte à côte (aujourd&apos;hui ils passent 2 + 2 + 1), puis un aperçu du desktop à 1, 3 et 5 cartes et du mode clair.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="00" title="Mobile aujourd'hui, avec 5 cartes" desc="Les cadres gardent leur taille (152 px) et passent à la ligne : 2 + 2 + 1. Le mur devient très haut (plus de 800 px) et pousse la collection loin vers le bas."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ gap: 22 }}>{[0, 1, 2, 3, 4].map(i => <Fr key={i} i={i} w={132} />)}</div></div></Bay>

      <Bay id="s2" n="01" title="Carrousel : on fait glisser de côté, un cadre à la fois" desc="Un seul rang horizontal avec accroche : le cadre central est grand (168 px) et on voit le bord du suivant. Hauteur fixe d'environ 300 px quelle que soit la quantité de cartes, quelques traits dorés indiquent la position. Toucher un cadre ouvre la carte comme aujourd'hui."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall carousel"><div className="gw-snap">{[0, 1, 2, 3, 4].map(i => <Fr key={i} i={i} />)}</div><div className="gw-dots"><i className="on" /><i /><i /><i /><i /></div></div></div></Bay>

      <Bay id="s3" n="02" title="Focus : une grande carte + vignettes en dessous" desc="La première carte est affichée en grand (220 px) avec son cartel ; sous le cadre, une rangée de petites vignettes carrées permet de passer à une autre en un toucher. On met la pièce maîtresse en valeur et le mur reste compact (≈ 400 px)."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ flexDirection: 'column', alignItems: 'center', gap: 16 }}><Fr i={0} w={200} /><div className="gw-thumbs">{[0, 1, 2, 3, 4].map(i => <div key={i} className={i === 0 ? 'on' : ''}><Fr i={i} nolabel /></div>)}</div></div></div></Bay>

      <Bay id="s4" n="03" title="Étagères : 3 cadres sur la première, 2 sur la seconde" desc="Les cadres rétrécissent (≈ 88 px) pour tenir 3 par rangée, posés sur une vraie étagère dorée (filet épais) avec le cartel masqué ; le nom apparaît au toucher. Garde l'esprit « salle de musée » sans scroll horizontal. Hauteur ≈ 380 px."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ flexDirection: 'column', gap: 0, padding: '30px 10px 26px' }}><div className="gw-shelf"><Fr i={0} w={84} nolabel /><Fr i={1} w={84} nolabel /><Fr i={2} w={84} nolabel /></div><div className="gw-shelf"><Fr i={3} w={84} nolabel /><Fr i={4} w={84} nolabel /></div></div></div></Bay>

      <Bay id="s5" n="04" title="Éventail : les cartes se chevauchent, un toucher pour déplier" desc="Les 5 cadres sont posés en éventail les uns sur les autres (≈ 270 px de haut). Un toucher dessus déplie la sélection en carrousel (idée 01) ; ça donne un aperçu spectaculaire sans prendre de place."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ paddingBottom: 30 }}><div className="gw-fan">{[0, 1, 2, 3, 4].map((i, k) => <Fr key={i} i={i} nolabel style={{ transform: `translateX(${(k - 2) * 46}px) rotate(${(k - 2) * 9}deg)`, zIndex: k === 2 ? 5 : 4 - Math.abs(k - 2) }} />)}</div></div></div></Bay>

      <Bay id="s6" n="05" title="Visionneuse : un cadre, deux flèches carrées et un compteur" desc="Un seul cadre à la fois (180 px) avec deux flèches carrées à filet doré de chaque côté (en plus du glissement du doigt), et un compteur « 1 / 5 » en dessous. Très lisible ; le propriétaire garde son bouton d'ajout sous le compteur."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ flexDirection: 'column', alignItems: 'center', gap: 14 }}><div className="gw-view"><span className="gw-arr">‹</span><Fr i={1} w={170} /><span className="gw-arr">›</span></div><div className="gw-count">2 / 5</div><Add label="Choisir une carte" /></div></div></Bay>

      <Bay id="s7" n="06" title="Liste : miniature + nom en grand + série" desc="Chaque pièce maîtresse devient une ligne : cadre doré miniature (62 px), nom en Surfquest 20 px, set dessous. Rien n'est tronqué, tous les noms se lisent, hauteur ≈ 70 px par carte. Moins « musée », plus pratique."><div className="gw-ph"><div className="top"><Ttl /></div>
        <div className="gw-wall" style={{ padding: '26px 10px 14px', gap: 0 }}><div className="gw-list">{[0, 1, 2, 3, 4].map(i => <div key={i} className="gw-li"><Fr i={i} nolabel /><div><div className="nm sf">{GC[i].n}</div><small>{GC[i].s}</small></div></div>)}</div></div></div></Bay>

      <Bay id="s8" n="07" title="Desktop : 1, 3 ou 5 cartes, les cadres se centrent, pas de cases vides" desc="Aperçu de ce qui est maintenant sur le site. Le propriétaire voit en plus un seul bouton « + Choisir une carte (n/5) » pointillé à droite des cadres ; les visiteurs ne voient que les cadres remplis, centrés."><div>
        <Ttl /><div className="gw-wall" style={{ marginBottom: 20 }}><Fr i={0} w={152} /><Add label="Choisir une carte (1/5)" /></div>
        <div className="gw-wall" style={{ marginBottom: 20 }}><Fr i={0} w={152} /><Fr i={1} w={152} /><Fr i={2} w={152} /></div>
        <div className="gw-wall"><Fr i={0} w={152} /><Fr i={1} w={152} /><Fr i={2} w={152} /><Fr i={3} w={152} /><Fr i={4} w={152} /></div>
      </div></Bay>

      <Bay id="s9" n="08" title="Mode clair : salle claire, ombres portées, textes lisibles" desc="Avant : le mur restait un gros bloc bleu nuit sur la page blanche et le sous-titre était presque invisible. Maintenant : mur crème avec filet bleu nuit, ombre portée sous chaque cadre, lampes grises, sous-titre contrasté, bouton d'ajout en or foncé."><div className="gw-lightbg">
        <div className="gw-ttl lt"><span>💎</span><span className="t sf">Grail Wall</span><small>— Les pièces maîtresses</small></div>
        <div className="gw-wall lt"><Fr i={0} w={152} /><Fr i={1} w={152} /><Fr i={2} w={152} /><Add label="Choisir une carte (3/5)" /></div>
      </div></Bay>
    </div>
  )
}
