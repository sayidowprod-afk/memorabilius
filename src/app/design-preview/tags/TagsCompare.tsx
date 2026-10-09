'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { printRunOf } from '@/components/TagIcon'

// Comparaison des pastilles RC / AUTO / PATCH / NUM sur de vraies cartes.
// Base = les pastilles actuelles (que l'utilisateur garde comme reference) ;
// Q1..Q3 = la meme forme et les memes couleurs, de plus en plus travaillees.

const SB = 'https://snnrkzbevjhdtviizfyp.supabase.co/storage/v1/object/public/avatars/cartes/eb730dee-414e-4fcb-89d8-4a7b3448c218/'
type Sample = { nom: string; meta: string; img: string; rc?: boolean; auto?: boolean; patch?: boolean; num?: string }
const SAMPLES: Sample[] = [
  { nom: 'Anthony Edwards', meta: '2020-21 Panini Chronicles', img: SB + '1784235265864_recto.jpg', rc: true },
  { nom: 'Jared McCain', meta: '2024-25 Panini Contenders', img: SB + '1787763372857_recto.jpg', rc: true, auto: true },
  { nom: 'Luwawu-Cabarrot', meta: '2016-17 Gold Standard', img: SB + 'csv_1790632470730_4f41x1.jpg', rc: true, auto: true, patch: true, num: '038/125' },
  { nom: 'Hersey Hawkins', meta: '2018-19 Panini Prizm', img: SB + '1781534889963_recto.jpg', auto: true, num: '12/25' },
  { nom: 'Tyrese Maxey', meta: '2020-21 Court Kings', img: SB + '1781291200820_recto.jpg', rc: true, auto: true, num: '07/10' },
  { nom: 'Michael Carter-Williams', meta: '2013-14 Panini', img: SB + '1781875894817_recto.jpg', rc: true, auto: true, patch: true, num: '1/1' },
]

type Kind = 'rc' | 'auto' | 'patch' | 'num'
const BASE: Record<Kind, string> = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' }

// melange d'une couleur hex avec du blanc (t>0) ou du noir (t<0)
function mix(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)))
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}

type Tier = 'std' | 'gold' | 'silver' | 'bronze'
function numTier(num?: string): Tier {
  const v = printRunOf(num)
  if (v === 1) return 'gold'
  if (v !== null && v <= 10) return 'silver'
  if (v !== null && v <= 25) return 'bronze'
  return 'std'
}
const METAL: Record<Exclude<Tier, 'std'>, { g: string; fg: string; edge: string; glow?: string }> = {
  gold: { g: 'linear-gradient(180deg,#fff3b0 0%,#e9bd3f 48%,#a9760c 100%)', fg: '#2a1a00', edge: '#7a5206', glow: '0 0 7px rgba(233,189,63,0.65)' },
  silver: { g: 'linear-gradient(180deg,#ffffff 0%,#c3cad4 50%,#7d8795 100%)', fg: '#10151d', edge: '#566070' },
  bronze: { g: 'linear-gradient(180deg,#f4c89b 0%,#c07a3a 50%,#7c431a 100%)', fg: '#fff', edge: '#5b3012' },
}

function Glyph({ kind, s }: { kind: Kind; s: number }) {
  const p = { width: s, height: s, viewBox: '0 0 10 10', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { flexShrink: 0 } }
  if (kind === 'rc') return <svg {...p} fill="currentColor" stroke="none"><polygon points="5,0.5 6.5,3.5 9.8,3.9 7.4,6.2 8,9.5 5,7.9 2,9.5 2.6,6.2 0.2,3.9 3.5,3.5" /></svg>
  if (kind === 'auto') return <svg {...p}><path d="M0.8 7.2 C2 2 3.2 9 5 5 S8 3 9.4 6" /></svg>
  if (kind === 'patch') return <svg {...p}><rect x="1" y="1" width="8" height="8" strokeDasharray="1.6 1.2" /><rect x="3.3" y="3.3" width="3.4" height="3.4" /></svg>
  return <svg {...p}><path d="M3.6 1 L2.6 9 M7.4 1 L6.4 9 M1 3.7 H9 M1 6.3 H9" /></svg>
}

const LABEL: Record<Kind, string> = { rc: 'RC', auto: 'AUTO', patch: 'PATCH', num: '' }

function OldPill({ kind, text }: { kind: Kind; text: string }) {
  return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: BASE[kind], color: '#fff' }}>{text}</span>
}

