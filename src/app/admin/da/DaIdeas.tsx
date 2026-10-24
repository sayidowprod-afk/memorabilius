'use client'
/* eslint-disable react/jsx-key, @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'

// Idees visuelles + techniques pour les classeurs et la bibliotheque de classeurs
// (galerie). Page de TRAVAIL reservee aux admins : donnees d'exemple en dur,
// rien n'est lu ni ecrit sur le vrai compte.
// Serie 46 : classeurs & bibliotheque de classeurs.

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
const C = {
  mccain: { nom: 'Jared McCain', img: SB + '1787763372857_recto.jpg' },
  edwards: { nom: 'Anthony Edwards', img: SB + '1784235265864_recto.jpg' },
  mcw: { nom: 'Michael Carter-Williams', img: SB + '1781875894817_recto.jpg' },
  maxey: { nom: 'Tyrese Maxey', img: SB + '1781291200820_recto.jpg' },
  hawkins: { nom: 'Hersey Hawkins', img: SB + '1781534889963_recto.jpg' },
  luwawu: { nom: 'Luwawu-Cabarrot', img: SB + 'csv_1790632470730_4f41x1.jpg' },
}
// memes couleurs que BINDER_COLORS / FOLDER_SHELF_COLORS du vrai composant
const BC = ['#c0392b', '#e2b13c', '#1a1a1a', '#1f3a5f', '#6b2737', '#3d5a3d']
const FC = ['#4a6741', '#1f3a5f', '#6b2737']

const CSS = `
.ix { font-family: system-ui, sans-serif; color:#fff; min-height:100vh;
  background: radial-gradient(circle at 15% -10%, rgba(91,141,239,.10), transparent 45%), linear-gradient(160deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: 24px clamp(14px,3vw,44px) 90px; }
.ix * { box-sizing: border-box; }
.ix img:not(.fc):not(.mi) { background: none !important; animation: none !important; }
.ix .sf { font-family: 'Surfquest', Impact, 'Arial Narrow', sans-serif; font-weight: 400; text-transform: uppercase; letter-spacing: .02em; }
.ix h1 { font-size: clamp(34px,6vw,60px); margin: 8px 0 6px; line-height: .95; }
.ix .lead { max-width: 760px; color: rgba(255,255,255,.72); font-size: 15px; line-height: 1.5; margin: 0 0 30px; }
.ix .back { color:#fff; text-decoration:none; font-weight:800; font-size:13px; letter-spacing:.08em; text-transform:uppercase; }
.ix .bay { margin: 0 0 46px; max-width: 1180px; }
.ix .eyebrow { display:inline-block; padding:5px 14px; border:3px solid #fff; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #fff; font: 800 12px system-ui; letter-spacing:.18em; text-transform:uppercase; }
.ix .eyebrow.k { border-color: #e0a526; box-shadow: inset 0 0 0 3px #08153b, inset 0 0 0 4.5px #e0a526; color: #ffd98a; }
.ix .bay h2 { font-size: clamp(24px,3.6vw,36px); margin: 12px 0 6px; line-height: 1.1; }
.ix .bay p.d { color: rgba(255,255,255,.7); max-width: 720px; margin: 0 0 16px; font-size: 14px; line-height: 1.5; }
.ix .stage { border: 3px solid rgba(255,255,255,.22); background: linear-gradient(135deg,#050912 0%,#08153b 55%,#0a2468 100%); padding: clamp(16px,3vw,30px); position:relative; overflow:hidden; }
.ix .tags { display:flex; flex-wrap:wrap; gap: 8px; margin: 0 0 30px; }
.ix .tags a { color:#fff; text-decoration:none; border: 2px solid rgba(255,255,255,.4); padding: 5px 10px; font: 800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; }
.ix .tags a:hover { background:#fff; color:#06122e; }
.ix .tags a.k { border-color: #e0a526; color: #ffd98a; }

/* ── Serie 46 : classeurs & bibliotheque (prefixe b6) ───────────────── */
.ix .b6 { max-width: 980px; }
.ix .b6 * { box-sizing: border-box; }
.ix .b6 .box { border: 3px solid rgba(255,255,255,.85); background: linear-gradient(135deg,#050912 0%,#08153b 60%,#0a2468 100%); padding: 18px; position: relative; overflow: hidden; }
.ix .b6 .rp { margin-top: 14px; padding: 7px 14px; background: transparent; border: 2px solid rgba(255,255,255,.6); color: #fff; font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; cursor: pointer; }
.ix .b6 .rp:hover { background: #fff; color: #06122e; }
.ix .b6 .lab { font: 800 11px system-ui; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.7); margin-bottom: 10px; }
.ix .b6 .row { display:flex; gap: 14px; align-items: center; flex-wrap: wrap; }

/* etagere + dos de classeurs, fidele au vrai rendu (largeur 40px, coins hauts arrondis, ombres internes) */
.ix .b6 .shelf { background: linear-gradient(180deg, #1a2638, #0d1824); border-radius: 14px; padding: 20px 18px 10px; position: relative; overflow: hidden; }
.ix .b6 .srow { display: flex; align-items: flex-end; gap: 5px; padding-bottom: 10px; }
.ix .b6 .board { height: 11px; border-radius: 2px; background: #2f6bff; box-shadow: 0 4px 10px rgba(0,0,0,.5); margin-bottom: 16px; opacity: .9; }
.ix .b6 .spine { position: relative; width: 40px; height: 150px; border-radius: 4px 4px 0 0; flex-shrink: 0; cursor: pointer;
  box-shadow: inset 4px 0 0 rgba(255,255,255,.2), inset -4px 0 0 rgba(0,0,0,.28), 2px 2px 5px rgba(0,0,0,.4);
  transition: transform .22s cubic-bezier(.3,1.5,.4,1), box-shadow .22s; display:flex; flex-direction:column; align-items:center; overflow:hidden; }
.ix .b6 .spine .ttl { margin: auto 0 10px; background: rgba(0,0,0,.38); border-radius: 2px; padding: 8px 2px; writing-mode: vertical-rl; transform: rotate(180deg);
  font: 600 9px system-ui; letter-spacing: .06em; color: rgba(255,255,255,.92); max-height: 118px; overflow: hidden; white-space: nowrap; }
.ix .b6 .spine .lock { position: absolute; top: 6px; right: 4px; font-size: 9px; }
.ix .b6 .spine .cov { width: 100%; height: 46px; flex-shrink: 0; overflow: hidden; border-bottom: 1px solid rgba(0,0,0,.2); }
.ix .b6 .spine .cov img { width: 100%; height: 100%; object-fit: cover; }

/* N1 cuir + titre dore */
.ix .b6 .spine.leather { background: linear-gradient(145deg,#7a3b2e,#4a2016 55%,#2c130d); }
.ix .b6 .spine.leather::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(115deg, transparent 0 3px, rgba(0,0,0,.14) 3px 4px); mix-blend-mode: multiply; pointer-events:none; }
.ix .b6 .spine.leather .ttl { background: none; color:#e8c468; text-shadow: 0 1px 0 rgba(0,0,0,.65), 0 0 7px rgba(232,196,104,.3); }

/* N2 sortie au survol */
.ix .b6 .spine.pull:hover { transform: translateY(-18px) rotate(-3deg); box-shadow: 0 18px 28px rgba(0,0,0,.55); z-index: 3; }

/* N3 etagere qui s'affaisse + classeur qui tombe */
.ix .b6 .board.sag { animation: b6sag .55s ease .3s; }
@keyframes b6sag { 32% { transform: scaleY(2.1) translateY(2px); } 100% { transform: none; } }
.ix .b6 .spine.drop { animation: b6drop .55s cubic-bezier(.22,.61,.36,1); }
@keyframes b6drop { 0% { transform: translateY(-140%) rotate(-5deg); opacity:0; } 70% { transform: translateY(5%) rotate(0); opacity:1; } 100% { transform:none; opacity:1; } }

/* N4 anneau de progression */
.ix .b6 .ringwrap { position:relative; width:72px; height:72px; }
.ix .b6 .ringwrap svg { transform: rotate(-90deg); }
.ix .b6 .ringwrap .bgc { stroke: rgba(255,255,255,.15); fill:none; }
.ix .b6 .ringwrap .fgc { stroke: #3ddc97; fill:none; stroke-linecap: round; stroke-dasharray: 194; stroke-dashoffset: 194; animation: b6ring 1.3s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes b6ring { to { stroke-dashoffset: var(--off); } }
.ix .b6 .ringwrap .pct { position:absolute; inset:0; display:grid; place-items:center; font:800 14px system-ui; }

/* N5 badge nouveau */
.ix .b6 .newb { position:absolute; top:-7px; right:-7px; min-width:18px; height:18px; padding: 0 4px; background:#3ddc97; border-radius:9px; display:grid; place-items:center; font:900 9px system-ui; color:#06122e; box-shadow:0 0 0 2px #0d1824; animation: b6pulse 1.6s ease-in-out infinite; z-index: 2; }
@keyframes b6pulse { 50% { transform: scale(1.16); box-shadow: 0 0 0 2px #0d1824, 0 0 10px rgba(61,220,151,.7); } }

/* N6 rayon de lumiere ambiant */
.ix .b6 .shelf.amb::after { content:''; position:absolute; top:-40%; bottom:-40%; width:22%; left:-40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.06), transparent); animation: b6sweeplight 9s ease-in-out infinite; pointer-events:none; }
@keyframes b6sweeplight { 0%,62% { left:-40%; } 100% { left:140%; } }

/* N7 cadenas qui scintille */
.ix .b6 .spine .lock.glint { position:relative; }
.ix .b6 .spine .lock.glint::after { content:''; position:absolute; inset:-5px; background: radial-gradient(circle, rgba(255,255,255,.95), transparent 60%); opacity:0; animation: b6glint 3.2s ease-in-out infinite; }
@keyframes b6glint { 0%,82%,100% { opacity:0; } 88% { opacity:1; } }

/* N8 etagere vide illustree */
.ix .b6 .spine.ghost { background: transparent; box-shadow: none; border: 2px dashed rgba(255,255,255,.28); display:grid; place-items:center; color: rgba(255,255,255,.32); font-size: 20px; }

/* N9 planche bois teintee */
.ix .b6 .board.grain { position:relative; background: linear-gradient(180deg, var(--fc), color-mix(in srgb, var(--fc) 55%, #000)); }
.ix .b6 .board.grain::after { content:''; position:absolute; inset:0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.1) 0 2px, transparent 2px 8px); }

/* N10 drag avec wobble */
.ix .b6 .spine.grabbed { transform: translateY(-22px) scale(1.07) rotate(var(--w,-4deg)); box-shadow: 0 24px 32px rgba(0,0,0,.6); z-index: 4; }

/* N11 flip de page avec ombre de poids */
.ix .b6 .flipstage { perspective: 1400px; width: 170px; height: 230px; margin: 0 auto; position:relative; }
.ix .b6 .fpage { position:absolute; inset:0; background: linear-gradient(135deg,#0f1b3d,#142a5c); border:2px solid rgba(255,255,255,.3); border-radius: 2px; }
.ix .b6 .fpage.r.go { transform-origin: left center; animation: b6flip 1.15s cubic-bezier(.4,0,.2,1) forwards; backface-visibility:hidden; }
@keyframes b6flip { to { transform: rotateY(-172deg); } }
.ix .b6 .fpage.r.go::after { content:''; position:absolute; inset:0; background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.55)); opacity:0; animation: b6flipshadow 1.15s ease forwards; }
@keyframes b6flipshadow { 38% { opacity:0; } 50% { opacity:.75; } 62% { opacity:0; } }

/* N12 case vide qui respire */
.ix .b6 .eslot { width:72px; aspect-ratio:2.5/3.5; border:2px dashed rgba(255,255,255,.35); display:grid; place-items:center; animation: b6breathe 2.6s ease-in-out infinite; cursor:pointer; }
@keyframes b6breathe { 50% { border-color: rgba(255,255,255,.7); } }
.ix .b6 .eslot span { font-size:22px; color: rgba(255,255,255,.5); transition: transform .18s, color .18s; display:block; }
.ix .b6 .eslot:hover span { transform: scale(1.4); color:#fff; }

/* N13 carte qui vole vers sa case */
.ix .b6 .flywrap { position:relative; height: 180px; }
.ix .b6 .flyer { position:absolute; width:50px; aspect-ratio:2.5/3.5; object-fit:cover; box-shadow:0 10px 20px rgba(0,0,0,.5); animation: b6fly 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes b6fly { 0% { left:6px; top:118px; transform: scale(1) rotate(-10deg); } 55% { left:150px; top:10px; transform: scale(1.12) rotate(5deg); } 100% { left:260px; top:34px; transform: scale(.82) rotate(0); } }
.ix .b6 .landslot { position:absolute; left: 254px; top: 28px; width: 56px; aspect-ratio: 2.5/3.5; border: 2px dashed rgba(255,255,255,.4); }
.ix .b6 .landslot.hit { animation: b6landflash .5s ease; }
@keyframes b6landflash { 40% { box-shadow: 0 0 0 4px rgba(61,220,151,.5); border-color: #3ddc97; } }

/* N14 reordonnancement magnetique */
.ix .b6 .reorderRow { display:flex; gap:6px; align-items:flex-end; }
.ix .b6 .reorderRow .gapx { width:0; transition: width .28s cubic-bezier(.3,1.4,.4,1); }
.ix .b6 .reorderRow:hover .gapx { width:58px; }

/* N15 reflet metallique des anneaux */
.ix .b6 .ringsRow { display:flex; gap:12px; padding: 14px 10px; }
.ix .b6 .ringhole { width:18px; height:18px; border-radius:50%; background: radial-gradient(circle at 35% 30%, #eee, #888 55%, #333 100%); position:relative; overflow:hidden; }
.ix .b6 .ringhole::after { content:''; position:absolute; inset:0; background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.95) 50%, transparent 60%); transform: translateX(-130%); animation: b6ringshine 3.6s ease-in-out infinite; }
@keyframes b6ringshine { 0%,68% { transform: translateX(-130%); } 100% { transform: translateX(130%); } }

/* N16 coin de page qui se souleve */
.ix .b6 .peelpage { position:relative; width:170px; height:220px; background: linear-gradient(135deg,#0f1b3d,#142a5c); border:2px solid rgba(255,255,255,.3); overflow:hidden; margin: 0 auto; }
.ix .b6 .peelpage::after { content:''; position:absolute; right:0; bottom:0; width:0; height:0; border-style:solid; border-width:0 0 34px 34px; border-color: transparent transparent rgba(255,255,255,.88) transparent; filter: drop-shadow(-2px -2px 4px rgba(0,0,0,.4)); transition: border-width .2s ease; }
.ix .b6 .peelpage:hover::after { border-width: 0 0 58px 58px; }

/* N17 aperçu plein ecran "shared element" */
.ix .b6 .lbwrap { position:relative; height:230px; }
.ix .b6 .lbthumb { width:70px; aspect-ratio:2.5/3.5; object-fit:cover; cursor:zoom-in; box-shadow:0 8px 16px rgba(0,0,0,.4); }
.ix .b6 .lbdim { position:absolute; inset:0; background:rgba(0,0,0,.65); opacity:0; transition:opacity .3s; pointer-events:none; }
.ix .b6 .lbdim.on { opacity:1; }
.ix .b6 .lbbig { position:absolute; left:50%; top:50%; width:70px; aspect-ratio:2.5/3.5; object-fit:cover; transform: translate(-50%,-50%); box-shadow:0 24px 44px rgba(0,0,0,.65); transition: width .35s cubic-bezier(.2,.8,.2,1); cursor: zoom-out; }
.ix .b6 .lbbig.on { width:190px; }

/* N18 squelettes dos de classeur */
.ix .b6 .spine.sk { box-shadow:none; background: linear-gradient(90deg, rgba(255,255,255,.07) 25%, rgba(255,255,255,.2) 50%, rgba(255,255,255,.07) 75%); background-size:200% 100%; animation: b6sk 1.3s linear infinite; }
@keyframes b6sk { to { background-position: -200% 0; } }

/* N19 apparition en cascade des rangees */
.ix .b6 .rv { opacity: 0; transform: translateY(22px); transition: opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1); }
.ix .b6 .rv.on { opacity: 1; transform: none; }

/* N20 chargement progressif (blur-up) */
.ix .b6 .bu { position:relative; width:94px; aspect-ratio:2.5/3.5; overflow:hidden; }
.ix .b6 .bu img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.ix .b6 .bu .ph { filter: blur(16px) saturate(1.3) brightness(1.1); transform: scale(1.15); transition: opacity .5s ease; }
.ix .b6 .bu .sharp { opacity:0; transition: opacity .5s ease .08s; }
.ix .b6 .bu.loaded .ph { opacity:0; }
.ix .b6 .bu.loaded .sharp { opacity:1; }

/* N21-23 schemas technique */
.ix .b6 .pgstrip { display:flex; gap:6px; flex-wrap: wrap; }
.ix .b6 .pg { width:36px; height:48px; border-radius:3px; display:grid; place-items:center; font:800 10px system-ui; color:rgba(255,255,255,.5); background: rgba(255,255,255,.06); border:1.5px solid rgba(255,255,255,.14); }
.ix .b6 .pg.on { background:#2f6bff; border-color:#2f6bff; color:#fff; }
.ix .b6 .pg.dom { background: rgba(61,220,151,.18); border-color:#3ddc97; color:#fff; }
.ix .b6 .pg.off { background: repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 4px, transparent 4px 8px); }
.ix .b6 .tl { display:flex; align-items:flex-end; gap:3px; height: 50px; }
.ix .b6 .tk { width:6px; border-radius: 2px 2px 0 0; }
.ix .b6 .tk.bad { background: #e74c3c; height: 14px; }
.ix .b6 .tk.good { background: #3ddc97; height: 34px; }
.ix .b6 .brace { font-size: 11px; color: rgba(255,255,255,.55); margin-top: 4px; }
@media (prefers-reduced-motion: reduce) { .ix .b6 * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; } }

/* ── Serie 47 : classeurs, le realisme (prefixe b7, memes blocs .b6) ─── */
/* N24 ombre portee qui suit une source de lumiere */
.ix .b6 .spine.lit { box-shadow: inset 4px 0 0 rgba(255,255,255,.2), inset -4px 0 0 rgba(0,0,0,.28), 2px 2px 5px rgba(0,0,0,.4); }
.ix .b6 .spine.lit::after { content:''; position:absolute; left:4px; right:4px; bottom:-9px; height:9px; background: rgba(0,0,0,.55); filter: blur(5px); border-radius:50%; transform: translateX(var(--sx,0px)); transition: transform .08s linear; }
/* N25 anneaux spirale, reflet en cascade au scroll */
.ix .b6 .spiralrow { display:flex; gap:6px; }
.ix .b6 .spiralring { width:14px; height:14px; border-radius:50%; background: radial-gradient(circle at 35% 30%,#eee,#888 55%,#333); position:relative; overflow:hidden; }
.ix .b6 .spiralring.go::after { content:''; position:absolute; inset:0; background: linear-gradient(120deg, transparent 40%, rgba(255,255,255,.95) 50%, transparent 60%); transform: translateX(-130%); animation: b7ringgo .8s ease forwards; animation-delay: calc(var(--i) * 80ms); }
@keyframes b7ringgo { to { transform: translateX(130%); } }
/* N26 cuir qui reagit au tilt (reflet specifique suit la souris) */
.ix .b6 .covertilt { width:124px; height:172px; border-radius:3px; position:relative; margin:0 auto; background: linear-gradient(145deg,#7a3b2e,#4a2016 55%,#2c130d); overflow:hidden; cursor:pointer; box-shadow: 0 14px 28px rgba(0,0,0,.5); }
.ix .b6 .covertilt::before { content:''; position:absolute; inset:0; background: repeating-linear-gradient(115deg, transparent 0 3px, rgba(0,0,0,.14) 3px 4px); mix-blend-mode: multiply; }
.ix .b6 .covertilt .spec { position:absolute; inset:0; background: radial-gradient(circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,.4), transparent 45%); pointer-events:none; }
/* N27 reflet plastique glossy sur les pochettes */
.ix .b6 .sleeve { position:relative; width:74px; aspect-ratio:2.5/3.5; overflow:hidden; box-shadow:0 8px 16px rgba(0,0,0,.4); border-radius: 2px; }
.ix .b6 .sleeve::after { content:''; position:absolute; top:-30%; bottom:-30%; width:40%; left:-60%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent); transition: left .5s ease; pointer-events:none; }
.ix .b6 .sleeve:hover::after { left:120%; }
/* N28 etagere en pseudo-3D */
.ix .b6 .shelf.persp { perspective: 900px; }
.ix .b6 .shelf.persp .srow { transform-style: preserve-3d; }
.ix .b6 .shelf.persp .spine { transition: transform .25s; }
/* N29 classeur "use" / abime par l'usage */
.ix .b6 .spine.worn { filter: saturate(.78) brightness(.9); border-radius: 7px 7px 1px 1px; }
.ix .b6 .spine.worn::before { content:''; position:absolute; inset:0; background: radial-gradient(circle at 18% 92%, rgba(0,0,0,.4), transparent 42%), radial-gradient(circle at 88% 12%, rgba(0,0,0,.3), transparent 36%); mix-blend-mode:multiply; pointer-events:none; }
/* N30 poussiere flottante dans la lumiere */
.ix .b6 .shelf.dust { position:relative; }
.ix .b6 .mote { position:absolute; width:2px; height:2px; background:rgba(255,255,255,.55); border-radius:50%; animation: b7dust var(--t,7s) linear infinite; animation-delay: var(--d,0s); opacity:0; pointer-events:none; }
@keyframes b7dust { 0% { opacity:0; transform: translateY(0); } 12% { opacity:.6; } 88% { opacity:.25; } 100% { opacity:0; transform: translateY(-70px); } }
/* N31 retour sonore optionnel (mockup d'interrupteur, pas de son joue ici) */
.ix .b6 .swrow { display:flex; align-items:center; gap:12px; }
.ix .b6 .sw { width:42px; height:24px; border-radius:12px; background: rgba(255,255,255,.18); position:relative; cursor:pointer; transition: background .2s; flex-shrink:0; }
.ix .b6 .sw.on { background:#3ddc97; }
.ix .b6 .sw i { position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition: transform .2s; }
.ix .b6 .sw.on i { transform: translateX(18px); }
/* N32 reflet de vitrine en verre sur toute la bibliotheque */
.ix .b6 .shelf.glass { position:relative; }
.ix .b6 .shelf.glass::before { content:''; position:absolute; inset:0; background: linear-gradient(115deg, rgba(255,255,255,.09) 0%, transparent 20%, transparent 80%, rgba(255,255,255,.05) 100%); pointer-events:none; }
/* N33 matiere differente selon le type de classeur */
.ix .b6 .spine.fabric { background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 2px, transparent 2px 4px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 2px, transparent 2px 4px); }
.ix .b6 .spine.rigid { box-shadow: inset 0 0 0 1px rgba(255,255,255,.3), inset 5px 0 0 rgba(255,255,255,.35), inset -5px 0 0 rgba(0,0,0,.4), 2px 2px 5px rgba(0,0,0,.4); }
/* N34 classeur vedette, sous spot */
.ix .b6 .spotwrap { position:relative; display:inline-block; padding-top: 26px; }
.ix .b6 .spotwrap::before { content:''; position:absolute; left:50%; top:-34px; width:150px; height:170px; transform:translateX(-50%); background: radial-gradient(ellipse at top, rgba(255,255,255,.2), transparent 70%); pointer-events:none; }
/* N35 ouverture complete en eventail */
.ix .b6 .openstage { perspective:1200px; display:flex; justify-content:center; padding: 10px 0; }
.ix .b6 .openbook { position:relative; width:220px; height:190px; }
.ix .b6 .obp { position:absolute; top:0; width:110px; height:190px; background: linear-gradient(135deg,#0f1b3d,#142a5c); border:2px solid rgba(255,255,255,.3); transition: transform .55s cubic-bezier(.2,.8,.2,1); }
.ix .b6 .obp.l { right:50%; transform-origin: right center; }
.ix .b6 .obp.r { left:50%; transform-origin: left center; }
.ix .b6 .openbook.open .obp.l { transform: rotateY(24deg); }
.ix .b6 .openbook.open .obp.r { transform: rotateY(-24deg); }
/* N36 anneaux qui "cliquent" a l'ouverture */
.ix .b6 .ringhole.clickpulse { animation: b7click .4s ease; }
@keyframes b7click { 0% { transform: scale(1); } 40% { transform: scale(1.32) translateY(-2px); } 100% { transform: scale(1); } }
/* N37 pochette avec relief interne (volume du plastique) */
.ix .b6 .pocket { width:74px; aspect-ratio:2.5/3.5; position:relative; box-shadow: inset 0 0 0 1px rgba(255,255,255,.22), inset 2px 2px 7px rgba(0,0,0,.4), inset -1px -1px 3px rgba(255,255,255,.18); border-radius:2px; overflow:hidden; }
.ix .b6 .pocket img { width:100%; height:100%; object-fit:cover; }
/* N38 mode vitrine musee : spot sur le classeur ouvert */
.ix .b6 .museumwrap { position:relative; padding: 34px 10px; }
.ix .b6 .museumwrap::before { content:''; position:absolute; inset:0; background: radial-gradient(ellipse at center, transparent 32%, rgba(0,0,0,.8) 85%); pointer-events:none; }
/* N39 logo du sport embosse sur la tranche */
.ix .b6 .spine .emboss { position:absolute; top:7px; left:50%; transform:translateX(-50%); width:18px; height:18px; border-radius:50%; background: rgba(255,255,255,.92); box-shadow: 0 1px 2px rgba(0,0,0,.4); }
/* N40 separateurs façon languette carton */
.ix .b6 .tab { position:relative; display:inline-block; background: var(--fc); border-radius: 3px 3px 0 0; padding: 5px 16px 5px 12px; font:800 10px system-ui; letter-spacing:.1em; text-transform:uppercase; color:#fff; margin-left: 10px; box-shadow: 0 -2px 6px rgba(0,0,0,.3); clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%); }
/* N41 transition cinematique a l'ouverture */
.ix .b6 .cinestage { position:relative; height:220px; display:grid; place-items:center; overflow:hidden; }
.ix .b6 .cinecover { width:120px; height:170px; background: linear-gradient(145deg,#1f3a5f,#0d1824); border:2px solid rgba(255,255,255,.3); transition: transform .9s cubic-bezier(.3,.1,.2,1), opacity .5s ease .4s; }
.ix .b6 .cinecover.zoom { transform: scale(3.6); opacity:0; }
/* N42 effet "sous verre" pour les cartes precieuses */
.ix .b6 .underglass { position:relative; width:92px; aspect-ratio:2.5/3.5; margin:0 auto; }
.ix .b6 .underglass img { width:100%; height:100%; object-fit:cover; display:block; box-shadow: 0 0 0 2px #ffd54a, 0 0 18px rgba(255,213,74,.55); }
.ix .b6 .underglass::after { content:''; position:absolute; top:-20%; left:-40%; width:45%; height:140%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.5), transparent); transform: translateX(-40%) rotate(8deg); animation: b7glass 4s ease-in-out infinite; pointer-events:none; }
@keyframes b7glass { 0%,70% { transform: translateX(-120%) rotate(8deg); } 100% { transform: translateX(260%) rotate(8deg); } }
@media (prefers-reduced-motion: reduce) { .ix .b6 .mote, .ix .b6 .underglass::after, .ix .b6 .spiralring.go::after { animation: none !important; } }
`

const Bay = ({ id, n, title, desc, kind, children }: { id: string; n: string; title: string; desc: string; kind?: 'tech'; children: React.ReactNode }) => (
  <section className="bay" id={id}>
    <span className={'eyebrow' + (kind === 'tech' ? ' k' : '')}>{n}{kind === 'tech' ? ' · technique' : ''}</span>
    <h2 className="sf">{title}</h2>
    <p className="d">{desc}</p>
    <div className="stage"><div className="b6">{children}</div></div>
  </section>
)
// remonte l'animation : un compteur « Rejouer » change la cle du contenu
function Replay({ children, label = 'Rejouer' }: { children: (k: number) => React.ReactNode; label?: string }) {
  const [k, setK] = useState(0)
  return (<>{children(k)}<button type="button" className="rp" onClick={() => setK(x => x + 1)}>↻ {label}</button></>)
}

const Spine = ({ color, title, pages, locked, cover, cls = '', ghost, glintLock, style }: {
  color?: string; title?: string; pages?: number; locked?: boolean; cover?: string; cls?: string; ghost?: boolean; glintLock?: boolean; style?: CSSProperties
}) => (
  <div className={'spine ' + cls} style={ghost ? style : { background: color, ...style }}>
    {ghost ? '+' : (
      <>
        {cover && <div className="cov"><img src={cover} alt="" /></div>}
        {locked && <span className={'lock' + (glintLock ? ' glint' : '')}>🔒</span>}
        <span className="ttl">{title}{pages ? ` · ${pages}` : ''}</span>
      </>
    )}
  </div>
)

const Ring = ({ pct, k }: { pct: number; k: number }) => {
  const r = 31, c = 2 * Math.PI * r
  return (
    <div className="ringwrap" key={k}>
      <svg width={72} height={72}><circle className="bgc" cx={36} cy={36} r={r} strokeWidth={6} /><circle className="fgc" cx={36} cy={36} r={r} strokeWidth={6} style={{ ['--off' as string]: c - (pct / 100) * c }} /></svg>
      <span className="pct">{pct}%</span>
    </div>
  )
}

const FlyDemo = ({ k }: { k: number }) => {
  const [hit, setHit] = useState(false)
  useEffect(() => { setHit(false); const t = setTimeout(() => setHit(true), 1000); return () => clearTimeout(t) }, [k])
  return (
    <div className="flywrap" key={k}>
      <img className="flyer" src={C.maxey.img} alt="" />
      <div className={'landslot' + (hit ? ' hit' : '')} />
    </div>
  )
}

const FlipDemo = ({ k }: { k: number }) => (
  <div className="flipstage" key={k}>
    <div className="fpage" />
    <div className="fpage r go" />
  </div>
)

const BlurUpDemo = ({ k }: { k: number }) => {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(false); const t = setTimeout(() => setLoaded(true), 900); return () => clearTimeout(t) }, [k])
  return (
    <div className={'bu' + (loaded ? ' loaded' : '')} key={k}>
      <img className="ph" src={C.hawkins.img} alt="" />
      <img className="sharp" src={C.hawkins.img} alt="" />
    </div>
  )
}

const LightboxDemo = () => {
  const [on, setOn] = useState(false)
  return (
    <div className="lbwrap">
      <div className="row" style={{ marginBottom: 14 }}>
        {[C.mccain, C.edwards, C.mcw, C.maxey].map(c => <img key={c.nom} className="lbthumb" src={c.img} alt="" onClick={() => setOn(true)} />)}
      </div>
      <div className={'lbdim' + (on ? ' on' : '')} onClick={() => setOn(false)} />
      <img className={'lbbig' + (on ? ' on' : '')} src={C.mccain.img} alt="" onClick={() => setOn(false)} />
    </div>
  )
}

const CascadeShelfDemo = ({ k }: { k: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current; if (!root) return
    const rows = [...root.querySelectorAll('.rv')]
    rows.forEach(e => e.classList.remove('on'))
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('on'); io.unobserve(e.target) } }), { threshold: 0.3 })
    const t = setTimeout(() => rows.forEach(e => io.observe(e)), 150)
    return () => { clearTimeout(t); io.disconnect() }
  }, [k])
  return (
    <div className="shelf" ref={ref} key={k}>
      {[0, 1, 2].map(row => (
        <div className="rv" key={row} style={{ transitionDelay: `${row * 110}ms` }}>
          <div className="srow">{[0, 1, 2, 3].map(i => <Spine key={i} color={BC[(row * 4 + i) % BC.length]} title={`Set ${row * 4 + i + 1}`} pages={2} />)}</div>
          <div className="board" />
        </div>
      ))}
    </div>
  )
}

const IDEAS: [string, string, React.ReactNode, ('tech' | undefined)?][] = [
  ['Dos de classeur en cuir avec titre doré embossé', 'Les classeurs premium (ou juste une variante de couleur) adoptent un grain de cuir subtil et un titre en lettres dorées légèrement gravées, au lieu d\'un simple aplat de couleur.', (
    <div className="shelf"><div className="srow"><Spine cls="leather" title={C.mccain.nom} pages={4} /><Spine color={BC[3]} title={C.edwards.nom} pages={2} /><Spine color={BC[4]} title={C.mcw.nom} pages={3} /></div><div className="board" /></div>)],
  ['Le classeur sort de l\'étagère au survol', 'Au lieu d\'un simple décalage vers le haut, le classeur s\'incline légèrement comme si on le tirait du doigt — l\'ombre grandit en même temps pour renforcer l\'effet de profondeur.', (
    <div className="shelf"><div className="srow">{[0, 1, 2, 3].map(i => <Spine key={i} cls="pull" color={BC[i]} title={[C.mccain, C.edwards, C.mcw, C.maxey][i].nom} pages={i + 1} />)}</div><div className="board" /></div>)],
  ['L\'étagère s\'affaisse quand on range un nouveau classeur', 'La planche de l\'étagère "encaisse" visuellement le poids : un léger tassement au moment où le classeur tombe et se pose, avec un petit rebond.', (
    <Replay>{k => <div className="shelf" key={k}><div className="srow"><Spine color={BC[0]} title={C.mccain.nom} pages={3} /><Spine color={BC[1]} title={C.edwards.nom} pages={2} /><Spine cls="drop" color={BC[3]} title="Nouveau" pages={0} /></div><div className="board sag" /></div>}</Replay>)],
  ['Anneau de progression du classeur', 'Un petit anneau coloré (plutôt qu\'un texte "12/16") entoure le cadenas ou le coin du classeur et montre d\'un coup d\'œil son taux de remplissage, en se dessinant à l\'ouverture de la bibliothèque.', (
    <Replay>{k => <div className="row"><Ring pct={75} k={k} /><Ring pct={32} k={k} /><Ring pct={100} k={k} /></div>}</Replay>)],
  ['Pastille "nouveau" sur un classeur fraîchement créé', 'Un petit badge vert qui pulse doucement sur le coin du classeur pendant quelques jours après sa création, pour le repérer tout de suite dans une grande bibliothèque.', (
    <div className="shelf"><div className="srow"><Spine color={BC[0]} title={C.mccain.nom} pages={1} /><div style={{ position: 'relative' }}><Spine color={BC[2]} title="2027 Prizm" pages={0} /><span className="newb">N</span></div></div><div className="board" /></div>)],
  ['Rayon de lumière ambiant qui balaie l\'étagère', 'Un très léger reflet diagonal traverse lentement le fond de la bibliothèque en continu, comme une vitrine éclairée — à peine perceptible, juste assez pour que l\'ensemble ne soit pas statique.', (
    <div className="shelf amb"><div className="srow">{[0, 1, 2, 3, 4].map(i => <Spine key={i} color={BC[i % BC.length]} title={`Classeur ${i + 1}`} pages={i} />)}</div><div className="board" /></div>)],
  ['Le cadenas scintille au lieu d\'être figé', 'Sur les classeurs privés, le petit 🔒 a un bref reflet lumineux toutes les quelques secondes — un détail qui signale "protégé" sans avoir besoin de le lire.', (
    <div className="shelf"><div className="srow"><Spine color={BC[4]} title={C.mcw.nom} pages={2} locked glintLock /><Spine color={BC[1]} title={C.maxey.nom} pages={3} locked glintLock /></div><div className="board" /></div>)],
  ['Étagère vide illustrée plutôt qu\'un bloc gris', 'Une section sans classeur affiche des silhouettes en pointillés avec un "+" au centre, plus accueillant qu\'un simple espace vide — invite clairement à ajouter le premier classeur.', (
    <div className="shelf"><div className="srow">{[0, 1, 2].map(i => <Spine key={i} ghost cls="ghost" />)}</div><div className="board" /></div>)],
  ['Planche d\'étagère en bois, teintée par la section', 'Chaque section (dossier) a déjà sa couleur sur le libellé — la planche en dessous reprend cette teinte avec un léger grain de bois, pour unifier visuellement toute la rangée.', (
    <div className="shelf"><div className="srow">{[0, 1, 2].map(i => <Spine key={i} color={FC[0]} title={`Lakers ${i + 1}`} pages={i + 2} />)}</div><div className="board grain" style={{ ['--fc' as string]: FC[0] } as CSSProperties} /></div>)],
  ['Glisser-déposer avec un léger "wobble" physique', 'Pendant la réorganisation, le classeur saisi se soulève, grossit très légèrement et s\'incline un peu au lieu de rester rigide — rend le geste plus satisfaisant qu\'un simple déplacement linéaire.', (
    <GrabWrap />)],
  ['Tourner une page avec le poids du papier', 'La page se retourne avec une ombre qui traverse la tranche au moment précis où elle passe à la verticale — donne une sensation de matière plutôt qu\'une simple rotation plate.', (
    <Replay>{k => <FlipDemo k={k} />}</Replay>)],
  ['Case vide qui respire, "+" qui grossit au survol', 'Une pochette vide a un contour en pointillés qui pulse doucement pour attirer l\'œil sans être criard ; le "+" au centre grossit nettement au survol pour confirmer qu\'on peut cliquer.', (
    <div className="row"><div className="eslot"><span>+</span></div><div className="eslot"><span>+</span></div></div>)],
  ['La carte "vole" du picker jusqu\'à sa case', 'Au lieu d\'apparaître instantanément, la carte choisie dans le picker parcourt une petite trajectoire courbe jusqu\'à sa pochette, qui flashe brièvement en vert à l\'arrivée pour confirmer le rangement.', (
    <Replay>{k => <FlyDemo k={k} />}</Replay>)],
  ['Réordonner les cartes d\'une page avec un espace magnétique', 'En glissant une carte sur sa page, un espace s\'ouvre en douceur entre ses voisines pour montrer où elle va atterrir, plutôt qu\'un déplacement sec.', (
    <div className="box"><div className="reorderRow"><img className="card" src={C.mccain.img} alt="" style={{ width: 50 }} /><span className="gapx" /><img className="card" src={C.edwards.img} alt="" style={{ width: 50 }} /><img className="card" src={C.mcw.img} alt="" style={{ width: 50 }} /></div><p style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginTop: 10 }}>Survole la rangée pour voir l&apos;espace s&apos;ouvrir.</p></div>)],
  ['Reflet métallique animé sur les anneaux (classeur à anneaux)', 'Pour les classeurs de type "anneaux", chaque trou métallique a un bref reflet qui le traverse de temps en temps — un détail qui vend le matériau sans effort.', (
    <div className="box"><div className="ringsRow">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="ringhole" style={{ animationDelay: `${i * 0.3}s` }} />)}</div></div>)],
  ['Le coin de la page se soulève au survol', 'Un petit coin de page qui se "décolle" visuellement quand le pointeur approche du bord — un indice discret et skeuomorphe qu\'on peut tourner la page à cet endroit.', (
    <div className="peelpage" />)],
  ['Aperçu plein cadre avec transition "élément partagé"', 'Cliquer sur une carte dans sa pochette l\'agrandit en partant exactement de sa position d\'origine (pas un fondu générique) puis elle revient à sa place en cliquant ailleurs — cohérent avec le reste du site.', (
    <LightboxDemo />)],
  ['Squelettes brillants en forme de dos de classeur', 'Pendant le chargement de la bibliothèque, des silhouettes de classeurs avec un dégradé qui défile remplacent le vide — la forme de l\'étagère est déjà là avant même les données.', (
    <div className="shelf"><div className="srow">{[0, 1, 2, 3].map(i => <Spine key={i} ghost={false} cls="sk" />)}</div><div className="board" /></div>)],
  ['Les rangées de l\'étagère apparaissent en cascade au défilement', 'Dans une grande bibliothèque, chaque rangée (section) monte en fondu à son tour quand elle entre dans l\'écran, légèrement décalée de la précédente — une seule fois, pas à chaque passage.', (
    <Replay>{k => <CascadeShelfDemo k={k} />}</Replay>)],
  ['Couvertures et cases en chargement progressif (flou → net)', 'Une version minuscule et floue de l\'image s\'affiche immédiatement, puis la vraie image prend le relais en fondu dès qu\'elle est prête — plus de saut brutal ni de case grise qui clignote.', (
    <Replay>{k => <BlurUpDemo k={k} />}</Replay>)],
  ['Ne précharger que les pages voisines, pas tout le classeur', 'Un classeur de 40 pages n\'a besoin de charger que la page affichée et ses deux voisines immédiates ; le reste se charge seulement quand on s\'en approche en tournant les pages. Évite de télécharger des dizaines d\'images jamais vues.', (
    <div className="pgstrip">{Array.from({ length: 12 }, (_, i) => <div key={i} className={'pg' + (Math.abs(i - 5) <= 1 ? ' on' : '')}>{i + 1}</div>)}</div>
  ), 'tech'],
  ['Rendu virtualisé des pages d\'un gros classeur', 'Pour un classeur à 50+ pages, seules les 2-3 pages visibles sont réellement montées dans le DOM ; les autres ne réservent que leur hauteur de défilement. Le classeur reste fluide à faire défiler quelle que soit sa taille, au lieu de ralentir avec le nombre de pages.', (
    <div className="pgstrip">{Array.from({ length: 12 }, (_, i) => <div key={i} className={'pg' + (Math.abs(i - 5) <= 1 ? ' dom' : ' off')}>{Math.abs(i - 5) <= 1 ? 'DOM' : ''}</div>)}</div>
  ), 'tech'],
  ['Regrouper les écritures de réorganisation plutôt qu\'une par case déplacée', 'Glisser 6 cartes pour réorganiser une page ne doit pas écrire 6 fois en base pendant le geste : on attend la fin du glisser-déposer (ou un court délai d\'inactivité) pour n\'envoyer qu\'une seule écriture groupée avec l\'ordre final.', (
    <div><div className="lab">Avant · une écriture par pixel déplacé</div><div className="tl">{Array.from({ length: 14 }, (_, i) => <div key={i} className="tk bad" />)}</div><div className="lab" style={{ marginTop: 16 }}>Après · une écriture groupée à la fin du geste</div><div className="tl"><div className="tk good" /></div></div>
  ), 'tech'],
]

function GrabWrap() {
  const [g, setG] = useState(false)
  return (
    <div>
      <div className="shelf"><div className="srow">
        <Spine color={BC[0]} title={C.mccain.nom} pages={3} />
        <Spine color={BC[1]} title={C.edwards.nom} pages={2} cls={g ? 'grabbed' : ''} />
        <Spine color={BC[2]} title={C.mcw.nom} pages={4} />
      </div><div className="board" /></div>
      <button type="button" className="rp" onClick={() => setG(v => !v)}>{g ? '↓ Reposer' : '✋ Saisir'}</button>
    </div>
  )
}

// ── Serie 47 : classeurs, le realisme ──────────────────────────────────
const LitShadowDemo = () => {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width
    el.querySelectorAll<HTMLElement>('.spine.lit').forEach(s => s.style.setProperty('--sx', `${(x - 0.5) * 22}px`))
  }
  return (
    <div className="shelf" ref={ref} onMouseMove={move}>
      <div className="srow"><Spine cls="lit" color={BC[0]} title={C.mccain.nom} pages={3} /><Spine cls="lit" color={BC[3]} title={C.edwards.nom} pages={2} /><Spine cls="lit" color={BC[4]} title={C.mcw.nom} pages={4} /><Spine cls="lit" color={BC[1]} title={C.maxey.nom} pages={1} /></div>
      <div className="board" />
    </div>
  )
}

const SpiralCascade = ({ k }: { k: number }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current; if (!root) return
    const rings = [...root.querySelectorAll('.spiralring')]
    rings.forEach(r => r.classList.remove('go'))
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('go'); io.unobserve(e.target) } }), { threshold: 0.4 })
    const t = setTimeout(() => rings.forEach(r => io.observe(r)), 150)
    return () => { clearTimeout(t); io.disconnect() }
  }, [k])
  return <div className="box" ref={ref} key={k}><div className="spiralrow">{Array.from({ length: 10 }, (_, i) => <div key={i} className="spiralring" style={{ ['--i' as string]: i } as CSSProperties} />)}</div></div>
}

const CoverTiltDemo = () => {
  const move = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget; const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`)
  }
  return <div className="covertilt" onMouseMove={move}><span className="spec" /></div>
}

const SoundToggle = () => {
  const [on, setOn] = useState(false)
  return (
    <div className="swrow">
      <div className={'sw' + (on ? ' on' : '')} onClick={() => setOn(v => !v)}><i /></div>
      <span className="lab" style={{ margin: 0 }}>🔈 Son des pages {on ? 'activé' : 'désactivé (par défaut)'}</span>
    </div>
  )
}

const OpenBookDemo = () => {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="openstage"><div className={'openbook' + (open ? ' open' : '')}><div className="obp l" /><div className="obp r" /></div></div>
      <button type="button" className="rp" onClick={() => setOpen(v => !v)}>{open ? '↺ Fermer' : '📖 Ouvrir'}</button>
    </div>
  )
}

const CineZoomDemo = ({ k }: { k: number }) => {
  const [zoom, setZoom] = useState(false)
  useEffect(() => { setZoom(false); const t = setTimeout(() => setZoom(true), 500); return () => clearTimeout(t) }, [k])
  return <div className="cinestage" key={k}><div className={'cinecover' + (zoom ? ' zoom' : '')} /></div>
}

const MOTES = Array.from({ length: 14 }, (_, i) => ({ l: (i * 37) % 100, t: 6 + (i * 13) % 6, d: (i * 0.41) % 4 }))

const IDEAS2: [string, string, React.ReactNode][] = [
  ['Ombre portée qui suit une source de lumière', 'L\'ombre de chaque classeur sur le bois se décale légèrement selon la position du curseur (qui joue le rôle d\'une lumière) — déplace la souris au-dessus de l\'étagère.', (
    <LitShadowDemo />)],
  ['Anneaux de reliure spirale, reflet en cascade au scroll', 'Pour un classeur "spirale", chaque anneau métallique s\'allume d\'un reflet l\'un après l\'autre dès que la rangée entre dans l\'écran — un détail qui donne tout de suite envie de zoomer.', (
    <Replay>{k => <SpiralCascade k={k} />}</Replay>)],
  ['Le cuir réagit au mouvement de la souris', 'La couverture en cuir a un reflet spéculaire qui suit le curseur, comme une vraie matière sous la lumière — déplace la souris sur la couverture.', (
    <CoverTiltDemo />)],
  ['Reflet plastique glossy sur les pochettes au survol', 'Chaque pochette a le reflet diagonal typique du plastique rigide des protège-cartes, qui glisse au survol — un détail minuscule mais hyper reconnaissable pour un collectionneur.', (
    <div className="row">{[C.mccain, C.edwards, C.mcw].map(c => <div key={c.nom} className="sleeve"><img src={c.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>)}</div>)],
  ['Étagère en légère perspective 3D', 'Les classeurs aux extrémités de la rangée s\'inclinent très légèrement, comme si on regardait une vraie étagère depuis le centre — donne une sensation de profondeur sans gadget.', (
    <div className="shelf persp"><div className="srow">{[0, 1, 2, 3, 4].map(i => <Spine key={i} color={BC[i]} title={`Classeur ${i + 1}`} pages={i} style={{ transform: `rotateY(${(i - 2) * -8}deg)` } as CSSProperties} />)}</div><div className="board" /></div>)],
  ['Classeurs "usés" par une grande collection', 'Un classeur très rempli (beaucoup de pages, ancien) gagne une légère patine — coins arrondis, teinte un peu passée — pour distinguer d\'un coup d\'œil les classeurs vécus des tout nouveaux.', (
    <div className="shelf"><div className="srow"><Spine cls="worn" color={BC[2]} title="Collection 2015-2019" pages={38} /><Spine color={BC[0]} title="2027 Prizm" pages={2} /></div><div className="board" /></div>)],
  ['Poussière qui flotte doucement dans la lumière de l\'étagère', 'Quelques particules à peine visibles dérivent lentement devant le fond de la bibliothèque — pur détail d\'ambiance, comme la lumière dans une pièce.', (
    <div className="shelf dust"><div className="srow">{[0, 1, 2].map(i => <Spine key={i} color={BC[i]} title={`Classeur ${i + 1}`} pages={i + 1} />)}</div><div className="board" />{MOTES.map((m, i) => <span key={i} className="mote" style={{ left: `${m.l}%`, bottom: 20, ['--t' as string]: `${m.t}s`, ['--d' as string]: `${m.d}s` } as CSSProperties} />)}</div>)],
  ['Petit bruit de page qui tourne, désactivé par défaut', 'Un retour sonore très discret (un léger "swish" de papier) à chaque tournage de page, uniquement si le collectionneur l\'active lui-même — jamais imposé.', (
    <div className="box"><SoundToggle /></div>)],
  ['Reflet de vitrine en verre sur toute la bibliothèque', 'Un voile de lumière diagonal très subtil traverse toute l\'étagère, comme si elle était exposée derrière une vitre — renforce le sentiment de "collection exposée" plutôt que de simple liste.', (
    <div className="shelf glass"><div className="srow">{[0, 1, 2, 3].map(i => <Spine key={i} color={BC[i]} title={`Classeur ${i + 1}`} pages={i} />)}</div><div className="board" /></div>)],
  ['Une matière différente selon le type de classeur', 'Un classeur "portfolio" a un grain toilé discret, un classeur "anneaux" un plastique plus rigide et brillant sur les bords — le matériau raconte le type sans avoir à le lire.', (
    <div className="shelf"><div className="srow"><Spine cls="fabric" color={BC[4]} title="Portfolio" pages={3} /><Spine cls="rigid" color={BC[3]} title="Anneaux" pages={5} /></div><div className="board" /></div>)],
  ['Le classeur vedette mis en valeur sous un spot', 'Le classeur le plus rempli (ou épinglé par le collectionneur) peut être mis en avant en haut de la bibliothèque, sous un halo de lumière façon vitrine de musée.', (
    <div className="spotwrap"><Spine color={BC[1]} title="Ma collection signature" pages={62} /></div>)],
  ['Ouverture complète en éventail autour de la reliure', 'Au lieu d\'un simple flip plat, les deux pages s\'écartent légèrement en 3D autour de la reliure centrale à l\'ouverture — plus proche d\'un vrai classeur qu\'on ouvre entre les mains.', (
    <OpenBookDemo />)],
  ['Les anneaux "cliquent" visuellement à l\'ouverture', 'Au moment d\'ouvrir un classeur à anneaux, chaque anneau a un micro-rebond métallique en cascade — vend le mécanisme sans avoir besoin de son.', (
    <div className="box"><div className="ringsRow">{[0, 1, 2, 3, 4].map(i => <div key={i} className="ringhole clickpulse" style={{ animationDelay: `${i * 70}ms` }} />)}</div></div>)],
  ['Pochettes avec un vrai volume (relief intérieur)', 'Un léger jeu d\'ombre et de lumière à l\'intérieur de chaque pochette donne l\'impression d\'un vrai plastique creux plutôt qu\'un cadre plat — un détail qui se voit surtout sur les cases vides.', (
    <div className="row">{[C.hawkins, C.maxey].map(c => <div key={c.nom} className="pocket"><img src={c.img} alt="" /></div>)}</div>)],
  ['Mode "vitrine musée" à l\'ouverture d\'un classeur', 'À l\'ouverture, le reste de l\'écran s\'assombrit légèrement en vignette autour du classeur, comme un objet mis en lumière dans une vitrine — concentre l\'attention sans un vrai mode plein écran.', (
    <div className="museumwrap"><div className="shelf"><div className="srow"><Spine color={BC[3]} title={C.mccain.nom} pages={4} /></div><div className="board" /></div></div>)],
  ['Logo du sport discrètement embossé sur la tranche', 'Un tout petit médaillon (logo de l\'équipe ou de la ligue) en haut de la tranche, en relief plutôt qu\'en gros badge — personnalise sans surcharger le dos du classeur.', (
    <div className="shelf"><div className="srow"><div style={{ position: 'relative' }}><Spine color={BC[3]} title={C.mccain.nom} pages={4} /><span className="emboss" /></div></div><div className="board" /></div>)],
  ['Séparateurs façon languette de bibliothèque physique', 'Chaque section a une vraie languette en carton découpé au-dessus de l\'étagère plutôt qu\'un simple bandeau coloré plat — plus proche d\'un classeur de collection réel qu\'un intercalaire numérique.', (
    <div><span className="tab" style={{ ['--fc' as string]: FC[1] } as CSSProperties}>Lakers</span><div className="shelf"><div className="srow"><Spine color={BC[3]} title={C.mccain.nom} pages={2} /></div><div className="board" /></div></div>)],
  ['Transition cinématique de zoom à l\'ouverture', 'Au clic sur un classeur, la couverture grossit doucement vers l\'écran avant de laisser place aux pages — comme l\'ouverture d\'une appli de lecture, plutôt qu\'un changement de page sec.', (
    <Replay>{k => <CineZoomDemo k={k} />}</Replay>)],
  ['Effet "sous verre" pour les cartes les plus précieuses', 'Une carte numérotée /1 ou gradée 10 dans sa pochette gagne un halo doré et un reflet de verre qui la traverse lentement — la distingue immédiatement des autres cases sans avoir à lire l\'étiquette.', (
    <div className="underglass"><img src={C.edwards.img} alt="" /></div>)],
]

export default function DaIdeas() {
  return (
    <div className="ix">
      <style>{CSS}</style>
      <Link href="/admin" className="back">← Admin</Link>
      <h1 className="sf">Idées · Série 46 · Classeurs &amp; bibliothèque</h1>
      <p className="lead">23 pistes pour les classeurs et la bibliothèque de classeurs de la galerie — visuel, animations, et 3 pistes purement techniques/perf (repérées "technique"), toutes vivantes ici (survol ou bouton « Rejouer »). Respectent « réduire les animations » du téléphone. Dis-moi les numéros à garder.</p>
      <nav className="tags">{IDEAS.map((d, i) => <a key={i} href={`#n${i + 1}`} className={d[3] === 'tech' ? 'k' : ''}>N{i + 1}</a>)}</nav>
      {IDEAS.map((d, i) => <Bay key={d[0]} id={`n${i + 1}`} n={`N${i + 1}`} title={d[0]} desc={d[1]} kind={d[3]}>{d[2]}</Bay>)}

      <h1 className="sf" style={{ marginTop: 50 }}>Idées · Série 47 · Classeurs, le réalisme</h1>
      <p className="lead">19 pistes en plus des précédentes, plus fantaisistes, centrées sur le rendu matière et la mise en scène — cuir qui réagit à la souris, ombres qui suivent une lumière, poussière, vitrine musée, ouverture en éventail... Toutes vivantes ici (survol, clic ou bouton « Rejouer »).</p>
      <nav className="tags">{IDEAS2.map((_, i) => <a key={i} href={`#m${i + 1}`}>N{IDEAS.length + i + 1}</a>)}</nav>
      {IDEAS2.map((d, i) => <Bay key={d[0]} id={`m${i + 1}`} n={`N${IDEAS.length + i + 1}`} title={d[0]} desc={d[1]}>{d[2]}</Bay>)}
    </div>
  )
}
