'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 27 : les 3 podiums de l'accueil (jour, semaine, mois).

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

/* serie 27 : podiums de l'accueil (prefixe pd-) */
.ix .pd-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; } .ix .pd-col { min-width: 0; }
.ix .pd-h { margin: 0 0 2px; } .ix .pd-sub { font: 700 11px system-ui; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-bottom: 10px; }
.ix .pd-r { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,.14); position: relative; }
.ix .pd-r:hover { background: rgba(255,255,255,.07); }
.ix .pd-rk { text-align: center; font-size: 20px; line-height: 1; color: rgba(255,255,255,.4); }
.ix .pd-rk.g { color: #ffd54a; } .ix .pd-rk.s { color: #c9d1e0; } .ix .pd-rk.b { color: #e0925a; }
.ix .pd-who { display: flex; align-items: center; gap: 9px; min-width: 0; } .ix .pd-who .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ix .pd-av { border-radius: 50%; object-fit: cover; object-position: 50% 18%; flex-shrink: 0; display: block; } .ix .pd-ini { border-radius: 50%; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ix .pd-v { font-size: 20px; line-height: 1; color: #ffd54a; text-align: right; }
.ix .pd-old { background: #0d0d0d; border-radius: 12px; padding: 8px; } .ix .pd-old .pd-r { grid-template-columns: 26px 1fr auto; border: 0; padding: 6px; font: 600 13px system-ui; } .ix .pd-old .pd-r.t1 { background: rgba(255,170,0,.14); border: 1px solid rgba(255,170,0,.5); border-radius: 8px; } .ix .pd-old .v { color: #ffa733; font: 800 12px system-ui; }
.ix .pd-box { border: 3px solid #fff; padding: 14px; } .ix .pd-in { border: 1px solid rgba(255,255,255,.28); }
/* 02 numero 1 geant */
.ix .pd-hero { border: 3px solid #ffd54a; background: linear-gradient(135deg, rgba(255,213,74,.14), transparent 70%); padding: 14px; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; position: relative; } .ix .pd-hero .k { position: absolute; top: -3px; left: -3px; background: #ffd54a; color: #06122e; font-size: 16px; padding: 3px 10px 2px; }
.ix .pd-hero .n { font-size: 34px; line-height: .95; } .ix .pd-hero .v { margin-left: auto; font-size: 54px; line-height: .9; color: #ffd54a; } .ix .pd-hero small { display: block; font: 700 9px system-ui; letter-spacing: .14em; color: rgba(255,255,255,.55); text-transform: uppercase; margin-top: 4px; }
/* 03 marches */
.ix .pd-steps { display: grid; grid-template-columns: 1fr 1.15fr 1fr; align-items: end; gap: 6px; margin-bottom: 8px; } .ix .pd-st { border: 2px solid rgba(255,255,255,.85); text-align: center; padding: 10px 4px 8px; } .ix .pd-st.s1 { border-color: #ffd54a; background: rgba(255,213,74,.1); padding-top: 18px; } .ix .pd-st .nm { font-size: 17px; line-height: 1; margin: 6px 0 4px; word-break: break-word; } .ix .pd-st .vv { font-size: 24px; line-height: 1; color: #ffd54a; } .ix .pd-st .rr { font-size: 15px; color: rgba(255,255,255,.6); } .ix .pd-st.s1 .nm { font-size: 20px; }
/* 04 onglets */
.ix .pd-seg { display: inline-flex; border: 2px solid #fff; margin-bottom: 12px; } .ix .pd-seg span { padding: 0 16px; height: 36px; display: inline-flex; align-items: center; font: 800 12px system-ui; letter-spacing: .1em; text-transform: uppercase; border-right: 2px solid #fff; } .ix .pd-seg span:last-child { border-right: 0; } .ix .pd-seg .on { background: #fff; color: #06122e; }
/* 05 barres */
.ix .pd-bar { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(255,213,74,.28), rgba(255,213,74,.04)); border-right: 2px solid rgba(255,213,74,.8); } .ix .pd-r.bar > *:not(.pd-bar) { position: relative; }
/* 06 resume */
.ix .pd-sum { display: grid; grid-template-columns: repeat(3, 1fr); } .ix .pd-sum > div { padding: 16px; border-right: 2px solid rgba(255,255,255,.3); text-align: center; } .ix .pd-sum > div:last-child { border-right: 0; } .ix .pd-sum .t { font: 800 11px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.65); } .ix .pd-sum .n { font-size: 30px; line-height: 1; margin: 10px 0 4px; } .ix .pd-sum .v { font-size: 44px; line-height: 1; color: #ffd54a; }
.ix .pd-more { display: block; width: 100%; background: transparent; border: 0; border-top: 2px solid #fff; color: #fff; padding: 12px; font: 800 12px system-ui; letter-spacing: .14em; text-transform: uppercase; text-align: center; }
/* 07 medailles carrees */
.ix .pd-med { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; font-size: 17px; line-height: 1; border: 2px solid; } .ix .pd-med.g { color: #06122e; background: #ffd54a; border-color: #ffd54a; } .ix .pd-med.s { color: #06122e; background: #c9d1e0; border-color: #c9d1e0; } .ix .pd-med.b { color: #06122e; background: #e0925a; border-color: #e0925a; }
/* 10 equipe */
.ix .pd-r.tm { border-left: 5px solid var(--tc); background: linear-gradient(90deg, color-mix(in srgb, var(--tc) 22%, transparent), transparent 60%); } .ix .pd-lg { width: 15px; height: 15px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
/* 11 progression */
.ix .pd-up { font: 800 10px system-ui; color: #4cd37b; letter-spacing: .04em; } .ix .pd-dn { font: 800 10px system-ui; color: #ff8a8d; } .ix .pd-eq { font: 800 10px system-ui; color: rgba(255,255,255,.4); } .ix .pd-new { font: 800 9px system-ui; color: #06122e; background: #4cd37b; padding: 1px 4px; letter-spacing: .08em; }
/* mobile */
.ix .pd-ph { width: 300px; border: 4px solid #fff; background: #050912; } .ix .pd-ph .top { padding: 12px 12px 4px; font-size: 22px; } .ix .pd-ph .pd-seg { margin: 6px 10px; display: flex; } .ix .pd-ph .pd-seg span { flex: 1; justify-content: center; padding: 0 4px; font-size: 10px; height: 32px; } .ix .pd-ph .pd-r { padding: 8px 10px; }
.ix .pd-snap { display: flex; gap: 10px; overflow-x: auto; padding: 10px; scroll-snap-type: x mandatory; } .ix .pd-snap .pd-card { flex: 0 0 82%; scroll-snap-align: start; border: 2px solid #fff; } .ix .pd-snap .pd-card .hd { padding: 8px 10px; background: #fff; color: #06122e; font-size: 20px; line-height: 1; } .ix .pd-dots { display: flex; gap: 6px; justify-content: center; padding-bottom: 10px; } .ix .pd-dots i { width: 18px; height: 4px; background: rgba(255,255,255,.3); } .ix .pd-dots i.on { background: #fff; }
@media (max-width: 800px) { .ix .pd-3 { grid-template-columns: 1fr; } .ix .pd-sum { grid-template-columns: 1fr; } .ix .pd-sum > div { border-right: 0; border-bottom: 2px solid rgba(255,255,255,.3); } .ix .pd-hero .n { font-size: 26px; } .ix .pd-hero .v { font-size: 40px; } }
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

type P = { n: string; img?: string; v: number; t?: string; d?: number }
const AV = [C.mccain.img, undefined, C.maxey.img, C.edwards.img, undefined, C.hawkins.img, C.mcw.img, undefined, C.luwawu.img, undefined]
const mk = (names: string[], vals: number[], teams: string[]): P[] => names.map((n, i) => ({ n, v: vals[i], img: AV[i], t: teams[i], d: [0, 2, -1, 0, 3, 0, -2, 5, -1, 0][i] }))
const DAY = mk(['Zalandarr', 'Fracod59', 'Dams', 'Mahery12', 'Tched69', 'dune03', 'Nanorcards', 'Auré', 'geekennord', 'BastienC'], [49, 45, 43, 41, 37, 32, 32, 32, 25, 25], ['BKN', 'DEN', 'PHI', 'MIA', 'NYK', 'BOS', 'MIA', 'LAL', 'GSW', 'MIN'])
const WEEK = mk(['Tched69', 'Dams', 'Mahery12', 'Benlou33', 'Nanorcards', 'Alf', 'PresseBasket', 'Francoiskun', 'Zalandarr', 'Jayssjoyss'], [623, 434, 426, 409, 380, 347, 266, 249, 224, 220], ['NYK', 'PHI', 'MIA', 'LAL', 'MIA', 'GSW', 'BOS', 'DEN', 'BKN', 'MIN'])
const MONTH = mk(['Tched69', 'Alf', 'Mahery12', 'Benlou33', 'Dams', 'Nanorcards', 'Francoiskun', 'NikoNounours', 'ThymThym53', 'PresseBasket'], [885, 674, 592, 569, 481, 452, 338, 321, 266, 266], ['NYK', 'GSW', 'MIA', 'LAL', 'PHI', 'MIA', 'DEN', 'BOS', 'MIN', 'BOS'])
const TC: Record<string, string> = { PHI: '#2f8bff', MIN: '#4aa3df', BOS: '#1fb75a', LAL: '#fdb927', GSW: '#ffc72c', NYK: '#f58426', MIA: '#e03a5e', DEN: '#fec524', BKN: '#9aa6bd' }
const PER = [['Aujourd’hui', 'dimanche 11 octobre', DAY], ['Cette semaine', 'lun. 5 oct. — auj.', WEEK], ['Ce mois', 'octobre 2026', MONTH]] as const
const rkc = (i: number) => (i === 0 ? 'g' : i === 1 ? 's' : i === 2 ? 'b' : '')
const Ph = ({ p, s = 26 }: { p: P; s?: number }) => (p.img ? <img className="pd-av" src={p.img} width={s} height={s} style={{ width: s, height: s }} alt="" /> : <span className="pd-ini sf" style={{ width: s, height: s, fontSize: s * 0.5 }}>{p.n[0]}</span>)
const Lg = ({ t }: { t?: string }) => (t && t !== 'BKN' ? <img className="pd-lg" src={`/team-logos/nba-${t}.png`} alt="" /> : null)
const Rows = ({ list, nameSize = 20, extra, start = 0 }: { list: P[]; nameSize?: number; extra?: (p: P, i: number) => React.ReactNode; start?: number }) => (
  <div>{list.map((p, i) => (
    <div key={p.n} className="pd-r"><span className={`pd-rk sf ${rkc(i + start)}`}>{i + start + 1}</span><span className="pd-who"><Ph p={p} /><span className="n sf" style={{ fontSize: nameSize }}>{p.n}</span>{extra?.(p, i)}</span><span className="pd-v sf">+{p.v}</span></div>
  ))}</div>
)

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Trois colonnes DA', 'N°1 géant', 'Marches du podium', 'Onglets', 'Barres', 'Résumé des 3 n°1', 'Médailles carrées', 'Liseré équipe', 'Progression', 'Mobile onglets', 'Mobile carrousel']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 27 · Les 3 podiums</h1>
      <p className="lead">Les classements « Aujourd&apos;hui / Cette semaine / Ce mois » de l&apos;accueil : aujourd&apos;hui des cartes noires à coins arrondis avec des médailles emoji. Les versions suivantes passent en Surfquest, filets blancs et angles droits, avec l&apos;or pour le n°1 et les gains (+49…). Elles gardent les mêmes informations (rang, avatar, pseudo, gain) et sont pensées pour le téléphone.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="00" title="Aujourd'hui, pour comparer" desc="Trois cartes noires à coins arrondis, titre en gras, médailles emoji pour le top 3, la première ligne surlignée en orange. Aucun lien avec Surfquest ni les filets blancs du reste de la DA."><div className="pd-3">
        {PER.map(([t, s, l]) => <div key={t} className="pd-col"><div style={{ font: '800 15px system-ui' }}>{t}</div><div className="pd-sub" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{s}</div><div className="pd-old">{l.slice(0, 6).map((p, i) => <div key={p.n} className={`pd-r${i === 0 ? ' t1' : ''}`}><span style={{ textAlign: 'center' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span className="pd-who"><Ph p={p} /><span className="n">{p.n}</span></span><span className="v">+{p.v}</span></div>)}</div></div>)}
      </div></Bay>

      <Bay id="s2" n="01" title="Trois colonnes en DA : titres, pseudos et gains en Surfquest" desc="Même disposition, mais à plat : titre de période en Surfquest, filet blanc épais sous la liste, rang en Surfquest (or, argent, bronze pour le top 3 à la place des médailles), pseudo en Surfquest, gain en or. Plus de coins arrondis ni de fond noir."><div className="pd-3">
        {PER.map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 30, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div><div className="pd-in" style={{ borderTop: '3px solid #fff' }}><Rows list={l} /></div></div>)}
      </div></Bay>

      <Bay id="s3" n="02" title="Le n°1 en grand bloc doré, les autres en liste" desc="Dans chaque période, le premier prend un bloc à filet doré avec son pseudo en 34 px et son gain en 54 px (comme les compteurs de l'accueil). Les places 2 à 10 restent en liste compacte dessous. On voit tout de suite qui domine."><div className="pd-3">
        {PER.map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div>
          <div className="pd-hero"><span className="k sf">1er</span><Ph p={l[0]} s={52} /><div style={{ minWidth: 0 }}><div className="n sf">{l[0].n}</div></div><div className="v sf">+{l[0].v}<small>cartes</small></div></div>
          <Rows list={l.slice(1)} nameSize={18} start={1} />
        </div>)}
      </div></Bay>

      <Bay id="s4" n="03" title="Les marches du podium (2 – 1 – 3), puis la liste" desc="Le top 3 de chaque période est dessiné comme un vrai podium : le n°1 au centre, plus grand et en or, le 2 à gauche et le 3 à droite. Les places 4 à 10 continuent en liste. Très visuel, un peu plus haut."><div className="pd-3">
        {PER.map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div>
          <div className="pd-steps">{[l[1], l[0], l[2]].map((p, k) => { const i = k === 1 ? 0 : k === 0 ? 1 : 2; return <div key={p.n} className={`pd-st${i === 0 ? ' s1' : ''}`}><div className={`rr sf ${rkc(i)}`} style={{ color: i === 0 ? '#ffd54a' : i === 1 ? '#c9d1e0' : '#e0925a' }}>{i + 1}</div><Ph p={p} s={i === 0 ? 44 : 34} /><div className="nm sf">{p.n}</div><div className="vv sf">+{p.v}</div></div> })}</div>
          <Rows list={l.slice(3)} nameSize={17} start={3} />
        </div>)}
      </div></Bay>

      <Bay id="s5" n="04" title="Un seul classement avec onglets (Aujourd'hui · Semaine · Mois)" desc="Au lieu de trois colonnes (qui s'empilent sur téléphone et allongent la page), un seul panneau avec un sélecteur carré à trois segments. Le segment actif est plein blanc. Les 10 lignes en Surfquest, la liste prend toute la largeur donc les pseudos longs ne sont plus coupés."><div className="pd-box" style={{ maxWidth: 560 }}>
        <div className="pd-seg"><span className="on">Aujourd’hui</span><span>Cette semaine</span><span>Ce mois</span></div>
        <div className="pd-sub">dimanche 11 octobre</div>
        <div className="pd-in" style={{ borderTop: '3px solid #fff' }}><Rows list={DAY} nameSize={22} /></div>
      </div></Bay>

      <Bay id="s6" n="05" title="Barres de gain derrière chaque ligne" desc="Chaque ligne a une barre dorée proportionnelle à son gain (relative au n°1 de la période) avec un trait doré au bout. On voit l'écart entre les places sans lire les nombres, comme dans la maquette de l'annuaire."><div className="pd-3">
        {PER.map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div><div className="pd-in" style={{ borderTop: '3px solid #fff' }}>{l.map((p, i) => <div key={p.n} className="pd-r bar"><span className="pd-bar" style={{ width: `${(p.v / l[0].v) * 100}%` }} /><span className={`pd-rk sf ${rkc(i)}`}>{i + 1}</span><span className="pd-who"><Ph p={p} /><span className="n sf" style={{ fontSize: 19 }}>{p.n}</span></span><span className="pd-v sf" style={{ color: '#fff' }}>+{p.v}</span></div>)}</div></div>)}
      </div></Bay>

      <Bay id="s7" n="06" title="Résumé : les 3 n°1 côte à côte, le reste se déplie" desc="Le haut de l'accueil ne montre que les trois champions (jour, semaine, mois) dans un bandeau à trois cases séparées par des filets, avec le gain en très gros. Un bouton « Voir les classements » déplie les 10 lignes de chaque période. Gagne beaucoup de place sur l'accueil."><div className="pd-box" style={{ padding: 0 }}>
        <div className="pd-sum">{PER.map(([t, , l]) => <div key={t}><div className="t">{t}</div><div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 0' }}><Ph p={l[0]} s={56} /></div><div className="n sf">{l[0].n}</div><div className="v sf">+{l[0].v}</div></div>)}</div>
        <span className="pd-more">Voir les classements ▾</span>
      </div></Bay>

      <Bay id="s8" n="07" title="Médailles carrées or / argent / bronze" desc="Le top 3 garde des médailles, mais en carrés pleins (or, argent, bronze) avec le chiffre en Surfquest dedans, au lieu des emojis. Les autres rangs restent en gris. Même rendu sur toutes les plateformes (les emojis varient selon le téléphone)."><div className="pd-3">
        {PER.slice(0, 2).map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div><div className="pd-in" style={{ borderTop: '3px solid #fff' }}>{l.slice(0, 6).map((p, i) => <div key={p.n} className="pd-r"><span style={{ textAlign: 'center' }}>{i < 3 ? <span className={`pd-med sf ${rkc(i)}`}>{i + 1}</span> : <span className="pd-rk sf">{i + 1}</span>}</span><span className="pd-who"><Ph p={p} /><span className="n sf" style={{ fontSize: 20 }}>{p.n}</span></span><span className="pd-v sf">+{p.v}</span></div>)}</div></div>)}
      </div></Bay>

      <Bay id="s9" n="08" title="Liseré de la couleur de l'équipe favorite + petit logo" desc="Comme dans l'annuaire : un liseré et un léger dégradé dans la couleur de l'équipe favorite de chaque joueur, et son logo (15 px) à côté du pseudo. Donne de la vie et de l'identité sans alourdir."><div className="pd-3">
        {PER.slice(0, 2).map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div><div className="pd-in" style={{ borderTop: '3px solid #fff' }}>{l.slice(0, 6).map((p, i) => <div key={p.n} className="pd-r tm" style={{ ['--tc' as string]: TC[p.t || 'BKN'] }}><span className={`pd-rk sf ${rkc(i)}`}>{i + 1}</span><span className="pd-who"><Ph p={p} /><span className="n sf" style={{ fontSize: 20 }}>{p.n}</span><Lg t={p.t} /></span><span className="pd-v sf">+{p.v}</span></div>)}</div></div>)}
      </div></Bay>

      <Bay id="s10" n="09" title="Progression : flèches ↑ ↓ et « Nouveau » (par rapport à la veille)" desc="À côté de chaque pseudo, une petite flèche verte (a gagné des places), rouge (en a perdu) ou un trait gris (stable), et une étiquette « Nouveau » pour qui entre dans le top 10. Donne envie de revenir voir son évolution."><div className="pd-3">
        {PER.slice(0, 2).map(([t, s, l]) => <div key={t} className="pd-col"><h3 className="pd-h sf" style={{ fontSize: 26, lineHeight: 1 }}>{t}</h3><div className="pd-sub">{s}</div><div className="pd-in" style={{ borderTop: '3px solid #fff' }}><Rows list={l.slice(0, 8)} nameSize={19} extra={(p, i) => i === 7 ? <span className="pd-new">NEW</span> : (p.d || 0) > 0 ? <span className="pd-up">▲{p.d}</span> : (p.d || 0) < 0 ? <span className="pd-dn">▼{Math.abs(p.d || 0)}</span> : <span className="pd-eq">–</span>} /></div></div>)}
      </div></Bay>

      <Bay id="s11" n="10" title="Téléphone : onglets + une seule liste" desc="Sur mobile les trois colonnes deviennent un sélecteur à trois segments pleine largeur et une liste unique, pseudos en Surfquest 20 px et gain à droite. Un seul écran de scroll au lieu de trois classements empilés."><div className="pd-ph">
        <div className="top sf">Podium</div>
        <div className="pd-seg"><span className="on">Jour</span><span>Semaine</span><span>Mois</span></div>
        <Rows list={DAY.slice(0, 7)} nameSize={20} />
      </div></Bay>

      <Bay id="s12" n="11" title="Téléphone : carrousel horizontal des 3 périodes" desc="Chaque période est une carte à bandeau blanc (titre en Surfquest) ; on les fait glisser de côté avec accroche, la suivante dépassant légèrement pour montrer qu'il y en a d'autres. Trois traits indiquent la position."><div className="pd-ph">
        <div className="top sf">Podium</div>
        <div className="pd-snap">{PER.map(([t, , l]) => <div key={t} className="pd-card"><div className="hd sf">{t}</div><Rows list={l.slice(0, 5)} nameSize={18} /></div>)}</div>
        <div className="pd-dots"><i className="on" /><i /><i /></div>
      </div></Bay>
    </div>
  )
}
