'use client'
import { useState } from 'react'
import Link from 'next/link'
import TagGlyph, { cardTier } from '@/components/TagGlyph'
import CardTags, { TagPill } from '@/components/CardTags'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 34 : pastilles RC / AUTO / PATCH / NUM sur les vignettes.

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

/* serie 34 : pastilles RC / AUTO / PATCH / NUM sur les vignettes (prefixe pg-) */
.ix .pg-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; max-width: 900px; } .ix .pg-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 680px; }
.ix .pg { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; } .ix .pg .ph { position: relative; } .ix .pg img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .pg .bar { height: 4px; margin: 8px -7px 0; background: var(--tc, #2f8bff); }
.ix .pg .tx { padding: 8px 2px 9px; } .ix .pg .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .pg .nm .t { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .pg .vr { font: italic 600 11px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .pg .st { font: 500 11px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 2px; }
.ix .pg .lg { width: 17px; height: 17px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
.ix .pg .ic { display: inline-flex; gap: 8px; font-size: 14px; flex-shrink: 0; }
.ix .pg-old { padding: 8px; border: 2px solid #1a5fd0; border-radius: 10px; background: #0d1530; } .ix .pg-old .tx { padding: 8px 0 4px; } .ix .pg-old .nm { font: 800 13px system-ui; }
/* A ruban en coin */
.ix .pg-a .rib { position: absolute; top: 8px; left: -5px; display: grid; gap: 4px; justify-items: start; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.45)); }
/* B colonne de glyphes */
.ix .pg-b .spine { position: absolute; left: 0; top: 0; bottom: 0; width: 32px; background: linear-gradient(90deg, rgba(5,9,18,.88), rgba(5,9,18,.6)); border-right: 1px solid rgba(255,255,255,.2); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 12px; padding-top: 12px; }
/* C bandeau bas */
.ix .pg-c .ban { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 10px; padding: 26px 8px 8px; background: linear-gradient(0deg, rgba(5,9,18,.95), rgba(5,9,18,.7) 55%, transparent); }
/* D glyphes + cartouche */
.ix .pg-d .cl { position: absolute; top: 6px; left: 6px; display: flex; gap: 6px; align-items: center; padding: 5px 8px; background: rgba(5,9,18,.82); border: 1px solid rgba(255,255,255,.55); } .ix .pg-d .cart { position: absolute; right: 6px; bottom: 6px; font: 400 22px/1 'Surfquest', Impact, sans-serif; padding: 3px 9px 2px; background: rgba(5,9,18,.9); border: 2px solid var(--cc); color: var(--cc) !important; box-shadow: 0 0 14px var(--cg); }
/* E onglets */
.ix .pg-e { margin-top: 12px; } .ix .pg-e .tabs { position: absolute; top: -12px; left: 10px; display: flex; gap: 4px; z-index: 2; }
/* F icones a cote du nom */
.ix .pg-f .nm { align-items: flex-start; } .ix .pg-f .gl { display: inline-flex; gap: 4px; align-items: center; flex-shrink: 0; margin-left: auto; padding-top: 1px; }
/* G sceau */
.ix .pg-g .seal { position: absolute; top: 6px; right: 6px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; background: rgba(5,9,18,.82); border: 2px solid var(--sc); box-shadow: 0 0 14px var(--sg); } .ix .pg-g .seal small { position: absolute; bottom: -8px; right: -8px; background: #fff; color: #06122e !important; font: 800 10px system-ui; padding: 1px 5px; }
/* mobile */
.ix .pg-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .pg-ph .pg-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .ix .pg-ph .pg .nm { font-size: 15px; } .ix .pg-ph .pg .st { font-size: 9px; }
@media (max-width: 800px) { .ix .pg-row, .ix .pg-row.three { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type PC = { n: string; v?: string; s: string; img: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tm: string; tc: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, rc: true, tm: 'PHI', tc: '#2f8bff' },
  { n: 'Tyrese Maxey', s: '1995-96 SkyBox Rookie', img: C.maxey.img, auto: true, patch: true, num: '/25', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Offensive Rebound LDR', s: '1989-90 Fleer', img: C.hawkins.img, patch: true, num: '/99', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Anthony Edwards', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', tm: 'MIN', tc: '#4aa3df' },
]
const kinds = (c: PC) => ([c.rc && 'rc', c.auto && 'auto', c.patch && 'patch', c.num && 'num'].filter(Boolean) as ('rc' | 'auto' | 'patch' | 'num')[])
const Pills = ({ c, h = 20 }: { c: PC; h?: number }) => <>{kinds(c).map(k => <TagPill key={k} kind={k} num={c.num} h={h} />)}</>
const Glyphs = ({ c, h = 20 }: { c: PC; h?: number }) => { const t = cardTier(c); return <>{kinds(c).map(k => <TagGlyph key={k} kind={k} h={h} tier={k === 'num' || t !== 'base' ? t : 'base'} num={c.num} />)}</> }
const Lg = ({ t }: { t: string }) => <img className="lg" src={`/team-logos/nba-${t}.png`} alt="" />
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>
const Body = ({ c, extra, after }: { c: PC; extra?: React.ReactNode; after?: React.ReactNode }) => (
  <><div className="bar" style={{ ['--tc' as string]: c.tc }} /><div className="tx"><div className="nm"><Lg t={c.tm} /><span className="t">{c.n}</span>{extra ?? <Ic />}</div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div>{after}</div></>
)
const tierStyle = (c: PC) => { const t = cardTier(c); return t === 'gold' ? ['#ffd54a', 'rgba(255,215,0,.5)'] : t === 'silver' ? ['#dfe6f2', 'rgba(220,230,245,.4)'] : t === 'bronze' ? ['#e0925a', 'rgba(224,146,90,.4)'] : t === 'blue' ? ['#6c97ff', 'rgba(47,107,255,.4)'] : ['#fff', 'transparent'] }
const Row = ({ children }: { children: React.ReactNode }) => <div className="pg-row">{children}</div>

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Ruban en coin', 'Colonne de glyphes', 'Bandeau bas', 'Glyphes + cartouche', 'Onglets sur le cadre', 'À côté du nom', 'Sceau', 'Mobile']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 34 · Pastilles sur les vignettes</h1>
      <p className="lead">On garde les vignettes de la série 33 (barre de couleur d&apos;équipe, nom en Surfquest) et on cherche comment mieux placer les pastilles RC / AUTO / PATCH / NUM. Les maquettes utilisent les vrais composants du site : les pastilles teintées (avec effet or / argent / bronze sur les tirages bas) et les icônes vectorielles (qui prennent la teinte de la rareté de la carte). Dans l&apos;esprit des rubans de l&apos;idée 03.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#g${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="g1" n="00" title="Aujourd'hui, pour comparer" desc="Les pastilles teintées sont dans une rangée sous le nom et le set. Elles fonctionnent, mais elles s'ajoutent au texte (la vignette devient plus haute) et elles sont éloignées de la carte qu'elles qualifient."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-old"><img className="im" src={c.img} alt="" /><div className="tx"><div className="nm"><span className="t">{c.n}</span><Ic /></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div><div style={{ marginTop: 6 }}><CardTags rc={c.rc} auto={c.auto} patch={c.patch} num={c.num} size="sm" /></div></div></div>)}
      </Row></Bay>

      <Bay id="g2" n="01" title="Ruban en coin avec les vraies pastilles (idée 03)" desc="Les pastilles teintées quittent le texte et se posent en ruban sur le coin haut gauche de l'image, empilées avec une petite ombre (le tirage reste en pastille or / argent / bronze). Sous l'image il ne reste que le nom, le set et les icônes : la vignette est plus basse et les pastilles sont lues avec la carte."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-a"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib"><Pills c={c} h={20} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g3" n="02" title="Colonne d'icônes sur le bord gauche de l'image" desc="Une fine colonne translucide le long du bord gauche de l'image avec les icônes vectorielles empilées (RC, AUTO, PATCH, tirage). Les icônes prennent la teinte de la rareté de la carte (bleu, bronze, argent, or) ; elles ne masquent presque rien de l'image et restent lisibles grâce au fond sombre."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-b"><div className="ph"><img className="im" src={c.img} alt="" /><div className="spine"><Glyphs c={c} h={22} /></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g4" n="03" title="Bandeau sombre en bas de l'image : icônes à gauche, tirage à droite" desc="Un dégradé sombre au bas de l'image porte une ligne d'icônes (RC, AUTO, PATCH) alignées à gauche et le tirage en pastille à droite. Tout reste dans l'image, l'œil lit la carte puis ses atouts d'un seul regard, et le texte dessous ne change pas de hauteur."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-c"><div className="ph"><img className="im" src={c.img} alt="" /><div className="ban"><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{kinds(c).filter(k => k !== 'num').map(k => <TagGlyph key={k} kind={k} h={20} tier={cardTier(c)} />)}</span><span style={{ marginLeft: 'auto' }}>{c.num && <TagPill kind="num" num={c.num} h={20} />}</span></div></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g5" n="04" title="Atouts en haut à gauche, tirage en cartouche Surfquest en bas à droite" desc="Deux rôles distincts : les atouts (RC, AUTO, PATCH) en petites icônes dans une plaque sombre à filet en haut à gauche, et la numérotation en gros cartouche Surfquest en bas à droite, coloré selon la rareté (or pour 1/1, argent, bronze, bleu). Le tirage, ce qui fait la valeur d'une carte, devient très lisible."><Row>
        {PCS.map(c => { const [cc, cg] = tierStyle(c); return <div key={c.n} className="pg pg-d"><div className="ph"><img className="im" src={c.img} alt="" />{(c.rc || c.auto || c.patch) && <div className="cl">{kinds(c).filter(k => k !== 'num').map(k => <TagGlyph key={k} kind={k} h={18} tier={cardTier(c)} />)}</div>}{c.num && <div className="cart" style={{ ['--cc' as string]: cc, ['--cg' as string]: cg }}>{c.num}</div>}</div><Body c={c} /></div> })}
      </Row></Bay>

      <Bay id="g6" n="05" title="Pastilles en onglets qui dépassent du cadre" desc="Les pastilles teintées sont posées à cheval sur le bord supérieur du cadre, comme les onglets d'un classeur, à gauche. La carte garde son image intacte ; les atouts sont tout de suite visibles au-dessus de chaque vignette. Un peu de marge supplémentaire entre les lignes de la grille suffit."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-e"><div className="tabs"><Pills c={c} h={20} /></div><div className="ph"><img className="im" src={c.img} alt="" /></div><Body c={c} /></div>)}
      </Row></Bay>

      <Bay id="g7" n="06" title="Icônes sur la ligne du nom, à droite" desc="Plus de rangée de pastilles : les icônes vectorielles (16 px) se rangent à droite du nom, avant les icônes commentaire et cœur ; elles prennent la teinte de rareté. Le texte devient plus compact. Moins visible que les rubans, mais très propre et sans rien sur l'image."><Row>
        {PCS.map(c => <div key={c.n} className="pg pg-f"><div className="ph"><img className="im" src={c.img} alt="" /></div><Body c={c} extra={<><span className="gl"><Glyphs c={c} h={16} /></span></>} /></div>)}
      </Row></Bay>

      <Bay id="g8" n="07" title="Un sceau : l'emblème de la meilleure rareté, avec « +2 »" desc="Un seul médaillon carré en haut à droite de l'image montre le critère le plus précieux de la carte (le tirage s'il y en a un, sinon auto, patch ou RC), avec un halo à la couleur de rareté, et un petit « +2 » s'il y en a d'autres. Très épuré ; le détail complet reste dans la fiche de la carte."><Row>
        {PCS.map(c => { const [sc, sg] = tierStyle(c); const ks = kinds(c); const top = ks.includes('num') ? 'num' : ks.includes('auto') ? 'auto' : ks.includes('patch') ? 'patch' : 'rc'; return <div key={c.n} className="pg pg-g"><div className="ph"><img className="im" src={c.img} alt="" /><div className="seal" style={{ ['--sc' as string]: sc, ['--sg' as string]: sg }}><TagGlyph kind={top} h={26} tier={cardTier(c)} num={c.num} />{ks.length > 1 && <small>+{ks.length - 1}</small>}</div></div><Body c={c} /></div> })}
      </Row></Bay>

      <Bay id="g9" n="08" title="Téléphone : 2 colonnes, ruban en coin et colonne d'icônes" desc="Sur mobile les pastilles sur l'image évitent d'allonger la vignette. À gauche : le ruban en coin (idée 01) en hauteur 17 px ; à droite : la colonne d'icônes (idée 02). Dans les deux cas le nom reste sur deux lignes lisibles."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="pg-ph"><Row>{PCS.map(c => <div key={c.n} className="pg pg-a"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib"><Pills c={c} h={17} /></div></div><div className="bar" style={{ ['--tc' as string]: c.tc }} /><div className="tx"><div className="nm"><Lg t={c.tm} /><span className="t" style={{ whiteSpace: 'normal' }}>{c.n.split(' ')[1]}</span><Ic /></div><div className="st">{c.s}</div></div></div>)}</Row></div>
        <div className="pg-ph"><Row>{PCS.map(c => <div key={c.n} className="pg pg-b"><div className="ph"><img className="im" src={c.img} alt="" /><div className="spine" style={{ width: 26, gap: 9 }}><Glyphs c={c} h={18} /></div></div><div className="bar" style={{ ['--tc' as string]: c.tc }} /><div className="tx"><div className="nm"><Lg t={c.tm} /><span className="t">{c.n.split(' ')[1]}</span><Ic /></div><div className="st">{c.s}</div></div></div>)}</Row></div>
      </div></Bay>
    </div>
  )
}
