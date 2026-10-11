'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 33 : vignettes de cartes de la galerie.

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

/* serie 33 : vignettes de cartes de la galerie (prefixe vg-) */
.ix .vg-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; max-width: 900px; } .ix .vg-row.three { grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 680px; }
.ix .vg { position: relative; min-width: 0; } .ix .vg img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .vg-nm { font-weight: 800; font-size: 14px; line-height: 1.15; } .ix .vg-var { font: italic 600 11px system-ui; color: #5aa9ff !important; } .ix .vg-sub { font: 500 11px system-ui; color: rgba(255,255,255,.62) !important; }
.ix .vg-ic { display: inline-flex; gap: 8px; font-size: 14px; align-items: center; } .ix .vg-ic i { font-style: normal; opacity: .85; }
.ix .vg-tg { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.ix .vg-t { font: 800 9px system-ui; letter-spacing: .1em; padding: 3px 7px; text-transform: uppercase; color: #fff !important; } .ix .vg-t.rc { background: #e67e22; } .ix .vg-t.au { background: #2e7d32; } .ix .vg-t.pa { background: #1976d2; } .ix .vg-t.nu { background: #7b1fa2; }
.ix .vg-t.silver { background: linear-gradient(135deg,#9aa3b2,#e8edf5,#9aa3b2); color: #1a2030 !important; } .ix .vg-t.gold { background: linear-gradient(135deg,#b8860b,#ffd700,#fff3a0,#ffd700); color: #3d2800 !important; }
/* 0 actuel */
.ix .vg-old { background: #0d1530; border: 2px solid #1a5fd0; border-radius: 10px; padding: 8px; } .ix .vg-old img.im { border-radius: 2px; } .ix .vg-old .tt { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; } .ix .vg-old .vg-nm { font-size: 13px; }
/* 1 cadre filet */
.ix .vg-a { border: 3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4px rgba(255,255,255,.7); padding: 9px; background: linear-gradient(180deg,#0b1745,#08102b); } .ix .vg-a .tt { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-top: 9px; } .ix .vg-a .vg-nm { font-size: 21px; font-weight: 400; line-height: .95; font-family: 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .vg-a .vg-tg { margin-top: 6px; }
/* 2 plaque */
.ix .vg-b { border: 1px solid rgba(140,170,255,.35); background: #0a1330; } .ix .vg-b .ph { padding: 8px; } .ix .vg-b .pl { padding: 8px 10px 9px; border-top: 3px solid #fff; background: linear-gradient(180deg,#112060,#0c1844); display: grid; gap: 3px; } .ix .vg-b .vg-nm { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 20px; line-height: .95; text-transform: uppercase; } .ix .vg-b .r { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
/* 3 rubans */
.ix .vg-c { background: #0a1330; border: 1px solid rgba(140,170,255,.3); padding: 7px; } .ix .vg-c .ph { position: relative; } .ix .vg-c .rib { position: absolute; top: 8px; left: -4px; display: grid; gap: 3px; } .ix .vg-c .rib .vg-t { box-shadow: 2px 2px 0 rgba(0,0,0,.4); font-size: 10px; padding: 4px 9px; } .ix .vg-c .nb { position: absolute; right: 6px; bottom: 6px; font: 400 18px 'Surfquest', Impact, sans-serif; padding: 2px 8px; background: rgba(5,9,18,.85); color: #fff !important; border: 1px solid rgba(255,255,255,.7); } .ix .vg-c .nb.gold { color: #ffd54a !important; border-color: #ffd54a; } .ix .vg-c .tt { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; gap: 6px; } .ix .vg-c .vg-nm { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 18px; line-height: 1; text-transform: uppercase; }
/* 4 equipe */
.ix .vg-d { background: #0a1330; border: 1px solid rgba(255,255,255,.2); padding: 7px 7px 0; position: relative; } .ix .vg-d .bar { height: 6px; margin: 8px -7px 0; background: var(--tc); } .ix .vg-d .in { display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 8px 2px 9px; } .ix .vg-d .nmw { display: flex; align-items: center; gap: 6px; min-width: 0; } .ix .vg-d .lg { width: 18px; height: 18px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; } .ix .vg-d .vg-nm { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 19px; line-height: 1; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 5 survol */
.ix .vg-e { position: relative; border: 2px solid rgba(255,255,255,.85); overflow: hidden; background: #050912; } .ix .vg-e .ov { position: absolute; left: 0; right: 0; bottom: 0; padding: 38px 10px 10px; background: linear-gradient(0deg, rgba(5,9,18,.96) 0%, rgba(5,9,18,.85) 55%, transparent); } .ix .vg-e .vg-nm { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 22px; line-height: .95; text-transform: uppercase; } .ix .vg-e .extra { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; } .ix .vg-e.rest .extra, .ix .vg-e.rest .vg-sub, .ix .vg-e.rest .vg-var { display: none; } .ix .vg-e.rest .ov { padding-top: 28px; }
/* 6 rarete */
.ix .vg-f { padding: 5px; background: var(--fr); box-shadow: 0 0 22px var(--fg); } .ix .vg-f .core { background: #0a1330; padding: 7px; } .ix .vg-f .tt { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; } .ix .vg-f .vg-nm { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; font-size: 18px; line-height: 1; text-transform: uppercase; } .ix .vg-f .nmb { font: 400 17px 'Surfquest', Impact, sans-serif; margin-top: 4px; color: var(--ft) !important; }
/* mobile */
.ix .vg-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .vg-ph .vg-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; } .ix .vg-ph .vg-a { padding: 6px; border-width: 2px; box-shadow: inset 0 0 0 2px #08153b, inset 0 0 0 3px rgba(255,255,255,.7); } .ix .vg-ph .vg-a .vg-nm { font-size: 16px; } .ix .vg-ph .vg-a .vg-ic { font-size: 12px; gap: 5px; } .ix .vg-ph .vg-d .vg-nm { font-size: 15px; } .ix .vg-ph .vg-d .lg { width: 13px; height: 13px; } .ix .vg-ph .vg-c .vg-nm { font-size: 15px; } .ix .vg-ph .vg-sub { font-size: 9px; } .ix .vg-ph .vg-t { font-size: 8px; padding: 2px 5px; }
@media (max-width: 800px) { .ix .vg-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } .ix .vg-row.three { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type VC = { n: string; v?: string; s: string; img: string; tags: ('rc' | 'au' | 'pa')[]; num?: string; tier?: 'gold' | 'silver'; tm?: string; tc?: string }
const VCS: VC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', img: C.mccain.img, tags: ['rc'], tm: 'PHI', tc: '#2f8bff' },
  { n: 'Tyrese Maxey', s: '1995-96 SkyBox Rookie', img: C.maxey.img, tags: ['au', 'pa'], num: '/25', tier: 'silver', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Offensive Rebound LDR', s: '1989-90 Fleer', img: C.hawkins.img, tags: [], tm: 'PHI', tc: '#2f8bff' },
  { n: 'Anthony Edwards', s: '2023-24 Panini Prizm', img: C.edwards.img, tags: ['rc', 'au'], num: '1/1', tier: 'gold', tm: 'MIN', tc: '#4aa3df' },
]
const Tg = ({ c }: { c: VC }) => (
  <span className="vg-tg">{c.tags.map(t => <span key={t} className={`vg-t ${t}`}>{t === 'rc' ? 'RC' : t === 'au' ? 'Auto' : 'Patch'}</span>)}{c.num && <span className={`vg-t ${c.tier || 'nu'}`}>{c.num}</span>}</span>
)
const Ic = () => <span className="vg-ic"><i>💬</i><i>🤍</i></span>
const Row = ({ children, three }: { children: React.ReactNode; three?: boolean }) => <div className={`vg-row${three ? ' three' : ''}`}>{children}</div>

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Cadre à filet', 'Plaque', 'Rubans sur l’image', 'Couleur d’équipe', 'Infos au survol', 'Rareté', 'Mobile 2 colonnes']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 33 · Vignettes de la galerie</h1>
      <p className="lead">On garde le principe actuel : l&apos;image de la carte dans un cadre, son nom, la variation en bleu, l&apos;année / marque / set, les étiquettes (RC, AUTO, PATCH, numérotation) et les icônes commentaire et cœur. Les idées changent le cadre, la typographie (nom en Surfquest) et la place des étiquettes pour que ce soit beau et très lisible, y compris en 2 colonnes sur téléphone.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#v${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="v1" n="00" title="Aujourd'hui, pour comparer" desc="Cadre bleu à coins arrondis, nom en gras, icônes à droite, variation en italique bleu, étiquettes sous le texte. Lisible mais le texte est petit et le cadre ne suit pas la DA."><Row>
        {VCS.map(c => <div key={c.n} className="vg vg-old"><img className="im" src={c.img} alt="" /><div className="tt"><span className="vg-nm">{c.n}</span><Ic /></div>{c.v && <div className="vg-var">{c.v}</div>}<div className="vg-sub">{c.s}</div><div style={{ marginTop: 5 }}><Tg c={c} /></div></div>)}
      </Row></Bay>

      <Bay id="v2" n="01" title="Cadre à double filet, nom en Surfquest" desc="Le cadre bleu devient un cadre à double filet blanc (comme les titres du site), fond bleu nuit dégradé. Le nom passe en Surfquest 21 px (beaucoup plus lisible de loin), la variation et l'année / set restent en petit dessous, les étiquettes en carrés pleins. Angles droits partout."><Row>
        {VCS.map(c => <div key={c.n} className="vg vg-a"><img className="im" src={c.img} alt="" /><div className="tt"><span className="vg-nm">{c.n}</span><Ic /></div>{c.v && <div className="vg-var" style={{ marginTop: 4 }}>{c.v}</div>}<div className="vg-sub">{c.s}</div><div className="vg-tg-w"><Tg c={c} /></div></div>)}
      </Row></Bay>

      <Bay id="v3" n="02" title="Plaque d'information sous l'image, comme un cartel" desc="L'image est dans un cadre fin, puis une plaque bleu électrique sombre avec un trait blanc épais en haut regroupe tout : nom en Surfquest, variation, année / set à gauche, étiquettes et icônes sur la dernière ligne. Les infos sont bien séparées de l'image et lisibles même sur une carte très colorée."><Row>
        {VCS.map(c => <div key={c.n} className="vg vg-b"><div className="ph"><img className="im" src={c.img} alt="" /></div><div className="pl"><span className="vg-nm">{c.n}</span>{c.v && <span className="vg-var">{c.v}</span>}<span className="vg-sub">{c.s}</span><div className="r"><Tg c={c} /><Ic /></div></div></div>)}
      </Row></Bay>

      <Bay id="v4" n="03" title="Étiquettes en rubans sur l'image, numérotation dans le coin" desc="Les étiquettes (RC, AUTO, PATCH) quittent le texte pour devenir des rubans posés en haut à gauche de la carte, avec une petite ombre ; la numérotation (/25, 1/1) est dans un cartouche en bas à droite de l'image (doré pour les très rares). Sous l'image il ne reste que le nom en Surfquest, l'année / set et les icônes : le texte respire."><Row>
        {VCS.map(c => <div key={c.n} className="vg vg-c"><div className="ph"><img className="im" src={c.img} alt="" /><div className="rib">{c.tags.map(t => <span key={t} className={`vg-t ${t}`}>{t === 'rc' ? 'RC' : t === 'au' ? 'Auto' : 'Patch'}</span>)}</div>{c.num && <span className={`nb${c.tier === 'gold' ? ' gold' : ''}`}>{c.num}</span>}</div><div className="tt"><span className="vg-nm">{c.n}</span><Ic /></div>{c.v && <div className="vg-var" style={{ marginTop: 3 }}>{c.v}</div>}<div className="vg-sub">{c.s}</div></div>)}
      </Row></Bay>

      <Bay id="v5" n="04" title="Barre de la couleur de l'équipe + petit logo" desc="Sous l'image, une barre épaisse (6 px) dans la couleur de l'équipe de la carte, puis le logo de l'équipe (18 px) devant le nom en Surfquest. Même logique que le visualiseur et l'annuaire : on repère les équipes d'un coup d'œil dans une grille de 200 cartes."><Row>
        {VCS.map(c => <div key={c.n} className="vg vg-d" style={{ ['--tc' as string]: c.tc }}><img className="im" src={c.img} alt="" /><div className="bar" /><div className="in"><div style={{ minWidth: 0 }}><div className="nmw"><img className="lg" src={`/team-logos/nba-${c.tm}.png`} alt="" /><span className="vg-nm">{c.n}</span></div><div className="vg-sub" style={{ marginTop: 3 }}>{c.s}</div><div style={{ marginTop: 5 }}><Tg c={c} /></div></div><Ic /></div></div>)}
      </Row></Bay>

      <Bay id="v6" n="05" title="Image d'abord : nom au repos, tous les détails au survol" desc="Au repos, on ne voit que la carte avec son nom en Surfquest sur un dégradé sombre en bas (très propre). Au survol (ordinateur), le bandeau grandit : variation, année / set, étiquettes et icônes apparaissent. Sur téléphone, c'est l'état « détails » qui reste affiché. Haut à gauche : repos, haut à droite : survol."><div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[VCS[0], VCS[1]].map(c => <div key={c.n} className="vg vg-e rest" style={{ width: 200 }}><img className="im" src={c.img} alt="" /><div className="ov"><div className="vg-nm">{c.n}</div></div></div>)}
        {[VCS[0], VCS[1]].map(c => <div key={c.n + 'h'} className="vg vg-e" style={{ width: 200 }}><img className="im" src={c.img} alt="" /><div className="ov"><div className="vg-nm">{c.n}</div>{c.v && <div className="vg-var">{c.v}</div>}<div className="vg-sub">{c.s}</div><div className="extra"><Tg c={c} /><Ic /></div></div></div>)}
      </div></Bay>

      <Bay id="v7" n="06" title="La rareté se voit sur le cadre : or, argent, standard" desc="Le cadre prend la couleur du tirage : doré lumineux pour un 1/1 ou SSP, argent pour les tirages jusqu'à /10 et SP, filet blanc pour le reste (mêmes seuils que la pastille NUM du site). Les plus belles pièces ressortent dans la grille sans surcharger les autres. Le nom reste en Surfquest et la numérotation s'affiche en gros sous le nom."><Row three>
        {[VCS[3], VCS[1], VCS[0]].map((c, i) => { const rs = [['linear-gradient(145deg,#b8860b,#ffe27a,#b8860b)', 'rgba(255,215,0,.45)', '#ffd54a'], ['linear-gradient(145deg,#8f98a8,#f2f5fa,#8f98a8)', 'rgba(220,230,245,.35)', '#dfe6f2'], ['rgba(255,255,255,.55)', 'transparent', '#fff']][i]; return <div key={c.n} className="vg vg-f" style={{ ['--fr' as string]: rs[0], ['--fg' as string]: rs[1], ['--ft' as string]: rs[2] }}><div className="core"><img className="im" src={c.img} alt="" /><div className="tt"><span className="vg-nm">{c.n}</span><Ic /></div>{c.num && <div className="nmb">{c.num}</div>}<div className="vg-sub">{c.s}</div><div style={{ marginTop: 5 }}><Tg c={c} /></div></div></div> })}
      </Row></Bay>

      <Bay id="v8" n="07" title="Téléphone : 2 colonnes lisibles (cadre à filet, nom Surfquest 16 px)" desc="Sur mobile, deux vignettes par ligne : cadre à double filet fin, nom en Surfquest 16 px sur une ligne, année / set en 9 px, étiquettes réduites, icônes plus petites mais assez grandes pour être touchées. Même base que 01, plus la barre d'équipe de l'idée 04 en variante (colonne de droite)."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div className="vg-ph"><Row>{VCS.slice(0, 4).map(c => <div key={c.n} className="vg vg-a"><img className="im" src={c.img} alt="" /><div className="tt"><span className="vg-nm">{c.n.split(' ')[1]}</span><Ic /></div><div className="vg-sub">{c.s}</div><div style={{ marginTop: 4 }}><Tg c={c} /></div></div>)}</Row></div>
        <div className="vg-ph"><Row>{VCS.slice(0, 4).map(c => <div key={c.n} className="vg vg-d" style={{ ['--tc' as string]: c.tc }}><img className="im" src={c.img} alt="" /><div className="bar" style={{ height: 4 }} /><div className="in" style={{ padding: '6px 1px 7px' }}><div style={{ minWidth: 0 }}><div className="nmw"><img className="lg" src={`/team-logos/nba-${c.tm}.png`} alt="" /><span className="vg-nm">{c.n.split(' ')[1]}</span></div><div className="vg-sub" style={{ marginTop: 2 }}>{c.s}</div></div><Ic /></div></div>)}</Row></div>
      </div></Bay>
    </div>
  )
}