// Q1 : pastille actuelle affinee ; Q2 : + rarete metal sur le numero ; Q3 : + mini-picto
function Pill({ kind, text, h, level, tier }: { kind: Kind; text: string; h: number; level: 1 | 2 | 3; tier: Tier }) {
  const metal = kind === 'num' && level >= 2 && tier !== 'std' ? METAL[tier] : null
  const c = BASE[kind]
  const hp = Math.round(h * 0.92)
  const bg = metal ? metal.g : `linear-gradient(180deg, ${mix(c, 0.22)} 0%, ${c} 52%, ${mix(c, -0.2)} 100%)`
  const edge = metal ? metal.edge : mix(c, -0.38)
  const fg = metal ? metal.fg : '#fff'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: hp * 0.24, height: hp, padding: `0 ${hp * 0.42}px 0 ${level === 3 ? hp * 0.3 : hp * 0.42}px`,
      borderRadius: 5, background: bg, color: fg, border: `1px solid ${edge}`, whiteSpace: 'nowrap',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.35)${metal?.glow ? ', ' + metal.glow : ''}`,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 800, fontSize: hp * 0.5, letterSpacing: kind === 'num' ? '0.03em' : '0.08em',
      fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase', lineHeight: 1, textShadow: metal ? 'none' : '0 1px 1px rgba(0,0,0,0.35)',
    }}>
      {level === 3 && <Glyph kind={kind} s={hp * 0.5} />}
      {text}
    </span>
  )
}

// ── Ecusson premium : meme forme pour les 4, rebord metal, reflet, filet interieur ──
const TIER_BASE: Record<string, string> = { gold: '#d9a521', silver: '#8e98a6', bronze: '#b06a30' }
function ShieldX({ kind, h, num, tier }: { kind: Kind; h: number; num?: string; tier: Tier }) {
  const id = 'sx' + kind + Math.round(h) + (num || '').replace(/\W/g, '')
  const c = kind === 'num' && tier !== 'std' ? TIER_BASE[tier] : BASE[kind]
  const label = kind === 'num' ? (printRunOf(num) === 1 ? '1/1' : `/${printRunOf(num) ?? ''}`) : kind === 'rc' ? 'RC' : kind === 'auto' ? 'AUTO' : 'PATCH'
  const fs = kind === 'rc' ? 50 : kind === 'num' ? (label.length > 4 ? 30 : 38) : kind === 'auto' ? 30 : 25
  const tl = kind === 'rc' ? 56 : kind === 'auto' ? 60 : kind === 'patch' ? 62 : label.length > 4 ? 62 : label.length > 3 ? 56 : 46
  const OUT = 'M13 3 H87 L96 12 V68 Q96 98 50 120 Q4 98 4 68 V12 Z'
  const IN = 'M17 9 H83 L90 16 V67 Q90 92 50 112 Q10 92 10 67 V16 Z'
  return (
    <svg viewBox="0 0 100 124" width={h * 100 / 124} height={h} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', overflow: 'visible', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.42))' }}>
      <defs>
        <linearGradient id={'r' + id} x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.45" stopColor="#c8ced8" /><stop offset="1" stopColor="#7d8693" /></linearGradient>
        <linearGradient id={'f' + id} x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stopColor={mix(c, 0.3)} /><stop offset="0.5" stopColor={c} /><stop offset="1" stopColor={mix(c, -0.38)} /></linearGradient>
        <clipPath id={'c' + id}><path d={IN} /></clipPath>
      </defs>
      <path d={OUT} fill={`url(#r${id})`} />
      <path d={OUT} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <path d={IN} fill={`url(#f${id})`} />
      <g clipPath={`url(#c${id})`}><path d="M0 0 H100 V50 Q50 66 0 50 Z" fill="#fff" opacity="0.2" /></g>
      <path d={IN} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" />
      <text x="50" y="62" textAnchor="middle" dominantBaseline="middle" fontFamily="system-ui, 'Segoe UI', Arial, sans-serif" fontWeight={900} fontSize={fs} fill="#fff"
        textLength={tl} lengthAdjust="spacingAndGlyphs" style={{ filter: 'drop-shadow(0 1.5px 0.8px rgba(0,0,0,0.55))' }}>{label}</text>
      {kind !== 'num' && <path d="M34 88 H66" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  )
}

// ── Double filet premium : angles droits, filet exterieur clair + filet interieur, reflet ──
function FrameX({ kind, text, h, tier }: { kind: Kind; text: string; h: number; tier: Tier }) {
  const metal = kind === 'num' && tier !== 'std' ? METAL[tier] : null
  const c = BASE[kind]
  const hp = Math.round(h * 1.0)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', height: hp, padding: `0 ${hp * 0.5}px`, color: metal ? metal.fg : '#fff', whiteSpace: 'nowrap',
      background: metal ? metal.g : `linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 48%, rgba(0,0,0,0.14) 52%, rgba(0,0,0,0.22) 100%), ${c}`,
      border: '1.5px solid rgba(255,255,255,0.95)',
      boxShadow: `inset 0 0 0 1.5px ${metal ? metal.edge : c}, inset 0 0 0 2.5px rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,0.45)${metal?.glow ? ', ' + metal.glow : ''}`,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', fontWeight: 900, fontSize: hp * 0.44, letterSpacing: kind === 'num' ? '0.05em' : '0.16em',
      fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase', lineHeight: 1, textShadow: metal ? 'none' : '0 1px 1px rgba(0,0,0,0.4)',
    }}>{text}</span>
  )
}

