'use client'
/* eslint-disable @next/next/no-img-element */
// Outil admin (/admin/pub) : vidéo de présentation de Memorabilius, 30 s, vertical 1080×1920.
// Les écrans montrés sont de VRAIES captures du site (public/ad/*.jpg) : galerie, trades, achats, ventes, guides, setlist (données d'exemple et photos de la galerie GKNNN_Cards).
// Tout est monté dans un canvas et enregistré sur ton appareil (MediaRecorder) : rien n'est envoyé.
import { useEffect, useRef, useState } from 'react'
import TikTokMaker from './TikTokMaker'
import PubPlanning from './PubPlanning'
import PubCalendar from './PubCalendar'
import { scheduleMusic, decodeAudioFile, type MusicKind } from './audio'
import { AD_TX, loadPartnerLogo } from './tiktokAd'
import { saveOrShareFile } from '@/lib/saveOrShare'

const W = 1080, H = 1920, FPS = 60, DUR = 30
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const DISPLAY = `Surfquest, Impact, 'Arial Narrow', ${FONT}`
const BLUE = '#7fa8ff'
// début de chaque écran du téléphone (s) : galerie, viewer 3D, trades, achats, ventes, guides, setlist ; final à fin
const T0 = { gal: 2.4, viewer: 6.6, trades: 10.0, achats: 13.6, ventes: 17.2, guides: 20.8, setlist: 23.8, fin: 26.8 }
// téléphone : écran 640 × 1387 (rapport 480:1040 des captures)
const SW = 640, SH = Math.round(SW * 1040 / 480), PY = 360

type Lang = 'fr' | 'en' | 'de' | 'es' | 'it'
type Tx = { slogan: string; fin1: string; fin2: string; free: string; t: Record<string, string>; s: Record<string, string> }
const TX: Record<Lang, Tx> = {
  fr: { slogan: 'L’app ultime pour les collectionneurs', fin1: 'L’app ultime', fin2: 'pour les collectionneurs', free: 'GRATUIT · SUR LE WEB ET ANDROID',
    t: { gal: 'Ta galerie', v: 'En 3D', trd: 'Trades', ach: 'Tes achats', ven: 'Tes ventes', gui: 'Guides', set: 'Setlist' },
    s: { gal: 'Toute ta collection, en un coup d’œil', v: 'Fais tourner chaque carte, détails et reflets', trd: 'Vends et échange avec les collectionneurs', ach: 'Enchères, suivi des colis, budget', ven: 'Offres, expéditions, profit réalisé', gui: 'Checklists et conseils pour collectionner', set: 'NBA 2024-25 · Checklists' } },
  en: { slogan: 'The ultimate app for collectors', fin1: 'The ultimate app', fin2: 'for collectors', free: 'FREE · ON THE WEB AND ANDROID',
    t: { gal: 'Your gallery', v: 'In 3D', trd: 'Trades', ach: 'Your purchases', ven: 'Your sales', gui: 'Guides', set: 'Setlist' },
    s: { gal: 'Your whole collection at a glance', v: 'Spin every card, details and shine', trd: 'Sell and trade with other collectors', ach: 'Auctions, parcel tracking, budget', ven: 'Offers, shipping, realized profit', gui: 'Checklists and tips for collectors', set: 'NBA 2024-25 · Checklists' } },
  de: { slogan: 'Die ultimative App für Sammler', fin1: 'Die ultimative App', fin2: 'für Sammler', free: 'KOSTENLOS · IM WEB UND AUF ANDROID',
    t: { gal: 'Deine Galerie', v: 'In 3D', trd: 'Trades', ach: 'Deine Käufe', ven: 'Deine Verkäufe', gui: 'Guides', set: 'Setlist' },
    s: { gal: 'Deine ganze Sammlung auf einen Blick', v: 'Dreh jede Karte, Details und Glanz', trd: 'Verkaufe und tausche mit Sammlern', ach: 'Auktionen, Paketverfolgung, Budget', ven: 'Angebote, Versand, realisierter Gewinn', gui: 'Checklisten und Tipps für Sammler', set: 'NBA 2024-25 · Checklisten' } },
  es: { slogan: 'La app definitiva para coleccionistas', fin1: 'La app definitiva', fin2: 'para coleccionistas', free: 'GRATIS · EN LA WEB Y EN ANDROID',
    t: { gal: 'Tu galería', v: 'En 3D', trd: 'Trades', ach: 'Tus compras', ven: 'Tus ventas', gui: 'Guías', set: 'Setlist' },
    s: { gal: 'Toda tu colección de un vistazo', v: 'Gira cada carta, detalles y brillo', trd: 'Vende e intercambia con coleccionistas', ach: 'Subastas, seguimiento de envíos, presupuesto', ven: 'Ofertas, envíos, beneficio realizado', gui: 'Checklists y consejos para coleccionar', set: 'NBA 2024-25 · Checklists' } },
  it: { slogan: 'L’app definitiva per i collezionisti', fin1: 'L’app definitiva', fin2: 'per i collezionisti', free: 'GRATIS · SUL WEB E SU ANDROID',
    t: { gal: 'La tua galleria', v: 'In 3D', trd: 'Trades', ach: 'I tuoi acquisti', ven: 'Le tue vendite', gui: 'Guide', set: 'Setlist' },
    s: { gal: 'Tutta la tua collezione a colpo d’occhio', v: 'Fai girare ogni carta, dettagli e riflessi', trd: 'Vendi e scambia con i collezionisti', ach: 'Aste, tracciamento pacchi, budget', ven: 'Offerte, spedizioni, profitto realizzato', gui: 'Checklist e consigli per collezionare', set: 'NBA 2024-25 · Checklist' } },
}
const LANG_NAMES: Record<Lang, string> = { fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español', it: 'Italiano' }

type Tall = { c: HTMLCanvasElement; nav: HTMLCanvasElement; k: number } // k = pixels par pixel css ; nav = menu du bas de l'appli (fixe)
type Assets = {
  gal: Tall; trd: Tall; ach: Tall; ven: Tall; gui: Tall; set: Tall
  vbg: HTMLImageElement; card3: ImageBitmap | null; partner: HTMLCanvasElement | null; partnerTxt: string; tx: Tx; logo: HTMLCanvasElement | null; card: ImageBitmap | null; cards: ImageBitmap[]
  bg: HTMLCanvasElement; grain: CanvasPattern | null; shell: HTMLCanvasElement; shadow: HTMLCanvasElement
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const eo = (t: number) => 1 - Math.pow(1 - clamp(t), 3)
const eio = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
const eio2 = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t) }
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src })
async function bmp(url: string): Promise<ImageBitmap | null> {
  try { const r = await fetch(url, { mode: 'cors' }); return r.ok ? await createImageBitmap(await r.blob()) : null } catch { return null }
}
async function tintedLogo(color: string): Promise<HTMLCanvasElement | null> {
  const b = await bmp('/memorabilius-logo-white-sm.png'); if (!b) return null
  const c = document.createElement('canvas'); c.width = b.width; c.height = b.height
  const x = c.getContext('2d')!; x.drawImage(b, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height)
  return c
}

