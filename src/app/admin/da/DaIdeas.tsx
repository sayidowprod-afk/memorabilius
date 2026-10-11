'use client'
import React from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { TAG_BASE, numTier, numShort, mix } from '@/lib/cardTags'

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

/* serie 41 : bandeau d'atouts plus beau, remplissage sans atout, degrade du bas (prefixe v4-) */
.ix .v4-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; max-width: 1000px; }
.ix .v4 { position: relative; background: #0a1330; border: 1px solid rgba(140,170,255,.35); padding: 8px 8px 0; min-width: 0; }
.ix .v4 .ph img { display: block; width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; }
.ix .v4 .bar { height: 4px; margin: 6px -8px 0; background: var(--tc); }
.ix .v4 .bt { position: relative; margin: 0 -8px; padding: 7px 8px 9px; text-align: center; background: var(--bg-b, none); box-shadow: var(--bs-b, none); border-bottom: var(--bb-b, 0); }
.ix .v4 .nm { display: flex; align-items: center; justify-content: center; gap: 5px; font: 400 17px/1 'Surfquest', Impact, sans-serif; text-transform: uppercase; letter-spacing: .02em; } .ix .v4 .nm img { width: 15px; height: 15px; object-fit: contain; filter: brightness(0) invert(1); flex-shrink: 0; }
.ix .v4 .vr { font: italic 600 10px system-ui; color: #5aa9ff !important; margin-top: 3px; } .ix .v4 .st { font: 500 10px system-ui; color: rgba(255,255,255,.7) !important; margin-top: 2px; padding: 0 30px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ix .v4 .ic { position: absolute; right: 7px; bottom: 5px; display: inline-flex; gap: 5px; font-size: 13px; }
.ix .sq { font-family: 'Surfquest', Impact, sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; }
/* bandeau */
.ix .gs { display: flex; gap: 2px; height: 17px; margin: 0 0 6px; }
.ix .gs .s { flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; font: 800 10px/1 system-ui; letter-spacing: .16em; text-transform: uppercase; color: var(--t) !important; white-space: nowrap; overflow: hidden; background: var(--g); box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 0 -1px 0 rgba(0,0,0,.28); text-shadow: 0 1px 1px rgba(0,0,0,.35); }
.ix .gs.sv-1 { }
.ix .gs.sv-2 { height: 14px; } .ix .gs.sv-2 .s { font-size: 8.5px; background: var(--c); box-shadow: none; text-shadow: none; letter-spacing: .18em; }
.ix .gs.sv-3 { gap: 0; } .ix .gs.sv-3 .s { background: var(--c); box-shadow: none; text-shadow: none; clip-path: polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%); margin-left: -3px; } .ix .gs.sv-3 .s:first-child { margin-left: 0; clip-path: polygon(0 0, 100% 0, calc(100% - 7px) 100%, 0 100%); }
.ix .gs.sv-4 .s { background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--l) !important; border-top: 2px solid var(--c); box-shadow: none; text-shadow: none; }
.ix .gs.sv-5 .s { background: var(--c); box-shadow: inset 0 0 0 1px rgba(255,255,255,.4), inset 0 0 0 2px rgba(0,0,0,.18); text-shadow: none; }
.ix .gs.sv-6 .s { background: #fff; color: #06122e !important; border-bottom: 3px solid var(--c); box-shadow: none; text-shadow: none; }
.ix .gs.sv-7 .s { background: rgba(5,9,18,.88); color: #fff !important; box-shadow: inset 4px 0 0 var(--c), inset 0 0 0 1px rgba(255,255,255,.14); text-shadow: none; padding-left: 4px; }
.ix .gs.sv-8 .s { background: var(--c); box-shadow: none; text-shadow: none; clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 0 100%, 0 4px); }
.ix .gs.sv-9 { gap: 0; } .ix .gs.sv-9 .s { background: var(--c); box-shadow: none; text-shadow: none; border-right: 1px solid rgba(255,255,255,.5); } .ix .gs.sv-9 .s:last-child { border-right: 0; }
.ix .gs.sv-10 { height: 13px; } .ix .gs.sv-10 .s { font-size: 8px; letter-spacing: .22em; background: color-mix(in srgb, var(--c) 88%, #0a1330); box-shadow: inset 0 -2px 0 rgba(0,0,0,.25); text-shadow: none; }
/* remplissage sans atout */
.ix .gs .ghost { background: rgba(255,255,255,.06); color: rgba(255,255,255,.55) !important; letter-spacing: .22em; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); text-shadow: none; }
.ix .gs .team { background: linear-gradient(90deg, color-mix(in srgb, var(--tc) 55%, transparent), transparent 85%); color: rgba(255,255,255,.8) !important; letter-spacing: .2em; justify-content: flex-start; padding-left: 8px; box-shadow: none; text-shadow: none; }
.ix .gs .stripe { background: repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 3px, transparent 3px 7px); box-shadow: inset 0 0 0 1px rgba(255,255,255,.1); text-shadow: none; }
.ix .gs .insert { background: color-mix(in srgb, #5aa9ff 16%, transparent); color: #7fb8ff !important; letter-spacing: .14em; font-style: italic; box-shadow: inset 0 0 0 1px rgba(90,169,255,.3); text-shadow: none; }
.ix .gs.none { height: 0; margin: 0; }
/* degrades du bas */
.ix .b1 { --bg-b: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 30%, transparent) 100%); }
.ix .b2 { --bg-b: linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--gt) 22%, transparent) 100%); --bb-b: 2px solid var(--gt); }
.ix .b3 { --bs-b: inset 0 -18px 18px -14px color-mix(in srgb, var(--gt) 55%, transparent); }
.ix .b4 { --bg-b: linear-gradient(160deg, transparent 35%, color-mix(in srgb, var(--gt) 28%, transparent) 100%); }
.ix .b5 { border-image: linear-gradient(180deg, rgba(140,170,255,.35) 35%, var(--gt) 100%) 1; } .ix .b5 .bar { background: transparent; }
.ix .b6 { --bg-b: radial-gradient(ellipse 85% 70% at 50% 45%, color-mix(in srgb, var(--gt) 28%, transparent), transparent 75%); }
.ix .b7 { background: linear-gradient(180deg, #0a1330 52%, color-mix(in srgb, var(--gt) 24%, #0a1330) 100%); }
.ix .b8 { background: linear-gradient(180deg, #0a1330 40%, color-mix(in srgb, var(--gt) 20%, #0a1330) 100%); } .ix .b8 .bar { order: 9; position: absolute; left: 0; right: 0; bottom: 0; margin: 0; height: 4px; }
/* D : style de la barre defilante de l'accueil (police grasse espacee, etoiles, mouvement) */
@keyframes mq41 { to { transform: translateX(-50%); } }
@keyframes tw41 { 0%, 100% { opacity: .35; transform: scale(.8); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes gl41 { 0% { transform: translateX(-120%); } 55%, 100% { transform: translateX(260%); } }
.ix .gs.mqs { overflow: hidden; align-items: center; background: var(--mb, #003DA6); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), inset 0 -1px 0 rgba(0,0,0,.3); }
.ix .gs.mqs.slim { height: 14px; }
.ix .mq { display: flex; width: max-content; animation: mq41 var(--d, 11s) linear infinite; }
.ix .mq > span { display: flex; align-items: center; white-space: nowrap; font: 900 10px/1 system-ui; letter-spacing: .16em; text-transform: uppercase; color: #fff; padding-right: 0; }
.ix .gs.slim .mq > span { font-size: 8.5px; }
.ix .mq b { font-weight: 900; } .ix .mq i { font-style: normal; margin: 0 9px; font-size: 10px; color: #fff; }
.ix .gs.sv-star .s { gap: 6px; } .ix .gs.sv-star .s::before, .ix .gs.sv-star .s::after { content: '✦'; font-size: 8px; animation: tw41 2.4s ease-in-out infinite; } .ix .gs.sv-star .s::after { animation-delay: 1.2s; }
.ix .gs.sv-glint .s { position: relative; overflow: hidden; } .ix .gs.sv-glint .s::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: 0; background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent); transform: translateX(-120%); animation: gl41 3.6s ease-in-out infinite; } .ix .gs.sv-glint .s:nth-child(2)::after { animation-delay: .35s; } .ix .gs.sv-glint .s:nth-child(3)::after { animation-delay: .7s; } .ix .gs.sv-glint .s:nth-child(4)::after { animation-delay: 1.05s; }
@media (prefers-reduced-motion: reduce) { .ix .mq, .ix .gs.sv-star .s::before, .ix .gs.sv-star .s::after, .ix .gs.sv-glint .s::after { animation: none; } }
/* E : chaque atout est sa propre barre defilante (vitesses et sens independants) ; infos qui defilent pour les cartes sans atout */
.ix .gs.sgs { gap: 2px; } .ix .gs.sgs.slim { height: 14px; }
.ix .sgm { flex: 1 1 0; min-width: 0; overflow: hidden; display: flex; align-items: center; background: var(--g); box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 0 -1px 0 rgba(0,0,0,.28); }
.ix .sgm.flat { background: var(--c); box-shadow: none; }
.ix .sgm.blue { background: var(--mb, #003DA6); }
.ix .sgm .mq { animation-duration: var(--d, 8s); animation-direction: var(--dir, normal); }
.ix .sgm .mq > span { color: var(--t); text-shadow: 0 1px 1px rgba(0,0,0,.3); }
.ix .sgm.blue .mq > span { color: #fff; } .ix .sgm.blue .mq b { color: var(--l); }
.ix .sgm .mq i { margin: 0 7px; }
.ix .sgm.fixed { position: relative; } .ix .sgm.fixed .lab { position: absolute; left: 0; top: 0; bottom: 0; z-index: 2; display: flex; align-items: center; padding: 0 7px 0 6px; background: var(--c); font: 900 10px/1 system-ui; letter-spacing: .14em; text-transform: uppercase; color: var(--t); box-shadow: 6px 0 6px -2px rgba(0,0,0,.35); } .ix .sgm.fixed .mq { margin-left: 30px; }
.ix .stk { position: absolute; left: 0; right: 0; top: 0; z-index: 3; display: flex; flex-direction: column; gap: 1px; } .ix .stk .sgm { height: 12px; }
.ix .stk .mq > span { font-size: 8.5px; }
.ix .gs.mqs.info { background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); } .ix .gs.mqs.info .mq > span { color: rgba(255,255,255,.78); } .ix .gs.mqs.info .mq i { color: rgba(255,255,255,.5); }
.ix .gs.mqs.infob { background: color-mix(in srgb, #003DA6 70%, #0a1330); }
@media (max-width: 900px) { .ix .v4-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
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

type PC = { n: string; v?: string; s: string; img: string; y: string; br: string; no?: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string; tm: string; tc: string; ab: string }
const PCS: PC[] = [
  { n: 'Jared McCain', v: 'Team Card', s: '2010-11 Panini Donruss', y: '2010-11', br: 'Panini Donruss', no: '#64', img: C.mccain.img, rc: true, tm: 'PHI', tc: '#2f8bff', ab: 'PHI' },
  { n: 'Anthony Edwards', v: 'Silver Prizm', s: '2023-24 Panini Prizm', y: '2023-24', br: 'Panini Prizm', no: '#12', img: C.edwards.img, rc: true, auto: true, tm: 'MIN', tc: '#4aa3df', ab: 'MIN' },
  { n: 'Hersey Hawkins', v: 'Power Brokers', s: '2006-07 Topps Bowman', y: '2006-07', br: 'Topps Bowman', no: '#33', img: C.hawkins.img, patch: true, auto: true, num: '/35', tm: 'BOS', tc: '#1fb75a', ab: 'BOS' },
  { n: 'Tyrese Maxey', v: 'Fresh Paint', s: '2024-25 Court Kings', y: '2024-25', br: 'Court Kings', no: '#FP-TM', img: C.maxey.img, rc: true, auto: true, patch: true, num: '/25', tm: 'LAL', tc: '#fdb927', ab: 'LAL' },
  { n: 'Luwawu-Cabarrot', v: 'Gold Standard', s: '2023-24 Panini Select', y: '2023-24', br: 'Panini Select', no: '#5', img: C.luwawu.img, tm: 'DEN', tc: '#fec524', ab: 'DEN' },
]
type K = 'rc' | 'patch' | 'auto' | 'num'
const TIERC: Record<string, string> = { gold: '#ffd54a', silver: '#dfe6f2' }
const segsOf = (c: PC) => {
  const out: { k: K; t: string; c: string; dark?: boolean }[] = []
  if (c.rc) out.push({ k: 'rc', t: 'RC', c: TAG_BASE.rc })
  if (c.patch) out.push({ k: 'patch', t: 'Patch', c: TAG_BASE.patch })
  if (c.auto) out.push({ k: 'auto', t: 'Auto', c: TAG_BASE.auto })
  if (c.num) { const t = numTier(c.num); out.push({ k: 'num', t: numShort(c.num), c: t === 'gold' ? '#ffd54a' : t === 'silver' ? '#dfe6f2' : TAG_BASE.num, dark: t === 'gold' || t === 'silver' }) }
  return out
}
const gradOf = (c: string) => `linear-gradient(180deg, ${mix(c, 0.22)} 0%, ${c} 55%, ${mix(c, -0.22)} 100%)`
const segStyle = (s: { c: string; dark?: boolean }): CSSProperties => ({ ['--c' as string]: s.c, ['--g' as string]: gradOf(s.c), ['--l' as string]: mix(s.c, 0.55), ['--t' as string]: s.dark ? '#1a1000' : '#fff' } as CSSProperties)
const Ic = () => <span className="ic"><i>💬</i><i>🤍</i></span>

type Fill = 'year' | 'brand' | 'num' | 'team' | 'sport' | 'stripe' | 'insert' | 'none'
const fillNode = (c: PC, f: Fill): React.ReactNode => {
  if (f === 'none') return null
  if (f === 'stripe') return <span className="s stripe" />
  if (f === 'team') return <span className="s team" style={{ ['--tc' as string]: c.tc } as CSSProperties}>{c.ab} · Basketball</span>
  const t = f === 'year' ? c.y : f === 'brand' ? c.br : f === 'num' ? c.no : f === 'sport' ? 'Basketball' : c.v
  return <span className={`s ${f === 'insert' ? 'insert' : 'ghost'}`}>{t}</span>
}
const Cell = ({ c, sv = 1, fill = 'year', b = 1, strip, svc, over, below }: { c: PC; sv?: number; fill?: Fill; b?: number; strip?: React.ReactNode; svc?: string; over?: React.ReactNode; below?: boolean }) => {
  const segs = segsOf(c)
  return (
    <div className={`v4 b${b}`} style={{ ['--gt' as string]: c.tc, ['--tc' as string]: c.tc } as CSSProperties}>
      {!below && (strip ?? (
        <div className={`gs sv-${sv}${svc ? ' ' + svc : ''}${!segs.length && fill === 'none' ? ' none' : ''}`}>
          {segs.length ? segs.map(s => <span key={s.k} className="s" style={segStyle(s)}>{s.t}</span>) : fillNode(c, fill)}
        </div>
      ))}
      <div className="ph" style={{ position: 'relative' }}><img src={c.img} alt="" />{over}</div>
      {below && <div style={{ height: 6 }} />}
      {below && strip}
      <div className="bar" />
      <div className="bt"><div className="nm"><img src={`/team-logos/nba-${c.tm}.png`} alt="" /><span>{c.n}</span></div>{c.v && <div className="vr">{c.v}</div>}<div className="st">{c.s}</div><Ic /></div>
    </div>
  )
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="v4-row">{children}</div>

const Mq = ({ c, slim, team, color }: { c: PC; slim?: boolean; team?: boolean; color?: boolean }) => {
  const segs = segsOf(c)
  if (!segs.length) return <div className="gs"><span className="s ghost">{c.y}</span></div>
  const unit = (
    <span>
      {[0, 1, 2].map(r => (
        <React.Fragment key={r}>
          {segs.map(s => <React.Fragment key={s.k}><b style={color ? { color: mix(s.c, 0.45) } : undefined}>{s.t}</b><i>✦</i></React.Fragment>)}
        </React.Fragment>
      ))}
    </span>
  )
  return (
    <div className={`gs mqs${slim ? ' slim' : ''}`} style={team ? ({ ['--mb' as string]: `color-mix(in srgb, ${c.tc} 60%, #0a1330)` } as CSSProperties) : undefined}>
      <div className="mq" style={{ ['--d' as string]: `${8 + segs.length * 2}s` } as CSSProperties}>{unit}{unit}</div>
    </div>
  )
}
const MQ_DEFS: { title: string; desc: string; strip: (c: PC) => React.ReactNode; svc?: string; sv?: number }[] = [
  { title: 'Barre défilante bleue de l\'accueil, atouts en blanc', desc: 'La même barre que sur l\'accueil : fond bleu de la marque, police grasse en capitales très espacées, étoiles à quatre branches (✦) entre chaque mot, et le texte défile en boucle. Les atouts s\'écrivent « RC ✦ AUTO ✦ /25 ✦ RC ✦ AUTO… » : un seul atout suffit à remplir la barre.', strip: c => <Mq c={c} /> },
  { title: 'Barre défilante, mots dans leur couleur', desc: 'Même barre bleue, mais chaque atout garde sa couleur (RC orange, AUTO vert, PATCH bleu clair, tirage violet ou doré) avec les étoiles blanches. On garde le code couleur sans plein de couleur : le bandeau reste uniformément bleu.', strip: c => <Mq c={c} color /> },
  { title: 'Barre défilante fine (14 px), aux couleurs de l\'équipe', desc: 'Version plus fine de 14 px dont le fond reprend la couleur de l\'équipe de la carte (mélangée au bleu de base). Le bandeau et le dégradé du bas parlent alors de la même équipe.', strip: c => <Mq c={c} slim team /> },
  { title: 'Segments colorés avec étoiles qui scintillent', desc: 'On garde les segments égaux de la version actuelle (un par atout), mais chacun est encadré de deux étoiles ✦ qui scintillent doucement en alternance (2,4 s). Pas de défilement : seulement un peu de vie.', strip: () => null, svc: 'sv-star' },
  { title: 'Segments colorés avec reflet qui passe', desc: 'Segments actuels, avec un reflet de lumière diagonal qui traverse chacun toutes les 3,6 s, l\'un après l\'autre (décalés de 0,35 s), comme un badge métallique qu\'on incline. Aucune étoile, juste le mouvement.', strip: () => null, svc: 'sv-glint' },
]

const SegMq = ({ c, o }: { c: PC; o: 'indep' | 'alt' | 'blue' | 'fixed' | 'flat' }) => {
  const segs = segsOf(c)
  return (
    <div className="gs sgs">
      {segs.map((s, i) => {
        const unit = (
          <span>
            {[0, 1, 2, 3].map(r => <React.Fragment key={r}>{o === 'fixed' ? null : <b>{s.t}</b>}<i>✦</i>{o === 'fixed' ? null : null}</React.Fragment>)}
          </span>
        )
        const dur = 5 + ((i * 3 + c.n.length) % 5) * 1.4
        const st = { ...segStyle(s), ['--d' as string]: `${dur.toFixed(1)}s`, ['--dir' as string]: o === 'alt' && i % 2 ? 'reverse' : 'normal', ['--mb' as string]: '#003DA6' } as CSSProperties
        return (
          <div key={s.k} className={`sgm ${o === 'blue' ? 'blue' : o === 'flat' ? 'flat' : o === 'fixed' ? 'fixed' : ''}`} style={st}>
            {o === 'fixed' && <span className="lab">{s.t}</span>}
            <div className="mq">{unit}{unit}</div>
          </div>
        )
      })}
    </div>
  )
}
const InfoMq = ({ c, blue }: { c: PC; blue?: boolean }) => {
  const items = [c.n, c.v, c.y, c.br].filter(Boolean) as string[]
  const unit = <span>{[0, 1].map(r => <React.Fragment key={r}>{items.map(x => <React.Fragment key={x}><b>{x}</b><i>✦</i></React.Fragment>)}</React.Fragment>)}</span>
  return <div className={`gs mqs info${blue ? 'b' : ''}`}><div className="mq" style={{ ['--d' as string]: '16s' } as CSSProperties}>{unit}{unit}</div></div>
}
const StkMq = ({ c }: { c: PC }) => {
  const segs = segsOf(c)
  return (
    <div className="stk">
      {segs.map((s, i) => {
        const unit = <span>{[0, 1, 2, 3].map(r => <React.Fragment key={r}><b>{s.t}</b><i>✦</i></React.Fragment>)}</span>
        const st = { ...segStyle(s), ['--d' as string]: `${(5 + i * 1.7).toFixed(1)}s`, ['--dir' as string]: i % 2 ? 'reverse' : 'normal' } as CSSProperties
        return <div key={s.k} className="sgm" style={st}><div className="mq">{unit}{unit}</div></div>
      })}
    </div>
  )
}
type EDef = { title: string; desc: string; strip?: (c: PC) => React.ReactNode; over?: (c: PC) => React.ReactNode }
const E_DEFS: EDef[] = [
  { title: 'D1 + les infos qui défilent quand il n\'y a aucun atout', desc: 'La barre bleue défilante de D1 pour les cartes avec atouts (RC ✦ AUTO ✦ /25…), et pour les cartes sans atout une barre grise du même style qui fait défiler le nom, l\'insert, l\'année et le set (« ADEM BONA ✦ FRESH PAINT ✦ 2024-25 ✦ COURT KINGS »). Plus d\'année figée en en-tête.', strip: c => (segsOf(c).length ? <Mq c={c} /> : <InfoMq c={c} />) },
  { title: 'Même chose, infos sans atout sur la barre bleue', desc: 'Idem, mais la barre d\'infos des cartes sans atout est bleue comme D1 (un peu plus sombre) : toutes les vignettes ont la même barre, on ne la distingue qu\'à son contenu.', strip: c => (segsOf(c).length ? <Mq c={c} /> : <InfoMq c={c} blue />) },
  { title: 'Chaque atout est sa propre barre défilante (côte à côte, vitesses différentes)', desc: 'Les segments égaux sont conservés (RC, AUTO, PATCH, tirage chacun dans sa couleur), mais chaque segment fait défiler son propre texte (« AUTO ✦ AUTO ✦ AUTO ✦ ») à sa propre vitesse, de 5 à 11 secondes : ils ne bougent jamais à l\'unisson.', strip: c => (segsOf(c).length ? <SegMq c={c} o="indep" /> : <InfoMq c={c} />) },
  { title: 'Chaque atout défile, sens alternés', desc: 'Même principe, mais un segment sur deux défile vers la droite : RC vers la gauche, AUTO vers la droite, PATCH vers la gauche… L\'effet est plus vivant, un peu plus agité.', strip: c => (segsOf(c).length ? <SegMq c={c} o="alt" /> : <InfoMq c={c} />) },
  { title: 'Segments mats (sans relief) défilants', desc: 'Les segments défilants indépendants, en couleur unie sans dégradé ni relief : plus plat, plus proche de la barre de l\'accueil.', strip: c => (segsOf(c).length ? <SegMq c={c} o="flat" /> : <InfoMq c={c} />) },
  { title: 'Segments bleus de la marque, seuls les mots gardent leur couleur', desc: 'Chaque segment est bleu comme la barre de l\'accueil et fait défiler son atout ; seule la couleur du mot change (RC orange, AUTO vert, PATCH bleu clair). Le bandeau reste uniformément bleu tout en gardant le code couleur.', strip: c => (segsOf(c).length ? <SegMq c={c} o="blue" /> : <InfoMq c={c} blue />) },
  { title: 'Étiquette fixe à gauche, étoiles qui défilent derrière', desc: 'Chaque segment porte son nom immobile à gauche (RC, AUTO, /25) et, à sa droite, des étoiles ✦ qui défilent seules. L\'information reste lisible à tout instant et seul l\'ornement bouge.', strip: c => (segsOf(c).length ? <SegMq c={c} o="fixed" /> : <InfoMq c={c} />) },
  { title: 'Barres empilées de 12 px, une par atout (par-dessus l\'image)', desc: 'Chaque atout est une barre pleine largeur de 12 px posée sur le haut de l\'image, empilées (sens alternés). Très proche de ta demande « chaque barre bouge indépendamment » mais elles couvrent de 12 à 50 px de l\'image selon le nombre d\'atouts : à voir si c\'est acceptable.', over: c => (segsOf(c).length ? <StkMq c={c} /> : null), strip: c => (segsOf(c).length ? <div className="gs none" /> : <InfoMq c={c} />) },
]
type FDef = { title: string; desc: string; strip: (c: PC) => React.ReactNode }
const F_DEFS: FDef[] = [
  { title: 'Barres défilantes indépendantes, une couleur par atout, entre la carte et le texte', desc: 'Le même bandeau de 14 px (chaque atout sa propre barre défilante, sa couleur, sa vitesse) mais descendu sous l\'image, juste au-dessus du nom : la carte est « rehaussée » et commence tout en haut du cadre. Les cartes sans atout ont la barre d\'infos qui défile (nom, insert, année, set).', strip: c => <div style={{ marginBottom: 0 }}>{segsOf(c).length ? <SegMq c={c} o="indep" /> : <InfoMq c={c} />}</div> },
  { title: 'Une seule barre bleue défilante (style D1) entre la carte et le texte', desc: 'La barre bleue de l\'accueil (tous les atouts à la suite : RC ✦ AUTO ✦ /25…) sous l\'image. Plus calme : une seule barre en mouvement. Cartes sans atout : barre d\'infos qui défile.', strip: c => (segsOf(c).length ? <Mq c={c} /> : <InfoMq c={c} blue />) },
  { title: 'Segments statiques entre la carte et le texte', desc: 'Les segments colorés égaux (relief) mais immobiles, sous l\'image. La carte est rehaussée, aucun mouvement. Cartes sans atout : barre d\'infos qui défile (seul élément mobile).', strip: c => (segsOf(c).length ? <div className="gs sv-1">{segsOf(c).map(s => <span key={s.k} className="s" style={segStyle(s)}>{s.t}</span>)}</div> : <InfoMq c={c} />) },
  { title: 'Barres défilantes indépendantes, sens alternés, aux couleurs franches', desc: 'Sous l\'image, chaque atout défile à sa vitesse et un segment sur deux dans l\'autre sens, en couleur unie (sans relief) comme la barre de l\'accueil. Le plus animé.', strip: c => (segsOf(c).length ? <SegMq c={c} o="alt" /> : <InfoMq c={c} />) },
]
const StSeg = ({ c, n }: { c: PC; n: number }) => (segsOf(c).length ? <div className={`gs sv-${n}`}>{segsOf(c).map(s => <span key={s.k} className="s" style={segStyle(s)}>{s.t}</span>)}</div> : <InfoMq c={c} />)
const F_MORE: FDef[] = [
  { title: 'Entre la carte et le texte : plat et ultra fin (14 px), segments fixes', desc: 'Couleur unie sans relief, 14 px, segments immobiles. Cartes sans atout : infos qui défilent.', strip: c => <StSeg c={c} n={2} /> },
  { title: 'Entre la carte et le texte : segments inclinés', desc: 'Parallélogrammes qui s\'emboîtent, sous l\'image. Cartes sans atout : infos qui défilent.', strip: c => <StSeg c={c} n={3} /> },
  { title: 'Entre la carte et le texte : fond teinté et filet de couleur', desc: 'Fond teinté à 18 % avec un filet de 2 px en haut, texte clair. Plus léger. Cartes sans atout : infos qui défilent.', strip: c => <StSeg c={c} n={4} /> },
  { title: 'Entre la carte et le texte : blocs blancs soulignés de couleur', desc: 'Blocs blancs pleins texte marine, trait de 3 px de la couleur de l\'atout. Cartes sans atout : infos qui défilent.', strip: c => <StSeg c={c} n={6} /> },
  { title: 'Entre la carte et le texte : fond sombre + carré de couleur à gauche', desc: 'Segments sombres avec un bloc de 4 px de la couleur de l\'atout, texte blanc. Cartes sans atout : infos qui défilent.', strip: c => <StSeg c={c} n={7} /> },
  { title: 'Entre la carte et le texte : barre défilante bleue, mots dans leur couleur', desc: 'La barre bleue de l\'accueil (style D1) avec chaque mot dans la couleur de son atout. Cartes sans atout : infos qui défilent sur la barre bleue.', strip: c => (segsOf(c).length ? <Mq c={c} color /> : <InfoMq c={c} blue />) },
  { title: 'Entre la carte et le texte : barre défilante fine aux couleurs de l\'équipe', desc: 'Barre défilante de 14 px au fond de la couleur de l\'équipe de la carte. Cartes sans atout : infos qui défilent.', strip: c => (segsOf(c).length ? <Mq c={c} slim team /> : <InfoMq c={c} />) },
  { title: 'Entre la carte et le texte : barres indépendantes sur fond bleu, mots colorés', desc: 'Chaque atout est sa propre barre défilante bleue (comme l\'accueil), seul le mot garde sa couleur. Cartes sans atout : infos qui défilent.', strip: c => (segsOf(c).length ? <SegMq c={c} o="blue" /> : <InfoMq c={c} blue />) },
  { title: 'Entre la carte et le texte : étiquette fixe + étoiles qui défilent', desc: 'Chaque segment porte son nom immobile à gauche et des étoiles ✦ qui défilent seules à sa droite. Cartes sans atout : infos qui défilent.', strip: c => (segsOf(c).length ? <SegMq c={c} o="fixed" /> : <InfoMq c={c} />) },
]
F_DEFS.push(...F_MORE)
const STRIPS = [
  ['Actuel (dégradé fin, relief)', 'Le bandeau tel qu\'il est en ligne : 17 px, dégradé vertical, filet de relief, lettres espacées.'],
  ['Plat et ultra fin (14 px)', 'Couleur unie sans relief, 14 px de haut, texte de 8,5 px. Le plus discret et le plus net.'],
  ['Segments inclinés', 'Les segments sont des parallélogrammes qui s\'emboîtent (bords inclinés de 7 px), sans espace entre eux : une bande dynamique, comme une pile de rubans.'],
  ['Filet de couleur + fond teinté', 'Pas de plein : un fond teinté à 18 % de la couleur, un filet épais de 2 px en haut et le texte en version claire. Plus léger visuellement, la couleur est discrète.'],
  ['Plein + double liseré intérieur', 'Couleur unie avec deux liserés intérieurs (un blanc, un sombre) comme un badge frappé. Plus soigné de près.'],
  ['Blocs blancs soulignés de couleur', 'Blocs blancs pleins avec le texte marine et un trait de 3 px de la couleur de l\'atout dessous : le style des repères blancs du site.'],
  ['Fond sombre + carré de couleur à gauche', 'Segments sombres à filet fin, un bloc de couleur de 4 px à gauche de chacun et le texte blanc. Très sobre ; les couleurs sont réduites à un repère.'],
  ['Coins coupés', 'Couleur unie, les quatre coins coupés de 4 px (forme de badge à pans coupés). Net et un peu graphique.'],
  ['Bande continue à séparateurs fins', 'Une seule bande sans espace, divisée par des filets blancs de 1 px. Se lit comme un seul objet qui change de largeur selon le nombre d\'atouts.'],
  ['Ultra fin 13 px mat', 'Couleur légèrement assombrie (mélangée au fond), texte de 8 px très espacé, ombre intérieure basse. Le moins visible, le plus élégant.'],
]
const FILLS: [Fill, string, string][] = [
  ['year', 'L\'année dans un segment gris (actuel)', 'Un segment gris discret avec l\'année de la carte.'],
  ['brand', 'La marque / le set', 'Le nom de la marque (« PANINI SELECT ») en gris : on connaît la gamme d\'un coup d\'œil.'],
  ['num', 'Le numéro de la carte', 'Le numéro (« #FP-TM ») dans le segment gris, à la place du bas de la vignette où tu ne voulais plus le voir.'],
  ['team', 'Équipe + sport en dégradé', 'Un dégradé de la couleur de l\'équipe qui s\'efface vers la droite, avec « MIN · Basketball » : le haut se colore sans prétendre à un atout.'],
  ['sport', 'Le sport', 'Un simple « BASKETBALL » en gris. Utile surtout pour les galeries multisports.'],
  ['stripe', 'Rayures neutres sans texte', 'Une bande de fines rayures diagonales grises : on voit que la place est réservée volontairement, sans rien écrire.'],
  ['insert', 'Le nom de l\'insert (ou de la variation) en bleu italique', 'L\'insert « Gold Standard » monte dans la bande, en bleu italique : même couleur que dans le bas, qui pourrait alors se raccourcir.'],
  ['none', 'Rien : la rangée disparaît et l\'image remonte', 'Pas de bande pour les cartes sans atout ; l\'image commence plus haut, donc elle n\'est plus alignée avec ses voisines.'],
]
const BOTS = [
  ['Actuel (30 % sur tout le bloc)', 'Dégradé vertical de la couleur de l\'équipe sur tout le bloc texte. Le fondu se voit surtout aux bords : c\'est ce qui paraît mal intégré.'],
  ['Plus léger + trait d\'équipe en pied', 'Dégradé à 22 % qui se termine sur un trait de 2 px de la couleur de l\'équipe en bas : le dégradé a une « ligne d\'arrivée » nette qui l\'ancre dans le cadre.'],
  ['Lueur de pied (sans remplissage)', 'Aucun fond : seulement une lueur de la couleur de l\'équipe qui monte de 18 px depuis le bord bas. Très naturel, comme un éclairage.'],
  ['Dégradé diagonal', 'Le dégradé part du coin bas droit en diagonale (160°) au lieu de monter à la verticale : moins « bloc de couleur », plus lumière.'],
  ['Dégradé dans le cadre (liseré qui se colore)', 'Le fond reste uni ; c\'est le liseré du cadre qui passe de bleu pâle en haut à la couleur de l\'équipe en bas (la barre de 4 px disparaît). L\'équipe se lit sur toute la hauteur.'],
  ['Halo derrière le nom', 'Un halo elliptique de la couleur de l\'équipe, centré derrière le nom : le nom est mis en valeur et le reste du bas reste sombre.'],
  ['Teinte de toute la carte', 'Le fond de la carte entière glisse de la couleur de base (en haut) vers une teinte de l\'équipe (en bas, 24 %), image et texte compris : le dégradé commence derrière l\'image, donc il n\'a plus de bord.'],
  ['Teinte de la carte + barre en pied', 'Même teinte de toute la carte (20 %) et la barre d\'équipe passe au tout bas du cadre, comme une plinthe.'],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 41 · Bandeau, espace vide, dégradé</h1>
      <p className="lead">Tout en haut (F1 à F4) : le bandeau descendu entre la carte et le texte du bas (carte rehaussée). Puis (E1 à E8) : chaque atout comme sa propre barre défilante, et des infos qui défilent pour les cartes sans atout. Ensuite (D1 à D5) : le bandeau dans le style de la barre défilante de l&apos;accueil (police grasse espacée, étoiles ✦, mouvement). Puis trois chantiers sur les vignettes de la galerie, montrés sur 5 cartes (1, 2, 3 et 4 atouts, et une sans atout) avec des équipes de couleurs différentes : A. rendre le bandeau d&apos;atouts plus beau et plus fin (10 variantes) ; B. remplir la rangée quand il n&apos;y a aucun atout (8 façons) ; C. mieux intégrer le dégradé du bas à la couleur d&apos;équipe (8 façons).</p>
      <nav className="tags">{F_DEFS.map((_, i) => <a key={`f${i}`} href={`#f${i + 1}`}>F{i + 1}</a>)}{E_DEFS.map((_, i) => <a key={`e${i}`} href={`#e${i + 1}`}>E{i + 1}</a>)}{MQ_DEFS.map((_, i) => <a key={`d${i}`} href={`#d${i + 1}`}>D{i + 1}</a>)}{STRIPS.map((_, i) => <a key={i} href={`#a${i + 1}`}>A{i + 1}</a>)}{FILLS.map((_, i) => <a key={i} href={`#b${i + 1}`}>B{i + 1}</a>)}{BOTS.map((_, i) => <a key={i} href={`#c${i + 1}`}>C{i + 1}</a>)}</nav>

      {F_DEFS.map((d, i) => <Bay key={d.title} id={`f${i + 1}`} n={`F${i + 1}`} title={d.title} desc={d.desc}><Row>{PCS.map(c => <Cell key={c.n} c={c} below strip={d.strip(c)} />)}</Row></Bay>)}
      {E_DEFS.map((d, i) => <Bay key={d.title} id={`e${i + 1}`} n={`E${i + 1}`} title={d.title} desc={d.desc}><Row>{PCS.map(c => <Cell key={c.n} c={c} strip={d.strip ? d.strip(c) : undefined} over={d.over ? d.over(c) : undefined} />)}</Row></Bay>)}
      {MQ_DEFS.map((d, i) => <Bay key={d.title} id={`d${i + 1}`} n={`D${i + 1}`} title={d.title} desc={d.desc}><Row>{PCS.map(c => <Cell key={c.n} c={c} svc={d.svc} strip={i < 3 ? d.strip(c) : undefined} />)}</Row></Bay>)}
      {STRIPS.map((d, i) => <Bay key={d[0]} id={`a${i + 1}`} n={`A${i + 1}`} title={d[0]} desc={d[1]}><Row>{PCS.map(c => <Cell key={c.n} c={c} sv={i + 1} />)}</Row></Bay>)}
      {FILLS.map((d, i) => <Bay key={d[1]} id={`b${i + 1}`} n={`B${i + 1}`} title={d[1]} desc={d[2]}><Row>{PCS.map(c => <Cell key={c.n} c={c} fill={d[0]} />)}</Row></Bay>)}
      {BOTS.map((d, i) => <Bay key={d[0]} id={`c${i + 1}`} n={`C${i + 1}`} title={d[0]} desc={d[1]}><Row>{PCS.map(c => <Cell key={c.n} c={c} b={i + 1} />)}</Row></Bay>)}
    </div>
  )
}