// ── Bandeau premium : verre sombre/clair, repere de couleur par segment, numero en relief ──
function StripX({ s, h, dark, tier }: { s: Sample; h: number; dark: boolean; tier: Tier }) {
  const hp = Math.round(h * 1.0)
  const ink = dark ? '#ffffff' : '#0a1228'
  const items: { kind: Kind; text: string }[] = []
  if (s.rc) items.push({ kind: 'rc', text: 'RC' })
  if (s.auto) items.push({ kind: 'auto', text: 'AUTO' })
  if (s.patch) items.push({ kind: 'patch', text: 'PATCH' })
  const metal = s.num && tier !== 'std' ? METAL[tier] : null
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'stretch', height: hp, borderRadius: 5, overflow: 'hidden', whiteSpace: 'nowrap',
      background: dark ? 'linear-gradient(180deg,#1b2548,#0b1226)' : 'linear-gradient(180deg,#ffffff,#e9edf4)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.28)' : 'rgba(10,18,40,0.3)'}`,
      boxShadow: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)'}, 0 1px 3px rgba(0,0,0,0.35)${metal?.glow ? ', ' + metal.glow : ''}`,
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', lineHeight: 1,
    }}>
      {items.map((it, i) => (
        <span key={it.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: hp * 0.28, padding: `0 ${hp * 0.4}px 0 ${hp * 0.3}px`, borderLeft: i ? `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(10,18,40,0.14)'}` : 0, color: ink, fontWeight: 800, fontSize: hp * 0.46, letterSpacing: '0.1em' }}>
          <i style={{ width: 3, height: hp * 0.5, borderRadius: 2, background: `linear-gradient(180deg, ${mix(BASE[it.kind], 0.25)}, ${BASE[it.kind]})`, display: 'block' }} />
          {it.text}
        </span>
      ))}
      {s.num && (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: `0 ${hp * 0.45}px`, borderLeft: items.length ? '1px solid rgba(0,0,0,0.25)' : 0,
          background: metal ? metal.g : `linear-gradient(180deg, ${mix(BASE.num, 0.22)}, ${BASE.num} 55%, ${mix(BASE.num, -0.22)})`, color: metal ? metal.fg : '#fff',
          fontWeight: 800, fontSize: hp * 0.5, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums', textShadow: metal ? 'none' : '0 1px 1px rgba(0,0,0,0.35)' }}>{s.num}</span>
      )}
    </span>
  )
}

