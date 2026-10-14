'use client'
/* eslint-disable react/jsx-key, @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'

// Idees visuelles pour pousser la nouvelle DA (Surfquest, marine -> bleu electrique, angles droits, doubles filets, metaux).
// Page de TRAVAIL reservee aux admins : donnees d'exemple en dur, rien n'est lu ni ecrit.
// Serie 45 : petites animations pour l'accueil.

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
.ix img:not(.fc):not(.mi) { background: none !important; animation: none !important; }
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

/* serie 44 : barre d'atouts de la vignette de la galerie, memes classes que le site, seule la barre change (prefixe s4) */
.ix .mk-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 1000px; }
.ix .mk-grid .card-item { flex: 0 0 calc(20% - 8px); max-width: calc(20% - 8px); }
@media (max-width: 900px) { .ix .mk-grid .card-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); } }
.ix .s4 .gs-mq { align-items: stretch; }
.ix .s4 .gs-seg { align-items: stretch; text-shadow: none; box-shadow: none; background: transparent; }
.ix .s4 .gs-mq > span { align-items: stretch; }
.ix .s4 .w { position: relative; display: flex; align-items: center; padding: 0 var(--wp, 16px); font: 900 11.5px/1 system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; color: var(--t, #fff) !important; background: linear-gradient(90deg, color-mix(in srgb, var(--p), var(--a)) 0%, var(--a) 30%, var(--a) 70%, color-mix(in srgb, var(--n), var(--a)) 100%); }
.ix .s4 .w > span { display: inline-block; }
.ix .s4 .gs-mq .sep { align-self: center; width: 1px; height: 8px; background: rgba(255,255,255,.7); }
/* variantes */
.ix .s4 .vz-chips .w { background: var(--a); border-right: 1px solid rgba(255,255,255,.75); }
.ix .s4 .vz-out .gs-seg::after, .ix .s4 .vz-fil .gs-seg::after, .ix .s4 .vz-dbl .gs-seg::after { content: ''; position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.ix .s4 .vz-out .gs-seg::after { box-shadow: inset 0 0 0 1.5px #fff; }
.ix .s4 .vz-fil .gs-seg::after { box-shadow: inset 0 1.5px 0 #fff, inset 0 -1.5px 0 #fff; }
.ix .s4 .vz-gloss .w::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 50%; background: linear-gradient(rgba(255,255,255,.42), rgba(255,255,255,.04)); pointer-events: none; }
.ix .s4 .vz-haz .w { background: repeating-linear-gradient(-45deg, var(--a) 0 6px, color-mix(in srgb, var(--a) 62%, #000) 6px 12px); text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.ix .s4 .vz-under .gs-seg { background: #0b1230; box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
.ix .s4 .vz-under .w { background: none; color: var(--al) !important; box-shadow: inset 0 -3px 0 var(--a); }
.ix .s4 .vz-neon .gs-seg { background: #070d24; }
.ix .s4 .vz-neon .w { background: none; color: var(--al) !important; text-shadow: 0 0 5px var(--a), 0 0 11px var(--a); box-shadow: inset 0 1px 0 var(--a), inset 0 -1px 0 var(--a); }
.ix .s4 .vz-chev .w { margin-left: -6px; padding: 0 20px 0 16px; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%, 7px 50%); background: var(--a); }
.ix .s4 .vz-skew .w { transform: skewX(-18deg); margin: 0 2px; background: var(--a); } .ix .s4 .vz-skew .w > span { transform: skewX(18deg); }
.ix .s4 .vz-cap .gs-seg::before, .ix .s4 .vz-cap .gs-seg::after { content: ''; position: absolute; top: 0; bottom: 0; width: 4px; background: var(--gt); z-index: 3; }
.ix .s4 .vz-cap .gs-seg::before { left: 0; } .ix .s4 .vz-cap .gs-seg::after { right: 0; }
.ix .s4 .vz-two .w { background: linear-gradient(180deg, var(--a) 0 50%, color-mix(in srgb, var(--a) 68%, #000) 50% 100%); }
.ix .s4 .vz-light .gs-seg { background: #fff; }
.ix .s4 .vz-light .w { background: none; color: var(--a) !important; box-shadow: inset 0 -2px 0 var(--a); }
.ix .s4 .vz-sheen .gs-seg::after { content: ''; position: absolute; top: 0; bottom: 0; width: 28%; left: -40%; z-index: 3; background: linear-gradient(90deg, transparent, rgba(255,255,255,.6), transparent); animation: s4sheen 6s ease-in-out infinite; }
@keyframes s4sheen { 0%, 55% { left: -40%; } 100% { left: 120%; } }
.ix .s4 .vz-dbl .gs-seg::after { box-shadow: inset 0 0 0 1px #fff, inset 0 0 0 2px #08153b; }
.ix .s4 .vz-glass .w { background: linear-gradient(180deg, color-mix(in srgb, var(--a) 70%, #fff) 0%, var(--a) 45%, color-mix(in srgb, var(--a) 70%, #000) 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -1px 0 rgba(0,0,0,.4); }
@media (prefers-reduced-motion: reduce) { .ix .s4 .vz-sheen .gs-seg::after { animation: none; } }
/* serie 45 : petites animations pour l'accueil (prefixe a4) */
.ix .a4 { max-width: 920px; }
.ix .a4 * { box-sizing: border-box; }
.ix .a4 .box { border: 3px solid rgba(255,255,255,.85); background: linear-gradient(135deg,#050912 0%,#08153b 60%,#0a2468 100%); padding: 18px; position: relative; overflow: hidden; }
.ix .a4 .row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.ix .a4 .rp { margin-top: 12px; padding: 7px 14px; background: transparent; border: 2px solid rgba(255,255,255,.6); color: #fff; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
.ix .a4 .rp:hover { background: #fff; color: #06122e; }
.ix .a4 .big { font: 400 96px/.9 'Surfquest', Impact, sans-serif; color: #fff; }
.ix .a4 .lab { font: 800 12px system-ui; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.75); }
.ix .a4 .tiles { display: grid; grid-template-columns: repeat(4, 1fr); border: 3px solid #fff; }
.ix .a4 .tile { padding: 16px 8px; text-align: center; border-right: 2px solid rgba(255,255,255,.25); position: relative; background: #0b1740; }
.ix .a4 .tile:last-child { border-right: 0; }
.ix .a4 .tile b { display: block; font: 400 52px/1 'Surfquest', Impact, sans-serif; color: #fff; }
.ix .a4 .tile i { position: absolute; left: 0; top: 0; height: 3px; background: var(--c); width: 100%; transform-origin: left; }
.ix .a4 .tile u { font: 800 10px system-ui; letter-spacing: .14em; text-decoration: none; opacity: .8; color: #fff; }
.ix .a4 .tile s { display: block; font: 800 11px system-ui; color: #3ddc97; text-decoration: none; min-height: 14px; }
/* A1 compteur : rien en CSS */
/* A2 barre XP */
.ix .a4 .xpb { height: 14px; background: rgba(255,255,255,.14); position: relative; overflow: hidden; }
.ix .a4 .xpb i { display: block; height: 100%; background: #2f6bff; width: 0; animation: a4fill 1.6s cubic-bezier(.2,.8,.2,1) forwards; position: relative; overflow: hidden; }
.ix .a4 .xpb i::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40px; left: -60px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent); animation: a4shine 1.6s .3s ease-in-out infinite; }
@keyframes a4fill { to { width: var(--w); } }
@keyframes a4shine { to { left: 120%; } }
/* A3 flamme */
.ix .a4 .flame { display: inline-block; font-size: 44px; transform-origin: 50% 90%; animation: a4flame 1.1s ease-in-out infinite alternate; filter: drop-shadow(0 0 10px rgba(255,140,0,.6)); }
@keyframes a4flame { 0% { transform: scale(1) rotate(-3deg); } 40% { transform: scale(1.08, 1.14) rotate(2deg); } 100% { transform: scale(.96, 1.06) rotate(-2deg); } }
/* A4 eventail */
.ix .a4 .fanw { position: relative; height: 230px; }
.ix .a4 .fc { position: absolute; left: 50%; bottom: 0; width: 120px; aspect-ratio: 2.5/3.5; object-fit: cover; transform-origin: 50% 100%; box-shadow: 0 14px 26px rgba(0,0,0,.55); transform: translateX(-50%) rotate(0); animation: a4fan .9s cubic-bezier(.2,.9,.3,1.1) forwards, a4float 4.5s 1.2s ease-in-out infinite alternate; animation-delay: calc(var(--i) * 90ms), calc(1.2s + var(--i) * 200ms); }
@keyframes a4fan { to { transform: translateX(calc(-50% + var(--dx))) rotate(var(--r)); } }
@keyframes a4float { from { translate: 0 0; } to { translate: 0 -8px; } }
/* A5 boutons */
.ix .a4 .wb { position: relative; overflow: hidden; display: inline-block; padding: 16px 30px; background: #fff; color: #06122e; border: 3px solid #fff; font: 800 13px system-ui; letter-spacing: .12em; text-transform: uppercase; transition: transform .15s; cursor: pointer; }
.ix .a4 .wb::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%; left: -60%; transform: skewX(-20deg); background: linear-gradient(90deg, transparent, rgba(0,61,166,.28), transparent); }
.ix .a4 .wb:hover::after { animation: a4sweep .7s ease; }
.ix .a4 .wb:hover { transform: translateY(-3px); } .ix .a4 .wb:active { transform: translateY(0) scale(.97); }
@keyframes a4sweep { to { left: 130%; } }
/* A6 tuiles en cascade */
.ix .a4 .tile.in { opacity: 0; animation: a4up .6s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i) * 120ms); }
.ix .a4 .tile.in i { transform: scaleX(0); animation: a4draw .6s ease forwards; animation-delay: calc(var(--i) * 120ms + 350ms); }
.ix .a4 .tile.in s { animation: a4pulse 1.4s 1.2s ease-in-out infinite; }
@keyframes a4up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes a4draw { to { transform: scaleX(1); } }
@keyframes a4pulse { 50% { transform: scale(1.35); } }
/* A7 recherche */
.ix .a4 .sb { display: flex; border: 3px solid #fff; background: #0b1740; }
.ix .a4 .sb span.t { flex: 1; padding: 14px; font: 500 15px system-ui; font-style: italic; color: rgba(255,255,255,.7); }
.ix .a4 .sb .caret { display: inline-block; width: 2px; height: 1em; background: #fff; margin-left: 2px; vertical-align: -2px; animation: a4blink 1s steps(1) infinite; }
.ix .a4 .sb b { width: 52px; display: grid; place-items: center; background: #fff; color: #06122e; font-size: 20px; animation: a4loupe 2.4s ease-in-out infinite; }
@keyframes a4blink { 50% { opacity: 0; } }
@keyframes a4loupe { 0%, 70%, 100% { transform: scale(1); } 80% { transform: scale(1.18) rotate(-8deg); } }
/* A8 apparition au defilement */
.ix .a4 .rv { opacity: 0; transform: translateY(26px); transition: opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1); }
.ix .a4 .rv.on { opacity: 1; transform: none; }
.ix .a4 .blk { padding: 20px; border: 3px solid rgba(255,255,255,.8); background: #0b1740; margin-bottom: 12px; font: 800 14px system-ui; letter-spacing: .1em; text-transform: uppercase; color: #fff; }
/* A9 podium */
.ix .a4 .pod { display: flex; align-items: flex-end; gap: 12px; height: 190px; justify-content: center; }
.ix .a4 .pb { width: 110px; background: linear-gradient(180deg,#2f6bff,#14307d); border: 3px solid #fff; display: grid; place-items: start center; padding-top: 8px; font: 400 40px/1 'Surfquest', Impact, sans-serif; color: #fff; height: 0; animation: a4rise .9s cubic-bezier(.2,.8,.2,1) forwards; animation-delay: calc(var(--i) * 160ms); }
.ix .a4 .pb.gold { background: linear-gradient(180deg,#ffd54a,#a8770a); animation: a4rise .9s cubic-bezier(.2,.8,.2,1) forwards, a4gold 2.2s 1.2s ease-in-out infinite; animation-delay: calc(var(--i) * 160ms), 1.2s; }
@keyframes a4rise { to { height: var(--h); } }
@keyframes a4gold { 50% { box-shadow: 0 0 26px rgba(255,213,74,.75); } }
/* A10 carte du jour */
.ix .a4 .cdj { position: relative; width: 150px; aspect-ratio: 2.5/3.5; margin: 6px auto; animation: a4breath 4s ease-in-out infinite; }
.ix .a4 .cdj img { width: 100%; height: 100%; object-fit: cover; display: block; box-shadow: 0 18px 34px rgba(0,0,0,.6); }
.ix .a4 .cdj .sh { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.ix .a4 .cdj .sh::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%; left: -60%; transform: skewX(-18deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); animation: a4sweep 5s 1s ease-in-out infinite; }
.ix .a4 .sp { position: absolute; color: #ffd54a; font-size: 16px; animation: a4spark 2.6s ease-in-out infinite; animation-delay: var(--d); opacity: 0; text-shadow: 0 0 8px rgba(255,213,74,.9); }
@keyframes a4breath { 50% { transform: translateY(-6px) rotate(.6deg); } }
@keyframes a4spark { 0%, 100% { opacity: 0; transform: scale(.4) rotate(0); } 50% { opacity: 1; transform: scale(1.1) rotate(30deg); } }
/* A11 badge presque debloque */
.ix .a4 .pill { display: inline-grid; place-items: center; width: 54px; height: 54px; border: 3px solid #fff; font-size: 26px; animation: a4bounce 1.8s ease-in-out infinite; }
.ix .a4 .gb { height: 14px; background: rgba(255,255,255,.14); position: relative; flex: 1; min-width: 220px; }
.ix .a4 .gb i { display: block; height: 100%; width: 92%; background: #e0a526; position: relative; }
.ix .a4 .gb i::after { content: ''; position: absolute; right: -3px; top: -3px; bottom: -3px; width: 6px; background: #fff; box-shadow: 0 0 12px #ffd54a; animation: a4pulse2 1.2s ease-in-out infinite; }
@keyframes a4bounce { 0%, 60%, 100% { transform: translateY(0); } 70% { transform: translateY(-9px); } 80% { transform: translateY(0); } 88% { transform: translateY(-4px); } }
@keyframes a4pulse2 { 50% { opacity: .35; } }
/* A12 niveau */
.ix .a4 .lv { position: relative; width: 70px; height: 70px; border: 3px solid #fff; display: grid; place-items: center; font: 400 38px 'Surfquest', Impact, sans-serif; color: #fff; }
.ix .a4 .lv.pop { animation: a4pop .6s cubic-bezier(.2,.9,.3,1.3); }
.ix .a4 .lv .ring { position: absolute; inset: -3px; border: 3px solid #ffd54a; opacity: 0; }
.ix .a4 .lv.pop .ring { animation: a4ring .8s ease-out; }
@keyframes a4pop { 0% { transform: scale(1); } 40% { transform: scale(1.25) rotate(-4deg); } 100% { transform: scale(1); } }
@keyframes a4ring { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(2); } }
/* A13 pseudo */
.ix .a4 .nm { font: 400 64px/1 'Surfquest', Impact, sans-serif; color: #fff; text-transform: uppercase; display: inline-flex; }
.ix .a4 .nm span { display: inline-block; opacity: 0; transform: translateY(-30px) rotate(-8deg); animation: a4letter .5s cubic-bezier(.2,.9,.3,1.2) forwards; animation-delay: calc(var(--i) * 55ms); }
@keyframes a4letter { to { opacity: 1; transform: none; } }
/* A14 mosaique a la derive */
.ix .a4 .mos { position: relative; height: 220px; overflow: hidden; background: #050912; }
.ix .a4 .mos img { position: absolute; width: 90px; aspect-ratio: 2.5/3.5; object-fit: cover; opacity: .55; animation: a4drift var(--t) ease-in-out infinite alternate; left: var(--x); top: var(--y); }
@keyframes a4drift { from { transform: translate(0, 0) rotate(var(--r)); } to { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--r) + 4deg)); } }
.ix .a4 .mos::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, #050912 0%, rgba(5,9,18,.5) 55%, transparent 100%); }
.ix .a4 .mos h4 { position: absolute; z-index: 2; left: 20px; top: 50%; transform: translateY(-50%); margin: 0; font: 400 70px/.9 'Surfquest', Impact, sans-serif; color: #fff; }
/* A15 confettis */
.ix .a4 .bz { position: relative; display: inline-block; }
.ix .a4 .cf { position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; background: var(--c); animation: a4burst .9s cubic-bezier(.1,.7,.3,1) forwards; }
@keyframes a4burst { from { transform: translate(-50%, -50%) rotate(0); opacity: 1; } to { transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--r)); opacity: 0; } }
/* A16 tilt */
.ix .a4 .tiltw { perspective: 700px; display: grid; place-items: center; height: 250px; }
.ix .a4 .tiltc { width: 150px; aspect-ratio: 2.5/3.5; transition: transform .12s ease-out; transform-style: preserve-3d; position: relative; }
.ix .a4 .tiltc img { width: 100%; height: 100%; object-fit: cover; display: block; box-shadow: 0 20px 36px rgba(0,0,0,.6); }
.ix .a4 .tiltc .gl { position: absolute; inset: 0; background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,.4), transparent 55%); mix-blend-mode: overlay; pointer-events: none; }
/* A17 squelette */
.ix .a4 .sk { height: 18px; background: linear-gradient(90deg, rgba(255,255,255,.07) 25%, rgba(255,255,255,.2) 50%, rgba(255,255,255,.07) 75%); background-size: 200% 100%; animation: a4sk 1.3s linear infinite; margin-bottom: 10px; }
@keyframes a4sk { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .ix .a4 * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }
`
const Bay45 = ({ id, n, title, desc, children }: { id: string; n: string; title: string; desc: string; children: React.ReactNode }) => (
  <section className="bay" id={id}>
    <span className="eyebrow">{n}</span>
    <h2 className="sf">{title}</h2>
    <p className="d">{desc}</p>
    <div className="stage"><div className="a4">{children}</div></div>
  </section>
)
// remonte l'animation : un compteur « Rejouer » change la cle du contenu
function Replay({ children, label = 'Rejouer' }: { children: (k: number) => React.ReactNode; label?: string }) {
  const [k, setK] = useState(0)
  return (<>{children(k)}<button type="button" className="rp" onClick={() => setK(x => x + 1)}>↻ {label}</button></>)
}
function useCount(to: number, ms: number, k: number) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const f = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(f) }
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf)
  }, [to, ms, k])
  return v
}
const CountBig = ({ k }: { k: number }) => { const v = useCount(602, 1500, k); return <span className="big">{v}</span> }
const CountTile = ({ k, to, label, c, plus }: { k: number; to: number; label: string; c: string; plus?: string }) => { const v = useCount(to, 1300, k); return <div className="tile" style={{ ['--c' as string]: c } as CSSProperties}><i /><b>{v}</b><u>{label}</u><s>{plus || ''}</s></div> }
const FAN = [C.mccain.img, C.edwards.img, C.mcw.img, C.maxey.img, C.hawkins.img]
const FanDeploy = ({ k }: { k: number }) => (
  <div className="fanw" key={k}>{FAN.map((u, i) => <img key={i} className="fc" src={u} alt="" style={{ ['--i' as string]: i, ['--dx' as string]: `${(i - 2) * 62}px`, ['--r' as string]: `${(i - 2) * 9}deg`, zIndex: i === 2 ? 9 : 5 - Math.abs(i - 2) } as CSSProperties} />)}</div>
)
const Typer = () => {
  const words = ['un joueur…', 'un set…', 'un collectionneur…', 'une carte…']
  const [i, setI] = useState(0); const [n, setN] = useState(0); const [del, setDel] = useState(false)
  useEffect(() => {
    const w = words[i]
    const t = setTimeout(() => {
      if (!del && n < w.length) setN(n + 1)
      else if (!del) setDel(true)
      else if (n > 0) setN(n - 1)
      else { setDel(false); setI((i + 1) % words.length) }
    }, del ? 35 : n === w.length ? 1100 : 70)
    return () => clearTimeout(t)
  }, [i, n, del])
  return <div className="sb"><span className="t">Rechercher {words[i].slice(0, n)}<span className="caret" /></span><b>⌕</b></div>
}
const RevealDemo = ({ k }: { k: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current; if (!root) return
    const els = [...root.querySelectorAll('.rv')]
    els.forEach(e => e.classList.remove('on'))
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('on'); io.unobserve(e.target) } }), { threshold: 0.35 })
    const t = setTimeout(() => els.forEach((e, i) => setTimeout(() => io.observe(e), i * 0)), 150)
    return () => { clearTimeout(t); io.disconnect() }
  }, [k])
  return <div ref={ref}>{['Niveau et XP', 'Prochain badge', 'Défi de la semaine'].map((t, i) => <div key={t} className="blk rv" style={{ transitionDelay: `${i * 90}ms` }}>{t}</div>)}</div>
}
const LevelDemo = () => {
  const [pop, setPop] = useState(0)
  return (<div className="row"><div key={pop} className={'lv' + (pop ? ' pop' : '')}><span className="ring" />{5 + pop}</div><button type="button" className="rp" style={{ marginTop: 0 }} onClick={() => setPop(x => x + 1)}>+ Gagner un niveau</button></div>)
}
const Burst = () => {
  const [b, setB] = useState(0)
  const parts = Array.from({ length: 22 }, (_, i) => ({ x: Math.cos(i * 0.9) * (50 + (i % 5) * 18), y: Math.sin(i * 0.9) * (40 + (i % 4) * 16) - 20, r: i * 47, c: ['#ffd54a', '#ff9d3d', '#3B82F6', '#fff', '#A855F7'][i % 5] }))
  return (<div className="row"><span className="bz"><span className="flame">🔥</span>{b > 0 && parts.map((p, i) => <i key={b + '-' + i} className="cf" style={{ ['--x' as string]: p.x + 'px', ['--y' as string]: p.y + 'px', ['--r' as string]: p.r + 'deg', ['--c' as string]: p.c } as CSSProperties} />)}</span>
    <button type="button" className="rp" style={{ marginTop: 0 }} onClick={() => setB(x => x + 1)}>🎉 Nouveau record de série</button></div>)
}
const TiltDemo = () => {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.transform = `rotateY(${(x - 0.5) * 26}deg) rotateX(${(0.5 - y) * 22}deg)`
    el.style.setProperty('--gx', x * 100 + '%'); el.style.setProperty('--gy', y * 100 + '%')
  }
  const leave = () => { if (ref.current) ref.current.style.transform = '' }
  return <div className="tiltw" onMouseMove={move} onMouseLeave={leave}><div className="tiltc" ref={ref}><img src={C.maxey.img} alt="" /><span className="gl" /></div></div>
}
const Letters = ({ k }: { k: number }) => <div key={k} className="nm">{'GKNNN_CARDS'.split('').map((c, i) => <span key={i} style={{ ['--i' as string]: i } as CSSProperties}>{c}</span>)}</div>

const IDEAS: [string, string, React.ReactNode][] = [
  ['Compteurs qui montent à l\'arrivée', 'Le gros nombre de cartes et les 4 tuiles RC / Auto / Patch / Num comptent de 0 à leur valeur en 1,5 seconde, en ralentissant à la fin. Donne de la vie dès l\'ouverture.', (
    <Replay>{k => (<div className="box"><div className="row" style={{ marginBottom: 14 }}><div><CountBig key={'b' + k} k={k} /><div className="lab">Cartes</div></div></div>
      <div className="tiles"><CountTile k={k} to={120} label="RC" c="#F97316" plus="+1" /><CountTile k={k} to={29} label="Auto" c="#3B82F6" /><CountTile k={k} to={23} label="Patch" c="#EF4444" /><CountTile k={k} to={92} label="Num" c="#A855F7" plus="+1" /></div></div>)}</Replay>)],
  ['Barre d\'XP qui se remplit avec un reflet', 'Les barres de niveau, de badge et de défi se remplissent en douceur au chargement, avec un reflet blanc qui les parcourt.', (
    <Replay>{k => (<div className="box" key={k}><div className="lab" style={{ marginBottom: 8 }}>Niveau 5 · 347/360 XP</div><div className="xpb"><i style={{ ['--w' as string]: '96%' } as CSSProperties} /></div><div className="lab" style={{ margin: '16px 0 8px' }}>Prochain badge : 25 patches · 23/25</div><div className="xpb"><i style={{ ['--w' as string]: '92%', background: '#e0a526' } as CSSProperties} /></div></div>)}</Replay>)],
  ['Flamme de la série qui vacille', 'La flamme à côté de « 58 jours de suite » respire en continu : elle s\'étire et penche légèrement, avec une lueur orange. Discret mais vivant.', (
    <div className="box"><div className="row"><span className="flame">🔥</span><div><div className="big" style={{ fontSize: 56 }}>58</div><div className="lab">Jours de suite</div></div></div></div>)],
  ['Éventail qui se déploie puis flotte', 'Les 5 dernières cartes sont empilées puis s\'ouvrent en éventail en cascade, et elles flottent ensuite de quelques pixels, chacune à son rythme.', (
    <Replay>{k => <div className="box"><FanDeploy k={k} /></div>}</Replay>)],
  ['Boutons blancs avec reflet au survol', 'Passage de la souris (ou toucher) : un reflet bleuté traverse le bouton, qui se soulève de 3 px ; au clic il s\'enfonce légèrement.', (
    <div className="box"><div className="row"><span className="wb">Scanner de prix</span><span className="wb">Ajouter une carte</span><span className="wb">Trades</span></div></div>)],
  ['Tuiles en cascade avec trait de couleur qui se dessine', 'Les 4 tuiles montent l\'une après l\'autre ; le trait de couleur de chaque atout se dessine de gauche à droite, et le « +1 » de la semaine pulse.', (
    <Replay>{k => <div className="box" key={k}><div className="tiles">{[['120', 'RC', '#F97316', '+1'], ['29', 'Auto', '#3B82F6', ''], ['23', 'Patch', '#EF4444', ''], ['92', 'Num', '#A855F7', '+1']].map((x, i) => <div key={x[1]} className="tile in" style={{ ['--c' as string]: x[2], ['--i' as string]: i } as CSSProperties}><i /><b>{x[0]}</b><u>{x[1]}</u><s>{x[3]}</s></div>)}</div></div>}</Replay>)],
  ['Recherche qui suggère en tapant toute seule', 'Le texte de la barre change tout seul (un joueur…, un set…, un collectionneur…) avec un curseur clignotant, et la loupe fait un petit mouvement régulier. Montre à quoi sert la barre.', (
    <div className="box"><Typer /></div>)],
  ['Blocs qui apparaissent en glissant quand on scrolle', 'Chaque bloc de l\'accueil (niveau, badge, défi, carte du jour, podium) monte en fondu quand il entre dans l\'écran, légèrement décalé du précédent. Une seule fois, pas à chaque passage.', (
    <Replay>{k => <div className="box" style={{ paddingBottom: 6 }}><RevealDemo k={k} /></div>}</Replay>)],
  ['Podium dont les marches montent, première en or lumineux', 'Les trois marches montent l\'une après l\'autre ; la première pulse d\'une lueur dorée en boucle lente.', (
    <Replay>{k => <div className="box" key={k}><div className="pod">{[['2', 120], ['1', 170], ['3', 90]].map((x, i) => <div key={x[0]} className={'pb' + (x[0] === '1' ? ' gold' : '')} style={{ ['--h' as string]: x[1] + 'px', ['--i' as string]: i } as CSSProperties}>{x[0]}</div>)}</div></div>}</Replay>)],
  ['Carte du jour qui respire avec reflet et étincelles', 'La carte à gratter flotte doucement ; un reflet blanc la traverse toutes les 5 secondes et de petites étoiles dorées scintillent autour.', (
    <div className="box"><div className="cdj"><img src={C.edwards.img} alt="" /><span className="sh" />{[['-14px', '10%', '0s'], ['92%', '22%', '.8s'], ['-10px', '70%', '1.5s'], ['96%', '82%', '2s']].map((p, i) => <span key={i} className="sp" style={{ left: p[0], top: p[1], ['--d' as string]: p[2] } as CSSProperties}>✦</span>)}</div></div>)],
  ['Badge presque débloqué : l\'icône rebondit', 'Quand il reste moins de 10 % pour le prochain badge, l\'icône fait un double rebond de temps en temps et le bout de la barre clignote d\'une lueur dorée.', (
    <div className="box"><div className="row"><span className="pill">🩹</span><div style={{ flex: 1 }}><div className="lab" style={{ marginBottom: 8 }}>Prochain badge : 25 patches · 23/25</div><div className="gb"><i /></div></div></div></div>)],
  ['Gain de niveau : le carré saute avec un anneau doré', 'Quand l\'XP fait passer un niveau, le carré du niveau « pop » (il grossit en s\'inclinant) et un anneau doré s\'en échappe.', (
    <div className="box"><LevelDemo /></div>)],
  ['Pseudo qui tombe lettre par lettre', 'Au chargement, le pseudo en Surfquest apparaît lettre par lettre (chute légère + rotation), comme une mise en place de typographie.', (
    <Replay>{k => <div className="box"><div className="lab" style={{ marginBottom: 6 }}>Content de te revoir</div><Letters k={k} /></div>}</Replay>)],
  ['Mosaïque de fond qui dérive lentement', 'Derrière le gros nombre, les cartes de la mosaïque glissent de quelques pixels en sens différents, très lentement (profondeur sans bouger l\'ensemble).', (
    <div className="mos">{[...FAN, ...FAN, ...FAN].map((u, i) => <img key={i} className="mi" src={u} alt="" style={{ ['--x' as string]: `${28 + (i % 8) * 9}%`, ['--y' as string]: `${(i % 3) * 38 - 12}%`, ['--r' as string]: `${(i % 5) * 3 - 6}deg`, ['--t' as string]: `${7 + (i % 4) * 2}s`, ['--dx' as string]: `${(i % 2 ? 1 : -1) * 14}px`, ['--dy' as string]: `${(i % 3 - 1) * 10}px` } as CSSProperties} />)}<h4>602<br /><span style={{ fontSize: 24, letterSpacing: '.16em' }}>CARTES</span></h4></div>)],
  ['Confettis quand la série bat un record', 'Quand la série de jours atteint un nouveau record personnel, une petite explosion de confettis (carrés de couleur, pas de cercles) part de la flamme. Une seule fois.', (
    <div className="box" style={{ overflow: 'visible' }}><Burst /></div>)],
  ['Carte qui s\'incline avec la souris (3D) et reflet qui suit', 'Sur ordinateur, la carte principale s\'incline vers le curseur avec un reflet lumineux qui le suit. Sur mobile, désactivé.', (
    <div className="box"><TiltDemo /></div>)],
  ['Squelettes qui brillent pendant le chargement', 'À la place d\'un vide ou d\'un cercle qui tourne, des blocs gris au dégradé qui défile aux formes des vrais blocs (nombre, tuiles, barre) : l\'accueil semble déjà là.', (
    <div className="box"><div className="sk" style={{ width: '30%', height: 60 }} /><div className="row" style={{ gap: 8, marginBottom: 12 }}>{[0, 1, 2, 3].map(i => <div key={i} className="sk" style={{ flex: 1, height: 70, margin: 0 }} />)}</div><div className="sk" style={{ width: '100%' }} /><div className="sk" style={{ width: '70%' }} /></div>)],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 45 · Animations de l&apos;accueil</h1>
      <p className="lead">17 petites animations pour l&apos;accueil, toutes vivantes ici (bouton « Rejouer » ou à survoler). Elles respectent « réduire les animations » du téléphone, restent sobres (angles droits, pas de bruit) et ne jouent qu&apos;une fois à l&apos;arrivée quand c&apos;est une mise en place. Dis-moi les numéros à garder.</p>
      <nav className="tags">{IDEAS.map((_, i) => <a key={i} href={`#n${i + 1}`}>N{i + 1}</a>)}</nav>
      {IDEAS.map((d, i) => <Bay45 key={d[0]} id={`n${i + 1}`} n={`N${i + 1}`} title={d[0]} desc={d[1]}>{d[2]}</Bay45>)}
    </div>
  )
}
