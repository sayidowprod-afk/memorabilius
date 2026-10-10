'use client'
import { useState } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 19 : visualiseur, meme contenu et memes boutons, 10 peaux a la nouvelle DA (ordinateur + mobile). Tout le style est ici, prefixe .ix.

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

/* serie 12 */
.ix .pnl { max-width: 560px; border: 3px solid #fff; } .ix .pnl > h4 { margin: 0; background:#fff; padding: 7px 14px; font-size: 20px; } .ix .pnl > h4, .ix .pnl > h4 * { color:#06122e !important; }
.ix .row2 { display:flex; align-items:center; gap: 12px; padding: 9px 14px; border-top: 1px solid rgba(255,255,255,.16); font-size: 14px; } .ix .row2 .n { width: 24px; font-size: 22px; } .ix .row2 .av { width: 30px; height: 30px; background:#2f6bff; display:flex; align-items:center; justify-content:center; font-size: 15px; } .ix .row2 b { flex:1; } .ix .row2 em { font-style:normal; font-weight:800; } .ix .row2 .up { color:#3ddc97 !important; font-size: 12px; font-weight:800; }
.ix .row2.me { background: rgba(255,255,255,.12); }
.ix .big { font-size: 44px; line-height: .9; } .ix .bar { height: 18px; background: rgba(255,255,255,.14); margin: 10px 0 6px; position:relative; } .ix .bar i { position:absolute; left:0; top:0; bottom:0; background:#fff; } .ix .sm { font: 700 11px system-ui; letter-spacing:.12em; text-transform:uppercase; opacity:.7; }
.ix .pad { padding: 14px; }
.ix .mini { display:flex; gap: 8px; } .ix .mini img { width: 64px; } .ix .grid4 { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; } .ix .grid4 .c small { display:block; text-align:center; font: 700 10px system-ui; margin-top: 4px; opacity:.8; }
.ix .match { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.16); display:flex; gap: 12px; align-items:center; font-size: 13px; } .ix .match img { width: 38px; } .ix .match .gold { color:#ffd54a !important; font-weight:800; }
.ix .pin { border-left: 6px solid #ffd54a; background: rgba(255,213,74,.1); padding: 12px 16px; max-width: 560px; } .ix .pin .sm { color:#ffd54a !important; }
.ix .rsvp { display:flex; gap: 8px; margin-top: 10px; }
.ix .week { max-width: 560px; border: 3px solid #fff; padding: 16px; } .ix .week .k { display:grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 12px 0; }
.ix .sv { display:flex; gap: 8px; flex-wrap:wrap; } .ix .sv span { border: 2px solid #fff; padding: 7px 14px; font: 800 12px system-ui; letter-spacing:.08em; text-transform:uppercase; } .ix .sv span.on { background:#fff; } .ix .sv span.on, .ix .sv span.on * { color:#06122e !important; } .ix .sv span.add { border-style: dashed; opacity:.7; }
.ix .tl { max-width: 520px; position:relative; padding-left: 22px; } .ix .tl:before { content:''; position:absolute; left: 6px; top: 6px; bottom: 6px; width: 3px; background:#fff; } .ix .tl .st { position:relative; padding: 0 0 16px; font-size: 14px; } .ix .tl .st:before { content:''; position:absolute; left:-22px; top: 4px; width: 15px; height: 15px; background:#06122e; border: 3px solid #fff; } .ix .tl .st.done:before { background:#fff; } .ix .tl .st small { display:block; opacity:.65; font-size: 12px; }
.ix .chart { max-width: 560px; border: 3px solid #fff; padding: 14px; } .ix .chart svg { width:100%; height: 120px; display:block; }
.ix .doc { display:flex; gap: 12px; align-items:center; padding: 10px 14px; border-top: 1px solid rgba(255,255,255,.16); } .ix .doc img { width: 44px; } .ix .doc .x2 { background:#ffd54a; padding: 2px 8px; font: 800 12px system-ui; } .ix .doc .x2, .ix .doc .x2 * { color:#06122e !important; }
.ix .two { display:grid; grid-template-columns: 1fr 1fr; max-width: 560px; border: 3px solid #fff; } .ix .two > div { padding: 12px 14px; } .ix .two > div + div { border-left: 1px solid rgba(255,255,255,.25); } .ix .two h5 { margin: 0 0 8px; font: 800 11px system-ui; letter-spacing:.14em; text-transform:uppercase; opacity:.7; }
.ix .bulkbar { max-width: 560px; background:#fff; display:flex; align-items:center; gap: 10px; padding: 10px 14px; flex-wrap:wrap; } .ix .bulkbar, .ix .bulkbar * { color:#06122e !important; } .ix .bulkbar b { font-size: 18px; margin-right: auto; } .ix .bulkbar span.b { border: 2px solid #06122e; padding: 5px 10px; font: 800 11px system-ui; letter-spacing:.08em; text-transform:uppercase; }
.ix .doc2 { max-width: 460px; background:#fff; padding: 18px; } .ix .doc2, .ix .doc2 * { color:#06122e !important; } .ix .doc2 .l { display:flex; justify-content:space-between; font-size: 12px; padding: 5px 0; border-bottom: 1px solid #ccd; } .ix .doc2 .t { display:flex; justify-content:space-between; margin-top: 10px; font-size: 26px; }
.ix .pcard { max-width: 560px; display:flex; gap: 14px; } .ix .pcard .info { flex:1; } .ix .own { font: 800 11px system-ui; letter-spacing:.1em; text-transform:uppercase; padding: 3px 8px; display:inline-block; margin-top: 6px; } .ix .own.y { background:#3ddc97; } .ix .own.y, .ix .own.y * { color:#06122e !important; } .ix .own.n { border: 2px solid #fff; }
.ix .roster12 { display:grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-width: 560px; } .ix .roster12 div { aspect-ratio: 1; display:flex; align-items:center; justify-content:center; border: 2px solid rgba(255,255,255,.3); font-size: 20px; } .ix .roster12 div.ok { background:#fff; } .ix .roster12 div.ok, .ix .roster12 div.ok * { color:#06122e !important; }
.ix .k3 { display:grid; grid-template-columns: repeat(3,1fr); gap: 10px; padding: 14px; } .ix .gold { color:#ffd54a !important; font-size: 12px; }
.ix .bar { max-width: 640px; }
/* serie 14 : maquettes du hero d'accueil */
.ix .hro { position: relative; max-width: 760px; height: 230px; border: 3px solid #fff; overflow: hidden; background: linear-gradient(135deg, #050912 0%, #0a2468 100%); }
.ix .hro .tx { position: relative; z-index: 3; padding: 20px 24px; }
.ix .hro .k { font: 800 11px system-ui; letter-spacing: .2em; }
.ix .hro .n { font-size: 84px; line-height: .9; margin: 14px 0 4px; }
.ix .hro .l { font: 800 11px system-ui; letter-spacing: .2em; }
.ix .hro .la { font-size: 12px; margin-top: 12px; }
.ix .hro:after { content: ''; position: absolute; inset: 0; z-index: 2; background: linear-gradient(90deg, rgba(5,9,18,.92) 0%, rgba(5,9,18,.55) 38%, transparent 70%); pointer-events: none; }
.ix .hro.h5:after, .ix .hro.h3:after { background: linear-gradient(90deg, rgba(5,9,18,.45) 0%, transparent 60%); }
.ix .hro .tiles { position: absolute; right: 0; top: 0; bottom: 0; width: 62%; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; padding: 6px; overflow: hidden; z-index: 1; opacity: .85; }
.ix .hro .tiles img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
.ix .hro .tiles img:nth-child(5n+2) { margin-top: -34px; } .ix .hro .tiles img:nth-child(5n+4) { margin-top: -62px; } .ix .hro .tiles img:nth-child(5n+3) { margin-top: -12px; }
.ix .hro .big1 { position: absolute; right: 30px; top: -30px; width: 260px; aspect-ratio: 2.5/3.5; object-fit: cover; transform: rotate(8deg); box-shadow: 0 20px 50px rgba(0,0,0,.6); z-index: 1; }
.ix .hro .court { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.ix .hro .strip { position: absolute; left: 0; right: 0; bottom: 8px; height: 96px; overflow: hidden; z-index: 1; opacity: .5; }
.ix .hro .strip > div { display: flex; gap: 8px; width: max-content; }
.ix .hro .strip img { height: 96px; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
.ix .hro.h5 { background: linear-gradient(100deg, #c8102e 0%, #1d428a 100%); }
.ix .hro .wm { position: absolute; right: 24px; top: -20px; font-size: 300px; line-height: 1; opacity: .22; z-index: 1; }
.ix .hro .pile { position: absolute; right: -20px; bottom: -60px; width: 330px; height: 300px; z-index: 1; }
.ix .hro .pile img { position: absolute; left: calc(var(--i) * 34px); bottom: calc(var(--i) * 4px); width: 130px; aspect-ratio: 2.5/3.5; object-fit: cover; transform: rotate(calc((var(--i) - 2) * 9deg)); box-shadow: 0 10px 28px rgba(0,0,0,.6); }
.ix .k4 { display: grid; grid-template-columns: repeat(4, 1fr); max-width: 620px; border: 3px solid #fff; } .ix .k4 > div { padding: 12px; text-align: center; border-right: 2px solid rgba(255,255,255,.22); } .ix .k4 > div:last-child { border-right: 0; } .ix .k4 b { display: block; font-size: 52px; line-height: .9; } .ix .k4 small { display: block; font: 800 11px system-ui; letter-spacing: .16em; margin-top: 4px; } .ix .k4 i { display: block; font-style: normal; font: 800 12px system-ui; color: #3ddc97 !important; min-height: 16px; margin-top: 2px; }
@media (max-width: 600px) { .ix .hro .n { font-size: 64px; }  .ix .hro .big1 { width: 190px; } .ix .hro .wm { font-size: 200px; } }
/* serie 15 */
.ix .hro.h7 { background: radial-gradient(ellipse at 75% 0%, #1b3a80 0%, #050912 70%); }
.ix .hro .spot { position: absolute; right: 90px; top: -20px; width: 340px; height: 300px; z-index: 1; background: conic-gradient(from 180deg at 50% 0%, transparent 150deg, rgba(255,235,170,.22) 180deg, transparent 210deg); }
.ix .hro .frames { position: absolute; right: 50px; top: 38px; z-index: 1; display: flex; gap: 14px; }
.ix .hro .frames img { width: 96px; aspect-ratio: 2.5/3.5; object-fit: cover; border: 3px solid #ffd54a; box-shadow: 0 0 0 3px #050912, 0 10px 24px rgba(0,0,0,.6); }
.ix .hro .holo { position: absolute; inset: 0; z-index: 1; background: linear-gradient(115deg, transparent 38%, rgba(255,90,160,.22) 44%, rgba(120,200,255,.28) 50%, rgba(140,255,170,.22) 56%, transparent 62%); }
.ix .hro .duo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 25%; filter: grayscale(1) contrast(1.15); mix-blend-mode: screen; opacity: .45; z-index: 1; }
.ix .hro.h9 { background: #0a2fa8; }
.ix .hro .binder { position: absolute; right: 24px; top: 14px; z-index: 1; display: grid; grid-template-columns: repeat(4, 74px); gap: 8px; }
.ix .hro .binder > div { aspect-ratio: 2.5/3.5; border: 2px solid rgba(255,255,255,.22); background: rgba(255,255,255,.05); overflow: hidden; } .ix .hro .binder img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ix .hro .amb { position: absolute; right: 70px; top: 28px; width: 130px; aspect-ratio: 2.5/3.5; object-fit: cover; z-index: 2; box-shadow: 0 14px 34px rgba(0,0,0,.6); }
.ix .hro .amb2 { position: absolute; right: -60px; top: -80px; width: 460px; aspect-ratio: 2.5/3.5; object-fit: cover; filter: blur(46px) saturate(1.5); opacity: .75; z-index: 1; }
.ix .hro .sky { position: absolute; inset: 0; z-index: 1; } .ix .hro .sky i { position: absolute; background: rgba(255,255,255,.75); border-radius: 50%; } .ix .hro .sky i.g { background: #ffd54a; box-shadow: 0 0 12px 3px rgba(255,213,74,.6); }
.ix .hdr { position: relative; max-width: 760px; height: 130px; border: 3px solid #fff; overflow: hidden; background: #050912; display: flex; flex-direction: column; justify-content: flex-end; padding: 16px 22px; } .ix .hdr .ph { position: absolute; inset: 0; display: flex; opacity: .32; } .ix .hdr .ph img { flex: 1; min-width: 0; object-fit: cover; object-position: 50% 30%; } .ix .hdr:after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #050912 15%, transparent); } .ix .hdr * { position: relative; z-index: 2; } .ix .hdr .ph, .ix .hdr .ph img { position: absolute; } .ix .hdr .ph img { position: relative; } .ix .hdr b { font-size: 46px; line-height: .9; }
.ix .ban { max-width: 560px; border: 3px solid #fff; background: #08153b; position: relative; padding-bottom: 14px; } .ix .ban .cv { height: 110px; overflow: hidden; } .ix .ban .cv img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; opacity: .75; } .ix .ban .av { width: 64px; height: 64px; border-radius: 50%; background: #2f6bff; border: 4px solid #08153b; margin: -32px 0 0 20px; display: flex; align-items: center; justify-content: center; font-size: 28px; } .ix .ban b { display: block; margin: 6px 20px 0; font-size: 30px; } .ix .ban small { margin: 0 20px; opacity: .7; }
.ix .team { max-width: 640px; border: 3px solid #fff; padding: 22px; display: flex; gap: 20px; align-items: center; background: linear-gradient(100deg, #c8102e, #1d428a); position: relative; overflow: hidden; } .ix .team .lg { font-size: 130px; line-height: .8; opacity: .3; } .ix .team b { display: block; font-size: 38px; line-height: .95; margin: 4px 0 10px; } .ix .team .k3t { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; } .ix .team .k3t i { font-style: normal; font-size: 24px; display: block; line-height: 1; }
.ix .cover { position: relative; max-width: 640px; height: 170px; border: 3px solid #fff; overflow: hidden; } .ix .cover img { width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; opacity: .5; } .ix .cover .o { position: absolute; left: 20px; bottom: 16px; } .ix .cover b { display: block; font-size: 40px; line-height: .95; }
.ix .ld { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; } .ix .ld .m { position: relative; font-size: 90px; line-height: 1; color: rgba(255,255,255,.2) !important; } .ix .ld .m i { position: absolute; left: 0; right: 0; bottom: 0; height: 62%; background: rgba(255,255,255,.9); mix-blend-mode: overlay; }
.ix .tex { max-width: 460px; padding: 24px; border: 3px solid #fff; background-color: #08153b; background-image: repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 1px, transparent 1px 7px); } .ix .tex b { display: block; font-size: 30px; } .ix .tex span { opacity: .7; font-size: 13px; }
.ix .tkt { position: relative; max-width: 520px; display: flex; align-items: center; gap: 14px; padding: 14px 22px; background: #0a0f20; border: 3px solid #fff; } .ix .tkt:before, .ix .tkt:after { content: ''; position: absolute; top: 50%; width: 22px; height: 22px; border-radius: 50%; background: #08153b; border: 3px solid #fff; transform: translateY(-50%); } .ix .tkt:before { left: -14px; } .ix .tkt:after { right: -14px; } .ix .tkt .side { display: flex; gap: 6px; } .ix .tkt .side img { width: 60px; aspect-ratio: 2.5/3.5; object-fit: cover; } .ix .tkt .mid { font-size: 34px; } .ix .tkt .stamp { position: absolute; right: 26px; bottom: 8px; border: 3px solid #ffd54a; color: #ffd54a !important; padding: 2px 8px; font-size: 16px; transform: rotate(-6deg); }
.ix .setc { display: flex; gap: 14px; align-items: center; max-width: 520px; border: 3px solid #fff; padding: 12px; } .ix .setc .cl { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; width: 92px; flex-shrink: 0; } .ix .setc .cl img, .ix .setc .cl div { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; background: rgba(255,255,255,.08); } .ix .setc b { display: block; font-size: 22px; line-height: 1; } .ix .setc .bar { max-width: none; margin: 8px 0 4px; }
/* serie 16 */
.ix .gdens { display: grid; gap: 6px; max-width: 560px; } .ix .gdens img { width: 100%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; }
.ix .peekw { position: relative; height: 210px; } .ix .peek { position: absolute; left: 60px; top: 20px; width: 300px; display: flex; gap: 12px; padding: 12px; background: #fff; box-shadow: 0 16px 40px rgba(0,0,0,.6); } .ix .peek, .ix .peek * { color: #06122e !important; } .ix .peek img { width: 110px; aspect-ratio: 2.5/3.5; object-fit: cover; } .ix .peek b { display: block; font-size: 22px; line-height: 1; } .ix .peek small { display: block; font-size: 11px; margin: 4px 0 8px; } .ix .peek .gold { font: 800 13px system-ui; }
.ix .sep { max-width: 520px; } .ix .sep .sh { display: flex; align-items: baseline; gap: 12px; padding: 8px 12px; background: #fff; margin: 8px 0; } .ix .sep .sh, .ix .sep .sh * { color: #06122e !important; } .ix .sep .sh b { font-size: 22px; } .ix .sep .sh span { flex: 1; font: 700 12px system-ui; } .ix .sep .sh i { font-style: normal; }
.ix .draw { display: flex; gap: 16px; max-width: 560px; border: 3px solid #fff; padding: 14px; } .ix .draw .dp { flex: 1; min-width: 0; }
.ix .ibar { display: inline-flex; border: 3px solid #fff; } .ix .ibar > div { padding: 10px 18px; text-align: center; border-right: 2px solid rgba(255,255,255,.3); cursor: pointer; } .ix .ibar > div:last-child { border-right: 0; } .ix .ibar b { display: block; font-size: 20px; } .ix .ibar small { font: 800 10px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .ibar .red, .ix .ibar .red * { color: #ff6b6f !important; }
.ix .fiche { display: flex; gap: 16px; max-width: 520px; border: 3px solid #fff; padding: 14px; } .ix .fiche .nav { display: flex; gap: 14px; align-items: center; margin-top: 12px; font: 800 12px system-ui; } .ix .fiche .nav span { border: 2px solid rgba(255,255,255,.5); padding: 3px 9px; }
.ix .sil { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; max-width: 520px; } .ix .sil > div { aspect-ratio: 2.5/3.5; border: 2px solid rgba(255,255,255,.2); background: rgba(255,255,255,.05); display: flex; align-items: center; justify-content: center; overflow: hidden; } .ix .sil > div.ok { border-color: #fff; } .ix .sil img { width: 100%; height: 100%; object-fit: cover; display: block; } .ix .sil span { font-size: 22px; opacity: .3; }
.ix .stick { max-width: 560px; border: 3px solid #fff; padding: 12px 14px; background: #0a0f20; }
.ix .bal { max-width: 520px; } .ix .scale { position: relative; height: 6px; background: rgba(255,255,255,.2); margin: 14px 0 10px; } .ix .scale:before { content: ''; position: absolute; left: 50%; top: -6px; width: 2px; height: 18px; background: #fff; } .ix .scale i { position: absolute; top: -7px; width: 20px; height: 20px; background: #3ddc97; margin-left: -10px; }
.ix .stampx { display: inline-block; border: 4px solid #3ddc97; padding: 10px 18px; transform: rotate(-3deg); } .ix .stampx, .ix .stampx * { color: #3ddc97 !important; } .ix .stampx b { display: block; font-size: 30px; line-height: 1; } .ix .stampx span { font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; }
.ix .cal { max-width: 360px; border: 3px solid #fff; } .ix .cal .ch { background: #fff; padding: 8px 14px; font-size: 20px; } .ix .cal .ch, .ix .cal .ch * { color: #06122e !important; } .ix .cal .cg { display: grid; grid-template-columns: repeat(7, 1fr); } .ix .cal .cg > div { aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 13px; border: 1px solid rgba(255,255,255,.1); position: relative; } .ix .cal .cg .ev { background: #ffd54a; } .ix .cal .cg .ev, .ix .cal .cg .ev * { color: #06122e !important; font-weight: 800; } .ix .cal .cg .now { outline: 2px solid #fff; outline-offset: -3px; }
.ix .conf2 { max-width: 440px; border: 3px solid #fff; } .ix .conf2 .f { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,.15); } .ix .conf2 .f i { width: 12px; height: 12px; border-radius: 50%; background: #3ddc97; } .ix .conf2 .f.o i { background: #ffb020; } .ix .conf2 .f.r i { background: #ff5a5f; } .ix .conf2 .f.o, .ix .conf2 .f.r { background: rgba(255,176,32,.1); } .ix .conf2 .f span { width: 90px; font: 700 11px system-ui; letter-spacing: .1em; text-transform: uppercase; opacity: .7; } .ix .conf2 .f b { font-size: 15px; }
.ix .help { position: relative; max-width: 420px; } .ix .help i { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 2px solid #fff; border-radius: 50%; font: 800 13px system-ui; font-style: normal; margin-left: 6px; } .ix .help .hb { margin-top: 10px; padding: 12px 14px; background: #fff; font-size: 13px; line-height: 1.4; } .ix .help .hb, .ix .help .hb * { color: #06122e !important; }
.ix .story { width: 220px; aspect-ratio: 9/16; border: 3px solid #fff; padding: 18px 14px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; background: linear-gradient(160deg, #050912, #0a2468); } .ix .story .n { font-size: 76px; line-height: .9; } .ix .story .mini { margin: 10px 0; gap: 5px; } .ix .story .mini img { width: 54px; }
/* serie 17 : visualiseur de carte */
.ix .vwd { display: flex; max-width: 860px; height: 380px; border: 3px solid #fff; background: #060b1a; overflow: hidden; }
.ix .vwd .stg { flex: 1.2; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 70%); min-width: 0; }
.ix .vwd .pn2 { flex: .9; min-width: 0; padding: 18px; border-left: 3px solid #fff; background: #08122b; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
.ix .vc { height: 78%; aspect-ratio: 2.5/3.5; object-fit: cover; display: block; box-shadow: 0 18px 44px rgba(0,0,0,.6); border-radius: 0; }
.ix .stgc { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; } .ix .stgc .vc { height: 66%; }
.ix .eb { font: 800 11px system-ui; letter-spacing: .18em; text-transform: uppercase; opacity: .75; }
.ix .nm { display: block; font-size: 38px; line-height: .95; }
.ix .tg { display: flex; gap: 6px; flex-wrap: wrap; } .ix .tg span, .ix .bigtags span { padding: 3px 9px; font: 800 12px system-ui; letter-spacing: .1em; } .ix .rc { background: #e67e22; } .ix .au { background: #2e7d32; } .ix .nu { background: #7b1fa2; } .ix .pa { background: #1976d2; }
.ix .bigtags { display: flex; gap: 8px; } .ix .bigtags span { padding: 7px 14px; font-size: 16px; } .ix .tir { font-size: 78px; line-height: .85; color: #ffd54a !important; text-shadow: 0 0 24px rgba(255,213,74,.4); }
.ix .tl4 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .ix .tl4 > div { border: 2px solid rgba(255,255,255,.28); padding: 7px 9px; min-width: 0; } .ix .tl4 small { display: block; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; opacity: .65; } .ix .tl4 b { font-size: 16px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .tl4.ico > div { display: grid; grid-template-columns: 22px 1fr; column-gap: 8px; } .ix .tl4.ico i { grid-row: 1 / 3; font-style: normal; font-size: 18px; align-self: center; }
.ix .act { display: flex; gap: 6px; margin-top: auto; } .ix .act span { flex: 1; text-align: center; border: 2px solid #fff; padding: 8px 4px; font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .act .p { background: #fff; color: #06122e !important; }
.ix .plq { padding: 8px 18px; background: linear-gradient(180deg, #d9b45a, #a8832f); text-align: center; } .ix .plq, .ix .plq * { color: #2a1d05 !important; } .ix .plq b { display: block; font-size: 20px; } .ix .plq small { font: 700 11px system-ui; letter-spacing: .06em; }
.ix .vb small { font: 800 11px system-ui; letter-spacing: .14em; opacity: .7; } .ix .vb b { display: block; font-size: 52px; line-height: .9; }
.ix .cpy { display: flex; align-items: center; gap: 10px; border: 2px solid rgba(255,255,255,.4); padding: 8px 10px; font-size: 13px; } .ix .cpy span { flex: 1; min-width: 0; }
.ix .three { display: flex; gap: 18px; flex-wrap: wrap; }
.ix .phn { width: 230px; height: 440px; border: 4px solid #fff; background: #060b1a; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.ix .phn .pt { flex: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 70%); min-height: 0; position: relative; } .ix .phn .pt .vc { height: 82%; }
.ix .phn .ps { flex: 0 0 auto; background: #08122b; border-top: 3px solid #fff; padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; max-height: 70%; overflow: hidden; }
.ix .grip { width: 40px; height: 4px; background: rgba(255,255,255,.55); margin: 0 auto 2px; }
.ix .fab { display: flex; justify-content: space-around; border-top: 2px solid rgba(255,255,255,.3); padding-top: 8px; font-size: 22px; } .ix .fab .rd { filter: hue-rotate(-30deg); }
.ix .swp { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 4px; } .ix .swp .ar { font-size: 40px; opacity: .5; } .ix .swp .cnt { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font: 800 12px system-ui; letter-spacing: .14em; border: 2px solid #fff; padding: 2px 10px; } .ix .swp .vc { height: 70%; }
.ix .dots { display: flex; gap: 6px; justify-content: center; } .ix .dots i { width: 8px; height: 8px; background: rgba(255,255,255,.3); } .ix .dots i.on { background: #fff; }
.ix .rail { display: flex; gap: 6px; } .ix .rail img { width: 36px; aspect-ratio: 2.5/3.5; object-fit: cover; opacity: .55; } .ix .rail img.on { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
.ix .stgc.amb { overflow: hidden; } .ix .glow { position: absolute; width: 90%; height: 90%; object-fit: cover; filter: blur(50px) saturate(1.6); opacity: .65; left: 5%; top: 5%; } .ix .stgc.amb .vc { position: relative; z-index: 1; } .ix .refl { position: absolute; bottom: 0; left: 20%; right: 20%; height: 10%; background: radial-gradient(ellipse, rgba(255,255,255,.18), transparent 70%); }
.ix .stgc.vit { background: #03060f; } .ix .stgc.vit .cone { position: absolute; top: 0; width: 70%; height: 100%; background: conic-gradient(from 180deg at 50% 0%, transparent 155deg, rgba(255,235,170,.2) 180deg, transparent 205deg); } .ix .stgc.vit .frm { position: relative; padding: 10px; border: 4px solid #ffd54a; box-shadow: 0 0 0 4px #03060f; } .ix .stgc.vit .vc { height: 230px; box-shadow: none; }
.ix .seg2 { display: flex; border: 3px solid #fff; } .ix .seg2 > div { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; } .ix .seg2 > div + div { border-left: 2px solid rgba(255,255,255,.4); } .ix .seg2 img { width: 24px; aspect-ratio: 2.5/3.5; object-fit: cover; } .ix .seg2 .on { background: #fff; } .ix .seg2 .on, .ix .seg2 .on * { color: #06122e !important; }
.ix .two2 { display: flex; align-items: center; gap: 10px; height: 80%; } .ix .two2 .vc { height: 100%; } .ix .vs { font-size: 28px; color: #ffd54a !important; }
.ix .cmp > div { display: grid; grid-template-columns: 70px 1fr 1fr; border-bottom: 1px solid rgba(255,255,255,.2); padding: 7px 0; } .ix .cmp small { font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; opacity: .65; } .ix .cmp b { font-size: 16px; } .ix .up { color: #3ddc97 !important; font: 800 12px system-ui; }
.ix .vb2 b { font-size: 70px; line-height: .85; display: block; } .ix .vb2 svg { width: 100%; height: 44px; margin-top: 8px; }
.ix .setp b { font-size: 34px; } .ix .setp .bar { max-width: none; margin: 6px 0; } .ix .setp small { font-size: 12px; opacity: .75; }
.ix .full { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; } .ix .full .vc { height: 86%; } .ix .full .cap { font-size: 16px; }
/* serie 18 : ecrans complets du visualiseur */
.ix .pair { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.ix .scr { position: relative; width: 760px; max-width: 100%; height: 430px; border: 3px solid #fff; background: #060b1a; overflow: hidden; display: flex; }
.ix .scr .stg { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 72%); min-width: 0; }
.ix .scr .big { font-size: 56px; line-height: .9; display: block; }
.ix .scr .gold { color: #ffd54a !important; }
.ix .phn2 { width: 210px; height: 430px; border: 4px solid #fff; background: #060b1a; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.ix .phn2 .pt { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 72%); position: relative; overflow: hidden; }
.ix .phn2 .ps { flex: 0 0 auto; border-top: 3px solid #fff; background: #08122b; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; max-height: 58%; overflow: hidden; }
.ix .phn2 .ps.paper { background: #f1f4fb; } .ix .phn2 .ps.paper, .ix .phn2 .ps.paper * { color: #06122e !important; } .ix .phn2 .ps.paper .tl4 > div { border-color: rgba(6,18,46,.3); }
.ix .phn2 .ps.ov { background: rgba(8,18,43,.7); }
.ix .phn2 .ps.bands { padding: 0; gap: 0; background: #fff; } .ix .phn2 .ps.bands > div { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 2px solid #06122e; font-size: 12px; } .ix .phn2 .ps.bands, .ix .phn2 .ps.bands * { color: #06122e !important; }
.ix .phn2 .ps.col1 { gap: 6px; } .ix .blk { border: 2px solid rgba(255,255,255,.4); padding: 8px 10px; }
.ix .phn2 .tl4 b { font-size: 12px; } .ix .phn2 .tl4 small { font-size: 9px; } .ix .phn2 .tl4 { gap: 4px; } .ix .phn2 .tl4 > div { padding: 4px 6px; }
.ix .phn2 .tg span { font-size: 10px; padding: 2px 6px; } .ix .phn2 .fab { font-size: 17px; padding-top: 4px; }
.ix .phn2 .plq { padding: 5px 8px; } .ix .phn2 .plq b { font-size: 14px; } .ix .phn2 .plq small { font-size: 9px; }
.ix .cone { position: absolute; top: 0; left: 15%; width: 70%; height: 100%; background: conic-gradient(from 180deg at 50% 0%, transparent 155deg, rgba(255,235,170,.2) 180deg, transparent 205deg); pointer-events: none; }
.ix .frm { position: relative; padding: 8px; border: 4px solid #ffd54a; box-shadow: 0 0 0 4px #03060f; } .ix .frm .vc { box-shadow: none; }
.ix .v1 { background: #03060f; } .ix .v1 .mid { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; } .ix .v1 .side { width: 190px; border-left: 3px solid #fff; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #08122b; } .ix .v1m { background: #03060f !important; flex-direction: column; }
.ix .v2 .paperp { width: 300px; background: #f1f4fb; padding: 18px; display: flex; flex-direction: column; gap: 10px; border-left: 3px solid #fff; } .ix .v2 .paperp, .ix .v2 .paperp * { color: #06122e !important; } .ix .v2 .rows > div { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 2px solid #06122e; font-size: 14px; } .ix .v2 .btnrow { display: flex; gap: 6px; margin-top: auto; } .ix .v2 .btnrow span { flex: 1; text-align: center; padding: 9px 4px; border: 3px solid #06122e; font: 800 11px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .v2 .btnrow .p { background: #06122e; color: #fff !important; }
.ix .v3 { background: #060b1a; } .ix .wmk { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font-size: 190px; line-height: 1; color: rgba(255,255,255,.07) !important; white-space: nowrap; z-index: 0; } .ix .v3 .stg, .ix .v3 .txt { position: relative; z-index: 1; background: none; } .ix .v3 .txt { width: 270px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: center; gap: 10px; } .ix .v3m { overflow: hidden; } .ix .v3m .wmk { font-size: 70px; }
.ix .v4 .col { width: 190px; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #08122b; } .ix .v4 .col:first-child { border-right: 3px solid #fff; } .ix .v4 .col:last-child { border-left: 3px solid #fff; }
.ix .v5 { } .ix .v5 .stg { position: absolute; inset: 0; } .ix .v5 .ovl { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 16px; padding: 12px 18px; background: rgba(6,11,26,.78); border-top: 3px solid #fff; backdrop-filter: blur(8px); } .ix .v5 .ovl .sv { flex: 1; } .ix .v5 .ovl .act { margin: 0; width: 280px; }
.ix .lbl { display: flex; align-items: center; gap: 10px; background: #fff; padding: 6px 12px; border: 3px solid #fff; } .ix .lbl, .ix .lbl * { color: #06122e !important; } .ix .lbl .gr { font-size: 26px; padding: 0 6px; background: #06122e; color: #fff !important; } .ix .lbl b { display: block; font-size: 14px; } .ix .lbl small { font: 700 10px system-ui; } .ix .lbl .bc { width: 60px; height: 28px; background: repeating-linear-gradient(90deg, #06122e 0 2px, #fff 2px 4px, #06122e 4px 5px, #fff 5px 8px); }
.ix .v6 .side { width: 210px; border-left: 3px solid #fff; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #08122b; }
.ix .big4 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .ix .big4 > div { border: 2px solid rgba(255,255,255,.35); padding: 10px 6px; text-align: center; } .ix .big4 b { display: block; font-size: 30px; line-height: .9; } .ix .phn2 .big4 b { font-size: 18px; } .ix .big4 small { margin-top: 4px; }
.ix .v7 .pn { width: 280px; padding: 18px; display: flex; flex-direction: column; gap: 12px; border-left: 3px solid #fff; background: #08122b; }
.ix .topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 3px solid #fff; background: #08122b; font: 800 12px system-ui; letter-spacing: .1em; text-transform: uppercase; } .ix .topbar b { font-size: 18px; }
.ix .v8 { flex-direction: column; } .ix .v8 .stg { flex: 1; } .ix .floatp { position: absolute; right: 12px; top: 12px; width: 190px; padding: 10px; background: rgba(8,18,43,.82); border: 2px solid rgba(255,255,255,.6); display: flex; flex-direction: column; gap: 8px; } .ix .v8 .rail { padding: 8px; justify-content: center; border-top: 3px solid #fff; background: #08122b; }
.ix .rail { display: flex; gap: 6px; } .ix .rail img { width: 38px; aspect-ratio: 2.5/3.5; object-fit: cover; opacity: .55; } .ix .rail img.on { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
.ix .v9 { background: linear-gradient(110deg, #c8102e 0%, #7a1038 45%, #1d428a 100%); } .ix .v9 .stg { background: none; } .ix .v9 .wm { position: absolute; left: 20px; top: -30px; font-size: 380px; line-height: 1; color: rgba(255,255,255,.14) !important; } .ix .v9 .glass { width: 290px; margin: 16px; padding: 16px; background: rgba(5,9,18,.62); border: 2px solid rgba(255,255,255,.7); display: flex; flex-direction: column; gap: 10px; position: relative; z-index: 1; } .ix .v9m { background: linear-gradient(110deg, #c8102e, #1d428a) !important; } .ix .v9m .wm { position: absolute; font-size: 170px; color: rgba(255,255,255,.16) !important; line-height: 1; }
.ix .v10 .stg { background: linear-gradient(135deg, #0a2fa8, #061a63); } .ix .v10 .bandp { width: 300px; background: #fff; display: flex; flex-direction: column; border-left: 3px solid #fff; } .ix .v10 .bandp, .ix .v10 .bandp * { color: #06122e !important; } .ix .v10 .bandp .nm { padding: 14px 16px 10px; font-size: 32px; } .ix .v10 .bnd { display: flex; justify-content: space-between; padding: 11px 16px; border-top: 3px solid #06122e; font-size: 14px; } .ix .v10 .bnd span { font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; } .ix .v10 .act { margin: auto 12px 12px; } .ix .v10 .act span { border-color: #06122e; } .ix .v10 .act .p { background: #06122e; color: #fff !important; } .ix .v10m { background: linear-gradient(135deg, #0a2fa8, #061a63) !important; }
.ix .tkt2 { display: flex; align-items: center; gap: 22px; padding: 10px 20px; background: #fff; border-bottom: 3px solid #06122e; } .ix .tkt2, .ix .tkt2 * { color: #06122e !important; } .ix .tkt2 b { font-size: 30px; flex: 1; } .ix .tkt2 span { font-size: 24px; } .ix .tkt2 .gold { color: #b8860b !important; } .ix .v11 { flex-direction: column; } .ix .v11 .row { flex: 1; display: flex; min-height: 0; } .ix .v11 .pn { width: 300px; border-left: 3px solid #fff; padding: 16px; display: flex; flex-direction: column; gap: 10px; background: #08122b; } .ix .phn2 .tkt2 { padding: 6px 10px; flex-direction: column; align-items: flex-start; gap: 0; } .ix .phn2 .tkt2 b { font-size: 18px; } .ix .phn2 .tkt2 span { font-size: 12px; }
.ix .v12 { justify-content: center; background: #03060f; overflow-y: hidden; } .ix .colw { width: 330px; border-left: 3px solid rgba(255,255,255,.3); border-right: 3px solid rgba(255,255,255,.3); padding: 0 14px; display: flex; flex-direction: column; gap: 10px; background: #08122b; } .ix .stk { display: flex; justify-content: center; padding: 12px 0; background: radial-gradient(circle at 50% 50%, #0e2257, #08122b 75%); margin: 0 -14px; }
/* serie 19 : meme contenu, nouvelle peau */
.ix .pair { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.ix .scr2 { display: flex; width: 780px; max-width: 100%; height: 1030px; border: 3px solid #fff; background: #060b1a; overflow: hidden; }
.ix .stg2 { flex: 1; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 72%); min-width: 0; overflow: hidden; }
.ix .stg2 .vc { height: 62%; position: relative; z-index: 1; }
.ix .stg2 .glow { position: absolute; width: 95%; height: 70%; object-fit: cover; filter: blur(55px) saturate(1.7); opacity: .6; }
.ix .close { position: absolute; top: 10px; right: 10px; z-index: 3; padding: 4px 10px; border: 2px solid rgba(255,255,255,.6); font: 800 11px system-ui; letter-spacing: .06em; background: rgba(6,11,26,.7); } .ix .close.s { padding: 2px 8px; right: 6px; top: 6px; }
.ix .nav2 { position: absolute; bottom: 12px; left: 0; right: 0; display: flex; justify-content: center; gap: 8px; z-index: 3; } .ix .nav2 span { padding: 5px 10px; border: 2px solid rgba(255,255,255,.55); font: 800 11px system-ui; background: rgba(6,11,26,.7); }
.ix .pan2 { width: 340px; flex-shrink: 0; overflow: hidden; border-left: 3px solid #fff; background: #08122b; }
.ix .phn3 { width: 230px; height: 780px; border: 4px solid #fff; background: #060b1a; display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.ix .pt3 { flex: 0 0 150px; position: relative; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, #0e2257, #060b1a 72%); } .ix .pt3 .vc { height: 130px; }
.ix .ps3 { flex: 1; min-height: 0; position: relative; overflow: hidden; border-top: 3px solid #fff; background: #08122b; } .ix .ps3:after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 60px; background: linear-gradient(transparent, #08122b); pointer-events: none; }
.ix .phn3 .grip { width: 40px; height: 4px; background: rgba(255,255,255,.55); margin: 6px auto 0; }

/* contenu du panneau (base = A Filets) */
.ix .fp { padding: 16px; display: flex; flex-direction: column; gap: 9px; font-size: 13px; }
.ix .fp.cp { padding: 10px 12px; gap: 7px; font-size: 12px; }
.ix .fp .k { font: 800 11px system-ui; letter-spacing: .16em; text-transform: uppercase; color: #9fbdf5; }
.ix .fp .n { font-size: 36px; line-height: .95; margin: 0; text-decoration: underline; text-decoration-color: rgba(255,255,255,.25); text-underline-offset: 5px; } .ix .fp.cp .n { font-size: 26px; }
.ix .fp .vr { font-style: italic; font-weight: 700; color: #9fbdf5; }
.ix .fp .dz { font-size: 12px; line-height: 1.4; opacity: .7; }
.ix .fp .gr { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 4px; }
.ix .fp .gr > div { border: 2px solid rgba(255,255,255,.28); padding: 6px 8px; min-width: 0; } .ix .fp .gr > div.w { grid-column: 1 / -1; }
.ix .fp .gr small, .ix .fp label { display: block; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; opacity: .65; margin-bottom: 2px; } .ix .fp label { margin-bottom: 6px; }
.ix .fp .gr b { font-size: 14px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ix .fp .gr > div.w b { white-space: normal; }
.ix .fp .loc { font-size: 12px; opacity: .85; }
.ix .fp .sec { border-top: 2px solid rgba(255,255,255,.25); padding-top: 9px; }
.ix .fp .chips { display: flex; flex-wrap: wrap; gap: 6px; } .ix .fp .chips span { border: 2px solid #fff; padding: 3px 9px; font: 800 11px system-ui; letter-spacing: .06em; text-transform: uppercase; cursor: default; display: inline; background: none; align-items: initial; } .ix .fp .chips .add { border-style: dashed; opacity: .7; }
.ix .fp .setl { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; } .ix .fp .setl span { flex: 1 1 100%; } .ix .fp .setl i { font: 800 11px system-ui; font-style: normal; letter-spacing: .08em; text-transform: uppercase; border-bottom: 2px solid #fff; }
.ix .fp .acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 2px 0; } .ix .fp .acts span { text-align: center; border: 2px solid #fff; padding: 8px 2px; font: 800 11px system-ui; letter-spacing: .06em; text-transform: uppercase; } .ix .fp .acts .p { background: #fff; color: #06122e !important; } .ix .fp .acts .d { border-color: #ff6b6f; color: #ff8a8d !important; } .ix .fp .acts.v3 { grid-template-columns: 1fr 1fr 70px; }
.ix .fp .vrow { display: flex; align-items: center; gap: 8px; } .ix .fp .vrow .inp { border: 2px solid #fff; padding: 4px 12px; font-size: 20px; min-width: 70px; text-align: center; } .ix .fp .vrow b { font-size: 24px; } .ix .fp .ebay { margin-left: auto; font: 800 12px system-ui; border: 2px solid rgba(255,255,255,.4); padding: 4px 8px; } .ix .fp .ebay i { font-style: normal; font-weight: 900; } .ix .fp .ebay i:nth-child(1) { color: #e53238; } .ix .fp .ebay i:nth-child(2) { color: #0064d2; } .ix .fp .ebay i:nth-child(3) { color: #f5af02; } .ix .fp .ebay i:nth-child(4) { color: #86b817; }
.ix .fp .avs { display: flex; gap: 5px; align-items: center; } .ix .fp .avs i { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font: 800 13px system-ui; font-style: normal; } .ix .fp .avs em { font-style: normal; font: 800 12px system-ui; opacity: .7; }
.ix .fp .vis { opacity: .9; } .ix .fp .vis label { color: #ffd54a !important; opacity: 1; }
.ix .fp.cp .gr small { font-size: 9.5px; } .ix .fp.cp .gr b { font-size: 12px; } .ix .fp.cp .acts span { padding: 6px 1px; font-size: 9.5px; }

/* B bandes */
.ix .fp.b .gr { grid-template-columns: 1fr; gap: 0; background: #fff; margin-top: 4px; } .ix .fp.b .gr > div { display: flex; justify-content: space-between; align-items: baseline; border: 0; border-bottom: 2px solid #06122e; padding: 9px 12px; } .ix .fp.b .gr > div, .ix .fp.b .gr > div * { color: #06122e !important; } .ix .fp.b .gr small { margin: 0; opacity: .8; }
/* C papier */
.ix .pan2:has(.fp.c), .ix .ps3:has(.fp.c) { background: #f1f4fb; } .ix .ps3:has(.fp.c):after { background: linear-gradient(transparent, #f1f4fb); }
.ix .fp.c, .ix .fp.c * { color: #06122e !important; } .ix .fp.c .gr > div, .ix .fp.c .sec, .ix .fp.c .chips span, .ix .fp.c .acts span, .ix .fp.c .vrow .inp, .ix .fp.c .ebay { border-color: rgba(6,18,46,.55); } .ix .fp.c .acts .p { background: #06122e; color: #fff !important; } .ix .fp.c .acts .d { color: #c0262d !important; border-color: #c0262d; } .ix .fp.c .tg span { color: #fff !important; } .ix .fp.c .setl i { border-color: #06122e; } .ix .fp.c .vis label { color: #8a5a00 !important; }
/* D verre */
.ix .pan2:has(.fp.d) { background: rgba(8,18,43,.62); backdrop-filter: blur(6px); } .ix .fp.d .gr > div { background: rgba(255,255,255,.06); }
/* E musee */
.ix .fp.e .n { color: #2a1d05 !important; background: linear-gradient(180deg, #e3c36e, #a8832f); padding: 6px 10px; text-decoration: none; display: inline-block; align-self: flex-start; } .ix .fp.e .k, .ix .fp.e .vr { color: #ffd54a !important; } .ix .fp.e .gr > div, .ix .fp.e .sec, .ix .fp.e .chips span, .ix .fp.e .vrow .inp, .ix .fp.e .ebay { border-color: rgba(255,213,74,.6); } .ix .fp.e .acts span { border-color: #ffd54a; } .ix .fp.e .acts .p { background: #ffd54a; color: #2a1d05 !important; } .ix .pan2:has(.fp.e) { border-left-color: #ffd54a; }
/* F liste dense */
.ix .fp.f .gr { grid-template-columns: 1fr; gap: 0; } .ix .fp.f .gr > div { display: flex; justify-content: space-between; align-items: baseline; border: 0; border-bottom: 1px solid rgba(255,255,255,.2); padding: 5px 0; } .ix .fp.f .gr small { margin: 0; } .ix .fp.f { gap: 7px; }
/* G equipe */
.ix .pan2:has(.fp.g), .ix .ps3:has(.fp.g) { border-top: 8px solid #c8102e; } .ix .pan2:has(.fp.g) { border-top-color: #c8102e; border-image: linear-gradient(90deg, #c8102e 60%, #1d428a 60%) 1; border-top-width: 8px; } .ix .fp.g .k { color: #fff !important; background: #c8102e; align-self: flex-start; padding: 2px 8px; } .ix .fp.g .gr > div { border-color: rgba(29,66,138,.9); background: rgba(29,66,138,.18); } .ix .fp.g .chips span { border-color: #c8102e; }
/* H bleu plein */
.ix .pan2:has(.fp.h), .ix .ps3:has(.fp.h) { background: #0a3dd0; } .ix .ps3:has(.fp.h):after { background: linear-gradient(transparent, #0a3dd0); } .ix .fp.h .k, .ix .fp.h .vr, .ix .fp.h .dz { color: #fff !important; opacity: .9; } .ix .fp.h .gr > div { border-color: #fff; } .ix .fp.h .sec { border-color: rgba(255,255,255,.6); }
/* I tuiles */
.ix .fp.i .gr > div { aspect-ratio: 1.5; display: flex; flex-direction: column; justify-content: space-between; padding: 8px; } .ix .fp.i .gr b { font-size: 15px; white-space: normal; } .ix .fp.i .acts { grid-template-columns: 1fr 1fr 1fr; } .ix .fp.i .acts span { aspect-ratio: 1.5; display: flex; align-items: center; justify-content: center; padding: 2px; }
/* J barre d'actions collante */
.ix .fp.j .acts { position: sticky; bottom: 0; background: #08122b; border-top: 3px solid #fff; margin: 4px -16px -16px; padding: 10px 16px; gap: 6px; } .ix .fp.j.cp .acts { margin: 4px -12px -10px; padding: 8px 12px; }
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

const ALL = [C.mccain, C.edwards, C.maxey, C.hawkins, C.mcw, C.luwawu]

// Tout le contenu actuel du panneau du visualiseur, dans le meme ordre ; seule la peau change d'une version a l'autre
function Panel({ v, compact }: { v: string; compact?: boolean }) {
  return (
    <div className={`fp ${v}${compact ? ' cp' : ''}`}>
      <span className="k">Philadelphia 76ers</span>
      <h3 className="n sf">Jared McCain</h3>
      <div className="vr">Rookie Ticket Autographs</div>
      <div className="dz">2024-25 Panini Contenders Rookie Ticket Variation #12 Jared McCain</div>
      <div className="tg"><span className="rc">RC</span><span className="au">AUTO</span><span className="nu">/149</span></div>
      <div className="gr">
        <div><small>Année</small><b>2024-25</b></div>
        <div><small>Numérotation</small><b>/149</b></div>
        <div><small>Grade</small><b>Brut</b></div>
        <div><small>Collection</small><b>Panini Contenders</b></div>
        <div><small>Variation</small><b>Rookie Ticket</b></div>
        <div><small>✍️ Signé par</small><b>Jared McCain</b></div>
        <div className="w"><small>📝 Note du collectionneur</small><b>Pièce de mon PC Sixers</b></div>
      </div>
      <div className="loc">📍 <b>Classeur Rookies</b> · p.4 · A3</div>
      <div className="sec"><label>Mes collections</label><div className="chips"><span>Rookies ✕</span><span>Sixers ✕</span><span className="add">+ Ajouter</span></div></div>
      <div className="sec"><label>🃏 Setlist</label><div className="setl"><span>2024-25 Contenders · #12 Jared McCain</span><i>Changer</i><i>Retirer</i></div></div>
      <div className="acts"><span className="p">Modifier</span><span>À vendre</span><span>Vendue</span><span>Partager</span><span>⬇ Exporter</span><span className="d">🗑 Supprimer</span></div>
      <div className="sec val"><label>Valeur est.</label><div className="vrow"><span className="inp">45</span><b className="sf">€</b><span className="ebay"><i>e</i><i>B</i><i>a</i><i>y</i> 38 – 52 €</span></div></div>
      <div className="sec"><label>Autres collectionneurs de cette carte</label><div className="avs"><i style={{ background: '#e63a6e' }}>K</i><i style={{ background: '#2f6bff' }}>T</i><i style={{ background: '#1f9d55' }}>B</i><em>+2</em></div></div>
      <div className="sec vis"><label>Vue visiteur</label><div className="acts v3"><span className="p">Proposer un échange</span><span>Ajouter à ma galerie</span><span>🤍 18</span></div></div>
    </div>
  )
}
const Desk = ({ v, stage }: { v: string; stage?: React.ReactNode }) => (
  <div className={`scr2 ${v}`}>
    <div className="stg2"><div className="close">× Fermer cette carte</div>{stage ?? <img className="vc" src={C.mccain.img} alt="" />}<div className="nav2"><span>‹</span><span>🔍 Loupe</span><span>↻ Retourner</span><span>›</span></div></div>
    <div className="pan2"><Panel v={v} /></div>
  </div>
)
const Phone = ({ v }: { v: string }) => (
  <div className={`phn3 ${v}`}>
    <div className="pt3"><div className="close s">×</div><img className="vc" src={C.mccain.img} alt="" /></div>
    <div className="ps3"><div className="grip" /><Panel v={v} compact /></div>
  </div>
)

export default function DaIdeas() {
  const names = ['Filets', 'Bandes', 'Papier', 'Verre', 'Musée', 'Liste dense', 'Équipe', 'Bleu plein', 'Tuiles', 'Barre d’actions collante']
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 19 · Visualiseur : même contenu, nouvelle peau</h1>
      <p className="lead">Cette fois, rien n&apos;est retiré ni déplacé. Chaque maquette reprend TOUT le panneau actuel dans le même ordre : équipe, nom (lien vers la page joueur), variation, désignation, tags, infos (année, numérotation, grade, collection, variation, signature, note), localisation, mes collections, setlist, Modifier / À vendre / Vendue / Partager / Exporter / Supprimer, valeur estimée et eBay, autres collectionneurs, et la vue visiteur (échange, ajouter à ma galerie, j&apos;aime). Les boutons Fermer, Loupe, Retourner et flèches sont aussi là. Seul l&apos;habillage change. Chaque version est montrée sur ordinateur et sur téléphone (tiroir déplié, le contenu défile).</p>
      <nav className="tags">{names.map((t, i) => <a key={t} href={`#s${i + 1}`}>{String(i + 1).padStart(2, '0')} {t}</a>)}</nav>

      <Bay id="s1" n="A" title="Filets : la base de la nouvelle DA" desc="Cadres à doubles filets blancs, angles droits, libellés en petites capitales (11 px au lieu de 9), nom en Surfquest, boutons à filet blanc dont le principal est plein. Le plus proche de l'accueil."><div className="pair"><Desk v="a" /><Phone v="a" /></div></Bay>
      <Bay id="s2" n="B" title="Bandes : une ligne pleine par information" desc="Les infos deviennent des bandes blanches pleine largeur (libellé à gauche, valeur à droite) en encre bleu nuit. Très lisible au pouce, et le panneau a une vraie structure."><div className="pair"><Desk v="b" /><Phone v="b" /></div></Bay>
      <Bay id="s3" n="C" title="Papier : un panneau clair sur scène sombre" desc="Le panneau est une fiche claire avec le texte en encre bleu nuit et des filets sombres. Le meilleur contraste en plein soleil, et la carte ressort sur la scène sombre."><div className="pair"><Desk v="c" /><Phone v="c" /></div></Bay>
      <Bay id="s4" n="D" title="Verre : panneau translucide sur ambiance colorée" desc="Le fond de la scène prend les couleurs de la carte (lueur floue) et le panneau est un verre sombre à filet blanc. Plus immersif, tout le contenu reste identique."><div className="pair"><Desk v="d" stage={<><img className="glow" src={C.mccain.img} alt="" /><img className="vc" src={C.mccain.img} alt="" /></>} /><Phone v="d" /></div></Bay>
      <Bay id="s5" n="E" title="Musée : accents or, nom sur plaque" desc="Filets et accents dorés, le nom du joueur sur une plaque de laiton, les boutons en or et noir. Pour un visualiseur plus précieux, sans rien changer à ce qu'on peut faire."><div className="pair"><Desk v="e" /><Phone v="e" /></div></Bay>
      <Bay id="s6" n="F" title="Liste dense : tableau serré, une ligne par info" desc="Les infos en tableau compact à filets fins, sans cadres, pour voir le maximum sans défiler (utile sur petit écran). Les boutons restent grands et cliquables."><div className="pair"><Desk v="f" /><Phone v="f" /></div></Bay>
      <Bay id="s7" n="G" title="Équipe : un liseré aux couleurs de la franchise" desc="Un bandeau rouge et bleu en haut du panneau (couleurs de l'équipe du joueur) et des pastilles teintées. Tout le reste est identique à la version A."><div className="pair"><Desk v="g" /><Phone v="g" /></div></Bay>
      <Bay id="s8" n="H" title="Bleu plein : le panneau en bleu électrique" desc="Fond bleu électrique uni (comme les boutons du site), texte blanc, filets blancs. Très franc et très DA, et la carte sombre ressort au milieu."><div className="pair"><Desk v="h" /><Phone v="h" /></div></Bay>
      <Bay id="s9" n="I" title="Tuiles : chaque info et chaque action dans sa case" desc="Les infos en tuiles carrées à filets, les actions en grille de boutons égaux 3 × 2. Tout est à la même taille, donc facile à viser au pouce."><div className="pair"><Desk v="i" /><Phone v="i" /></div></Bay>
      <Bay id="s10" n="J" title="Barre d'actions collante : les boutons ne défilent pas" desc="Mêmes infos et mêmes actions, mais les 6 boutons (Modifier, À vendre, Vendue, Partager, Exporter, Supprimer) sont rassemblés dans une barre fixe en bas du panneau, toujours accessible même quand on défile les informations."><div className="pair"><Desk v="j" /><Phone v="j" /></div></Bay>
    </div>
  )
}