// ── Bandeaux : 5 variantes. Tout tient TOUJOURS sur une ligne, en entier : la taille du texte
//    s'adapte a la largeur disponible (container query), tout est en em. ──
type StripStyle = 'b1' | 'b2' | 'b3' | 'b4' | 'b6'
function StripV({ s, h, dark, tier, v }: { s: Sample; h: number; dark: boolean; tier: Tier; v: StripStyle }) {
  const segs: { key: string; text: string; color: string; isNum?: boolean }[] = []
  if (s.rc) segs.push({ key: 'rc', text: 'RC', color: BASE.rc })
  if (s.auto) segs.push({ key: 'auto', text: 'AUTO', color: BASE.auto })
  if (s.patch) segs.push({ key: 'patch', text: 'PATCH', color: BASE.patch })
  if (s.num) segs.push({ key: 'num', text: s.num, color: BASE.num, isNum: true })
  if (!segs.length) return null
  const metal = s.num && tier !== 'std' ? METAL[tier] : null
  const chars = segs.reduce((a, g) => a + g.text.length, 0)
  const K = chars * 0.86 + segs.length * 1.5 + 0.4          // largeur estimee en em
  const base = Math.round(h * 0.5 * 10) / 10                // taille de texte voulue (px)
  const fam = 'system-ui, -apple-system, "Segoe UI", sans-serif'
  const numBg = (g: { isNum?: boolean; color: string }) => g.isNum && metal ? metal.g : `linear-gradient(180deg, ${mix(g.color, 0.24)} 0%, ${g.color} 52%, ${mix(g.color, -0.24)} 100%)`
  const numFg = (g: { isNum?: boolean }) => g.isNum && metal ? metal.fg : '#fff'
  const ink = dark ? '#ffffff' : '#0a1228'
  const glow = metal?.glow ? `, ${metal.glow}` : ''

  const outer: React.CSSProperties = { display: 'inline-flex', alignItems: 'stretch', height: '2.3em', fontFamily: fam, fontWeight: 900, letterSpacing: '0.07em', lineHeight: 1,
    fontSize: `clamp(7px, calc(100cqw / ${K.toFixed(2)}), ${base}px)`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textTransform: 'uppercase', position: 'relative', maxWidth: '100%' }
  const pad = '0 0.7em'

  let body: React.ReactNode
  let style: React.CSSProperties
  if (v === 'b1') {
    // capsule coloree d'un seul tenant : un segment par critere, aux couleurs des pastilles
    style = { ...outer, borderRadius: '0.55em', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.18)', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.38), 0 3px 8px -2px rgba(0,0,0,0.5)${glow}` }
    body = segs.map((g, i) => (
      <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', padding: pad, background: numBg(g), color: numFg(g), borderLeft: i ? '1px solid rgba(255,255,255,0.55)' : 0, textShadow: g.isNum && metal ? 'none' : '0 1px 2px rgba(0,0,0,0.55)' }}>{g.text}</span>
    ))
  } else if (v === 'b2') {
    // verre + filet multicolore en haut + pastille ronde de couleur devant chaque critere
    const grad = `linear-gradient(90deg, ${segs.map(g => (g.isNum && metal ? TIER_BASE[tier] : g.color)).join(', ')}${segs.length === 1 ? ', ' + segs[0].color : ''})`
    style = { ...outer, borderRadius: '0.55em', overflow: 'hidden', background: dark ? 'linear-gradient(180deg,#1d2850,#0a1024)' : 'linear-gradient(180deg,#ffffff,#e8ecf3)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.3)' : 'rgba(10,18,40,0.32)'}`, boxShadow: `inset 0 1px 0 ${dark ? 'rgba(255,255,255,0.2)' : '#fff'}, 0 2px 5px rgba(0,0,0,0.35)${glow}`, color: ink }
    body = <>
      <i style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '0.22em', background: grad }} />
      {segs.map((g, i) => (
        <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45em', padding: pad, borderLeft: i ? `1px solid ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(10,18,40,0.14)'}` : 0,
          ...(g.isNum && metal ? { background: metal.g, color: metal.fg } : {}) }}>
          {!(g.isNum && metal) && <i style={{ width: '0.62em', height: '0.62em', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${mix(g.color, 0.5)}, ${g.color} 60%, ${mix(g.color, -0.3)})`, boxShadow: `0 0 0.5em ${g.color}99`, display: 'block', flexShrink: 0 }} />}
          {g.text}
        </span>
      ))}
    </>
  } else if (v === 'b3' || v === 'b6') {
    // ruban arrondi : chaque categorie garde sa couleur FIXE (b3 : aplat, b6 : leger degrade propre a chaque etiquette), pas de degrade global
    const flat = v === 'b3'
    style = { ...outer, borderRadius: '2em', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.22)', color: '#fff',
      boxShadow: `0 3px 8px -2px rgba(0,0,0,0.5)${glow}` }
    body = segs.map((g, i) => {
      const c0 = g.isNum && metal ? null : g.color
      const bg = g.isNum && metal ? metal.g : flat ? c0! : `linear-gradient(180deg, ${mix(c0!, 0.16)} 0%, ${c0} 55%, ${mix(c0!, -0.16)} 100%)`
      return (
        <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', background: bg, color: g.isNum && metal ? metal.fg : '#fff',
          padding: i === 0 ? '0 0.7em 0 1em' : i === segs.length - 1 ? '0 1em 0 0.7em' : pad, borderLeft: i ? '1px solid rgba(255,255,255,0.5)' : 0,
          textShadow: g.isNum && metal ? 'none' : '0 1px 2px rgba(0,0,0,0.5)' }}>{g.text}</span>
      )
    })
  } else if (v === 'b4') {
    // luxe : noir profond, filet or, libelles or, soulignement de la couleur du critere, numero en metal
    style = { ...outer, borderRadius: '0.4em', overflow: 'hidden', background: 'linear-gradient(180deg,#171720,#07070b)', color: '#ecd08a',
      boxShadow: 'inset 0 0 0 1px #b8923a, inset 0 0 0 2px #07070b, inset 0 0 0 3px rgba(236,208,138,0.35), 0 2px 6px rgba(0,0,0,0.5)' + glow }
    body = segs.map((g, i) => (
      <span key={g.key} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.75em', position: 'relative', borderLeft: i ? '1px solid rgba(236,208,138,0.3)' : 0,
        ...(g.isNum && metal ? { background: metal.g, color: metal.fg } : g.isNum ? { color: '#fff', background: `linear-gradient(180deg, ${mix(BASE.num, 0.2)}, ${BASE.num} 60%, ${mix(BASE.num, -0.25)})` } : {}) }}>
        {g.text}
        {!g.isNum && <i style={{ position: 'absolute', left: '0.75em', right: '0.75em', bottom: '0.28em', height: '0.18em', borderRadius: 2, background: g.color }} />}
      </span>
    ))
  } else {
    style = outer
    body = null
  }
  return <span style={{ display: 'block', containerType: 'inline-size', width: '100%' }}><span style={style}>{body}</span></span>
}

// ── Nouvelle serie : coins arrondis comme les pastilles actuelles (pas de pilule). Tout tient sur une ligne,
//    le texte s'adapte a la largeur (container query), tout est en em. ──
type WStyle = 'r1' | 'r2' | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6' | 'c7' | 'c8' | 'c9' | 'c10' | 'c11' | 'c12'
function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}
function StripW({ s, h, dark, tier, v }: { s: Sample; h: number; dark: boolean; tier: Tier; v: WStyle }) {
  type G = { key: string; text: string; color: string; isNum?: boolean }
  const segs: G[] = []
  if (s.rc) segs.push({ key: 'rc', text: 'RC', color: BASE.rc })
  if (s.auto) segs.push({ key: 'auto', text: 'AUTO', color: BASE.auto })
  if (s.patch) segs.push({ key: 'patch', text: 'PATCH', color: BASE.patch })
  const pr = printRunOf(s.num)
  const numShort = pr === 1 ? '1/1' : pr !== null ? `/${pr}` : (s.num || '')
  if (s.num) segs.push({ key: 'num', text: numShort, color: BASE.num, isNum: true })
  if (!segs.length) return null
  const metal = s.num && tier !== 'std' ? METAL[tier] : null
  const col = (g: G) => (g.isNum && metal ? TIER_BASE[tier] : g.color)
  const solid = (g: G, grad: boolean) => (g.isNum && metal ? metal.g : grad ? `linear-gradient(180deg, ${mix(g.color, 0.18)} 0%, ${g.color} 55%, ${mix(g.color, -0.18)} 100%)` : g.color)
  const fg = (g: G) => (g.isNum && metal ? metal.fg : '#fff')
  const sh = (g: G) => (g.isNum && metal ? 'none' : '0 1px 2px rgba(0,0,0,0.5)')
  const ink = dark ? '#ffffff' : '#0a1228'
  const neutral = dark ? '#18224a' : '#eef1f6'
  const light = (c: string) => (dark ? mix(c, 0.7) : mix(c, -0.3))
  const full = s.num ? `Numérotation : ${s.num}` : undefined
  const ordered = v === 'c8' ? [...segs.filter(g => g.isNum), ...segs.filter(g => !g.isNum)] : segs
  const chars = segs.reduce((a, g) => a + g.text.length, 0)
  const separate = !['r1', 'r2', 'c8'].includes(v)
  // meme taille (donc meme hauteur) quel que soit le nombre d'etiquettes : on dimensionne pour le pire cas
  // (RC + AUTO + PATCH + tirage a 4 chiffres), jamais pour la carte en cours
  void chars
  const isSurf = v === 'c11' || v === 'c12'
  // Surfquest est tres etroite (RC+AUTO+PATCH+/1250 = 5,4em contre ~12em en Arial gras) : pire cas recalcule,
  // donc le texte peut etre bien plus grand a largeur egale
  const K = isSurf ? 11.4 : 16 * 0.86 + 4 * 1.5 + (separate ? 4 * 0.35 : 0.4)
  const base = isSurf ? Math.round(h * 1.0 * 10) / 10 : Math.round(h * 0.54 * 10) / 10
  const outer: React.CSSProperties = { display: 'inline-flex', alignItems: 'stretch', gap: separate ? '0.32em' : 0, height: isSurf ? (v === 'c12' ? '1.12em' : '1.3em') : '2.3em', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: 900, letterSpacing: '0.05em', lineHeight: 1, fontSize: `clamp(8px, calc(100cqw / ${K.toFixed(2)}), ${base}px)`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
    textTransform: 'uppercase', maxWidth: '100%' }
  const R = '0.42em'
  const pad = '0 0.75em'
  let wrap: React.CSSProperties = {}
  const item = (g: G, i: number): React.ReactNode => {
    const c = col(g)
    const surf = v === 'c11' || v === 'c12'
    // Surfquest : police condensee, plus haute que large -> texte agrandi pour remplir l'etiquette
    const base: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: surf ? '0 0.4em' : pad,
      ...(surf ? { fontFamily: 'Surfquest, system-ui, sans-serif', fontWeight: 400, letterSpacing: v === 'c12' ? '0.07em' : '0.04em', fontSize: '1em', paddingTop: '0.05em' } : {}) }
    if (g.isNum && tier !== 'std' && v !== 'c9') {
      // memes effets que les pastilles actuelles : or (1/1), argent (2-10), bronze (11-25), avec halo anime (keyframes de globals.css)
      const fx = {
        gold: { bg: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', fg: '#3d2800', sh: '0 1px 0 rgba(255,255,255,0.45)', an: 'oon-anim 1.8s ease-in-out infinite' },
        silver: { bg: 'linear-gradient(135deg,#555,#c0c0c0,#ffffff,#c0c0c0,#555)', fg: '#111', sh: 'none', an: 'low-anim 2.2s ease-in-out infinite' },
        bronze: { bg: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', fg: '#fff', sh: '0 1px 2px rgba(0,0,0,0.6)', an: 'bro-anim 2.6s ease-in-out infinite' },
      }[tier as 'gold' | 'silver' | 'bronze']
      const round = v === 'r1' || v === 'r2' || v === 'c8' ? 0 : R
      return <span key={g.key} style={{ ...base, borderRadius: round, background: fx.bg, color: fx.fg, textShadow: fx.sh, animation: fx.an, position: 'relative', zIndex: 1 }}>{g.text}</span>
    }
    switch (v) {
      case 'r1': case 'r2':
        return <span key={g.key} style={{ ...base, background: solid(g, v === 'r2'), color: fg(g), textShadow: sh(g), borderLeft: i ? '1px solid rgba(255,255,255,0.5)' : 0 }}>{g.text}</span>
      case 'c1':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: solid(g, true), color: fg(g), textShadow: sh(g), border: '1px solid rgba(255,255,255,0.2)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 5px -1px rgba(0,0,0,0.45)' }}>{g.text}</span>
      case 'c2': case 'c11': case 'c12':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: rgba(c, dark ? 0.32 : 0.18), color: light(c), border: `1px solid ${rgba(c, 0.85)}` }}>{g.text}</span>
      case 'c3':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: 'transparent', color: light(c), border: `1.5px solid ${c}` }}>{g.text}</span>
      case 'c4':
        return <span key={g.key} style={{ ...base, borderRadius: `${R} ${R} 0.2em 0.2em`, background: neutral, color: ink, borderBottom: `0.28em solid ${c}`, border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(10,18,40,0.14)'}`, borderBottomWidth: '0.28em', borderBottomColor: c }}>{g.text}</span>
      case 'c5':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: neutral, color: ink, borderLeft: `0.32em solid ${c}`, border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(10,18,40,0.14)'}`, borderLeftWidth: '0.32em', borderLeftColor: c, paddingLeft: '0.6em' }}>{g.text}</span>
      case 'c6':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: dark ? '#080d1f' : '#ffffff', color: light(c), boxShadow: `inset 0 0 0 1px ${rgba(c, 0.85)}, inset 0 0 0.9em ${rgba(c, 0.28)}`, textShadow: dark ? `0 0 0.6em ${rgba(c, 0.6)}` : 'none' }}>{g.text}</span>
      case 'c7':
        return <span key={g.key} style={{ ...base, borderRadius: R, background: solid(g, true), color: fg(g), textShadow: sh(g), border: '1.5px solid #e9edf3', boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.4)' }}>{g.text}</span>
      case 'c8':
        return <span key={g.key} style={{ ...base, background: solid(g, false), color: fg(g), textShadow: sh(g), borderLeft: i ? '1px solid rgba(255,255,255,0.5)' : 0,
          ...(g.isNum ? { fontSize: '1.15em', padding: '0 0.85em' } : {}) }}>{g.text}</span>
      case 'c9':
        return <span key={g.key} style={{ ...base, gap: '0.45em', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
          <i style={{ width: '0.6em', height: '0.6em', borderRadius: '50%', background: c, display: 'block', flexShrink: 0, boxShadow: '0 0 0 1px rgba(255,255,255,0.7)' }} />{g.text}</span>
      default: // c10 : neon
        return <span key={g.key} style={{ ...base, borderRadius: R, background: dark ? 'rgba(5,9,18,0.5)' : '#fff', color: light(c), border: `1.5px solid ${c}`, boxShadow: `0 0 0.8em ${rgba(c, dark ? 0.55 : 0.25)}, inset 0 0 0.6em ${rgba(c, 0.25)}`, textShadow: dark ? `0 0 0.5em ${rgba(c, 0.8)}` : 'none' }}>{g.text}</span>
    }
  }
  if (v === 'r1' || v === 'r2' || v === 'c8') wrap = { borderRadius: R, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.22)', boxShadow: `0 3px 8px -2px rgba(0,0,0,0.5)${metal?.glow ? ', ' + metal.glow : ''}` }
  if (v === 'c9') wrap = { borderRadius: '0.55em', background: 'rgba(8,14,34,0.52)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.28)', gap: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.4)' }
  return <span style={{ display: 'block', containerType: 'inline-size', width: '100%' }}><span style={{ ...outer, ...wrap }}>{ordered.map((g, i) => { const el = item(g, i) as React.ReactElement<{ title?: string }>; return g.isNum ? React.cloneElement(el, { title: full }) : el })}</span></span>
}

