'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 29 : recherche et filtres de la galerie.

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

/* serie 29 : recherche et filtres de la galerie (prefixe fl-) */
.ix .fl-w { max-width: 940px; } .ix .fl-cap { font: 700 10px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); margin: 12px 0 6px; }
.ix .fl-in { height: 44px; border: 2px solid #fff; display: flex; align-items: center; gap: 10px; padding: 0 14px; color: rgba(255,255,255,.6); font: 600 14px system-ui; flex: 1 1 220px; min-width: 0; } .ix .fl-in i { font-style: normal; margin-left: auto; border: 1px solid rgba(255,255,255,.5); padding: 0 6px; font-size: 11px; color: rgba(255,255,255,.7); }
.ix .fl-in.big { height: 64px; border-width: 3px; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font-size: 28px; } .ix .fl-in.big .ic { font-size: 26px; color: #fff; }
.ix .fl-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
.ix .fl-b { height: 36px; padding: 0 14px; border: 2px solid rgba(255,255,255,.7); display: inline-flex; align-items: center; justify-content: center; gap: 6px; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; }
.ix .fl-b.on { background: #fff; color: #06122e !important; border-color: #fff; } .ix .fl-b.on * { color: #06122e !important; }
.ix .fl-b.rc.on { background: #ff9a3c; border-color: #ff9a3c; } .ix .fl-b.au.on { background: #4cd37b; border-color: #4cd37b; } .ix .fl-b.nu.on { background: #c77dff; border-color: #c77dff; } .ix .fl-b.pa.on { background: #5aa9ff; border-color: #5aa9ff; }
.ix .fl-b.rc { color: #ff9a3c; border-color: #ff9a3c; } .ix .fl-b.au { color: #4cd37b; border-color: #4cd37b; } .ix .fl-b.nu { color: #c77dff; border-color: #c77dff; } .ix .fl-b.pa { color: #5aa9ff; border-color: #5aa9ff; }
.ix .fl-b.on.rc, .ix .fl-b.on.au, .ix .fl-b.on.nu, .ix .fl-b.on.pa { color: #06122e !important; }
.ix .fl-b small { font: 800 11px system-ui; opacity: .75; letter-spacing: .04em; }
.ix .fl-seg { display: inline-flex; border: 2px solid #fff; } .ix .fl-seg span { height: 34px; padding: 0 14px; display: inline-flex; align-items: center; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; border-right: 2px solid #fff; } .ix .fl-seg span:last-child { border-right: 0; } .ix .fl-seg .on { background: #fff; color: #06122e !important; }
.ix .fl-lbl { font: 800 9px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.55); margin-right: 4px; }
.ix .fl-old { background: #1b1b1b; border-radius: 12px; padding: 14px; } .ix .fl-old .inp { background: #162456; border-radius: 8px; padding: 12px; color: rgba(255,255,255,.6); font-style: italic; font-size: 14px; } .ix .fl-old .tg { background: #262626; border-radius: 6px; height: 28px; display: flex; align-items: center; justify-content: center; font: 800 10px system-ui; color: #ddd; } .ix .fl-old .pill { border-radius: 20px; background: #20263a; padding: 6px 12px; font: 700 11px system-ui; } .ix .fl-old .pill.on { background: #0b6bd3; }
/* tuiles compteurs */
.ix .fl-tiles { display: grid; grid-template-columns: repeat(7, 1fr); border: 2px solid #fff; } .ix .fl-tile { padding: 10px 6px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,.3); } .ix .fl-tile:last-child { border-right: 0; } .ix .fl-tile b { display: block; font-size: 32px; line-height: 1; font-weight: 400; } .ix .fl-tile i { display: block; font: 800 9px system-ui; letter-spacing: .14em; text-transform: uppercase; font-style: normal; color: rgba(255,255,255,.65); margin-top: 4px; } .ix .fl-tile.on { background: #fff; } .ix .fl-tile.on b, .ix .fl-tile.on i { color: #06122e !important; }
/* collections en onglets */
.ix .fl-tabs { display: flex; gap: 22px; flex-wrap: wrap; border-bottom: 3px solid rgba(255,255,255,.25); margin-top: 12px; } .ix .fl-tabs span { position: relative; padding: 6px 0 9px; font-size: 20px; line-height: 1; color: rgba(255,255,255,.65); } .ix .fl-tabs span small { font: 800 11px system-ui; margin-left: 6px; color: rgba(255,255,255,.5); } .ix .fl-tabs .on { color: #fff; } .ix .fl-tabs .on::after { content: ''; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; background: #fff; } .ix .fl-tabs .plus { font-size: 22px; color: rgba(255,255,255,.5); }
/* etiquettes actives */
.ix .fl-chip { height: 30px; display: inline-flex; align-items: center; gap: 8px; padding: 0 6px 0 10px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.5); font: 800 11px system-ui; letter-spacing: .08em; text-transform: uppercase; } .ix .fl-chip b { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,.6); font-size: 11px; }
.ix .fl-res { display: flex; align-items: baseline; gap: 10px; margin-top: 12px; } .ix .fl-res .n { font-size: 44px; line-height: .9; } .ix .fl-res span { font: 800 11px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.65); } .ix .fl-clear { margin-left: auto; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; text-decoration: underline; }
/* logos equipe */
.ix .fl-tm { display: flex; gap: 6px; flex-wrap: wrap; } .ix .fl-tm span { width: 46px; height: 46px; border: 2px solid rgba(255,255,255,.4); display: flex; align-items: center; justify-content: center; } .ix .fl-tm span.on { border-color: #fff; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 2px #08153b, inset 0 0 0 3.5px #fff; } .ix .fl-tm img { width: 28px; height: 28px; object-fit: contain; filter: brightness(0) invert(1); } .ix .fl-tm .all { width: auto; padding: 0 12px; font: 800 10px system-ui; letter-spacing: .1em; }
/* rail collant */
.ix .fl-rail { display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 12px; background: #050912; border-bottom: 2px solid #fff; border-top: 2px solid #fff; } .ix .fl-rail .fl-in { height: 34px; border-width: 1px; flex: 1; }
.ix .fl-ico { width: 34px; height: 34px; border: 2px solid #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; position: relative; flex-shrink: 0; } .ix .fl-ico.on { background: #fff; color: #06122e !important; } .ix .fl-badge { position: absolute; top: -9px; right: -9px; min-width: 18px; height: 18px; background: #ffd54a; color: #06122e !important; font: 800 10px system-ui; display: flex; align-items: center; justify-content: center; border: 2px solid #08153b; }
/* telephone */
.ix .fl-ph { width: 300px; border: 4px solid #fff; background: #050912; } .ix .fl-ph .top { padding: 10px 12px; font-size: 20px; border-bottom: 1px solid rgba(255,255,255,.25); } .ix .fl-ph .pad { padding: 10px; } .ix .fl-ph .fl-in { height: 38px; font-size: 13px; padding: 0 10px; }
.ix .fl-scroll { display: flex; gap: 6px; overflow-x: auto; padding: 8px 10px; } .ix .fl-scroll .fl-b { height: 32px; padding: 0 10px; font-size: 10px; flex-shrink: 0; }
.ix .fl-sheet { background: #08153b; border-top: 4px solid #fff; padding: 12px 12px 14px; } .ix .fl-sheet h4 { margin: 0 0 8px; font-size: 24px; line-height: 1; } .ix .fl-sheet .sec { margin: 12px 0 6px; font: 800 9px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.6); } .ix .fl-sheet .grp { display: flex; flex-wrap: wrap; gap: 6px; } .ix .fl-sheet .fl-b { height: 34px; padding: 0 10px; font-size: 10px; } .ix .fl-sheet .go { display: flex; gap: 8px; margin-top: 14px; } .ix .fl-sheet .go span { flex: 1; height: 42px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; } .ix .fl-sheet .go .p { background: #fff; color: #06122e !important; }
@media (max-width: 800px) { .ix .fl-tiles { grid-template-columns: repeat(4, 1fr); } .ix .fl-w { overflow-x: auto; } }
/* serie-29-extra */
/* ---- 10 idees de plus ---- */
.ix .fl-sent { font-size: clamp(26px, 4.4vw, 44px); line-height: 1.25; } .ix .fl-sent .tk { display: inline-flex; align-items: center; gap: 6px; border: 3px solid #fff; padding: 0 12px; margin: 0 4px; line-height: 1.05; vertical-align: middle; } .ix .fl-sent .tk.rc { border-color: #ff9a3c; color: #ff9a3c; } .ix .fl-sent .tk.au { border-color: #4cd37b; color: #4cd37b; } .ix .fl-sent .tk small { font-size: .5em; opacity: .7; } .ix .fl-sent .pl { color: rgba(255,255,255,.45); }
.ix .fl-side { display: grid; grid-template-columns: 230px 1fr; border: 2px solid #fff; min-height: 340px; } .ix .fl-side aside { border-right: 2px solid #fff; padding: 14px; } .ix .fl-side .g { margin-bottom: 14px; } .ix .fl-side .g h5 { margin: 0 0 6px; font: 800 10px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.6); } .ix .fl-side .it { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,.14); font: 700 13px system-ui; } .ix .fl-side .it i { width: 16px; height: 16px; border: 2px solid #fff; flex-shrink: 0; } .ix .fl-side .it.on i { background: #fff; box-shadow: inset 0 0 0 2px #08153b; } .ix .fl-side .it b { margin-left: auto; font: 400 18px 'Surfquest', Impact, sans-serif; } .ix .fl-side .main { padding: 14px; } .ix .fl-side .ph { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; } .ix .fl-side .ph div { aspect-ratio: 2.5/3.5; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.2); }
.ix .fl-pre { display: flex; gap: 10px; flex-wrap: wrap; } .ix .fl-pre span { border: 3px solid #fff; padding: 8px 16px; font-size: 22px; line-height: 1; display: inline-flex; align-items: baseline; gap: 8px; } .ix .fl-pre span small { font: 800 11px system-ui; opacity: .7; } .ix .fl-pre .on { background: #fff; color: #06122e !important; } .ix .fl-pre .on small { color: #06122e !important; } .ix .fl-pre .sv { border-style: dashed; border-width: 2px; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.75); align-items: center; }
.ix .fl-tok { height: 56px; border: 3px solid #fff; display: flex; align-items: center; gap: 8px; padding: 0 12px; flex-wrap: nowrap; overflow: hidden; } .ix .fl-tok .t { height: 32px; display: inline-flex; align-items: center; gap: 8px; padding: 0 4px 0 10px; border: 2px solid #fff; background: rgba(255,255,255,.12); font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; } .ix .fl-tok .t em { font-style: normal; opacity: .6; } .ix .fl-tok .t b { width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.6); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; } .ix .fl-tok .cur { color: rgba(255,255,255,.6); font: 600 16px system-ui; border-left: 2px solid #fff; padding-left: 8px; }
.ix .fl-sug { border: 3px solid #fff; border-top: 0; max-width: 480px; } .ix .fl-sug div { padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,.18); font: 700 13px system-ui; display: flex; gap: 10px; align-items: center; } .ix .fl-sug div em { font: 800 9px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.55); font-style: normal; min-width: 56px; } .ix .fl-sug .on { background: #fff; color: #06122e !important; } .ix .fl-sug .on em { color: #06122e !important; }
.ix .fl-big4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; } .ix .fl-big4 > div { border: 3px solid; padding: 14px 10px 10px; text-align: center; position: relative; } .ix .fl-big4 .ic { font-size: 28px; line-height: 1; } .ix .fl-big4 b { display: block; font-size: 40px; line-height: 1; font-weight: 400; margin: 8px 0 2px; } .ix .fl-big4 i { font: 800 10px system-ui; letter-spacing: .16em; text-transform: uppercase; font-style: normal; } .ix .fl-big4 .on { background: currentColor; } .ix .fl-big4 .on * { color: #06122e !important; }
.ix .fl-big4 .c1 { color: #ff9a3c; border-color: #ff9a3c; } .ix .fl-big4 .c2 { color: #4cd37b; border-color: #4cd37b; } .ix .fl-big4 .c3 { color: #c77dff; border-color: #c77dff; } .ix .fl-big4 .c4 { color: #5aa9ff; border-color: #5aa9ff; }
.ix .fl-andor { display: inline-flex; border: 2px solid #fff; margin-left: auto; } .ix .fl-andor span { height: 30px; padding: 0 12px; display: inline-flex; align-items: center; font: 800 11px system-ui; letter-spacing: .12em; } .ix .fl-andor .on { background: #fff; color: #06122e !important; }
.ix .fl-resbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-top: 3px solid #fff; border-bottom: 1px solid rgba(255,255,255,.3); padding: 10px 0; } .ix .fl-resbar .n { font-size: 40px; line-height: .9; } .ix .fl-resbar .lb { font: 800 11px system-ui; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.65); } .ix .fl-resbar .sp { flex: 1; }
.ix .fl-rng { margin: 12px 0; } .ix .fl-rng .hd { display: flex; justify-content: space-between; align-items: baseline; } .ix .fl-rng .hd b { font-weight: 400; font-size: 26px; } .ix .fl-rng .hd span { font: 800 10px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.6); } .ix .fl-rng .tr { position: relative; height: 6px; background: rgba(255,255,255,.2); margin: 14px 8px 6px; } .ix .fl-rng .fi { position: absolute; top: 0; bottom: 0; background: #fff; } .ix .fl-rng .th { position: absolute; top: -8px; width: 22px; height: 22px; background: #fff; border: 3px solid #08153b; margin-left: -11px; }
.ix .fl-bot { position: sticky; display: flex; border-top: 3px solid #fff; background: #050912; } .ix .fl-bot > div { flex: 1; padding: 9px 0 8px; text-align: center; border-right: 1px solid rgba(255,255,255,.25); position: relative; } .ix .fl-bot > div:last-child { border-right: 0; } .ix .fl-bot .ic { font-size: 20px; line-height: 1; } .ix .fl-bot i { display: block; font: 800 9px system-ui; letter-spacing: .12em; text-transform: uppercase; font-style: normal; margin-top: 4px; } .ix .fl-bot .on { background: #fff; color: #06122e !important; } .ix .fl-bot .on * { color: #06122e !important; }
.ix .fl-ov { background: #050912; min-height: 420px; } .ix .fl-ov .hd { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 2px solid #fff; } .ix .fl-ov .hd .fl-in { height: 40px; } .ix .fl-ov .sec { padding: 12px 10px 4px; font: 800 9px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.55); } .ix .fl-ov .rec { display: flex; flex-direction: column; } .ix .fl-ov .rec div { padding: 10px; border-bottom: 1px solid rgba(255,255,255,.14); display: flex; gap: 10px; align-items: center; font-size: 19px; } .ix .fl-ov .rec div i { font: 600 12px system-ui; color: rgba(255,255,255,.5); font-style: normal; margin-left: auto; }
.ix .fl-cov { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; } .ix .fl-cv { flex: 0 0 150px; border: 3px solid rgba(255,255,255,.55); background: rgba(255,255,255,.04); } .ix .fl-cv.on { border-color: #fff; box-shadow: inset 0 0 0 2px #08153b, inset 0 0 0 3.5px #fff; } .ix .fl-cv .im { position: relative; height: 96px; overflow: hidden; display: flex; justify-content: center; align-items: flex-end; } .ix .fl-cv .im img { position: absolute; bottom: -22px; width: 58px; aspect-ratio: 2.5/3.5; object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,.5); } .ix .fl-cv .tx { padding: 6px 8px 8px; border-top: 1px solid rgba(255,255,255,.25); } .ix .fl-cv .tx b { display: block; font-size: 17px; line-height: 1; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .ix .fl-cv .tx small { font: 800 9px system-ui; letter-spacing: .12em; color: rgba(255,255,255,.6); text-transform: uppercase; }
@media (max-width: 800px) { .ix .fl-side { grid-template-columns: 1fr; } .ix .fl-side aside { border-right: 0; border-bottom: 2px solid #fff; } .ix .fl-big4 { grid-template-columns: repeat(2, 1fr); } }
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

const B = ({ c, on, children }: { c?: string; on?: boolean; children: React.ReactNode }) => <span className={`fl-b${c ? ' ' + c : ''}${on ? ' on' : ''}`}>{children}</span>
const Lg = ({ t }: { t: string }) => <img src={`/team-logos/nba-${t}.png`} alt="" />
const COLS = [['Toutes', 599], ['Philadelphia 76ers', 312], ['Old School', 88], ['Frenchies', 41], ['Autre', 36], ['Football', 72], ['F1', 25]] as const

export default function DaIdeas() {
  const names = ['Aujourd’hui', 'Barre unique', 'Segments groupés', 'Tuiles compteurs', 'Collections en onglets', 'Étiquettes actives', 'Équipe en logos', 'Barre collante', 'Mobile : défilement', 'Mobile : feuille', 'Mobile : bouton Filtres', 'Phrase', 'Colonne latérale', 'Filtres enregistrés', 'Étiquettes à la frappe', 'Gros carrés + ET/OU', 'Barre de résultats', 'Curseurs', 'Collections visuelles', 'Mobile : barre du bas', 'Mobile : recherche plein écran']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 29 · Recherche et filtres</h1>
      <p className="lead">Le bloc au-dessus des cartes de la galerie : recherche joueur, équipe, boutons RC / AUTO / #NUM / PATCH, MÉMO / VENTE / PRIVÉ, filtres avancés, collections, et les 3 vues (Grille, Chronologie, Compact). Aujourd&apos;hui : une grosse boîte grise avec des pastilles arrondies. Les idées ci-dessous gardent toutes les options en angles droits, filets blancs, Surfquest et couleurs des atouts (orange, vert, violet, bleu), avec des versions pour le téléphone.</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="00" title="Aujourd'hui, pour comparer" desc="Champs bleu foncé arrondis, boutons gris à coins arrondis tous identiques (RC, AUTO, NUM et PATCH ne se distinguent que par leur texte), collections en pastilles arrondies avec un petit point de couleur. Beaucoup de blocs empilés, 4 rangées avant de voir une carte."><div className="fl-w"><div className="fl-old">
        <div style={{ display: 'flex', gap: 10 }}><div className="inp" style={{ flex: 1 }}>Joueur, variation…</div><div className="inp" style={{ flex: 1 }}>Équipe</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 8 }}>{['RC', 'AUTO', '# NUM', 'PATCH'].map(x => <div key={x} className="tg">{x}</div>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 8 }}>{['🗒 MÉMO', '🏷 VENTE', '🔒 PRIVÉ'].map(x => <div key={x} className="tg">{x}</div>)}</div>
        <div style={{ font: '700 12px system-ui', margin: '12px 0 8px', color: '#ccc' }}>▸ Filtres avancés</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{COLS.map(([n], i) => <span key={n} className={`pill${i === 0 ? ' on' : ''}`}>{n}</span>)}</div>
      </div></div></Bay>

      <Bay id="s2" n="01" title="Barre unique : recherche géante, filtres en une ligne de carrés" desc="La recherche passe sur toute la largeur avec un filet double et un texte en Surfquest ; dessous, une seule rangée de boutons carrés : RC / AUTO / NUM / PATCH dans leur couleur (pleins quand actifs), un séparateur, puis MÉMO / VENTE / PRIVÉ et « Avancés ». L'équipe devient un bouton qui ouvre la liste. 2 rangées au lieu de 4."><div className="fl-w">
        <div className="fl-in big"><span className="ic">⌕</span><span className="sf">Joueur, variation…</span><i>/</i></div>
        <div className="fl-row"><B c="rc" on>RC</B><B c="au">AUTO</B><B c="nu" on># NUM</B><B c="pa">PATCH</B><span style={{ width: 2, height: 24, background: 'rgba(255,255,255,.4)' }} /><B>🗒 Mémo</B><B>🏷 Vente</B><B>🔒 Privé</B><span style={{ flex: 1 }} /><B>Équipe ▾</B><B>Avancés ▾</B></div>
      </div></Bay>

      <Bay id="s3" n="02" title="Deux segments groupés : « Atouts » et « Statut »" desc="Les boutons sont regroupés en deux blocs à filets partagés, chacun avec son étiquette en petites capitales : Atouts [RC | AUTO | NUM | PATCH] et Statut [MÉMO | VENTE | PRIVÉ]. Plus lisible qu'une grille de 7 boutons identiques ; l'état actif est un fond plein blanc."><div className="fl-w">
        <div className="fl-row" style={{ marginTop: 0 }}><div className="fl-in"><span>⌕</span>Joueur, variation…<i>/</i></div><div className="fl-in" style={{ flex: '0 1 220px' }}>Équipe</div></div>
        <div className="fl-row" style={{ gap: 18 }}><span><span className="fl-lbl">Atouts</span><span className="fl-seg"><span className="on">RC</span><span>Auto</span><span className="on"># Num</span><span>Patch</span></span></span><span><span className="fl-lbl">Statut</span><span className="fl-seg"><span>Mémo</span><span>Vente</span><span>Privé</span></span></span><span style={{ flex: 1 }} /><B>Avancés ▾</B></div>
      </div></Bay>

      <Bay id="s4" n="03" title="Tuiles compteurs : les chiffres de la collection sont les filtres" desc="Une bande de tuiles avec le nombre de cartes de chaque catégorie en gros Surfquest (RC 119, AUTO 29, NUM 91, PATCH 23, MÉMO, VENTE, PRIVÉ). Cliquer une tuile filtre ; la tuile active devient pleine blanche. On voit d'un coup d'œil ce qu'il y a dans la collection, et ça remplace les boutons gris."><div className="fl-w">
        <div className="fl-in" style={{ marginBottom: 10 }}><span>⌕</span>Joueur, variation…<i>/</i></div>
        <div className="fl-tiles">{[['599', 'Cartes', false, ''], ['119', 'RC', true, '#ff9a3c'], ['29', 'Auto', false, '#4cd37b'], ['91', '# Num', false, '#c77dff'], ['23', 'Patch', false, '#5aa9ff'], ['12', 'Vente', false, ''], ['4', 'Privé', false, '']].map(([n, l, on, c]) => <div key={String(l)} className={`fl-tile${on ? ' on' : ''}`}><b className="sf" style={{ color: on ? undefined : (c as string) || '#fff' }}>{n}</b><i>{l}</i></div>)}</div>
      </div></Bay>

      <Bay id="s5" n="04" title="Collections en onglets soulignés avec compteur" desc="Les pastilles arrondies (« Philadelphia 76ers », « Old School »…) deviennent des onglets en Surfquest 20 px avec le nombre de cartes, soulignés comme les onglets de la galerie ; l'actif a la barre blanche épaisse. Le « + » est discret à la fin ; le glisser-déposer pour réordonner reste possible."><div className="fl-w">
        <div className="fl-cap">Ma collection · glisser pour réordonner</div>
        <div className="fl-tabs">{COLS.map(([n, c], i) => <span key={n} className={`sf${i === 1 ? ' on' : ''}`}>{n}<small>{c}</small></span>)}<span className="plus">+</span></div>
      </div></Bay>

      <Bay id="s6" n="05" title="Étiquettes actives + compteur de résultats" desc="Quand des filtres sont posés, ils s'affichent sous la barre en étiquettes carrées avec une croix (« RC ✕ », « Philadelphia ✕ »), à côté du nombre de résultats en gros Surfquest et d'un « Tout effacer » souligné. On sait toujours ce qui est filtré sans rouvrir les menus."><div className="fl-w">
        <div className="fl-in"><span>⌕</span>sarić<i>/</i></div>
        <div className="fl-row"><span className="fl-chip">RC <b>✕</b></span><span className="fl-chip">Auto <b>✕</b></span><span className="fl-chip">Philadelphia 76ers <b>✕</b></span></div>
        <div className="fl-res"><span className="n sf">14</span><span>cartes sur 599</span><span className="fl-clear">Tout effacer</span></div>
      </div></Bay>

      <Bay id="s7" n="06" title="L'équipe en logos cliquables plutôt qu'un champ texte" desc="Le champ « Équipe » est remplacé par une rangée de logos carrés (46 px) des équipes présentes dans la collection, avec « Toutes » ; le logo actif reçoit le double filet. Plus rapide que de taper et on reconnaît les équipes d'un coup d'œil. Les équipes en trop se replient derrière « + »."><div className="fl-w">
        <div className="fl-in" style={{ marginBottom: 10 }}><span>⌕</span>Joueur, variation…<i>/</i></div>
        <div className="fl-tm"><span className="all">TOUTES</span>{['PHI', 'MIN', 'BOS', 'LAL', 'GSW', 'NYK', 'MIA', 'DEN'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''}><Lg t={t} /></span>)}<span className="all">+ 22</span></div>
      </div></Bay>

      <Bay id="s8" n="07" title="Barre collante : recherche + filtres + vues restent en haut du scroll" desc="Une fois la page défilée, une barre compacte de 52 px reste collée sous l'en-tête : la recherche, un bouton Filtres avec une pastille jaune (nombre de filtres actifs) et les 3 vues en carrés à icônes. On peut changer de filtre sans remonter tout en haut."><div className="fl-w"><div className="fl-rail"><div className="fl-in"><span>⌕</span>Rechercher…</div><span className="fl-ico on">☰<span className="fl-badge">3</span></span><span className="fl-ico on">▦</span><span className="fl-ico">⏱</span><span className="fl-ico">▤</span></div></div></Bay>

      <Bay id="s9" n="08" title="Téléphone : recherche + une ligne de filtres qui défile" desc="Sur mobile, la recherche en haut puis une seule rangée horizontale de boutons carrés (RC, AUTO, NUM, PATCH, MÉMO, VENTE, PRIVÉ…) que l'on fait défiler du doigt ; les actifs sont pleins. Les collections viennent juste dessous en onglets. Deux rangées au lieu de quatre."><div className="fl-ph"><div className="top sf">Collection</div><div className="pad"><div className="fl-in"><span>⌕</span>Joueur, variation…</div></div>
        <div className="fl-scroll"><B c="rc" on>RC</B><B c="au">Auto</B><B c="nu"># Num</B><B c="pa">Patch</B><B>Mémo</B><B>Vente</B><B>Privé</B></div>
        <div className="fl-tabs" style={{ margin: '4px 10px 0', gap: 16, overflow: 'hidden' }}>{COLS.slice(0, 4).map(([n], i) => <span key={n} className={`sf${i === 1 ? ' on' : ''}`} style={{ fontSize: 16 }}>{n}</span>)}</div><div style={{ height: 14 }} /></div></Bay>

      <Bay id="s10" n="09" title="Téléphone : feuille de filtres qui monte du bas" desc="Un bouton « Filtres » ouvre une feuille à bord blanc épais avec des sections (Atouts, Statut, Équipe, Collection) et deux boutons en bas : Réinitialiser et Voir les 14 cartes. Tout le détail sans encombrer l'écran ; la recherche reste toujours visible au-dessus."><div className="fl-ph" style={{ minHeight: 440, display: 'flex', flexDirection: 'column' }}><div className="top sf">Collection</div><div style={{ flex: 1, opacity: .35, padding: 10 }}><div className="fl-in">Joueur, variation…</div></div>
        <div className="fl-sheet"><h4 className="sf">Filtres</h4>
          <div className="sec">Atouts</div><div className="grp"><B c="rc" on>RC</B><B c="au" on>Auto</B><B c="nu"># Num</B><B c="pa">Patch</B></div>
          <div className="sec">Statut</div><div className="grp"><B>Mémo</B><B>Vente</B><B>Privé</B></div>
          <div className="sec">Équipe</div><div className="fl-tm" style={{ gap: 4 }}>{['PHI', 'MIN', 'BOS', 'LAL'].map((t, i) => <span key={t} className={i === 0 ? 'on' : ''} style={{ width: 38, height: 38 }}><Lg t={t} /></span>)}</div>
          <div className="go"><span>Réinitialiser</span><span className="p">Voir 14 cartes</span></div></div></div></Bay>

      <Bay id="s11" n="10" title="Téléphone : recherche + bouton Filtres avec pastille + vues" desc="La version la plus compacte : une seule ligne avec la recherche, un carré « Filtres » avec une pastille jaune du nombre de filtres actifs et les vues. Sous la ligne, les filtres actifs en étiquettes avec croix et le compteur de résultats. Tout le reste est dans la feuille (idée 09)."><div className="fl-ph"><div className="top sf">Collection</div>
        <div className="pad" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="fl-in" style={{ flex: 1 }}><span>⌕</span>Rechercher…</div><span className="fl-ico on">☰<span className="fl-badge">3</span></span><span className="fl-ico">▦</span></div>
        <div className="fl-row" style={{ margin: '0 10px', gap: 6 }}><span className="fl-chip">RC <b>✕</b></span><span className="fl-chip">Auto <b>✕</b></span><span className="fl-chip">PHI <b>✕</b></span></div>
        <div className="fl-res" style={{ margin: '10px 10px 14px' }}><span className="n sf" style={{ fontSize: 34 }}>14</span><span>cartes</span><span className="fl-clear">Effacer</span></div></div></Bay>

      <Bay id="s12" n="11" title="Le filtre se lit comme une phrase" desc="Au lieu d'une pile de boutons, une grande phrase en Surfquest : « Je cherche des [RC] [Auto] de [Philadelphia] dans [Toutes mes cartes] ». Chaque mot encadré est cliquable et ouvre son choix ; les atouts gardent leur couleur. Ludique, très lisible, et ça rappelle la recherche en langage naturel déjà présente."><div className="fl-w">
        <div className="fl-sent sf"><span className="pl">Je cherche</span><span className="tk rc">RC <small>✕</small></span><span className="tk au">Auto <small>✕</small></span><span className="pl">de</span><span className="tk">Philadelphia <small>▾</small></span><span className="pl">dans</span><span className="tk">Toutes mes cartes <small>▾</small></span></div>
        <div className="fl-row"><B>+ Num</B><B>+ Patch</B><B>+ Mémo</B><B>+ Vente</B><B>+ Privé</B><B>Avancés ▾</B></div>
      </div></Bay>

      <Bay id="s13" n="12" title="Colonne de filtres à gauche (desktop), cartes à droite" desc="Comme une boutique : une colonne à filet blanc avec des groupes (Atouts, Statut, Équipe, Collection), des cases carrées à cocher et le nombre de cartes à droite de chaque ligne en Surfquest. La grille de cartes occupe le reste. Beaucoup de place pour les filtres avancés, et la recherche reste au-dessus."><div className="fl-w"><div className="fl-side">
        <aside>
          <div className="g"><h5>Atouts</h5>{[['RC', 119, true], ['Auto', 29, true], ['# Num', 91, false], ['Patch', 23, false]].map(([l, n, on]) => <div key={String(l)} className={`it${on ? ' on' : ''}`}><i />{l}<b>{n}</b></div>)}</div>
          <div className="g"><h5>Statut</h5>{[['Mémo', 8], ['Vente', 12], ['Privé', 4]].map(([l, n]) => <div key={String(l)} className="it"><i />{l}<b>{n}</b></div>)}</div>
          <div className="g"><h5>Équipe</h5>{[['Philadelphia', 312], ['Minnesota', 41], ['Boston', 27]].map(([l, n]) => <div key={String(l)} className="it"><i />{l}<b>{n}</b></div>)}</div>
        </aside>
        <div className="main"><div className="fl-in"><span>⌕</span>Joueur, variation…<i>/</i></div><div className="fl-row"><span className="fl-chip">RC <b>✕</b></span><span className="fl-chip">Auto <b>✕</b></span></div><div className="ph">{[0, 1, 2, 3].map(i => <div key={i} />)}</div></div>
      </div></div></Bay>

      <Bay id="s14" n="13" title="Filtres enregistrés : « Mes RC », « Autos à vendre »…" desc="Une rangée de gros boutons nommés en Surfquest qui appliquent en un clic une combinaison (avec le nombre de cartes) : Mes RC, Autos à vendre, Numérotées /25 et moins, Non classées. Un bouton pointillé « + Enregistrer ce filtre » permet de créer les siens. Les réglages détaillés restent dans Filtres avancés."><div className="fl-w">
        <div className="fl-in" style={{ marginBottom: 12 }}><span>⌕</span>Joueur, variation…<i>/</i></div>
        <div className="fl-pre sf"><span className="on">Toutes <small>599</small></span><span>Mes RC <small>119</small></span><span>Autos à vendre <small>6</small></span><span>/25 et moins <small>14</small></span><span>Non classées <small>38</small></span><span className="sv">+ Enregistrer ce filtre</span></div>
      </div></Bay>

      <Bay id="s15" n="14" title="Recherche à étiquettes : on tape, ça devient des filtres" desc="La recherche accepte des mots libres : en tapant « 76ers auto » les suggestions proposent « Équipe : Philadelphia 76ers » et « Atout : Auto » ; valider les transforme en étiquettes carrées (avec ✕) dans la barre elle-même. Un seul champ remplace équipe + boutons, et ça s'appuie sur l'analyseur de recherche en langage naturel du site."><div className="fl-w">
        <div className="fl-tok"><span>⌕</span><span className="t"><em>Équipe</em> Philadelphia 76ers <b>✕</b></span><span className="t"><em>Atout</em> Auto <b>✕</b></span><span className="cur">saric</span></div>
        <div className="fl-sug"><div className="on"><em>Joueur</em>Dario Saric</div><div><em>Joueur</em>Dario Saric — Flawless</div><div><em>Variation</em>Saric Prizm</div><div><em>Équipe</em>Sacramento Kings</div></div>
      </div></Bay>

      <Bay id="s16" n="15" title="Gros carrés d'atouts avec icône + bascule ET / OU" desc="Quatre gros carrés (RC, AUTO, NUM, PATCH) avec une icône, le nombre en Surfquest 40 px et la couleur de l'atout ; plein quand actif. Un petit sélecteur « ET | OU » dit si une carte doit avoir tous les atouts cochés ou un seul. Sur téléphone ils passent 2 × 2 en pleine largeur, faciles à toucher."><div className="fl-w">
        <div className="fl-big4"><div className="c1 on"><span className="ic">★</span><b className="sf">119</b><i>RC</i></div><div className="c2"><span className="ic">✍</span><b className="sf">29</b><i>Auto</i></div><div className="c3 on"><span className="ic">#</span><b className="sf">91</b><i>Num</i></div><div className="c4"><span className="ic">▣</span><b className="sf">23</b><i>Patch</i></div></div>
        <div className="fl-row"><span className="fl-lbl">Les cartes doivent avoir</span><span className="fl-andor"><span className="on">TOUS</span><span>UN SEUL</span></span></div>
      </div></Bay>

      <Bay id="s17" n="16" title="Barre de résultats : compteur géant, tri et vues alignés" desc="Une bande à filet épais juste au-dessus des cartes : le nombre de résultats en gros Surfquest (« 14 cartes sur 599 »), le tri en segment (Récentes | A→Z | Valeur) et les 3 vues (Grille, Chronologie, Compact) en carrés à icônes à droite. Les vues cessent de flotter seules au-dessus de la grille."><div className="fl-w"><div className="fl-resbar"><span className="n sf">14</span><span className="lb">cartes sur 599</span><span className="sp" /><span className="fl-seg"><span className="on">Récentes</span><span>A → Z</span><span>Valeur</span></span><span className="fl-seg"><span className="on">▦</span><span>⏱</span><span>▤</span></span></div></div></Bay>

      <Bay id="s18" n="17" title="Filtres avancés en curseurs : année et tirage" desc="« Filtres avancés » s'ouvre sur des curseurs à deux poignées carrées avec les valeurs en gros Surfquest (Année 1986 → 2026, Tirage /1 → /999) plutôt que des champs à remplir. Ce sont des exemples de champs : on y brancherait ceux qui existent déjà (année, marque, tirage, grade…)."><div className="fl-w" style={{ maxWidth: 520 }}>
        <div className="fl-rng"><div className="hd"><span>Année</span><b className="sf">1989 – 2019</b></div><div className="tr"><span className="fi" style={{ left: '20%', right: '25%' }} /><span className="th" style={{ left: '20%' }} /><span className="th" style={{ left: '75%' }} /></div></div>
        <div className="fl-rng"><div className="hd"><span>Tirage maximum</span><b className="sf">/ 99</b></div><div className="tr"><span className="fi" style={{ left: '0%', right: '60%' }} /><span className="th" style={{ left: '0%' }} /><span className="th" style={{ left: '40%' }} /></div></div>
        <div className="fl-row"><B>Marque ▾</B><B>Grade ▾</B><B>Réinitialiser</B></div>
      </div></Bay>

      <Bay id="s19" n="18" title="Collections visuelles : un dossier avec une carte en couverture" desc="Les collections (« Philadelphia 76ers », « Old School »…) deviennent des tuiles carrées de 150 px avec une carte de la collection qui dépasse en couverture, le nom en Surfquest et le nombre de cartes. Défilement horizontal, la tuile active a le double filet. Beaucoup plus visuel que de simples pastilles."><div className="fl-w"><div className="fl-cov">{[['Toutes', 599, 0], ['Philadelphia 76ers', 312, 1], ['Old School', 88, 4], ['Frenchies', 41, 3], ['Football', 72, 2]].map(([n, c, k], i) => <div key={String(n)} className={`fl-cv${i === 1 ? ' on' : ''}`}><div className="im"><img src={C[(['mccain', 'edwards', 'mcw', 'maxey', 'hawkins', 'luwawu'] as const)[Number(k) % 6]].img} alt="" /></div><div className="tx"><b className="sf">{n}</b><small>{c} cartes</small></div></div>)}</div></div></Bay>

      <Bay id="s20" n="19" title="Téléphone : barre du bas à 4 boutons (Recherche, Filtres, Tri, Vues)" desc="Une barre fixe en bas de l'écran, à portée du pouce : quatre cases carrées avec icône et libellé. Chacune ouvre sa feuille ; « Filtres » porte une pastille jaune avec le nombre de filtres actifs. La zone des cartes reste dégagée en haut."><div className="fl-ph" style={{ minHeight: 330, display: 'flex', flexDirection: 'column' }}><div className="top sf">Collection</div><div style={{ flex: 1, padding: 10 }}><div className="fl-res" style={{ margin: '0 0 10px' }}><span className="n sf" style={{ fontSize: 30 }}>14</span><span>cartes</span></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{[0, 1, 2, 3].map(i => <div key={i} style={{ aspectRatio: '2.5/3.5', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)' }} />)}</div></div>
        <div className="fl-bot"><div><span className="ic">⌕</span><i>Recherche</i></div><div className="on"><span className="ic">☰</span><i>Filtres</i><span className="fl-badge">3</span></div><div><span className="ic">⇅</span><i>Tri</i></div><div><span className="ic">▦</span><i>Vues</i></div></div></div></Bay>

      <Bay id="s21" n="20" title="Téléphone : recherche plein écran avec récents et raccourcis" desc="Toucher la recherche l'ouvre en plein écran : champ en haut, puis « Récents » (Saric, Prizm auto, Iguodala…) avec leur nombre de résultats, puis une rangée de raccourcis (Mes RC, Autos, Numérotées). Pratique au clavier du téléphone, qui prend la moitié de l'écran de toute façon."><div className="fl-ph"><div className="fl-ov"><div className="hd"><span style={{ fontSize: 22 }}>‹</span><div className="fl-in"><span>⌕</span>sar<i>✕</i></div></div>
        <div className="sec">Récents</div><div className="rec sf"><div>Saric<i>14 cartes</i></div><div>Prizm auto<i>6 cartes</i></div><div>Iguodala<i>9 cartes</i></div></div>
        <div className="sec">Raccourcis</div><div className="fl-scroll" style={{ flexWrap: 'wrap', overflow: 'visible' }}><B c="rc">Mes RC</B><B c="au">Autos</B><B c="nu">/25 et moins</B><B>À vendre</B></div></div></div></Bay>
    </div>
  )
}
