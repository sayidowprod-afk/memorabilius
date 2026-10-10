'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 26 : annuaire des collectionneurs (liste, tuiles, mobile). Tout le style est ici, prefixe .ix.

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

/* serie 26 : annuaire (prefixe an-) */
.ix .an-w { max-width: 940px; } .ix .an-cap { font: 700 11px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); margin: 0 0 8px; }
.ix .an-lg { display: inline-block; object-fit: contain; flex-shrink: 0; filter: brightness(0) invert(1); }
.ix .an-av { object-fit: cover; object-position: 50% 18%; flex-shrink: 0; display: block; }
.ix .an-tools { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; } .ix .an-in { flex: 1 1 200px; height: 40px; border: 2px solid #fff; background: transparent; color: #fff; padding: 0 12px; font: 600 14px system-ui; display: flex; align-items: center; color: rgba(255,255,255,.6); }
.ix .an-sel { flex: 0 1 190px; height: 40px; border: 2px solid #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font: 800 12px system-ui; letter-spacing: .1em; text-transform: uppercase; }
.ix .an-th, .ix .an-r { display: grid; align-items: center; column-gap: 10px; }
.ix .an-th { padding: 8px 12px; border-bottom: 2px solid #fff; font: 800 10px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.65); }
.ix .an-th .on { color: #fff; }
.ix .an-r { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.14); position: relative; }
.ix .an-r:hover { background: rgba(255,255,255,.07); }
.ix .an-nm { display: flex; align-items: center; gap: 10px; min-width: 0; } .ix .an-nm .p { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ix .an-lgs { display: inline-flex; gap: 6px; align-items: center; }
.ix .an-n { text-align: center; } .ix .an-n.sf { font-size: 22px; line-height: 1; } .ix .an-n.dim { color: rgba(255,255,255,.55); }
.ix .an-k { display: inline-block; min-width: 34px; padding: 3px 6px; text-align: center; font: 900 12px system-ui; border: 2px solid #fff; }
.ix .an-k.rc { border-color: #ff9a3c; color: #ff9a3c; } .ix .an-k.au { border-color: #4cd37b; color: #4cd37b; } .ix .an-k.nu { border-color: #c77dff; color: #c77dff; } .ix .an-k.pa { border-color: #5aa9ff; color: #5aa9ff; } .ix .an-k.to { background: #fff; color: #06122e; }
.ix .an-gold { color: #ffd54a !important; border-color: #ffd54a !important; }
.ix .an-tag { display: inline-block; border: 1.5px solid #ffd54a; color: #ffd54a; padding: 1px 6px; font: 800 9px system-ui; letter-spacing: .14em; text-transform: uppercase; }
/* 00 actuel */
.ix .an-old { background: #1e1e1e; border-radius: 12px; overflow: hidden; } .ix .an-old .an-r { border-bottom: 1px solid #2a2a2a; padding: 15px; } .ix .an-old .an-th { background: #252525; border-bottom: 2px solid #333; color: #999; padding: 16px 15px; }
.ix .an-old .bd { padding: 6px 12px; border-radius: 6px; font: 900 13px system-ui; display: inline-block; min-width: 40px; text-align: center; }
/* 02 geant */
.ix .an-big .an-r { padding: 14px 12px; } .ix .an-big .p { font-size: 40px; line-height: .95; } .ix .an-big .sf.t { font-size: 44px; line-height: .9; text-align: right; } .ix .an-big small { display: block; font: 700 9px system-ui; letter-spacing: .14em; color: rgba(255,255,255,.55); text-align: right; text-transform: uppercase; }
.ix .an-rk { font-size: 20px; color: rgba(255,255,255,.4); width: 34px; text-align: center; }
/* 03 podium */
.ix .an-pod { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 10px; align-items: end; margin-bottom: 14px; } .ix .an-pod > div { border: 3px solid #fff; padding: 14px; text-align: center; background: rgba(255,255,255,.04); }
.ix .an-pod .m { border-color: #ffd54a; background: rgba(255,213,74,.08); padding-top: 22px; padding-bottom: 22px; } .ix .an-pod .rk { font-size: 18px; color: rgba(255,255,255,.6); } .ix .an-pod .p { font-size: 28px; line-height: 1; margin: 8px 0 4px; word-break: break-word; } .ix .an-pod .m .p { font-size: 36px; } .ix .an-pod .t { font-size: 46px; line-height: 1; } .ix .an-pod .m .t { font-size: 62px; color: #ffd54a; }
/* 04 cartes membres */
.ix .an-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; } .ix .an-tile { border: 3px solid rgba(255,255,255,.85); padding: 12px; background: rgba(255,255,255,.03); }
.ix .an-tile .hd { display: flex; align-items: center; gap: 10px; } .ix .an-tile .p { font-size: 24px; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ix .an-st { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid rgba(255,255,255,.25); margin-top: 12px; padding-top: 10px; text-align: center; } .ix .an-st b { display: block; font-size: 20px; line-height: 1; font-weight: 400; } .ix .an-st i { font: 800 9px system-ui; letter-spacing: .12em; color: rgba(255,255,255,.55); font-style: normal; }
/* 05 barre */
.ix .an-bar { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(91,141,239,.34), rgba(91,141,239,.05)); border-right: 2px solid rgba(255,255,255,.6); z-index: 0; } .ix .an-r > *:not(.an-bar) { position: relative; z-index: 1; }
/* 07 apercu */
.ix .an-prev { display: inline-flex; gap: 4px; } .ix .an-prev img { width: 32px; height: 45px; object-fit: cover; display: block; }
/* 08 chips */
.ix .an-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; } .ix .an-chip { width: 44px; height: 44px; border: 2px solid rgba(255,255,255,.45); display: flex; align-items: center; justify-content: center; } .ix .an-chip.on { border-color: #fff; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 2px #08153b, inset 0 0 0 3.5px #fff; } .ix .an-chip.all { font: 800 10px system-ui; letter-spacing: .1em; width: auto; padding: 0 12px; }
/* 10 entete */
.ix .an-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; border-bottom: 3px solid #fff; padding-bottom: 12px; } .ix .an-hero .t { font-size: clamp(54px, 9vw, 96px); line-height: .85; } .ix .an-hero .c { text-align: right; } .ix .an-hero .c b { display: block; font-size: 48px; line-height: .9; font-weight: 400; } .ix .an-hero .c i { font: 800 10px system-ui; letter-spacing: .16em; font-style: normal; color: rgba(255,255,255,.6); text-transform: uppercase; }
.ix .an-search { height: 56px; border: 3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; display: flex; align-items: center; padding: 0 18px; font-size: 26px; color: rgba(255,255,255,.55); margin-bottom: 10px; }
/* 11 donateur */
.ix .an-d1 .p { color: #ffd54a; } .ix .an-d2 { border-left: 6px solid #ffd54a; background: linear-gradient(90deg, rgba(255,213,74,.14), transparent 60%); } .ix .an-d3 .av { box-shadow: 0 0 0 2px #08153b, 0 0 0 4px #ffd54a; }
.ix .holo { background: linear-gradient(90deg,#ff0080,#ff8c00,#ffee00,#00e676,#00b0ff,#e040fb,#ff0080); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent !important; }
/* mobile */
.ix .an-ph { width: 300px; border: 4px solid #fff; background: #050912; } .ix .an-ph .top { height: 46px; display: flex; align-items: center; padding: 0 12px; border-bottom: 1px solid rgba(255,255,255,.25); font-size: 17px; }
.ix .an-ph .pr { padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,.14); } .ix .an-ph .l1 { display: flex; align-items: center; gap: 8px; } .ix .an-ph .l1 .p { font-size: 22px; line-height: 1; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .an-ph .l2 { display: flex; gap: 5px; margin-top: 7px; padding-left: 44px; align-items: center; } .ix .an-ph .l2 .an-k { min-width: 0; padding: 2px 5px; font-size: 10px; flex: 1; }
.ix .an-ph .gr { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; } .ix .an-ph .gr .an-tile { padding: 8px; border-width: 2px; } .ix .an-ph .gr .p { font-size: 17px; } .ix .an-ph .gr .an-st b { font-size: 14px; } .ix .an-ph .gr .an-st i { font-size: 7px; letter-spacing: .05em; }
.ix .an-ph .an-chips { padding: 8px 10px 0; margin: 0; flex-wrap: nowrap; overflow: hidden; } .ix .an-ph .an-chip { width: 36px; height: 36px; flex-shrink: 0; }
@media (max-width: 700px) { .ix .an-pod { grid-template-columns: 1fr; } .ix .an-w { overflow-x: auto; } .ix .an-w > * { min-width: 560px; } .ix .an-ph { min-width: 0 !important; } }
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

type Mb = { n: string; a: string; t: string[]; tot: number; rc: number; au: number; nu: number; pa: number; d?: boolean; imgs: string[] }
const M: Mb[] = [
  { n: 'Gabriel_K', a: C.mccain.img, t: ['PHI', 'MIN', 'BOS'], tot: 2840, rc: 512, au: 301, nu: 644, pa: 188, d: true, imgs: [C.mccain.img, C.maxey.img, C.hawkins.img] },
  { n: 'Dunkmaster', a: C.edwards.img, t: ['MIN', 'LAL'], tot: 2113, rc: 390, au: 244, nu: 501, pa: 142, imgs: [C.edwards.img, C.luwawu.img, C.mcw.img] },
  { n: 'Sixers_Fan', a: C.maxey.img, t: ['PHI'], tot: 1760, rc: 301, au: 120, nu: 410, pa: 97, imgs: [C.maxey.img, C.mcw.img, C.mccain.img] },
  { n: 'Lucie', a: C.hawkins.img, t: ['BOS', 'NYK', 'MIA'], tot: 1402, rc: 210, au: 88, nu: 305, pa: 61, imgs: [C.hawkins.img, C.edwards.img, C.maxey.img] },
  { n: 'CardHunter', a: C.mcw.img, t: ['GSW', 'DEN'], tot: 987, rc: 150, au: 64, nu: 190, pa: 33, imgs: [C.mcw.img, C.luwawu.img, C.hawkins.img] },
  { n: 'Nico', a: C.luwawu.img, t: ['NYK'], tot: 640, rc: 80, au: 21, nu: 97, pa: 12, imgs: [C.luwawu.img, C.mccain.img, C.edwards.img] },
]
const TC: Record<string, string> = { PHI: '#2f8bff', MIN: '#4aa3df', BOS: '#1fb75a', LAL: '#fdb927', GSW: '#ffc72c', NYK: '#f58426', MIA: '#e03a5e', DEN: '#fec524' }
const fmt = (n: number) => n.toLocaleString('fr-FR')
const Lg = ({ t, s = 18 }: { t: string; s?: number }) => <img className="an-lg" src={`/team-logos/nba-${t}.png`} width={s} height={s} alt={t} />
const Lgs = ({ m, s = 18, max = 3 }: { m: Mb; s?: number; max?: number }) => <span className="an-lgs">{m.t.slice(0, max).map(t => <Lg key={t} t={t} s={s} />)}</span>
const Av = ({ m, s = 40, round }: { m: Mb; s?: number; round?: boolean }) => <img className="an-av av" src={m.a} width={s} height={s} style={{ width: s, height: s, borderRadius: round ? '50%' : 0 }} alt="" />
const Tools = () => (
  <div className="an-tools"><div className="an-in">Rechercher un collectionneur…</div><div className="an-sel">Toutes les teams <span>▾</span></div><div className="an-sel">Équipes favorites <span>▾</span></div></div>
)
const Th = ({ cols, labels, on = 1 }: { cols: string; labels: string[]; on?: number }) => (
  <div className="an-th" style={{ gridTemplateColumns: cols }}>{labels.map((l, i) => <span key={l + i} className={i === on ? 'on' : ''} style={{ textAlign: i === 0 ? 'left' : 'center' }}>{l}{i === on ? ' ↓' : ''}</span>)}</div>
)
const COLS = '1fr 70px 56px 56px 56px 56px'

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Tableau DA', 'Pseudo géant', 'Podium + liste', 'Cartes membres', 'Barre de total', 'Aperçu cartes', 'Logos en filtre', 'Liseré équipe', 'En-tête & recherche', 'Donateurs', 'Mobile liste', 'Mobile cartes']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 26 · Annuaire</h1>
      <p className="lead">La page des collectionneurs avec la nouvelle DA : pseudo en gros en Surfquest, chiffres en Surfquest, logos d&apos;équipes réduits, angles droits et filets blancs. Toutes les options actuelles sont conservées : recherche, filtre team, filtre équipe favorite, tri par colonne, aperçu au survol, badge donateur. Chaque version est aussi pensée pour le téléphone.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="00" title="Aujourd'hui, pour comparer" desc="Tableau clair à coins arrondis : avatar rond, pseudo en petit, logos d'équipes de 26 px, pastilles de couleur arrondies. Aucun lien avec la DA du reste du site."><div className="an-w"><div className="an-old">
        <Th cols={COLS} labels={['COLLECTIONNEUR', 'TOTAL', 'RC', 'AUTO', '# NUM', 'PATCH']} />
        {M.slice(0, 4).map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS }}><div className="an-nm"><Av m={m} s={42} round /><b style={{ fontSize: 14 }}>{m.n}</b><Lgs m={m} s={26} /></div>{[[m.tot, '#333', '#eee'], [m.rc, '#e67e22', '#fff'], [m.au, '#2e7d32', '#fff'], [m.nu, '#7b1fa2', '#fff'], [m.pa, '#1976d2', '#fff']].map(([v, b, c], i) => <span key={i} className="an-n"><span className="bd" style={{ background: b as string, color: c as string }}>{v as number}</span></span>)}</div>)}
      </div></div></Bay>

      <Bay id="s2" n="01" title="Tableau DA : pseudo en Surfquest, logos de 16 px, chiffres en Surfquest" desc="Même structure et mêmes colonnes triables, mais en angles droits : avatar carré, pseudo en Surfquest 26 px, logos d'équipes réduits à 16 px, filets fins. Les chiffres passent en Surfquest ; le total est en blanc, les autres colonnes gardent leur couleur."><div className="an-w">
        <Tools /><Th cols={COLS} labels={['Collectionneur', 'Total', 'RC', 'Auto', '# Num', 'Patch']} />
        {M.map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS }}><div className="an-nm"><Av m={m} s={40} /><span className="p sf" style={{ fontSize: 26 }}>{m.n}</span><Lgs m={m} s={16} />{m.d && <span className="an-tag">Soutien</span>}</div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf" style={{ color: '#ff9a3c' }}>{m.rc}</span><span className="an-n sf" style={{ color: '#4cd37b' }}>{m.au}</span><span className="an-n sf" style={{ color: '#c77dff' }}>{m.nu}</span><span className="an-n sf" style={{ color: '#5aa9ff' }}>{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s3" n="02" title="Pseudo géant : le nom est la star, le total en très gros" desc="Le pseudo passe à 40 px en Surfquest, avec un rang à gauche. Le total est énorme à droite (comme le compteur de l'accueil), les autres stats deviennent de simples pastilles à filet sous le nom. Moins de colonnes, beaucoup plus lisible."><div className="an-w">
        <Tools />
        {M.slice(0, 5).map((m, i) => <div key={m.n} className="an-r an-big" style={{ gridTemplateColumns: '34px 1fr 150px' }}><span className="an-rk sf">{i + 1}</span><div><div className="an-nm"><Av m={m} s={48} /><div style={{ minWidth: 0 }}><div className="p sf">{m.n}</div><div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}><Lgs m={m} s={16} /><span className="an-k rc">RC {m.rc}</span><span className="an-k au">AUTO {m.au}</span><span className="an-k nu">NUM {m.nu}</span><span className="an-k pa">PATCH {m.pa}</span></div></div></div></div><div><div className="sf t">{fmt(m.tot)}</div><small>cartes</small></div></div>)}
      </div></Bay>

      <Bay id="s4" n="03" title="Podium + liste : les 3 plus gros collectionneurs en tête" desc="Quand le tri est « Total », les trois premiers sortent en blocs à double filet (le n°1 en or, plus grand), puis la liste continue en dessous. Un peu de gamification sans changer le contenu."><div className="an-w">
        <div className="an-pod">{[M[1], M[0], M[2]].map((m, i) => <div key={m.n} className={i === 1 ? 'm' : ''}><div className="rk sf">{i === 1 ? '1er' : i === 0 ? '2e' : '3e'}</div><Av m={m} s={i === 1 ? 72 : 56} round /><div className="p sf">{m.n}</div><Lgs m={m} s={16} /><div className="t sf" style={{ marginTop: 8 }}>{fmt(m.tot)}</div></div>)}</div>
        <Th cols={COLS} labels={['Collectionneur', 'Total', 'RC', 'Auto', '# Num', 'Patch']} />
        {M.slice(3).map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS }}><div className="an-nm"><Av m={m} s={36} /><span className="p sf" style={{ fontSize: 22 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n dim sf">{m.rc}</span><span className="an-n dim sf">{m.au}</span><span className="an-n dim sf">{m.nu}</span><span className="an-n dim sf">{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s5" n="04" title="Cartes membres : une tuile par collectionneur" desc="Une grille de tuiles à filet blanc : avatar, pseudo en Surfquest, logos réduits, puis 4 chiffres (Total, RC, Auto, Num). Le tri devient un segment au-dessus de la grille. Très bien sur téléphone en 2 colonnes (voir 12)."><div className="an-w">
        <div className="an-tools"><div className="an-in">Rechercher…</div><div className="an-sel">Toutes les teams ▾</div><div className="an-sel">Trier : Total ↓</div></div>
        <div className="an-grid">{M.map(m => <div key={m.n} className="an-tile"><div className="hd"><Av m={m} s={46} /><div style={{ minWidth: 0 }}><div className="p sf">{m.n}</div><Lgs m={m} s={16} /></div></div><div className="an-st"><div><b className="sf">{fmt(m.tot)}</b><i>TOTAL</i></div><div><b className="sf" style={{ color: '#ff9a3c' }}>{m.rc}</b><i>RC</i></div><div><b className="sf" style={{ color: '#4cd37b' }}>{m.au}</b><i>AUTO</i></div><div><b className="sf" style={{ color: '#c77dff' }}>{m.nu}</b><i>NUM</i></div></div></div>)}</div>
      </div></Bay>

      <Bay id="s6" n="05" title="Barre de total : chaque ligne montre sa taille en un coup d'œil" desc="Derrière chaque ligne, une barre bleue proportionnelle au total (relative au plus gros collectionneur) avec un trait blanc au bout. On voit tout de suite les écarts sans lire les nombres."><div className="an-w">
        <Th cols="1fr 80px 52px 52px 52px 52px" labels={['Collectionneur', 'Total', 'RC', 'Auto', 'Num', 'Patch']} />
        {M.map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: '1fr 80px 52px 52px 52px 52px' }}><span className="an-bar" style={{ width: `${(m.tot / M[0].tot) * 100}%` }} /><div className="an-nm"><Av m={m} s={36} /><span className="p sf" style={{ fontSize: 24 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf">{m.rc}</span><span className="an-n sf">{m.au}</span><span className="an-n sf">{m.nu}</span><span className="an-n sf">{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s7" n="06" title="Aperçu des cartes dans la ligne (plus besoin du survol)" desc="Aujourd'hui l'aperçu de 3 cartes n'apparaît qu'au survol, donc jamais sur téléphone. Ici les 3 mini-cartes sont affichées à droite du pseudo (masquées sur petit écran). Le popup au survol reste possible pour les agrandir."><div className="an-w">
        <Th cols="1fr 130px 70px 56px 56px" labels={['Collectionneur', 'Dernières cartes', 'Total', 'RC', 'Auto']} on={2} />
        {M.slice(0, 5).map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: '1fr 130px 70px 56px 56px', paddingTop: 8, paddingBottom: 8 }}><div className="an-nm"><Av m={m} s={40} /><span className="p sf" style={{ fontSize: 26 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-prev">{m.imgs.map((s, i) => <img key={i} src={s} alt="" />)}</span><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf" style={{ color: '#ff9a3c' }}>{m.rc}</span><span className="an-n sf" style={{ color: '#4cd37b' }}>{m.au}</span></div>)}
      </div></Bay>

      <Bay id="s8" n="07" title="Logos d'équipes cliquables à la place du menu « équipe favorite »" desc="Le menu déroulant « Toutes les équipes NBA/NFL… » est remplacé par une rangée de logos carrés (44 px) : un clic filtre, le logo actif reçoit le double filet. « Tous » remet à zéro. Plus visuel et plus rapide, le menu reste accessible via « + »."><div className="an-w">
        <div className="an-tools"><div className="an-in">Rechercher un collectionneur…</div><div className="an-sel">Toutes les teams ▾</div></div>
        <div className="an-chips"><span className="an-chip all">TOUS</span>{['PHI', 'BOS', 'LAL', 'MIN', 'GSW', 'NYK', 'MIA', 'DEN'].map((t, i) => <span key={t} className={`an-chip${i === 0 ? ' on' : ''}`}><Lg t={t} s={26} /></span>)}<span className="an-chip all">+ 94</span></div>
        {M.slice(0, 3).map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS }}><div className="an-nm"><Av m={m} s={40} /><span className="p sf" style={{ fontSize: 26 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf">{m.rc}</span><span className="an-n sf">{m.au}</span><span className="an-n sf">{m.nu}</span><span className="an-n sf">{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s9" n="08" title="Liseré de la couleur de l'équipe favorite" desc="Chaque ligne reçoit un liseré de 6 px et un léger dégradé dans la couleur de sa première équipe favorite (même logique que le visualiseur de cartes). Le logo suit, réduit. Ça donne de la vie sans alourdir."><div className="an-w">
        {M.map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS, borderLeft: `6px solid ${TC[m.t[0]]}`, background: `linear-gradient(90deg, ${TC[m.t[0]]}26, transparent 55%)` }}><div className="an-nm"><Av m={m} s={40} /><span className="p sf" style={{ fontSize: 26 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf">{m.rc}</span><span className="an-n sf">{m.au}</span><span className="an-n sf">{m.nu}</span><span className="an-n sf">{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s10" n="09" title="En-tête géant, compteur et recherche à double filet" desc="Le titre « Annuaire » passe en Surfquest énorme avec le nombre de collectionneurs à droite, comme les compteurs de l'accueil. La recherche devient une grande barre à double filet ; les deux menus restent dessous en carrés."><div className="an-w">
        <div className="an-hero"><div className="t sf">Annuaire</div><div className="c"><b className="sf">1 284</b><i>collectionneurs</i></div></div>
        <div className="an-search sf">Rechercher un pseudo…</div>
        <div className="an-tools"><div className="an-sel">Toutes les teams ▾</div><div className="an-sel">Équipes favorites ▾</div><div className="an-sel">Trier : Total ↓</div></div>
        {M.slice(0, 2).map(m => <div key={m.n} className="an-r" style={{ gridTemplateColumns: COLS }}><div className="an-nm"><Av m={m} s={40} /><span className="p sf" style={{ fontSize: 26 }}>{m.n}</span><Lgs m={m} s={16} /></div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf">{m.rc}</span><span className="an-n sf">{m.au}</span><span className="an-n sf">{m.nu}</span><span className="an-n sf">{m.pa}</span></div>)}
      </div></Bay>

      <Bay id="s11" n="10" title="Donateurs : trois façons de les distinguer" desc="Aujourd'hui : pseudo arc-en-ciel animé et une tasse ☕. Ici : A) pseudo doré + étiquette « Soutien », B) liseré et fond doré sur la ligne, C) avatar cerclé d'or. L'arc-en-ciel reste possible, c'est une option."><div className="an-w">
        {[['A', 'an-d1'], ['B', 'an-d2'], ['C', 'an-d3']].map(([k, c]) => { const m = M[0]; return <div key={k} className={`an-r ${c}`} style={{ gridTemplateColumns: COLS }}><div className="an-nm"><span className="sf" style={{ color: 'rgba(255,255,255,.5)', width: 14 }}>{k}</span><Av m={m} s={40} /><span className="p sf holo" style={{ fontSize: 26, ...(k === 'A' ? {} : {}) }}>{m.n}</span><Lgs m={m} s={16} />{k === 'A' && <span className="an-tag">Soutien</span>}{k !== 'A' && <span style={{ color: '#ffd54a' }}>☕</span>}</div><span className="an-n sf">{fmt(m.tot)}</span><span className="an-n sf">{m.rc}</span><span className="an-n sf">{m.au}</span><span className="an-n sf">{m.nu}</span><span className="an-n sf">{m.pa}</span></div> })}
        <div className="an-cap" style={{ marginTop: 10 }}>(pseudo en arc-en-ciel conservé ici ; en doré uni il suffirait de retirer le dégradé)</div>
      </div></Bay>

      <Bay id="s12" n="11" title="Téléphone : liste sur 2 lignes" desc="Sur mobile le tableau à 6 colonnes est trop serré. Chaque membre prend 2 lignes : avatar, pseudo en Surfquest 22 px et total à droite ; dessous, les 4 chiffres (RC, Auto, Num, Patch) en petites pastilles à filet de couleur, et les logos réduits."><div className="an-ph">
        <div className="top sf">Annuaire</div>
        <div className="an-chips"><span className="an-chip all" style={{ height: 36 }}>TOUS</span>{['PHI', 'BOS', 'LAL', 'MIN'].map((t, i) => <span key={t} className={`an-chip${i === 0 ? ' on' : ''}`}><Lg t={t} s={20} /></span>)}</div>
        {M.slice(0, 4).map(m => <div key={m.n} className="pr"><div className="l1"><Av m={m} s={36} /><span className="p sf">{m.n}</span><Lgs m={m} s={14} max={2} /><span className="sf" style={{ fontSize: 22 }}>{fmt(m.tot)}</span></div><div className="l2"><span className="an-k rc">RC {m.rc}</span><span className="an-k au">A {m.au}</span><span className="an-k nu">N {m.nu}</span><span className="an-k pa">P {m.pa}</span></div></div>)}
      </div></Bay>

      <Bay id="s13" n="12" title="Téléphone : tuiles sur 2 colonnes" desc="La version 04 en 2 colonnes : avatar, pseudo, logos, puis 4 chiffres. Le tri passe dans un bouton carré à côté de la recherche. Plus de profils visibles d'un coup d'œil, les stats restent lisibles."><div className="an-ph">
        <div className="top sf">Annuaire</div>
        <div className="an-tools" style={{ padding: '10px 10px 0', marginBottom: 0 }}><div className="an-in" style={{ height: 34, fontSize: 12, flexBasis: 150 }}>Rechercher…</div><div className="an-sel" style={{ height: 34, flex: '0 0 44px', padding: 0, justifyContent: 'center' }}>⇅</div></div>
        <div className="gr">{M.slice(0, 4).map(m => <div key={m.n} className="an-tile"><div className="hd"><Av m={m} s={30} /><div style={{ minWidth: 0 }}><div className="p sf">{m.n}</div><Lgs m={m} s={12} max={2} /></div></div><div className="an-st" style={{ marginTop: 8, paddingTop: 6 }}><div><b className="sf">{m.tot > 999 ? (m.tot / 1000).toFixed(1) + 'k' : m.tot}</b><i>TOT</i></div><div><b className="sf" style={{ color: '#ff9a3c' }}>{m.rc}</b><i>RC</i></div><div><b className="sf" style={{ color: '#4cd37b' }}>{m.au}</b><i>AUT</i></div><div><b className="sf" style={{ color: '#c77dff' }}>{m.nu}</b><i>NUM</i></div></div></div>)}</div>
      </div></Bay>
    </div>
  )
}