type Variant = 'old' | 'q1' | 'q2' | 'q3' | 'sx' | 'dx' | 'bx' | StripStyle | WStyle
function Tags({ s, v, h, dark }: { s: Sample; v: Variant; h: number; dark: boolean }) {
  const tier = numTier(s.num)
  if (v === 'sx') return <>{s.rc && <ShieldX kind="rc" h={h * 1.45} tier={tier} />}{s.auto && <ShieldX kind="auto" h={h * 1.45} tier={tier} />}{s.patch && <ShieldX kind="patch" h={h * 1.45} tier={tier} />}{s.num && <ShieldX kind="num" h={h * 1.45} num={s.num} tier={tier} />}</>
  if (['r1','r2','c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','c11','c12'].includes(v)) return <StripW s={s} h={h} dark={dark} tier={tier} v={v as WStyle} />
  if (v === 'bx') return <StripX s={s} h={h} dark={dark} tier={tier} />
  if (v === 'b1' || v === 'b2' || v === 'b3' || v === 'b4' || v === 'b6') return <StripV s={s} h={h} dark={dark} tier={tier} v={v} />
  const items: { kind: Kind; text: string }[] = []
  if (s.rc) items.push({ kind: 'rc', text: LABEL.rc })
  if (s.auto) items.push({ kind: 'auto', text: LABEL.auto })
  if (s.num) items.push({ kind: 'num', text: s.num })
  if (s.patch) items.push({ kind: 'patch', text: LABEL.patch })
  if (v === 'dx') return <>{items.map(it => <FrameX key={it.kind} kind={it.kind} text={it.text} h={h} tier={tier} />)}</>
  return <>{items.map(it => v === 'old'
    ? <OldPill key={it.kind} kind={it.kind} text={it.text} />
    : <Pill key={it.kind} kind={it.kind} text={it.text} h={h} level={v === 'q1' ? 1 : v === 'q2' ? 2 : 3} tier={tier} />)}</>
}

