'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { TAG_BASE, numTier, numShort, mix, rgba } from '@/lib/cardTags'

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

/* serie 38 : ameliorer la visibilite des atouts et du tirage sur la vignette actuelle (prefixe vq-) */
.ix .vq-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; max-width: 900px; }
.ix .vq { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 7px 7px 0; min-width: 0; overflow: hidden; }
.ix .vq .ph { position: relative; overflow: hidden; } .ix .vq img.im { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .vq .bar { display: flex; height: 4px; margin: 8px -7px 0; } .ix .vq .bar > span { display: block; height: 100%; } .ix .vq .bar .tm { flex: 1; background: var(--tc, #2f8bff); } .ix .vq .bar .sg { flex: 0 0 38%; display: flex; } .ix .vq .bar .sg i { flex: 1; background: var(--k); }
.ix .vq .bar.big { height: 7px; }
.ix .vq .row2 { display: flex; justify-content: space-between; gap: 4px; padding: 6px 0 8px; align-items: flex-start; } .ix .vq .l { min-width: 0; flex: 1; } .ix .vq .r { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.ix .vq .nm { display: flex; align-items: center; gap: 6px; font: 400 19px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .vq .nm .t { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ix .vq .lg { width: 16px; height: 16px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
.ix .vq .vr { font: italic 600 10px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .vq .st { font: 500 10px system-ui; color: rgba(255,255,255,.62) !important; margin-top: 2px; }
.ix .vq .ic { display: inline-flex; gap: 6px; font-size: 14px; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
/* atouts */
.ix .vq .ats { min-height: 18px; margin-top: 5px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; }
.ix .a-ref { font: 900 10px/1.3 system-ui; letter-spacing: .12em; text-transform: uppercase; } .ix .a-ref i { font-style: normal; opacity: .4; margin: 0 4px; }
.ix .a-sqr { font: 900 12px/1.3 system-ui; letter-spacing: .1em; text-transform: uppercase; color: #fff !important; } .ix .a-sqr span { display: inline-flex; align-items: center; gap: 5px; } .ix .a-sqr span::before { content: ''; width: 9px; height: 9px; background: var(--k); }
.ix .a-blk span { font: 900 11px/1 system-ui; letter-spacing: .1em; text-transform: uppercase; padding: 4px 7px 3px; background: var(--b); color: var(--t) !important; }
.ix .a-ul { font: 900 12px/1.3 system-ui; letter-spacing: .1em; text-transform: uppercase; color: #fff !important; } .ix .a-ul span { border-bottom: 3px solid var(--k); padding-bottom: 2px; }
.ix .a-big { font: 900 13px/1.3 system-ui; letter-spacing: .08em; text-transform: uppercase; } .ix .a-big i { font-style: normal; opacity: .4; margin: 0 4px; }
/* tirage */
.ix .tir { margin-top: 3px; font-size: 25px; line-height: .9; color: var(--cc) !important; text-shadow: 0 0 12px var(--cg); }
.ix .tir.boxed { font-size: 19px; line-height: 1; padding: 4px 8px 2px; border: 2px solid var(--cc); background: rgba(5,9,18,.6); margin-top: 6px; text-shadow: none; box-shadow: 0 0 12px var(--cg); }
.ix .tir.gold { font-size: 19px; line-height: 1; padding: 4px 9px 2px; background: var(--cc); color: #1a1000 !important; margin-top: 6px; text-shadow: none; box-shadow: 0 0 14px var(--cg); }
.ix .tir.huge { font-size: 36px; text-shadow: 0 0 16px var(--cg); }
/* variantes de cadre */
.ix .vq.tint { background: linear-gradient(180deg, #0a1330 55%, var(--tt) 100%); }
.ix .vq .edge { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; display: flex; } .ix .vq .edge i { flex: 1; background: var(--k); }
.ix .vq .corner { position: absolute; right: 0; bottom: 0; padding: 4px 9px 2px; font-size: 18px; line-height: 1; background: var(--cc); color: #1a1000 !important; }
.ix .nmc { text-shadow: 0 0 12px var(--cg); }
/* telephone */
.ix .vq-ph { width: 300px; border: 4px solid #fff; background: #050912; padding: 10px; } .ix .vq-ph .vq-row { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } .ix .vq-ph .vq .nm { font-size: 15px; } .ix .vq-ph .a-ref, .ix .vq-ph .a-big, .ix .vq-ph .a-sqr, .ix .vq-ph .a-ul { font-size: 10px; } .ix .vq-ph .a-blk span { font-size: 9px; padding: 3px 5px 2px; } .ix .vq-ph .tir { font-size: 20px; } .ix .vq-ph .tir.boxed, .ix .vq-ph .tir.gold { font-size: 15px; }
@media (max-width: 800px) { .ix .vq-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', img: C.maxey.img, auto: true, patch: true, num: '/25', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Hersey Hawkins', v: 'Power Brokers', s: '2006-07 Topps Bowman', img: C.hawkins.img, patch: true, num: '/99', tm: 'PHI', tc: '#2f8bff' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', img: C.edwards.img, rc: true, auto: true, num: '1/1', tm: 'MIN', tc: '#4aa3df' },
]
type K = 'rc' | 'auto' | 'num' | 'patch'
const kinds = (c: PC) => ([c.rc && 'rc', c.auto && 'auto', c.patch && 'patch'].filter(Boolean) as K[])
const TIERC: Record<string, string> = { gold: '#ffd54a', silver: '#dfe6f2', bronze: '#e0925a' }
const TIERG: Record<string, string> = { gold: 'rgba(255,215,0,.55)', silver: 'rgba(220,230,245,.4)', bronze: 'rgba(224,146,90,.4)', std: 'rgba(108,151,255,.35)' }
const lite = (k: K) => mix(TAG_BASE[k], 0.5)
const short = (k: K) => (k === 'rc' ? 'RC' : k === 'auto' ? 'Auto' : k === 'patch' ? 'Patch' : 'Num')
const kv = (k: K): CSSProperties => ({ ['--k' as string]: TAG_BASE[k] } as CSSProperties)
const bt = (k: K): CSSProperties => ({ ['--b' as string]: TAG_BASE[k], ['--t' as string]: '#fff' } as CSSProperties)
const tv = (c: PC): CSSProperties => { const t = numTier(c.num); return { ['--cc' as string]: t === 'std' ? '#8fb4ff' : TIERC[t], ['--cg' as string]: TIERG[t] } as CSSProperties }
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>

type O = { ats?: 'ref' | 'big' | 'sqr' | 'blk' | 'ul'; tir?: 'text' | 'boxed' | 'gold' | 'huge' | 'corner'; bar?: 'team' | 'split'; nameTier?: boolean; tint?: boolean; edge?: boolean }
const Cell = ({ c, o }: { c: PC; o: O }) => {
  const ks = kinds(c); const ats = o.ats || 'ref'; const tir = o.tir || 'text'; const t = numTier(c.num)
  const topC = ks.length ? TAG_BASE[ks.includes('auto') ? 'auto' : ks.includes('patch') ? 'patch' : 'rc'] : 'transparent'
  const atsNode = ks.length ? (
    <div className={`ats a-${ats}`}>
      {ats === 'ref' || ats === 'big' ? ks.map((k, i) => <span key={k}>{i > 0 && <i>·</i>}<b style={{ color: lite(k), fontWeight: 'inherit' }}>{short(k)}</b></span>)
        : ats === 'blk' ? ks.map(k => <span key={k} style={bt(k)}>{short(k)}</span>)
        : ks.map(k => <span key={k} style={kv(k)}>{short(k)}</span>)}
    </div>
  ) : <div className="ats" />
  return (
    <div className={`vq${o.tint ? ' tint' : ''}`} style={o.tint ? ({ ['--tt' as string]: topC === 'transparent' ? '#0a1330' : rgba(topC, 0.22) } as CSSProperties) : undefined}>
      <div className="ph"><img className="im" src={c.img} alt="" />{tir === 'corner' && c.num && <div className="corner sq" style={tv(c)}>{numShort(c.num)}</div>}</div>
      <div className={`bar${o.bar === 'split' ? ' big' : ''}`} style={{ ['--tc' as string]: c.tc }}>
        <span className="tm" />{o.bar === 'split' && ks.length > 0 && <span className="sg">{ks.map(k => <i key={k} style={kv(k)} />)}</span>}
      </div>
      <div className="row2">
        <div className="l">
          <div className="nm"><img className="lg" src={`/team-logos/nba-${c.tm}.png`} alt="" /><span className={`t${o.nameTier && t !== 'std' ? ' nmc' : ''}`} style={o.nameTier && t !== 'std' ? ({ color: TIERC[t], ['--cg' as string]: TIERG[t] } as CSSProperties) : undefined}>{c.n}</span></div>
          {c.v && <div className="vr">{c.v}</div>}
          <div className="st">{c.s}</div>
          {atsNode}
        </div>
        <div className="r"><Ic />{c.num && tir !== 'corner' && <div className={`tir sq ${tir === 'text' ? '' : tir}`} style={tv(c)}>{numShort(c.num)}</div>}</div>
      </div>
      {o.edge && ks.length > 0 && <div className="edge">{ks.map(k => <i key={k} style={kv(k)} />)}</div>}
    </div>
  )
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="vq-row">{children}</div>

type Idea = { title: string; desc: string; o: O }
const IDEAS: Idea[] = [
  { title: 'Actuel (pour comparer)', desc: 'Ce qui est en ligne : atouts en capitales colorées de 10 px sous le set, tirage en Surfquest 25 px sous les icônes. Complet mais peu visible : le texte est petit et les couleurs pâles sur le fond bleu nuit.', o: {} },
  { title: 'Atouts en blocs pleins compacts + tirage en bloc doré plein', desc: 'Même place, mais les atouts deviennent de petits rectangles pleins de 11 px, couleur franche, texte blanc (angles droits, pas de pastille), et le tirage un bloc plein aux couleurs de la rareté, texte noir. Très visibles, sans toucher à l\'image ni à la hauteur.', o: { ats: 'blk', tir: 'gold' } },
  { title: 'Carrés de couleur + texte blanc 12 px, tirage encadré', desc: 'Les atouts passent en blanc gras 12 px avec un carré plein de 9 px devant chacun, et le tirage est dans un cadre de 2 px à la couleur de rareté avec fond sombre. Le texte blanc ressort beaucoup mieux que le texte coloré.', o: { ats: 'sqr', tir: 'boxed' } },
  { title: 'Barre sous l\'image partagée : équipe + segments d\'atouts', desc: 'La barre de couleur d\'équipe de 4 px devient une barre de 7 px : à gauche la couleur de l\'équipe, à droite un segment par atout (orange, vert, bleu). Aucune hauteur de texte en plus pour le code couleur ; les atouts restent écrits en 13 px blanc-teinté dessous.', o: { ats: 'big', bar: 'split' } },
  { title: 'Soulignement coloré épais + tirage géant (36 px)', desc: 'Atouts en blanc gras 12 px, chacun souligné de 3 px dans sa couleur, et un tirage en Surfquest 36 px sous les icônes, avec halo de rareté. On voit le tirage de loin, le texte est blanc donc très lisible.', o: { ats: 'ul', tir: 'huge' } },
  { title: 'Le nom prend la couleur de la rareté (or, argent, bronze)', desc: 'Pour les tirages rares (1/1, /10 et moins, /25 et moins), le nom du joueur lui-même devient doré, argenté ou bronze avec un léger halo, comme la pastille de numérotation du site. Ne coûte aucune place et repère les pièces d\'exception dans la grille.', o: { nameTier: true } },
  { title: 'Zone texte teintée par l\'atout principal', desc: 'Le bas de la vignette prend un dégradé de la couleur de l\'atout principal (vert pour un auto, bleu patch, orange RC) de 22 % d\'intensité, avec les atouts à 13 px. L\'ensemble de la vignette « sent » l\'atout sans ajouter d\'élément.', o: { tint: true, ats: 'big' } },
  { title: 'Tranche colorée sur le bord bas de la vignette', desc: 'Un trait de 5 px sur le bord inférieur de la vignette, découpé en un segment par atout. Zéro hauteur ajoutée (il est dans la marge), et cela fait un fil de couleur visible sur toute la grille. Atouts en blocs pleins.', o: { edge: true, ats: 'blk' } },
  { title: 'Petit cartouche du tirage collé au coin de l\'image', desc: 'Le tirage quitte les icônes pour un petit cartouche plein (18 px) collé au coin bas droit de l\'image, aux couleurs de la rareté, comme un numéro de série. Une seule petite surface sur la carte, bien moins qu\'un ruban, et le chiffre se voit même sans lire le texte.', o: { tir: 'corner', ats: 'sqr' } },
  { title: 'Combinaison complète', desc: 'Atouts en blocs pleins, barre partagée équipe + atouts, tirage encadré, nom coloré pour les tirages rares. Le plus lisible de tous, sans élément sur l\'image et sans hauteur en plus.', o: { ats: 'blk', bar: 'split', tir: 'boxed', nameTier: true } },
  { title: 'Combinaison discrète mais nette', desc: 'Carrés de couleur + texte blanc, tirage géant en couleur, tranche colorée dans la marge basse. Plus sobre que la précédente, tout en gardant les trois repères : carrés, chiffre, trait.', o: { ats: 'sqr', tir: 'huge', edge: true } },
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 38 · Rendre les atouts plus visibles</h1>
      <p className="lead">On part de la vignette actuelle en ligne (atouts sous le set, tirage en grand sous les icônes, rien sur la carte) et on cherche à la rendre plus visible sans la grandir : plus gros, texte blanc, fonds pleins, barre de couleur, rareté sur le nom, tranche colorée. Montré sur 4 cartes types avec insert (Fresh Paint, Power Brokers…), set, atouts et tirage.</p>
      <nav className="tags">{IDEAS.map((t, i) => <a key={t.title} href={`#i${i + 1}`}>{String(i + 1).padStart(2, '0')}</a>)}<a href="#i99">Mobile</a></nav>

      {IDEAS.map((d, i) => (
        <Bay key={d.title} id={`i${i + 1}`} n={String(i + 1).padStart(2, '0')} title={d.title} desc={d.desc}><Row>{PCS.map(c => <Cell key={c.n} c={c} o={d.o} />)}</Row></Bay>
      ))}

      <Bay id="i99" n="Mobile" title="Téléphone : les idées 02, 04 et 10 en 2 colonnes" desc="Trois des idées en vignettes de téléphone (2 colonnes) : blocs pleins + tirage doré, barre partagée, combinaison complète. Les tailles de texte descendent à 9-10 px mais les fonds pleins et la barre gardent la lecture."><div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {[1, 3, 9].map(i => <div key={i} className="vq-ph"><Row>{PCS.map(c => <Cell key={c.n} c={c} o={IDEAS[i].o} />)}</Row></div>)}
      </div></Bay>
    </div>
  )
}
