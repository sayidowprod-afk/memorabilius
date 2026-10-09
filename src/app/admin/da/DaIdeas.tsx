'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Deuxieme serie : la premiere (eventail, reflet holo, billet, vitrine...) est deja integree au site.
// Tout le style est ici, prefixe .ix-, pour ne rien changer sur les vraies pages.

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
@property --a { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
.ix { --bl:#003da6; --el:#2f6bff; font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
/* le theme sombre global force la couleur du texte des div : sur les fonds clairs on la fixe explicitement */
.ix .ink, .ix .ink * { color: #06122e !important; }
.ix h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.ix .lead { max-width: 720px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 30px; }
.ix .back { color:#fff; text-decoration:none; font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.ix .bay { margin: 0 0 54px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .bay h2 { font-size: clamp(28px,4.4vw,44px); margin: 14px 0 6px; line-height: 1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 680px; margin: 0 0 18px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,34px); position:relative; overflow:hidden; }
.ix .row { display:flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
.ix .cap { font: 700 11px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.55); margin-top: 10px; }
.ix .card { display:block; aspect-ratio: 2.5/3.5; object-fit: cover; border-radius: 0; box-shadow: 0 16px 36px rgba(0,0,0,.5); width:100%; }
.ix .btn { background:#fff; color:#06122e !important; border:3px solid #fff; padding: 9px 18px; font: 800 12px system-ui; letter-spacing:.1em; text-transform:uppercase; cursor:pointer; }
.ix .btn:hover { background: transparent; color:#fff !important; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 12px; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }

/* 01 · slab */
.ix .slab { width: 236px; padding: 10px 10px 12px; background: linear-gradient(160deg,#f4f6fb,#c8d0e0 55%,#eef1f8); box-shadow: 0 22px 44px rgba(0,0,0,.55), inset 0 0 0 2px #fff; position:relative; }
.ix .slab .lab { display:grid; grid-template-columns: 1fr auto; gap: 8px; background:#fff; padding: 7px 9px; border-bottom: 3px solid #c8102e; margin-bottom: 8px; }
.ix .slab .lab small { display:block; font: 800 8px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .slab .lab b { display:block; font-size: 16px; line-height: 1.05; }
.ix .slab .gr { text-align:center; padding-left: 8px; border-left: 2px solid #06122e; }
.ix .slab .gr b { font-size: 34px; line-height: 1; color:#c8102e !important; } .ix .slab .gr small { font-size: 7.5px; }
.ix .slab .win { padding: 6px; background: #0b1124; box-shadow: inset 0 0 0 2px rgba(255,255,255,.18), inset 0 6px 14px rgba(0,0,0,.6); }
.ix .slab .win .card { box-shadow: none; }
.ix .slab::after { content:''; position:absolute; inset:0; pointer-events:none; background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.35) 48%, transparent 58%); }

/* 02 · pochettes */
.ix .pages { display:grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 420px; padding: 14px; background: #101a3c; border: 3px solid rgba(255,255,255,.2); }
.ix .pk { aspect-ratio: 2.5/3.5; position:relative; background: rgba(255,255,255,.05); border: 2px solid rgba(255,255,255,.28); }
.ix .pk.miss { border-style: dashed; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; }
.ix .pk.miss .n { font-size: 38px; line-height:1; color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,.4); }
.ix .pk.miss small { font: 700 8px system-ui; letter-spacing:.14em; text-transform:uppercase; color: rgba(255,255,255,.45); }
.ix .pk .card { height:100%; box-shadow:none; }
.ix .pk::after { content:''; position:absolute; inset:0; pointer-events:none; background: linear-gradient(135deg, rgba(255,255,255,.14), transparent 40%); }

/* 03 · pellicule */
.ix .film { background:#06080f; padding: 22px 0; position:relative; overflow-x:auto; }
.ix .film::before, .ix .film::after { content:''; position:absolute; left:0; right:0; height: 12px; background: repeating-linear-gradient(90deg, transparent 0 10px, #2a3150 10px 22px, transparent 22px 32px); }
.ix .film::before { top: 5px; } .ix .film::after { bottom: 5px; }
.ix .film .fr { display:flex; gap: 18px; padding: 0 18px; width: max-content; }
.ix .fr .f { width: 150px; flex-shrink:0; }
.ix .fr .f .card { box-shadow:none; }
.ix .fr .f .m { display:flex; justify-content:space-between; font: 700 10px system-ui; letter-spacing:.14em; color:#e9b44c; margin-top: 6px; text-transform:uppercase; }

/* 04 · tableau d'affichage */
.ix .board { display:grid; grid-template-columns: repeat(auto-fit, minmax(120px,1fr)); gap: 3px; background: #1a1205; border: 4px solid #3a2a0a; padding: 4px; max-width: 760px; }
.ix .board .c { background:#0b0803; padding: 12px 14px 10px; position:relative; }
.ix .board .v { font-size: 64px; line-height: 1; color:#ffb300; text-shadow: 0 0 14px rgba(255,179,0,.7); position:relative; display:inline-block; }
.ix .board .v::after { content:''; position:absolute; inset:0; background: radial-gradient(circle, rgba(11,8,3,.9) 38%, transparent 42%) 0 0 / 4px 4px; pointer-events:none; }
.ix .board .l { font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; color:#b98a22; margin-top: 6px; }

/* 05 · halo rarete */
.ix .halos { display:flex; gap: 26px; flex-wrap:wrap; }
.ix .halo { width: 150px; padding: 4px; position:relative; animation: ixspin 3.2s linear infinite; }
.ix .halo .card { box-shadow:none; }
.ix .halo.gold { background: conic-gradient(from var(--a), #b8860b, #fff6a8, #ffd700, #b8860b, #fff6a8, #b8860b); box-shadow: 0 0 26px rgba(255,215,0,.55); }
.ix .halo.silver { background: conic-gradient(from var(--a), #777, #fff, #bbb, #777, #fff, #777); box-shadow: 0 0 22px rgba(220,230,255,.45); }
.ix .halo.bronze { background: conic-gradient(from var(--a), #6d3a00, #f5cba7, #cd7f32, #6d3a00, #f5cba7, #6d3a00); box-shadow: 0 0 20px rgba(205,127,50,.45); }
.ix .halo.none { background: rgba(255,255,255,.2); animation:none; }
@keyframes ixspin { to { --a: 360deg; } }

/* 06 · fiche joueur */
.ix .sheet { max-width: 560px; border: 3px solid rgba(255,255,255,.3); background: linear-gradient(135deg,#050912,#08153b 55%,#003da6); padding: 18px 20px; display:grid; grid-template-columns: 110px 1fr; gap: 18px; }
.ix .sheet .ovr { text-align:center; } .ix .sheet .ovr b { display:block; font-size: 76px; line-height:.9; } .ix .sheet .ovr small { font: 800 10px system-ui; letter-spacing:.2em; text-transform:uppercase; opacity:.7; }
.ix .sheet h3 { margin: 0 0 10px; font-size: 30px; line-height:1; }
.ix .st { display:grid; grid-template-columns: 62px 1fr 34px; gap: 8px; align-items:center; margin: 5px 0; font: 800 10px system-ui; letter-spacing:.14em; text-transform:uppercase; }
.ix .segs { display:grid; grid-template-columns: repeat(12, 1fr); gap: 2px; } .ix .segs i { height: 9px; background: rgba(255,255,255,.14); display:block; }
.ix .segs i.on { background: var(--c, #2f6bff); }

/* 07 · ruban de texte */
.ix .ribbon { position:relative; overflow:hidden; padding: 38px 0; }
.ix .ribbon .bg { position:absolute; left:0; top:50%; transform: translateY(-50%); white-space:nowrap; font-size: 150px; line-height: 1; color: transparent; -webkit-text-stroke: 2px rgba(255,255,255,.16); animation: ixslide 40s linear infinite; }
.ix .ribbon .bg2 { top: 50%; margin-top: 70px; animation-direction: reverse; -webkit-text-stroke-color: rgba(47,107,255,.35); font-size: 90px; }
@keyframes ixslide { to { transform: translate(-50%,-50%); } }
.ix .ribbon .fg { position:relative; display:flex; align-items:center; gap: 16px; padding: 0 22px; }
.ix .ribbon .fg h3 { margin:0; font-size: 56px; line-height: .95; }
@media (prefers-reduced-motion: reduce) { .ix .ribbon .bg, .ix .halo { animation: none; } }

/* 08 · alertes */
.ix .toasts { display:flex; flex-direction:column; gap: 12px; max-width: 460px; }
.ix .toast { display:flex; align-items:stretch; filter: drop-shadow(0 8px 14px rgba(0,0,0,.45)); animation: ixin .5s cubic-bezier(.2,.9,.2,1) both; }
.ix .toast .ic { width: 54px; display:flex; align-items:center; justify-content:center; font-size: 26px; background: var(--c); clip-path: polygon(0 0,100% 0,calc(100% - 10px) 100%,0 100%); }
.ix .toast .tx { flex:1; background:#fff; padding: 9px 22px 9px 18px; margin-left:-10px; clip-path: polygon(10px 0,100% 0,100% 100%,0 100%); }
.ix .toast .tx b { display:block; font-size: 22px; line-height:1; } .ix .toast .tx span { font: 700 11px system-ui; letter-spacing:.06em; }
@keyframes ixin { from { transform: translateX(-60px); opacity: 0; } to { transform:none; opacity:1; } }

/* 09 · heatmap */
.ix .heat { display:grid; grid-auto-flow: column; grid-template-rows: repeat(7, 13px); grid-auto-columns: 13px; gap: 3px; overflow-x:auto; padding-bottom: 6px; }
.ix .heat i { display:block; background: rgba(255,255,255,.09); }
.ix .heat i.l1 { background: #1a3f9e; } .ix .heat i.l2 { background: #2a58d6; } .ix .heat i.l3 { background: #4f86ff; } .ix .heat i.l4 { background: #b5ceff; }
.ix .legend { display:flex; align-items:center; gap:4px; font: 700 10px system-ui; letter-spacing:.12em; text-transform:uppercase; color: rgba(255,255,255,.6); margin-top: 8px; }
.ix .legend i { width: 13px; height: 13px; display:inline-block; }

/* 10 · pile qui se deploie */
.ix .piles { display:flex; gap: 70px; flex-wrap:wrap; padding: 8px 20px 24px 20px; }
.ix .pile { position:relative; width: 120px; height: 168px; cursor:pointer; }
.ix .pile .card { position:absolute; left:0; top:0; width:100%; transition: transform .45s cubic-bezier(.2,.9,.2,1); transform-origin: 50% 100%; }
.ix .pile .card:nth-child(1) { transform: rotate(-5deg) translateX(-6px); } .ix .pile .card:nth-child(2) { transform: rotate(3deg) translateX(4px); } .ix .pile .card:nth-child(3) { transform: rotate(0); }
.ix .pile:hover .card:nth-child(1) { transform: rotate(-18deg) translateX(-62px); } .ix .pile:hover .card:nth-child(2) { transform: rotate(18deg) translateX(62px); } .ix .pile:hover .card:nth-child(3) { transform: translateY(-14px); }
.ix .pile .nm { position:absolute; left:0; right:0; bottom:-30px; text-align:center; font: 800 11px system-ui; letter-spacing:.12em; text-transform:uppercase; }

/* 11 · cartel */
.ix .wall { display:flex; gap: 40px; flex-wrap:wrap; justify-content:center; padding: 20px 10px 6px; background: repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 2px, transparent 2px 6px); }
.ix .art { width: 170px; text-align:center; position:relative; padding-top: 20px; }
.ix .art::before { content:''; position:absolute; top:0; left: 10%; right:10%; height: 6px; background:#d9dde8; box-shadow: 0 0 0 1px #0006; }
.ix .art::after { content:''; position:absolute; top: 6px; left: 0; right: 0; height: 80px; background: linear-gradient(180deg, rgba(255,240,200,.28), transparent); pointer-events:none; }
.ix .art .frame { background:#0a0a0a; padding: 10px; border: 4px solid #b8923a; box-shadow: 0 16px 30px rgba(0,0,0,.6), inset 0 0 0 2px #6b5217; }
.ix .art .mat { background:#eee9dc; padding: 10px; } .ix .art .mat .card { box-shadow: 0 0 0 1px #0004; }
.ix .art .plaque { margin: 12px auto 0; width: 82%; padding: 6px 8px; background: linear-gradient(135deg,#d8b45a,#f1dc9a 45%,#b8923a); font: 800 9px system-ui; letter-spacing:.12em; text-transform:uppercase; }
.ix .art .plaque b { display:block; font-size: 15px; line-height:1.05; letter-spacing:.04em; }
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
  const [replay, setReplay] = useState(0)

  // heatmap : 26 semaines x 7 jours, generateur deterministe
  const heat = useMemo(() => {
    let s = 11
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    return Array.from({ length: 26 * 7 }, (_, i) => {
      const r = rnd() * (0.55 + (i / 182) * 0.7)
      return r < 0.45 ? '' : r < 0.7 ? 'l1' : r < 0.95 ? 'l2' : r < 1.15 ? 'l3' : 'l4'
    })
  }, [])

  const stats = [{ v: '599', l: 'Cartes' }, { v: '119', l: 'RC' }, { v: '29', l: 'Auto' }, { v: '23', l: 'Patch' }, { v: '91', l: 'Num' }]
  const owned = new Set([0, 1, 3, 4, 7])

  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées visuelles · Série 2</h1>
      <p className="lead">Onze nouvelles pistes (les précédentes sont intégrées : éventail, reflet holo léger, billet d&apos;échange, vitrine). Chaque maquette est vivante. Dis-moi les numéros à garder.</p>
      <nav className="tags">
        {['01 Boîtier gradé', '02 Pochettes fantômes', '03 Pellicule', '04 Tableau d’affichage', '05 Halo de rareté', '06 Fiche joueur', '07 Ruban de texte', '08 Alertes', '09 Calendrier', '10 Pile qui s’ouvre', '11 Cartel'].map((t, i) => <a key={t} href={`#j${i + 1}`}>{t}</a>)}
      </nav>

      <Bay id="j1" n="01 — Boîtier gradé" title="La carte dans son slab" desc="Pour les cartes gradées : boîtier transparent, étiquette avec le set, le joueur et la note en gros Surfquest rouge. Reconnaissable au premier coup d'œil dans la galerie et sur la fiche.">
        <div className="row">
          <div className="slab">
            <div className="lab ink">
              <div><small>2024-25 Panini Contenders Optic</small><b className="sf">Jared McCain</b><small>RC · AUTO · Season Ticket</small></div>
              <div className="gr"><b className="sf">10</b><small>Gem Mint</small></div>
            </div>
            <div className="win">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.mccain.img} alt="" /></div>
          </div>
          <div className="slab" style={{ width: 200 }}>
            <div className="lab ink">
              <div><small>2018-19 Panini Prizm</small><b className="sf">Hersey Hawkins</b><small>AUTO</small></div>
              <div className="gr"><b className="sf">9.5</b><small>Mint+</small></div>
            </div>
            <div className="win">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={C.hawkins.img} alt="" /></div>
          </div>
        </div>
      </Bay>

      <Bay id="j2" n="02 — Pochettes fantômes" title="La setlist comme une page de classeur" desc="Une page 3×3 : les cartes que tu as sont dans leur pochette, les manquantes restent en silhouette pointillée avec leur numéro en creux. On voit ce qu'il manque comme dans un vrai classeur.">
        <div className="pages">
          {Array.from({ length: 9 }, (_, i) => owned.has(i)
            ? <div key={i} className="pk">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={ALL[i % ALL.length].img} alt="" /></div>
            : <div key={i} className="pk miss"><span className="n sf">{String(i + 1).padStart(3, '0')}</span><small>Manquante</small></div>)}
        </div>
      </Bay>

      <Bay id="j3" n="03 — Pellicule" title="La chronologie en bande de film" desc="La vue « Chronologie » devient une pellicule : perforations en haut et en bas, numéro d'image et date sous chaque carte. Se fait défiler à l'horizontale.">
        <div className="film">
          <div className="fr">
            {ALL.concat(ALL).slice(0, 9).map((c, i) => (
              <div className="f" key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="card" src={c.img} alt="" />
                <div className="m"><span>{String(i + 1).padStart(2, '0')}A</span><span>{`${28 - i * 2}.0${(i % 9) + 1}.26`}</span></div>
              </div>
            ))}
          </div>
        </div>
      </Bay>

      <Bay id="j4" n="04 — Tableau d’affichage" title="Les stats en LED de stade" desc="Les chiffres du profil (cartes, RC, auto, patch, num) en ambre lumineux à pastilles, comme un tableau de score de salle. Fort contraste, identité « arène ».">
        <div className="board">
          {stats.map(s => (
            <div className="c" key={s.l}><div className="v sf">{s.v}</div><div className="l">{s.l}</div></div>
          ))}
        </div>
      </Bay>

      <Bay id="j5" n="05 — Halo de rareté" title="Un liseré animé pour les tirages rares" desc="Les cartes rares ont un contour métallique qui tourne lentement (or pour 1/1, argent jusqu'à /10, bronze jusqu'à /25) et un léger halo. Les autres gardent un filet simple.">
        <div className="halos">
          {[{ k: 'gold', c: C.mcw, l: '1/1' }, { k: 'silver', c: C.hawkins, l: '/10' }, { k: 'bronze', c: C.mccain, l: '/25' }, { k: 'none', c: C.maxey, l: '/149' }].map(h => (
            <div key={h.k}>
              <div className={`halo ${h.k}`}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={h.c.img} alt="" /></div>
              <div className="cap">{h.l}</div>
            </div>
          ))}
        </div>
      </Bay>

      <Bay id="j6" n="06 — Fiche joueur" title="Ta collection comme une fiche de jeu vidéo" desc="Une note globale géante (niveau ou score de collection) et des jauges à segments pour RC, auto, patch, num. Pour le profil public et la carte de collectionneur.">
        <div className="sheet">
          <div className="ovr"><b className="sf">87</b><small>Niveau</small></div>
          <div>
            <h3 className="sf">GKNNN_Cards</h3>
            {[{ l: 'RC', n: 10, c: '#e67e22' }, { l: 'Auto', n: 6, c: '#2e9d57' }, { l: 'Patch', n: 5, c: '#2f6bff' }, { l: 'Num', n: 8, c: '#a45cff' }, { l: 'Cartes', n: 11, c: '#fff' }].map(r => (
              <div className="st" key={r.l}>
                <span>{r.l}</span>
                <div className="segs" style={{ ['--c' as string]: r.c }}>{Array.from({ length: 12 }, (_, i) => <i key={i} className={i < r.n ? 'on' : ''} />)}</div>
                <span style={{ textAlign: 'right' }}>{r.n * 8}</span>
              </div>
            ))}
          </div>
        </div>
      </Bay>

      <Bay id="j7" n="07 — Ruban de texte" title="Un mot géant en contour derrière les sections" desc="Derrière un titre de section, le mot (COLLECTION, TRADES, SETLIST…) défile très lentement en contour, sur deux lignes à sens opposés. Du mouvement discret, très « affiche sportive ».">
        <div className="ribbon">
          <div className="bg sf">Collection Collection Collection Collection Collection Collection</div>
          <div className="bg bg2 sf">Memorabilius Memorabilius Memorabilius Memorabilius Memorabilius Memorabilius Memorabilius Memorabilius</div>
          <div className="fg"><span className="eyebrow">03 — Ma galerie</span><h3 className="sf">Mes 599 cartes</h3></div>
        </div>
      </Bay>

      <Bay id="j8" n="08 — Alertes" title="Les notifications façon bandeau de match" desc="Un like, une offre d'échange, un badge : l'alerte glisse depuis la gauche avec un bloc couleur + icône et un bandeau blanc à coupe oblique. Plus marquant qu'un toast arrondi.">
        <div className="toasts" key={replay}>
          {[{ ic: '♥', c: '#e63a6e', t: 'Jared a aimé ta carte', s: 'Anthony Edwards · Chronicles', d: 0 },
            { ic: '⇄', c: '#2f6bff', t: 'Nouvelle offre d’échange', s: 'Tyrese Maxey contre Hersey Hawkins', d: 0.25 },
            { ic: '★', c: '#e9b44c', t: 'Badge débloqué : 25 patchs', s: '+50 XP', d: 0.5 }].map(t => (
            <div className="toast" key={t.t} style={{ animationDelay: `${t.d}s` }}>
              <div className="ic" style={{ ['--c' as string]: t.c }}>{t.ic}</div>
              <div className="tx ink"><b className="sf">{t.t}</b><span>{t.s}</span></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><button className="btn" onClick={() => setReplay(r => r + 1)}>Rejouer ↻</button></div>
      </Bay>

      <Bay id="j9" n="09 — Calendrier" title="Le streak en calendrier de carrés" desc="Six mois d'activité en petits carrés bleus (plus clair = plus d'ajouts ce jour-là), à côté du « 53 jours de suite ». Le même langage que la mosaïque de setlist.">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 14 }}>
          <span className="sf" style={{ fontSize: 64, lineHeight: 1 }}>53</span>
          <span className="sf" style={{ fontSize: 24, opacity: .7 }}>jours de suite</span>
        </div>
        <div className="heat">{heat.map((h, i) => <i key={i} className={h} />)}</div>
        <div className="legend">Moins <i style={{ background: 'rgba(255,255,255,.09)' }} /><i style={{ background: '#1a3f9e' }} /><i style={{ background: '#2a58d6' }} /><i style={{ background: '#4f86ff' }} /><i style={{ background: '#b5ceff' }} /> Plus</div>
      </Bay>

      <Bay id="j10" n="10 — Pile qui s’ouvre" title="Les collections et classeurs en piles" desc="Chaque classeur, set ou collection est une pile de 3 cartes ; au survol (ou au toucher) elle s'ouvre en éventail pour montrer ce qu'elle contient.">
        <div className="piles">
          {[[C.mccain, C.edwards, C.maxey, 'Court Kings'], [C.hawkins, C.mcw, C.luwawu, 'Prizm']].map((p, k) => (
            <div className="pile" key={k}>
              {([p[0], p[1], p[2]] as { img: string }[]).map((c, i) => <div key={i} style={{ display: 'contents' }}>{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={c.img} alt="" /></div>)}
              <div className="nm">{p[3] as string}</div>
            </div>
          ))}
        </div>
        <div className="cap">Survole une pile</div>
      </Bay>

      <Bay id="j11" n="11 — Cartel" title="Le Grail Wall comme un mur de musée" desc="Les pièces maîtresses sont encadrées (cadre doré, passe-partout), éclairées par une petite lampe, avec un cartel en laiton qui donne le nom et le set. Un vrai moment d'exposition.">
        <div className="wall">
          {[{ c: C.mcw, a: 'Michael Carter-Williams', b: '2013-14 · Panini · Rising Tide' }, { c: C.luwawu, a: 'Luwawu-Cabarrot', b: '2016-17 · Gold Standard · 038/149' }, { c: C.mccain, a: 'Jared McCain', b: '2024-25 · Contenders Optic' }].map(x => (
            <div className="art" key={x.a}>
              <div className="frame"><div className="mat">{/* eslint-disable-next-line @next/next/no-img-element */}<img className="card" src={x.c.img} alt="" /></div></div>
              <div className="plaque ink"><b className="sf">{x.a}</b>{x.b}</div>
            </div>
          ))}
        </div>
      </Bay>
    </div>
  )
}