const TITLES: Record<Variant, [string, string]> = {
  old: ['Actuel', 'Ce qui est en ligne'],
  q1: ['Q1 · Actuel affiné', 'Mêmes couleurs et forme : hauteur régulière, dégradé léger, reflet intérieur, bordure plus foncée, ombre fine, chiffres alignés'],
  q2: ['Q2 · Affiné + rareté', 'Comme Q1 ; le numéro devient métal selon la rareté : or 1/1 (avec halo), argent ≤10, bronze ≤25'],
  sx: ['S · Écusson premium', 'Même forme pour les 4 : rebord métal, biseau, reflet, filet intérieur, texte en relief ; le numéro passe en or / argent / bronze si rare'],
  dx: ['D · Double filet premium', 'Angles droits, filet extérieur clair + filet intérieur, reflet, couleurs actuelles ; numéro métal si rare'],
  r1: ['R1 · Ruban à coins arrondis, aplat', 'Comme les pastilles actuelles (coins arrondis, pas de pilule) ; chaque catégorie sa couleur fixe ; numéro métal si rare'],
  r2: ['R2 · Ruban à coins arrondis, léger dégradé par étiquette', 'Même ruban, léger dégradé vertical propre à chaque étiquette'],
  c1: ['C1 · Pastilles régularisées', 'Pastilles séparées, même hauteur, texte plus ferme, léger relief'],
  c2: ['C2 · Teintées', 'Fond de la couleur à 20 %, bordure et texte de la couleur — douces, très lisibles sur sombre'],
  c11: ['C11 · Teintées Surfquest', 'Comme C2 (teintées) mais texte en Surfquest, fin, agrandi pour remplir l’étiquette'],
  c12: ['C12 · Teintées Surfquest XL', 'Idem, texte encore plus grand et un peu plus espacé'],
  c3: ['C3 · Contour', 'Fond transparent, contour de la couleur, texte de la couleur'],
  c4: ['C4 · Onglets neutres + trait de couleur', 'Fond neutre, texte normal, trait épais de la couleur en bas'],
  c5: ['C5 · Barre de couleur à gauche', 'Fond neutre, barre de la couleur à gauche, texte normal'],
  c6: ['C6 · Encre sur fond sombre', 'Fond noir, texte de la couleur, filet fin et lueur douce intérieure'],
  c7: ['C7 · Liseré argent', 'Aplat de la couleur entouré d’un fin liseré argent, comme le bord d’une carte'],
  c8: ['C8 · Numéro en tête', 'Ruban où le numéro passe en premier et en plus gros, puis les critères'],
  c9: ['C9 · Verre sur l’image', 'Bandeau flouté posé en bas à gauche de la carte, pastilles de couleur'],
  c10: ['C10 · Néon', 'Contour et lueur de la couleur ; surtout beau en mode sombre'],
  b1: ['B1 · Capsule colorée', 'Un seul bloc, un segment par critère aux couleurs des pastilles, séparés par un filet blanc ; numéro métal si rare'],
  b2: ['B2 · Verre + filet multicolore', 'Verre sombre/clair, filet des couleurs des critères en haut, pastille ronde lumineuse devant chaque critère'],
  b3: ['B3 · Ruban arrondi, couleurs fixes', 'Un ruban en pilule ; chaque catégorie garde sa couleur fixe en aplat (aucun dégradé) ; numéro métal si rare'],
  b6: ['B6 · Ruban arrondi, léger dégradé par étiquette', 'Même ruban ; chaque étiquette a son propre léger dégradé vertical, jamais de dégradé global'],
  b4: ['B4 · Luxe noir et or', 'Noir profond, triple filet or, libellés or, soulignement de la couleur du critère, numéro en métal'],
  bx: ['B · Bandeau premium (version précédente)', 'Un seul bloc en verre, repère de couleur par critère, numéro en relief (violet ou métal)'],
  q3: ['Q3 · Affiné + rareté + mini-picto', 'Comme Q2, avec un petit symbole devant le texte : étoile (RC), signature (AUTO), patch cousu (PATCH), # (numéro)'],
}