// recolle plusieurs captures de l'APPLI prises à des défilements connus (px css) en une longue image ; barre du haut (40) et menu du bas (83) fixes : gardés une seule fois
const HEAD = 40, NAV = 83, NAVX = 26 // NAVX : partie du bouton central qui dépasse au-dessus du menu
function stitch(frames: { img: HTMLImageElement; y: number }[]): Tall {
  const K = 2, VH = 1040
  const last = frames[frames.length - 1]
  const c = document.createElement('canvas'); c.width = 480 * K; c.height = Math.ceil((last.y + VH) * K)
  const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'
  frames.forEach((f, i) => {
    const s = f.img.width / 480 // 1 (capture normale) ou 2 (capture haute définition)
    if (i === 0) x.drawImage(f.img, 0, 0, f.img.width, f.img.height, 0, f.y * K, 480 * K, VH * K)
    else x.drawImage(f.img, 0, HEAD * s, f.img.width, (VH - HEAD - NAV) * s, 0, (f.y + HEAD) * K, 480 * K, (VH - HEAD - NAV) * K)
  })
  const f0 = frames[0].img, s0 = f0.width / 480
  const NH = (NAV + NAVX) * K
  const nav = document.createElement('canvas'); nav.width = 480 * K; nav.height = NH
  const nx = nav.getContext('2d')!; nx.imageSmoothingQuality = 'high'; nx.drawImage(f0, 0, (VH - NAV - NAVX) * s0, f0.width, (NAV + NAVX) * s0, 0, 0, 480 * K, NH)
  // au-dessus du menu, on ne garde que le bouton central (le reste de cette bande est du contenu de page qui change)
  const tmp = document.createElement('canvas'); tmp.width = nav.width; tmp.height = NH; tmp.getContext('2d')!.drawImage(nav, 0, 0)
  nx.clearRect(0, 0, nav.width, NAVX * K); nx.save(); nx.beginPath(); nx.ellipse(240 * K, NAVX * K, 40 * K, NAVX * K, 0, 0, Math.PI * 2); nx.clip(); nx.drawImage(tmp, 0, 0); nx.restore()
  return { c, nav, k: K }
}

