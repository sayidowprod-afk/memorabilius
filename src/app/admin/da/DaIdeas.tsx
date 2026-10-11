'use client'
import { useState } from 'react'
import Link from 'next/link'
import CardTags, { TagPill } from '@/components/CardTags'
import { TAG_BASE, numTier, numShort, RARE_FX, mix, rgba } from '@/lib/cardTags'

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

/* serie 34 : pastilles RC / AUTO / PATCH / NUM sur les vignettes, version pastilles / rubans / bandeaux (prefixe pg-) */
.ix .pg-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; max-width: 900px; }
.ix .pg { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; } .ix .pg .ph { position: relative; } .ix .pg img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .pg .bar { height: 4px; margin: 8px -7px 0; background: var(--tc, #2f8bff); }
.ix .pg .tx { padding: 8px 2px 9px; } .ix .pg .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .pg .nm .t { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .pg .vr { font: italic 600 11px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .pg .st { font: 500 11px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 2px; }
.ix .pg .ic { display: inline-flex; gap: 8px; font-size: 14px; flex-shrink: 0; }
.ix .pg-old { padding: 8px; border: 2px solid #1a5fd0; border-radius: 10px; background: #0d1530; } .ix .pg-old .tx { padding: 8px 0 4px; } .ix .pg-old .nm { font: 800 13px system-ui; }
/* 1 ruban en coin */
.ix .pg-a .rib { position: absolute; top: 9px; left: -6px; display: grid; gap: 4px; justify-items: start; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.5)); }
/* 2 drapeaux colles au bord */
.ix .pg-b .flags { position: absolute; top: 12px; left: -7px; display: grid; gap: 5px; justify-items: start; } .ix .pg-b .flags > span { display: block; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.5)); }
/* 3 bandeau bas de l'image */
.ix .pg-c .ban { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 5px; padding: 28px 7px 7px; background: linear-gradient(0deg, rgba(5,9,18,.96), rgba(5,9,18,.72) 55%, transparent); }
/* 4 barre segmentee */
.ix .pg-d .seg { display: flex; margin: 8px -7px 0; } .ix .pg-d .seg span { flex: 1; text-align: center; font: 900 11px system-ui; letter-spacing: .1em; text-transform: uppercase; padding: 6px 2px 5px; border-top: 3px solid var(--k); background: var(--b); color: var(--t) !important; border-right: 1px solid rgba(5,9,18,.6); } .ix .pg-d .seg span:last-child { border-right: 0; } .ix .pg-d .bar { margin-top: 0; }
/* 5 bandeau au-dessus du cadre */
.ix .pg-e { margin-top: 0; padding-top: 0; } .ix .pg-e .top { display: flex; gap: 0; margin: 0 -7px 7px; } .ix .pg-e .top > span { flex: 1; text-align: center; font: 900 11px system-ui; letter-spacing: .12em; text-transform: uppercase; padding: 6px 2px 5px; color: #fff !important; background: var(--b); } .ix .pg-e .top > span.rare { color: var(--t) !important; }
/* 6 atouts en ruban + tirage en cartouche */
.ix .pg-f .rib { position: absolute; top: 9px; left: -6px; display: grid; gap: 4px; justify-items: start; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.5)); } .ix .pg-f .cart { position: absolute; right: 6px; bottom: 6px; font: 400 22px/1 'Surfquest', Impact, sans-serif; padding: 3px 9px 2px; background: rgba(5,9,18,.92); border: 2px solid var(--cc); color: var(--cc) !important; box-shadow: 0 0 14px var(--cg); }
/* 7 onglets sur le cadre */
.ix .pg-g { margin-top: 14px; } .ix .pg-g .tabs { position: absolute; top: -11px; left: 10px; display: flex; gap: 4px; z-index: 2; }
/* 8 pile a droite */
.ix .pg-h .rr { position: absolute; right: -6px; bottom: 10px; display: grid; gap: 4px; justify-items: end; filter: drop-shadow(-2px 2px 0 rgba(0,0,0,.5)); }
/* mobile */
.ix .pg-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .pg-ph .pg-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .ix .pg-ph .pg .nm { font-size: 15px; } .ix .pg-ph .pg .st { font-size: 9px; }
@media (max-width: 800px) { .ix .pg-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type PC = { n: string; v?: string; s: string; img: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tc: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, tc: '#2f8bff' },
  { n: 'Tyrese Maxey', s: '1995-96 SkyBox Rookie', img: C.maxey.img, auto: true, patch: true, num: '/25', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Offensive Rebound LDR', s: '1989-90 Fleer', img: C.hawkins.img, patch: true, num: '/99', tc: '#2f8bff' },
  { n: 'Anthony Edwards', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', tc: '#4aa3df' },
]
type K = 'rc' | 'auto' | 'num' | 'patch'
const kinds = (c: PC) => ([c.rc && 'rc', c.auto && 'auto', c.num && 'num', c.patch && 'patch'].filter(Boolean) as K[])
const Pills = ({ c, h = 20, skip }: { c: PC; h?: number; skip?: K }) => <>{kinds(c).filter(k => k !== skip).map(k => <TagPill key={k} kind={k} num={c.num} h={h} />)}</>
const segStyle = (c: PC, k: K) => {
  const base = TAG_BASE[k]
  if (k === 'num') { const t = numTier(c.num); if (t !== 'std') return { ['--k' as string]: '#fff', ['--b' as string]: RARE_FX[t].bg, ['--t' as string]: RARE_FX[t].fg } }
  return { ['--k' as string]: base, ['--b' as string]: rgba(base, 0.34), ['--t' as string]: mix(base, 0.7) }
}
const topBg = (c: PC, k: K) => {
  const base = TAG_BASE[k]
  if (k === 'num') { const t = numTier(c.num); if (t !== 'std') return { ['--b' as string]: RARE_FX[t].bg, ['--t' as string]: RARE_FX[t].fg, rare: true } }
  return { ['--b' as string]: base, ['--t' as string]: '#fff', rare: false }
}
const label = (k: K, c: PC) => (k === 'rc' ? 'RC' : k === 'auto' ? 'Auto' : k === 'patch' ? 'Patch' : numShort(c.num) || 'Num')
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>
const Body = ({ c, last }: { c: PC; last?: React.ReactNode }) => (
  <><div className="bar" style={{ ['--tc' as string]: c.tc }} />{last}<div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div></div></>
)
const tierCol = (c: PC) => { const t = numTier(c.num); return t === 'gold' ? ['#ffd54a', 'rgba(255,215,0,.5)'] : t === 'silver' ? ['#dfe6f2', 'rgba(220,230,245,.4)'] : t === 'bronze' ? ['#e0925a', 'rgba(224,146,90,.4)'] : ['#6c97ff', 'rgba(47,107,255,.35)'] }
const Row = ({ children }: { children: React.ReactNode }) => <div className="pg-row">{children}</div>

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Ruban en coin', 'Drapeaux au bord', 'Bandeau bas de l’image', 'Barre segmentée', 'Bandeau au-dessus', 'Ruban + cartouche', 'Onglets sur le cadre', 'Pile à droite', 'Mobile']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 34 · Pastilles, rubans et bandeaux</h1>
      <p className="lead">Uniquement des pastilles, rubans et bandeaux de texte (RC, AUTO, PATCH, tirage) : pas d&apos;icônes ni de logos. Les maquettes utilisent les vraies pastilles du site (teintées, avec l&apos;effet or / argent / bronze sur les tirages bas). On part de l&apos;idée 03 « rubans sur l&apos;image » que tu avais aimée, et on explore d&apos;autres places pour les pastilles : coin, bord, bandeau, barre, onglets.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#g${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="g1" n="00" title="Aujourd'hui, pour comparer" desc="Les pastilles teintées sont dans une rangée sous le nom et le set : elles allongent la vignette et sont loin de la carte qu'elles qualifient."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-old"><img className="im" src={c.img} alt="" /><div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div><div style={{ marginTop: 6 }}><CardTags rc={c.rc} auto={c.auto} patch={c.patch} num={c.num} size="sm" /></div></div></div>)}
      </Row></Bay>

      <Bay id="g2" n="01" title="Ruban en coin : les vraies pastilles empilées sur l'image (idée 03)" desc="Les pastilles quittent le texte et se posent en ruban sur le coin haut gauche de l'image, empilées, avec une petite ombre portée. Le tirage reste en pastille or / argent / bronze selon la rareté. Sous l'image il ne reste que le nom, le set et les icônes commentaire / cœur."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-a"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib"><Pills c={c} h={22} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g3" n="02" title="Drapeaux collés au bord gauche de l'image" desc="Comme le ruban, mais les pastilles ont des coins carrés et dépassent à gauche du cadre, comme des drapeaux accrochés au bord de la carte : elles sont plus grandes (24 px) donc plus lisibles, et ne masquent qu'une fine bande de l'image."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-b"><div className="ph"><img className="im" src={c.img} alt="" /><div className="flags"><Pills c={c} h={24} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g4" n="03" title="Bandeau sombre en bas de l'image avec les pastilles en ligne" desc="Un dégradé sombre au bas de l'image porte les pastilles sur une ligne, alignées à gauche. Rien ne dépasse, tout reste dans l'image, la ligne s'adapte à la largeur de la vignette (sur mobile les pastilles se resserrent)."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-c"><div className="ph"><img className="im" src={c.img} alt="" /><div className="ban"><Pills c={c} h={21} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g5" n="04" title="Barre segmentée collée sous l'image" desc="Une barre pleine largeur entre l'image et la barre de couleur d'équipe, découpée en segments égaux : un segment par atout (RC, AUTO, # tirage, PATCH), chacun teinté à sa couleur avec son filet épais en haut. Le tirage rare devient un segment doré ou argenté. Très net et aligné, quelle que soit la quantité de pastilles."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-d"><div className="ph"><img className="im" src={c.img} alt="" /></div><div className="seg">{kinds(c).map(k => <span key={k} style={segStyle(c, k)}>{label(k, c)}</span>)}</div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g6" n="05" title="Bandeau plein au-dessus de l'image" desc="Un bandeau d'une ligne tout en haut de la vignette, au-dessus de l'image, divisé en parts égales : RC orange, AUTO vert, PATCH bleu, tirage violet ou doré (couleurs pleines, texte blanc). Il sert d'étiquette de classe de carte, comme un titre d'encadré. Les cartes sans atout n'ont pas de bandeau."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-e">{kinds(c).length > 0 ? <div className="top">{kinds(c).map(k => { const s = topBg(c, k); return <span key={k} className={s.rare ? 'rare' : ''} style={{ ['--b' as string]: s['--b' as string], ['--t' as string]: s['--t' as string] }}>{label(k, c)}</span> })}</div> : <div style={{ height: 7 }} />}<div className="ph"><img className="im" src={c.img} alt="" /></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g7" n="06" title="Atouts en ruban, tirage en gros cartouche Surfquest" desc="Deux rôles : les atouts (RC, AUTO, PATCH) en ruban de pastilles en haut à gauche, et la numérotation dans un gros cartouche Surfquest en bas à droite de l'image, aux couleurs de la rareté (or pour 1/1, argent, bronze, bleu sinon). Le tirage, qui fait la valeur de la carte, saute aux yeux."><Row>
        {PCS.map(c => { const [cc, cg] = tierCol(c); return <div key={c.n} className="pg pg-f"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib"><Pills c={c} h={22} skip="num" /></div>{c.num && <div className="cart" style={{ ['--cc' as string]: cc, ['--cg' as string]: cg }}>{numShort(c.num)}</div>}</div><Body c={c} /></div> })}
      </Row></Bay>

      <Bay id="g8" n="07" title="Pastilles en onglets à cheval sur le bord du cadre" desc="Les pastilles sont posées à cheval sur le bord supérieur du cadre, à gauche, comme des onglets de classeur : l'image reste entière, et les atouts se lisent tout de suite au-dessus de chaque vignette. Une marge de quelques pixels en plus entre les lignes de la grille suffit."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-g"><div className="tabs"><Pills c={c} h={22} /></div><div className="ph"><img className="im" src={c.img} alt="" /></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g9" n="08" title="Pile de pastilles en bas à droite, qui déborde du cadre" desc="Les pastilles s'empilent en bas à droite de l'image et dépassent légèrement à droite, ombre portée dessous. Laisse le haut de la carte (souvent le nom du joueur imprimé) parfaitement visible, ce que ne permettent pas les rubans en haut à gauche."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-h"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rr"><Pills c={c} h={22} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g10" n="09" title="Téléphone : deux colonnes, ruban en coin et barre segmentée" desc="Sur mobile, les pastilles dans l'image évitent d'allonger la vignette. À gauche : le ruban en coin (idée 01) avec des pastilles de 19 px ; à droite : la barre segmentée (idée 04) qui s'étire à la largeur de la vignette. Dans les deux cas le nom reste lisible sur deux lignes."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="pg-ph"><Row>{PCS.map(c => <div key={c.n} className="pg pg-a"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib"><Pills c={c} h={19} /></div></div><div className="bar" style={{ ['--tc' as string]: c.tc }} /><div className="tx"><div className="nm"><span className="t" style={{ whiteSpace: 'normal' }}>{c.n.split(' ')[1]}</span><Ic /></div><div className="st">{c.s}</div></div></div>)}</Row></div>
        <div className="pg-ph"><Row>{PCS.map(c => <div key={c.n} className="pg pg-d"><div className="ph"><img className="im" src={c.img} alt="" /></div><div className="seg">{kinds(c).map(k => <span key={k} style={{ ...segStyle(c, k), fontSize: 9, padding: '5px 1px 4px' }}>{label(k, c)}</span>)}</div><div className="bar" style={{ ['--tc' as string]: c.tc }} /><div className="tx"><div className="nm"><span className="t">{c.n.split(' ')[1]}</span><Ic /></div><div className="st">{c.s}</div></div></div>)}</Row></div>
      </div></Bay>
    </div>
  )
}
