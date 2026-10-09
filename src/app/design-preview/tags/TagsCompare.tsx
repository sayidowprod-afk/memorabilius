'use client'
import { useState } from 'react'
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

type Variant = 'old' | 'q1' | 'q2' | 'q3'
function Tags({ s, v, h }: { s: Sample; v: Variant; h: number }) {
  const tier = numTier(s.num)
  const items: { kind: Kind; text: string }[] = []
  if (s.rc) items.push({ kind: 'rc', text: LABEL.rc })
  if (s.auto) items.push({ kind: 'auto', text: LABEL.auto })
  if (s.num) items.push({ kind: 'num', text: s.num })
  if (s.patch) items.push({ kind: 'patch', text: LABEL.patch })
  return <>{items.map(it => v === 'old'
    ? <OldPill key={it.kind} kind={it.kind} text={it.text} />
    : <Pill key={it.kind} kind={it.kind} text={it.text} h={h} level={v === 'q1' ? 1 : v === 'q2' ? 2 : 3} tier={tier} />)}</>
}

const TITLES: Record<Variant, [string, string]> = {
  old: ['Actuel', 'Ce qui est en ligne'],
  q1: ['Q1 · Actuel affiné', 'Mêmes couleurs et forme : hauteur régulière, dégradé léger, reflet intérieur, bordure plus foncée, ombre fine, chiffres alignés'],
  q2: ['Q2 · Affiné + rareté', 'Comme Q1 ; le numéro devient métal selon la rareté : or 1/1 (avec halo), argent ≤10, bronze ≤25'],
  q3: ['Q3 · Affiné + rareté + mini-picto', 'Comme Q2, avec un petit symbole devant le texte : étoile (RC), signature (AUTO), patch cousu (PATCH), # (numéro)'],
}

export default function TagsCompare() {
  const [dark, setDark] = useState(true)
  const [h, setH] = useState(22)
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
      </div>

      {(['old', 'q1', 'q2', 'q3'] as Variant[]).map(v => (
        <section key={v} style={{ marginBottom: 34 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900 }}>{TITLES[v][0]}</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, opacity: 0.7 }}>{TITLES[v][1]}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {SAMPLES.map(s => (
              <div key={s.nom} style={{ background: dark ? '#0e1530' : '#fff', border: `2px solid ${dark ? '#1f4fd0' : '#003da6'}`, borderRadius: 8, padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.img} alt={s.nom} loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', marginBottom: 8, background: 'none', animation: 'none' }} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', minHeight: 22 }}>
                  <Tags s={s} v={v} h={h} />
                </div>
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