export default function TagsCompare() {
  const [dark, setDark] = useState(true)
  const [h, setH] = useState(22)
  const [mobile, setMobile] = useState(false)
  const btn = (on: boolean): React.CSSProperties => ({ padding: '8px 12px', fontWeight: 800, cursor: 'pointer', border: '2px solid currentColor', background: on ? (dark ? '#fff' : '#0a1228') : 'transparent', color: on ? (dark ? '#050912' : '#fff') : 'inherit' })
  return (
    <div style={{ minHeight: '100vh', background: dark ? 'linear-gradient(160deg,#050912,#08153b 60%,#0a2468)' : '#f3f5fa', color: dark ? '#fff' : '#0a1228', padding: '20px clamp(12px,3vw,40px) 60px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href="/admin" style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'inherit', textDecoration: 'none' }}>← Admin</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Pastilles de cartes : actuel et versions affinées</h1>
        <span style={{ flex: 1 }} />
        <button onClick={() => setDark(true)} style={btn(dark)}>Sombre</button>
        <button onClick={() => setDark(false)} style={btn(!dark)}>Clair</button>
        {[18, 22, 28].map(n => <button key={n} onClick={() => setH(n)} style={btn(h === n)}>{n}px</button>)}
        <button onClick={() => setMobile(m => !m)} style={btn(mobile)}>Mobile (2 col.)</button>
      </div>

      {(['old', 'c2', 'c11', 'c12', 'r1', 'r2', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'] as Variant[]).map(v => (
        <section key={v} style={{ marginBottom: 34 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900 }}>{TITLES[v][0]}</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, opacity: 0.7 }}>{TITLES[v][1]}</p>
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(190px, 1fr))', gap: mobile ? 8 : 12, maxWidth: mobile ? 360 : undefined }}>
            {SAMPLES.map(s => (
              <div key={s.nom} style={{ background: dark ? '#0e1530' : '#fff', border: `2px solid ${dark ? '#1f4fd0' : '#003da6'}`, borderRadius: 8, padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <img src={s.img} alt={s.nom} loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', background: 'none', animation: 'none' }} />
                  {v === 'c9' && <div style={{ position: 'absolute', left: 6, bottom: 6, maxWidth: 'calc(100% - 12px)' }}><Tags s={s} v={v} h={h} dark={dark} /></div>}
                </div>
                {v !== 'c9' && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', minHeight: 22 }}>
                    <Tags s={s} v={v} h={h} dark={dark} />
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>{s.nom}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{s.meta}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