// ── pré-rendus (une seule fois) : fond flouté, grain, coque du téléphone, ombre de la carte ──
function makeBackground(cards: ImageBitmap[]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, '#050914'); g.addColorStop(0.55, '#0a1a4a'); g.addColorStop(1, '#0d2a7a')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.globalAlpha = 0.17; ctx.filter = 'blur(14px)'
  cards.slice(1, 4).forEach((b, i) => {
    const h = 640 + i * 90, w = (b.width / b.height) * h
    ctx.save(); ctx.translate([W * 0.86, W * 0.1, W * 0.78][i], [420, 1380, 1720][i]); ctx.rotate([0.18, -0.14, 0.1][i]); ctx.drawImage(b, -w / 2, -h / 2, w, h); ctx.restore()
  })
  ctx.restore()
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)')
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
  return c
}
function makeGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d')!, d = x.createImageData(256, 256)
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 13 }
  x.putImageData(d, 0, 0); return ctx.createPattern(c, 'repeat')
}
function makeShell(): HTMLCanvasElement {
  const pad = 140, bw = SW + 34, bh = SH + 34
  const c = document.createElement('canvas'); c.width = bw + pad * 2; c.height = bh + pad * 2
  const x = c.getContext('2d')!
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 90; x.shadowOffsetY = 40
  x.fillStyle = '#07080d'; x.beginPath(); x.roundRect(pad, pad, bw, bh, 84); x.fill()
  x.shadowColor = 'transparent'; x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 2.5; x.stroke()
  return c
}
function makeShadow(): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 700; c.height = 200
  const x = c.getContext('2d')!; x.filter = 'blur(40px)'; x.fillStyle = 'rgba(0,0,0,.4)'; x.beginPath(); x.ellipse(350, 100, 250, 34, 0, 0, Math.PI * 2); x.fill()
  return c
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', o: { align?: CanvasTextAlign; alpha?: number; display?: boolean; weight?: number; track?: number; dy?: number } = {}) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1
  ctx.font = o.display === false ? `${o.weight ?? 600} ${size}px ${FONT}` : `400 ${Math.round(size * 1.12)}px ${DISPLAY}`
  ctx.textAlign = o.align ?? 'left'; ctx.fillStyle = color
  if (o.track) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${o.track}px`
  ctx.fillText(o.display === false ? s : s.toUpperCase(), x, y + (o.dy ?? 0))
  ctx.restore()
}

// légende en haut à gauche : petit repère numéroté, titre, ligne de détail ; apparaît en montant très légèrement
function caption(ctx: CanvasRenderingContext2D, n: string, title: string, sub: string, t: number, a: number, b: number) {
  const p = eo(seg(t, a, a + 0.6)) * (1 - eo(seg(t, b - 0.4, b)))
  if (p <= 0) return
  const rise = (1 - eo(seg(t, a, a + 0.8))) * 24
  text(ctx, `${n}  —`, 90, 150, 34, BLUE, { display: false, weight: 700, track: 4, alpha: p, dy: rise })
  text(ctx, title, 90, 250, 104, '#fff', { alpha: p, dy: rise })
  text(ctx, sub, 90, 312, 36, '#b8c4ff', { display: false, weight: 500, alpha: p * seg(t, a + 0.25, a + 0.9), dy: rise })
}

// téléphone sobre : coque pré-rendue ; l'écran affiche un morceau défilant d'une vraie capture
function phone(ctx: CanvasRenderingContext2D, A: Assets, o: { cx?: number; cy?: number; scale?: number; rot?: number; alpha?: number }, drawScreen: (x: number, y: number, w: number, h: number) => void) {
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1
  ctx.translate(o.cx ?? W / 2, o.cy ?? PY + SH / 2); ctx.rotate(o.rot ?? 0); ctx.scale(o.scale ?? 1, o.scale ?? 1)
  ctx.drawImage(A.shell, -A.shell.width / 2, -A.shell.height / 2)
  ctx.save(); ctx.beginPath(); ctx.roundRect(-SW / 2, -SH / 2, SW, SH, 64); ctx.clip()
  drawScreen(-SW / 2, -SH / 2, SW, SH)
  ctx.restore(); ctx.restore()
}

// morceau d'une longue capture ; la barre du haut et le menu du bas de l'appli restent fixes
function screen(ctx: CanvasRenderingContext2D, T: Tall, scroll: number, x: number, y: number, w: number, h: number, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(T.c, 0, scroll * T.k, 480 * T.k, 1040 * T.k, x, y, w, h)
  ctx.drawImage(T.c, 0, 0, 480 * T.k, HEAD * T.k, x, y, w, (HEAD / 1040) * h)
  ctx.drawImage(T.nav, 0, 0, T.nav.width, T.nav.height, x, y + h - ((NAV + NAVX) / 1040) * h, w, ((NAV + NAVX) / 1040) * h)
  ctx.restore()
}

// carte en perspective réelle : bandes verticales, bords nets, reflet qui balaye
function card3d(ctx: CanvasRenderingContext2D, A: Assets, b: ImageBitmap, cx: number, cy: number, h: number, rotY: number, rotX: number, shine: number, alpha = 1) {
  const w = (b.width / b.height) * h, f = 2400, N = 64, sy = Math.cos(rotX)
  ctx.save(); ctx.globalAlpha = alpha
  const sw = w * 0.95; ctx.drawImage(A.shadow, cx - sw / 2, cy + h / 2 + 20, sw, sw * 0.29)
  const px: number[] = [], tp: number[] = [], bt: number[] = []
  for (let i = 0; i <= N; i++) {
    const x3 = (i / N - 0.5) * w, z = x3 * Math.sin(rotY), sc = f / (f - z)
    px.push(cx + x3 * Math.cos(rotY) * sc); tp.push(cy - (h / 2) * sy * sc); bt.push(cy + (h / 2) * sy * sc)
  }
  for (let i = 0; i < N; i++) {
    ctx.drawImage(b, (i / N) * b.width, 0, b.width / N + 1, b.height, Math.min(px[i], px[i + 1]), (tp[i] + tp[i + 1]) / 2, Math.abs(px[i + 1] - px[i]) + 0.8, ((bt[i] - tp[i]) + (bt[i + 1] - tp[i + 1])) / 2)
  }
  ctx.save(); ctx.beginPath(); ctx.moveTo(px[0], tp[0]); for (let i = 1; i <= N; i++) ctx.lineTo(px[i], tp[i]); for (let i = N; i >= 0; i--) ctx.lineTo(px[i], bt[i]); ctx.closePath(); ctx.clip()
  const xs = px[0] + (px[N] - px[0]) * lerp(-0.3, 1.3, shine)
  const g = ctx.createLinearGradient(xs - 160, cy - h / 2, xs + 160, cy + h / 2)
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.38)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(Math.min(px[0], px[N]) - 10, cy - h, Math.abs(px[N] - px[0]) + 20, h * 2)
  ctx.restore(); ctx.restore()
}

function pill(ctx: CanvasRenderingContext2D, label: string, color: string, cx: number, y: number, h: number, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha
  ctx.font = `800 ${Math.round(h * 0.52)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const w = ctx.measureText(label).width + h * 1.0
  ctx.fillStyle = 'rgba(8,12,30,.8)'; ctx.beginPath(); ctx.roundRect(cx - w / 2, y, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke()
  ctx.fillStyle = color; ctx.fillText(label, cx, y + h / 2 + 1)
  ctx.restore()
}

// écrans défilants : début, fin, longue capture, défilement de départ et d'arrivée (px css), légende
const FADE = 0.45
type Scr = { a: number; b: number; key: 'gal' | 'trd' | 'ach' | 'ven' | 'gui' | 'set'; from: number; to: number; n: string; title: string; sub: string }
const SCREENS: Scr[] = [
  { a: T0.gal, b: T0.viewer, key: 'gal', from: 540, to: 1850, n: '01', title: 'Ta galerie', sub: 'Toute ta collection, en un coup d’œil' },
  { a: T0.trades, b: T0.achats, key: 'trd', from: 380, to: 1650, n: '03', title: 'Trades', sub: 'Vends et échange avec les collectionneurs' },
  { a: T0.achats, b: T0.ventes, key: 'ach', from: 1780, to: 2780, n: '04', title: 'Tes achats', sub: 'Enchères, suivi des colis, budget' },
  { a: T0.ventes, b: T0.guides, key: 'ven', from: 0, to: 1000, n: '05', title: 'Tes ventes', sub: 'Offres, expéditions, profit réalisé' },
  { a: T0.guides, b: T0.setlist, key: 'gui', from: 0, to: 1100, n: '06', title: 'Guides', sub: 'Checklists et conseils pour collectionner' },
  { a: T0.setlist, b: T0.fin, key: 'set', from: 0, to: 500, n: '07', title: 'Setlist', sub: 'NBA 2024-25 · Checklists' },
]

function frame(ctx: CanvasRenderingContext2D, t: number, A: Assets) {
  // fond pré-rendu, très léger mouvement
  ctx.drawImage(A.bg, -20 + Math.sin(t * 0.2) * 10, -20 + Math.cos(t * 0.17) * 10, W + 40, H + 40)

  // ── intro : le logo et le slogan
  if (t < T0.gal + 0.6) {
    const p = eo(seg(t, 0.3, 1.3)) * (1 - eo(seg(t, 1.9, 2.5)))
    if (A.logo && p > 0) {
      const lw = 760, lh = (A.logo.height / A.logo.width) * lw, sc = lerp(0.96, 1, eo(seg(t, 0.3, 2.4)))
      ctx.save(); ctx.globalAlpha = p; ctx.translate(W / 2, 860); ctx.scale(sc, sc); ctx.drawImage(A.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore()
      text(ctx, A.tx.slogan, W / 2, 1000, 46, '#cdd8ff', { align: 'center', display: false, weight: 600, alpha: p * seg(t, 0.9, 1.5), track: 1 })
    }
  }

  // ── le téléphone traverse toutes les scènes, l'écran change en fondu
  const inP = eio2(seg(t, T0.gal - 0.5, T0.gal + 0.7)), outP = 1 - eio2(seg(t, T0.fin - 0.5, T0.fin + 0.5))
  const v = t - T0.viewer
  const inView = t >= T0.viewer - FADE && t < T0.trades + FADE
  if (inP > 0 && outP > 0) {
    const base = t - T0.gal
    phone(ctx, A, {
      cx: W / 2, cy: PY + SH / 2 + (1 - inP) * 900 + (1 - outP) * 900,
      scale: 1 + 0.018 * Math.sin(base * 0.35), rot: 0.012 * Math.sin(base * 0.42), alpha: Math.min(inP * 1.5, 1),
    }, (x, y, w, h) => {
      for (const s of SCREENS) {
        const al = clamp(seg(t, s.a - FADE, s.a)) * (1 - clamp(seg(t, s.b - FADE, s.b)))
        if (al <= 0) continue
        screen(ctx, A[s.key], lerp(s.from, s.to, eio(seg(t, s.a + 0.35, s.b - 0.3))), x, y, w, h, al)
      }
      if (inView) {
        // viewer 3D de l'appli : fond réel (sans la carte) + carte en perspective calculée à chaque image, donc rotation parfaitement fluide
        const al = clamp(seg(t, T0.viewer - FADE, T0.viewer)) * (1 - clamp(seg(t, T0.trades - FADE, T0.trades)))
        const ramp = eio2(seg(v, 0.35, 1.1))
        ctx.save(); ctx.globalAlpha = al; ctx.drawImage(A.vbg, 0, 0, A.vbg.width, A.vbg.height, x, y, w, h); ctx.restore()
        if (A.card3) card3d(ctx, A, A.card3, x + w / 2, y + h * (405 / 1040), h * (425 / 1040), 0.64 * Math.sin(2.1 * Math.max(0, v - 0.45)) * ramp, 0.05 * Math.sin(v * 1.3) * ramp, (v * 0.45) % 1, al)
        ctx.restore()
      }
    })
  }

  // légendes
  for (const s of SCREENS) caption(ctx, s.n, A.tx.t[s.key], A.tx.s[s.key], t, s.a + 0.3, s.b - 0.05)
  caption(ctx, '02', A.tx.t.v, A.tx.s.v, t, T0.viewer + 0.3, T0.trades - 0.05)

  // ── final
  if (t >= T0.fin - 0.3) {
    const k = t - T0.fin, p = eo(seg(k, 0.1, 0.9))
    if (A.logo) {
      const lw = 800, lh = (A.logo.height / A.logo.width) * lw
      ctx.save(); ctx.globalAlpha = p; ctx.translate(W / 2, 700); ctx.scale(lerp(0.97, 1, p), lerp(0.97, 1, p)); ctx.drawImage(A.logo, -lw / 2, -lh / 2, lw, lh); ctx.restore()
    }
    text(ctx, A.tx.fin1, W / 2, 880, 84, '#ffffff', { align: 'center', alpha: eo(seg(k, 0.4, 1.0)) })
    text(ctx, A.tx.fin2, W / 2, 980, 84, '#ffffff', { align: 'center', alpha: eo(seg(k, 0.6, 1.2)) })
    text(ctx, 'memorabilius.fr', W / 2, 1100, 52, BLUE, { align: 'center', display: false, weight: 700, alpha: eo(seg(k, 0.9, 1.5)), track: 2 })
    text(ctx, A.tx.free, W / 2, 1168, 30, '#b8c4ff', { align: 'center', display: false, weight: 600, alpha: eo(seg(k, 1.1, 1.7)), track: 4 })
    A.cards.slice(1, 6).forEach((b, i) => {
      const cp = eo(seg(k, 0.5 + i * 0.1, 1.3 + i * 0.1))
      const h = 400, w = (b.width / b.height) * h
      ctx.save(); ctx.globalAlpha = cp; ctx.translate(W / 2 + (i - 2) * 214, 1560 + Math.abs(i - 2) * 18 + (1 - cp) * 60); ctx.rotate((i - 2) * 0.07)
      ctx.drawImage(b, -w / 2, -h / 2, w, h); ctx.restore()
    })
    if (A.partner) {
      const p4 = eo(seg(k, 1.2, 1.8)), pw = 380, ph = (A.partner.height / A.partner.width) * pw
      ctx.save(); ctx.globalAlpha = p4; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 26px ${FONT}`; ctx.fillStyle = "#c9d6ff"; ctx.fillText(A.partnerTxt, W / 2, 175)
      ctx.drawImage(A.partner, W / 2 - pw / 2, 211 - (1 - p4) * 16, pw, ph); ctx.restore()
    }
  }

  // fondu d'entrée de toute la vidéo, puis grain de film (un seul remplissage)
  const fade = 1 - eo(seg(t, 0, 0.6))
  if (fade > 0) { ctx.fillStyle = `rgba(5,9,20,${fade})`; ctx.fillRect(0, 0, W, H) }
  if (A.grain) { ctx.save(); ctx.translate((Math.floor(t * 30) % 7) * 37, (Math.floor(t * 30) % 5) * 53); ctx.fillStyle = A.grain; ctx.fillRect(-256, -256, W + 256, H + 256); ctx.restore() }
}

// bande-son : uniquement des « swipes » (souffle qui monte) à chaque changement d'écran + un petit « tic » ; pas de musique
function scheduleAudio(ac: BaseAudioContext, dest: AudioNode, lead = 0.1) {
  const master = ac.createGain(); master.gain.value = 0.9; master.connect(dest)
  const t0 = ac.currentTime + lead
  const noise = (len: number) => { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b }
  const swipe = (at: number, up = true) => {
    const src = ac.createBufferSource(); src.buffer = noise(0.8); const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1
    f.frequency.setValueAtTime(up ? 400 : 4200, t0 + at - 0.35); f.frequency.exponentialRampToValueAtTime(up ? 4200 : 400, t0 + at + 0.25)
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0 + at - 0.35); g.gain.linearRampToValueAtTime(0.42, t0 + at - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.45)
    src.connect(f); f.connect(g); g.connect(master); src.start(t0 + at - 0.35)
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(900, t0 + at); o.frequency.exponentialRampToValueAtTime(300, t0 + at + 0.09)
    og.gain.setValueAtTime(0.18, t0 + at); og.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.12); o.connect(og); og.connect(master); o.start(t0 + at); o.stop(t0 + at + 0.14)
  }
  swipe(T0.gal - 0.1); swipe(T0.viewer); swipe(T0.trades); swipe(T0.achats); swipe(T0.ventes); swipe(T0.guides); swipe(T0.setlist); swipe(T0.fin, false)
}

export default function PubGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const A = useRef<Assets | null>(null)
  const raf = useRef(0)
  const [status, setStatus] = useState('Chargement des captures…')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState<'idle' | 'preview' | 'record'>('idle')
  const [withAudio, setWithAudio] = useState(true)
  const [musicKind, setMusicKind] = useState<MusicKind>('lounge')
  const [musicFile, setMusicFile] = useState('')
  const musicBuf = useRef<AudioBuffer | null>(null)
  const withMusic = musicKind !== 'none'
  const [video, setVideo] = useState<{ url: string; ext: string; blob: Blob } | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const saveVideo = async (blob: Blob | null, name: string) => {
    if (!blob) return
    setSaveMsg('Enregistrement en cours… (une vidéo de plusieurs Mo peut prendre un moment sur téléphone)')
    try { await saveOrShareFile(blob, name, { timeoutMs: 180000 }); setSaveMsg('') }
    catch (e) { setSaveMsg('Échec de l’enregistrement : ' + (e instanceof Error ? e.message : 'erreur') + '. Réessaie, ou télécharge depuis un ordinateur.') }
  }

  const [pos, setPos] = useState(0)
  const [lang, setLang] = useState<Lang>('fr')

  useEffect(() => {
    let dead = false
    setReady(false); setVideo(null)
    ;(async () => {
      try { await document.fonts.load('400 40px Surfquest') } catch { /* police de repli */ }
      try {
        const dir = lang === 'fr' ? '/ad/app_' : `/ad/${lang}/app_`
        let fallback = 0
        const L = (n: string) => loadImg(`${dir}${n}.jpg`).catch(() => { fallback++; return loadImg(`/ad/app_${n}.jpg`) })
        const names = ['g0', 'g1', 'g2', 'g3', 'tr0', 'tr1', 'tr2', 'tr3', 'ac0', 'ac1', 'ac2', 'ac3', 'ac4', 'vt0', 'vt1', 'vt2', 'gd0', 'gd1', 'gd2', 'sl0', 'sl1', 'vbg']
        const im = Object.fromEntries(await Promise.all(names.map(async n => [n, await L(n)]))) as Record<string, HTMLImageElement>
        const gal = stitch([{ img: im.g0, y: 0 }, { img: im.g1, y: 700 }, { img: im.g2, y: 1400 }, { img: im.g3, y: 2100 }])
        const trd = stitch([{ img: im.tr0, y: 0 }, { img: im.tr1, y: 600 }, { img: im.tr2, y: 1300 }, { img: im.tr3, y: 2000 }])
        const ach = stitch([{ img: im.ac0, y: 0 }, { img: im.ac1, y: 700 }, { img: im.ac2, y: 1400 }, { img: im.ac3, y: 2100 }, { img: im.ac4, y: 2800 }])
        const ven = stitch([{ img: im.vt0, y: 0 }, { img: im.vt1, y: 700 }, { img: im.vt2, y: 1125 }])
        const gui = stitch([{ img: im.gd0, y: 0 }, { img: im.gd1, y: 700 }, { img: im.gd2, y: 1400 }])
        const set = stitch([{ img: im.sl0, y: 0 }, { img: im.sl1, y: 500 }])
        const logo = await tintedLogo('#ffffff')
        const card = await bmp('https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/1792761526819_recto.jpg')
        const cards: ImageBitmap[] = card ? [card] : []
        const card3 = card ? await createImageBitmap(card, { resizeHeight: 1000, resizeQuality: 'high' }) : null
        for (const [src, y0, y1] of [[im.g2, 176, 561], [im.g3, 233, 618]] as [HTMLImageElement, number, number][]) {
          const s = src.width / 480
          for (const [cx, cy, cw, ch] of [[33, y0, 193, 270], [254, y0, 193, 270], [33, y1, 193, 270], [254, y1, 193, 270]]) {
            const c = document.createElement('canvas'); c.width = cw * 2; c.height = ch * 2; c.getContext('2d')!.drawImage(src, cx * s, cy * s, cw * s, ch * s, 0, 0, cw * 2, ch * 2)
            cards.push(await createImageBitmap(c))
          }
        }
        if (dead) return
        const c = canvasRef.current!, ctx = c.getContext('2d')!
        A.current = { gal, trd, ach, ven, gui, set, vbg: im.vbg, card3, partner: await loadPartnerLogo(), partnerTxt: AD_TX[lang].partner, tx: TX[lang], logo, card, cards, bg: makeBackground(cards), grain: makeGrain(ctx), shell: makeShell(), shadow: makeShadow() }
        setStatus(fallback ? `Prêt · captures ${LANG_NAMES[lang]} absentes : écrans en français, textes traduits` : `Prêt · captures réelles du site · ${LANG_NAMES[lang]}`)
        setReady(true)
        frame(ctx, 5, A.current)
        ;(window as unknown as { __bench: () => number }).__bench = () => { const t1 = performance.now(); for (let i = 0; i < 60; i++) frame(ctx, 2.4 + i * 0.4, A.current!); return (performance.now() - t1) / 60 }
      } catch (e) { setStatus('Captures introuvables : ' + (e instanceof Error ? e.message : '')) }
    })()
    return () => { dead = true; cancelAnimationFrame(raf.current) }
  }, [lang])

  // Rendu hors-ligne : chaque image est calculée à l'instant exact (60 i/s), encodée en H.264 et rangée dans un MP4 ; la vitesse de l'ordinateur n'a aucune influence sur la fluidité
  const renderOffline = async (): Promise<boolean> => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any
    if (typeof w.VideoEncoder === 'undefined') return false
    const c = canvasRef.current, a = A.current; if (!c || !a) return false
    const ctx = c.getContext('2d')!
    const cfgs = ['avc1.64002A', 'avc1.4D002A', 'avc1.42002A']
    let codec = ''
    for (const cf of cfgs) { try { const r = await w.VideoEncoder.isConfigSupported({ codec: cf, width: W, height: H, bitrate: 10_000_000, framerate: FPS }); if (r.supported) { codec = cf; break } } catch { /* suivant */ } }
    if (!codec) return false
    let mod: any
    try { mod = await import('mp4-muxer') } catch { return false }
    cancelAnimationFrame(raf.current)
    setBusy('record'); setVideo(null)
    const SR = 44100
    let audioOk = false
    if ((withAudio || withMusic) && typeof w.AudioEncoder !== 'undefined') { try { audioOk = !!(await w.AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 })).supported } catch { audioOk = false } }
    const target = new mod.ArrayBufferTarget()
    const muxer = new mod.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: FPS }, ...(audioOk ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: SR } } : {}), fastStart: 'in-memory' })
    let encErr: unknown = null
    const venc = new w.VideoEncoder({ output: (chunk: unknown, meta: unknown) => muxer.addVideoChunk(chunk, meta), error: (e: unknown) => { encErr = e } })
    venc.configure({ codec, width: W, height: H, bitrate: 10_000_000, framerate: FPS })
    if (audioOk) {
      setStatus('Rendu du son…')
      const oc = new OfflineAudioContext(2, SR * DUR, SR)
      if (withMusic) scheduleMusic(oc, oc.destination, 0, DUR, musicKind, musicBuf.current)
      if (withAudio) scheduleAudio(oc, oc.destination, 0)
      const buf = await oc.startRendering()
      const aenc = new w.AudioEncoder({ output: (chunk: unknown, meta: unknown) => muxer.addAudioChunk(chunk, meta), error: (e: unknown) => { encErr = e } })
      aenc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 })
      const L = buf.getChannelData(0), R = buf.getChannelData(1)
      for (let off = 0; off < L.length; off += 4096) {
        const n = Math.min(4096, L.length - off), d = new Float32Array(n * 2)
        d.set(L.subarray(off, off + n), 0); d.set(R.subarray(off, off + n), n)
        const ad = new w.AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(off / SR * 1e6), data: d })
        aenc.encode(ad); ad.close()
      }
      await aenc.flush(); aenc.close()
    }
    const total = Math.round(DUR * FPS)
    for (let i = 0; i < total; i++) {
      frame(ctx, i / FPS, a)
      const vf = new w.VideoFrame(c, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) })
      venc.encode(vf, { keyFrame: i % FPS === 0 }); vf.close()
      while (venc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 2))
      if (encErr) break
      if (i % 20 === 0) { setStatus(`Rendu image par image : ${i} / ${total} (60 i/s)`); setPos(i / total); await new Promise(r => setTimeout(r, 0)) }
    }
    if (!encErr) await venc.flush()
    venc.close()
    if (encErr) { setStatus('Échec de l’encodage : ' + String(encErr)); setBusy('idle'); return true }
    muxer.finalize()
    setPos(1); setStatus('Vidéo prête · MP4 60 images/s')
    { const blob = new Blob([target.buffer], { type: 'video/mp4' }); setVideo({ url: URL.createObjectURL(blob), ext: 'mp4', blob }) }
    setBusy('idle')
    return true
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  const play = async (record: boolean) => {
    if (record && await renderOffline()) return
    const c = canvasRef.current, a = A.current; if (!c || !a) return
    const ctx = c.getContext('2d')!
    cancelAnimationFrame(raf.current)
    setBusy(record ? 'record' : 'preview'); setVideo(null)
    let rec: MediaRecorder | null = null, ac: AudioContext | null = null
    const chunks: Blob[] = []
    let ext = 'webm'
    if (record) {
      const stream = c.captureStream(FPS)
      if (withAudio || withMusic) { ac = new AudioContext(); const dest = ac.createMediaStreamDestination(); if (withMusic) scheduleMusic(ac, dest, 0.1, DUR, musicKind, musicBuf.current); if (withAudio) scheduleAudio(ac, dest); dest.stream.getAudioTracks().forEach(t => stream.addTrack(t)) }
      const cands: [string, string][] = [['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'], ['video/webm;codecs=vp9,opus', 'webm'], ['video/webm', 'webm']]
      const pick = cands.find(([m]) => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } })
      ext = pick?.[1] || 'webm'
      rec = new MediaRecorder(stream, { ...(pick ? { mimeType: pick[0] } : {}), videoBitsPerSecond: 8_000_000 })
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
      rec.start(500)
    }
    const t0 = performance.now()
    await new Promise<void>(res => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000
        frame(ctx, Math.min(t, DUR), a)
        if (Math.floor(t * 10) !== Math.floor((t - 0.05) * 10)) setPos(t / DUR)
        if (t >= DUR) return res()
        raf.current = requestAnimationFrame(tick)
      }
      tick()
    })
    setPos(1)
    if (rec) {
      await new Promise<void>(res => { rec!.onstop = () => res(); rec!.stop() })
      ac?.close()
      { const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' }); setVideo({ url: URL.createObjectURL(blob), ext, blob }) }
    }
    setBusy('idle')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070b18', color: '#fff', fontFamily: FONT, padding: 20, display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div style={{ width: 360 }}>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: 360, height: 640, background: '#000', display: 'block', border: '3px solid #243063' }} />
        <input type="range" min={0} max={DUR} step={0.1} value={pos * DUR} disabled={!ready || busy !== 'idle'} onChange={e => { const t = Number(e.target.value); setPos(t / DUR); const c = canvasRef.current; if (c && A.current) frame(c.getContext('2d')!, t, A.current) }} style={{ width: '100%', marginTop: 8 }} aria-label="Se déplacer dans la vidéo" />
        <div style={{ fontSize: 11, color: '#aab3d1' }}>Glisse pour voir chaque moment : {(pos * DUR).toFixed(1)} s / {DUR} s</div>
      </div>
      <div style={{ width: 'min(420px, 100%)' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24 }}>Vidéo de présentation · 30 s · 9:16</h1>
        <p style={{ color: '#aab3d1', fontSize: 14, lineHeight: 1.5 }}>Montage à partir de vraies captures du site : galerie, viewer 3D, trades, achats, ventes, guides, setlist. Créé sur ton appareil, rien n’est envoyé.</p>
        <p style={{ fontSize: 13, color: '#ffd84d' }}>{status}</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, margin: '10px 0' }}>Langue de la vidéo : <select value={lang} onChange={e => setLang(e.target.value as Lang)} disabled={busy !== 'idle'} style={{ padding: 6, background: '#17214a', color: '#fff', border: '2px solid #243063' }}>{(Object.keys(LANG_NAMES) as Lang[]).map(l => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0', fontSize: 14 }}><label>Musique <select value={musicKind} onChange={e => setMusicKind(e.target.value as MusicKind)} disabled={busy !== 'idle'} style={{ padding: 6, background: '#17214a', color: '#fff', border: '2px solid #243063' }}><option value="lounge">Ambiance douce (salle d’attente)</option><option value="beat">Beat dynamique</option><option value="file">Mon propre morceau…</option><option value="none">Aucune</option></select></label>{musicKind === 'file' && <label style={{ padding: 6, background: '#17214a', border: '2px solid #243063', cursor: 'pointer' }}>{musicFile || 'Choisir un fichier audio'}<input type="file" accept="audio/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { musicBuf.current = await decodeAudioFile(f); setMusicFile(f.name.slice(0, 28)) } catch { musicBuf.current = null; setMusicFile('Fichier illisible') } e.target.value = '' }} /></label>}</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, margin: '10px 0' }}><input type="checkbox" checked={withAudio} onChange={e => setWithAudio(e.target.checked)} disabled={busy !== 'idle'} /> Avec les sons de transition (swipes, sans droits d’auteur)</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" disabled={!ready || busy !== 'idle'} onClick={() => play(false)} style={{ padding: '10px 16px', fontWeight: 800, background: '#17214a', color: '#fff', border: '2px solid #243063', cursor: 'pointer' }}>▶ Aperçu</button>
          <button type="button" disabled={!ready || busy !== 'idle'} onClick={() => play(true)} style={{ padding: '10px 16px', fontWeight: 800, background: '#2f6bff', color: '#fff', border: 0, cursor: 'pointer' }}>⏺ Créer la vidéo (30 s · 60 fps)</button>
        </div>
        {busy === 'record' && <p style={{ fontSize: 13, color: '#aab3d1' }}>Création en cours… patiente, l’onglet peut rester ouvert en arrière-plan.</p>}
        {video && (
          <div style={{ marginTop: 14 }}>
            <video src={video.url} controls playsInline style={{ width: '100%', maxHeight: 520, background: '#000' }} />
            <button type="button" onClick={() => saveVideo(video.blob, `memorabilius-pub-${lang}.${video.ext}`)} style={{ ...{ display: 'inline-block', marginTop: 10, padding: '10px 16px', background: '#1e9e57', color: '#fff', fontWeight: 800, textDecoration: 'none' }, border: 0, cursor: 'pointer' }}>⬇ Télécharger la vidéo</button>
            {saveMsg && <p style={{ fontSize: 13, color: '#ffd84d', margin: '8px 0 0' }}>{saveMsg}</p>}
            <p style={{ fontSize: 12, color: '#aab3d1', margin: '8px 0 0' }}>Si rien ne se télécharge : clic droit sur la vidéo → « Enregistrer la vidéo sous… ».</p>
          </div>)}
      </div>
      <div style={{ width: '100%', maxWidth: 1000 }}><TikTokMaker /></div>
      <PubPlanning />
      <PubCalendar />
    </div>
  )
}
