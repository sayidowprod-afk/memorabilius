'use client'
import { useState } from 'react'
import Link from 'next/link'
import TagGlyph, { cardTier, type TagTier } from '@/components/TagGlyph'
import { numLabel } from '@/components/TagIcon'

// Comparaison sur de vraies cartes : ancien (pastilles) / 1 monochrome /
// 2 monochrome + rarete / 3 vectoriel + rarete + eclat.

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

const STOPS: Record<Exclude<TagTier, 'base'>, string> = {
  blue: 'linear-gradient(160deg,#8fb4ff,#2f6bff 50%,#1a43b8)',
  bronze: 'linear-gradient(160deg,#f0b982,#b36b30 50%,#6f3f17)',
  silver: 'linear-gradient(160deg,#fbfcfe,#b4bcc8 50%,#6c7585)',
  gold: 'linear-gradient(160deg,#fff2b8,#e3b53b 50%,#8f6208)',
}
const R: Record<string, number> = { rc: 576 / 700, auto: 700 / 270, patch: 1, num: 700 / 572 }
const SC: Record<string, number> = { rc: 1, auto: 0.78, patch: 0.9, num: 1.05 }

// Variantes 1 et 2 : le PNG sert de masque, le fond est une couleur (1) ou un degrade (2)
function MaskIcon({ kind, h, bg, num, textColor }: { kind: 'rc' | 'auto' | 'patch' | 'num'; h: number; bg: string; num?: string; textColor: string }) {
  const height = h * SC[kind]
  const width = height * R[kind]
  const label = kind === 'num' ? numLabel(num) : ''
  return (
    <span style={{ position: 'relative', display: 'inline-block', width, height, verticalAlign: 'middle', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, background: bg, WebkitMask: `url(/tags/trim/${kind}.png) center/contain no-repeat`, mask: `url(/tags/trim/${kind}.png) center/contain no-repeat` }} />
      {label && (
        <b style={{ position: 'absolute', left: '50%', top: '58%', transform: 'translate(-50%,-50%)', fontFamily: 'system-ui', fontWeight: 900,
          fontSize: height * (label.length > 4 ? 0.28 : 0.34), color: textColor, whiteSpace: 'nowrap', lineHeight: 1,
          textShadow: `0 0 ${height * 0.06}px ${bg.includes('gradient') ? '#0008' : bg}, 0 0 ${height * 0.06}px ${bg.includes('gradient') ? '#0008' : bg}` }}>{label}</b>
      )}
    </span>
  )
}

function OldPills({ s }: { s: Sample }) {
  const p = (bg: string, t: string) => <span key={t} style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: bg, color: '#fff' }}>{t}</span>
  return <>{s.rc && p('#e67e22', 'RC')}{s.auto && p('#2e7d32', 'AUTO')}{s.num && p('#7b1fa2', s.num)}{s.patch && p('#1976d2', 'PATCH')}</>
}

// ── Famille d'ecussons : meme forme pour RC / AUTO / PATCH / NUM, couleurs des pastilles actuelles ──
const SHIELD_COLORS = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' }
const SHIELD_TIER: Record<string, string> = { gold: '#d9a521', silver: '#8e98a6', bronze: '#b06a30' }
const SH_OUT = 'M8 6 H92 V70 Q92 98 50 116 Q8 98 8 70 Z'
const SH_IN = 'M15 13 H85 V69 Q85 93 50 108 Q15 93 85 69 Z'
const SH_IN2 = 'M15 13 H85 V69 Q85 93 50 108 Q15 93 15 69 Z'
function Shield({ kind, h, num, tier, flat }: { kind: 'rc' | 'auto' | 'patch' | 'num'; h: number; num?: string; tier: TagTier; flat: boolean }) {
  const id = kind + Math.round(h) + (flat ? 'f' : 'm') + (num || '').replace(/\W/g, '')
  const base = kind === 'num' && (tier === 'gold' || tier === 'silver' || tier === 'bronze') ? SHIELD_TIER[tier] : SHIELD_COLORS[kind]
  const label = kind === 'num' ? numLabel(num) || '#' : kind === 'rc' ? 'RC' : kind === 'auto' ? 'AUTO' : 'PATCH'
  const fs = kind === 'rc' ? 40 : kind === 'num' ? (label.length > 4 ? 26 : 32) : kind === 'auto' ? 27 : 22
  const ty = kind === 'num' ? 62 : 54
  const ink = '#ffffff'
  return (
    <svg viewBox="0 0 100 122" width={h * 100 / 122} height={h} style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', overflow: 'visible', filter: flat ? undefined : 'drop-shadow(0 2px 2px rgba(0,0,0,0.35))' }}>
      <defs>
        <linearGradient id={'r' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#c9cfd8" /><stop offset="1" stopColor="#8a929e" /></linearGradient>
        <linearGradient id={'f' + id} x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stopColor={base} stopOpacity="1" /><stop offset="1" stopColor="#000" stopOpacity="0.38" /></linearGradient>
        <linearGradient id={'s' + id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.38" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      {flat ? (
        <>
          <path d={SH_OUT} fill={base} />
          <path d={SH_OUT} fill="none" stroke="#fff" strokeWidth="3" />
          <path d="M15 13 H85 V69 Q85 93 50 108 Q15 93 15 69 Z" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.8" />
        </>
      ) : (
        <>
          <path d={SH_OUT} fill={`url(#r${id})`} />
          <path d="M15 13 H85 V69 Q85 93 50 108 Q15 93 15 69 Z" fill={base} />
          <path d="M15 13 H85 V69 Q85 93 50 108 Q15 93 15 69 Z" fill={`url(#f${id})`} />
          <path d="M15 13 H85 V60 H15 Z" fill={`url(#s${id})`} />
        </>
      )}
      <text x="50" y={ty} textAnchor="middle" dominantBaseline="middle" fontFamily="'Surfquest', Impact, system-ui, sans-serif" fontWeight={900} fontSize={fs} fill={ink} letterSpacing="0.5" style={{ textTransform: 'uppercase' }}>{label}</text>
      {kind === 'rc' && <g stroke={ink} strokeWidth="2.6" fill="none" opacity="0.95"><circle cx="50" cy="90" r="13" /><path d="M37 90 H63 M50 77 V103 M41 80 Q50 90 41 100 M59 80 Q50 90 59 100" /></g>}
      {kind === 'auto' && <path d="M26 88 C34 74 40 100 46 86 S58 78 62 92 S72 86 76 84" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.95" />}
      {kind === 'patch' && <g fill="none" stroke={ink} strokeWidth="2.4" opacity="0.95"><rect x="30" y="78" width="40" height="26" strokeDasharray="4 3" /><rect x="38" y="85" width="24" height="12" /></g>}
      {kind === 'num' && <path d="M32 90 H68" stroke={ink} strokeWidth="2.4" opacity="0.8" />}
    </svg>
  )
}

// ── Variantes typographiques (sans pictogramme) ───────────────────────────
const FILL: Record<TagTier, { bg: string; fg: string; edge: string }> = {
  base: { bg: 'transparent', fg: 'INK', edge: 'INK' },
  blue: { bg: 'linear-gradient(160deg,#5b8cff,#2f6bff 55%,#1a43b8)', fg: '#fff', edge: '#2f6bff' },
  bronze: { bg: 'linear-gradient(160deg,#f0b982,#b36b30 55%,#6f3f17)', fg: '#2b1500', edge: '#b36b30' },
  silver: { bg: 'linear-gradient(160deg,#fbfcfe,#b4bcc8 55%,#6c7585)', fg: '#10151d', edge: '#b4bcc8' },
  gold: { bg: 'linear-gradient(160deg,#fff2b8,#e3b53b 55%,#8f6208)', fg: '#2a1a00', edge: '#e3b53b' },
}

// D : etiquette a double filet (signature du logo), aux couleurs des pastilles actuelles
const KIND_COL = { rc: '#e67e22', auto: '#2e7d32', patch: '#1976d2', num: '#7b1fa2' }
const TIER_COL: Record<string, { c: string; fg: string }> = { gold: { c: '#d9a521', fg: '#2a1a00' }, silver: { c: '#aab3c0', fg: '#10151d' }, bronze: { c: '#b06a30', fg: '#fff' } }
function FrameLabel({ text, kind, tier, h, big }: { text: string; kind: 'rc' | 'auto' | 'patch' | 'num'; tier: TagTier; h: number; big?: boolean }) {
  const t = kind === 'num' ? TIER_COL[tier] : undefined
  const c = t ? t.c : KIND_COL[kind]; const fg = t ? t.fg : '#fff'
  const fs = h * (big ? 0.5 : 0.4)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: h * 0.9, padding: `0 ${h * 0.3}px`, color: fg,
      background: `linear-gradient(180deg, rgba(255,255,255,0.2), rgba(0,0,0,0.16)), ${c}`, border: '2px solid rgba(255,255,255,0.92)',
      boxShadow: `inset 0 0 0 2px ${c}, inset 0 0 0 3px rgba(255,255,255,0.6)${tier === 'gold' && kind === 'num' ? ', 0 0 8px rgba(217,165,33,0.55)' : ''}`,
      fontFamily: big ? "'Surfquest', Impact, sans-serif" : 'system-ui, sans-serif', fontWeight: big ? 400 : 900, fontSize: fs, letterSpacing: big ? '0.04em' : '0.14em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap' }}>{text}</span>
  )
}

// E : bandeau d'etiquette de carte gradee -- segments separes par des filets, tirage en grand
function SlabStrip({ s, tier, h, ink, panel }: { s: Sample; tier: TagTier; h: number; ink: string; panel: string }) {
  const f = FILL[tier]
  const seg: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: `0 ${h * 0.32}px`, height: '100%', fontFamily: 'system-ui, sans-serif', fontWeight: 900, fontSize: h * 0.36, letterSpacing: '0.14em', textTransform: 'uppercase', color: ink, borderLeft: `1px solid ${ink}55` }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'stretch', height: h * 0.95, background: panel, border: `2px solid ${ink}`, overflow: 'hidden', lineHeight: 1 }}>
      <span style={{ width: h * 0.16, background: tier === 'base' ? ink : f.bg }} />
      {s.rc && <span style={{ ...seg, borderLeft: 0 }}>RC</span>}
      {s.auto && <span style={seg}>AUTO</span>}
      {s.patch && <span style={seg}>PATCH</span>}
      {s.num && <span style={{ ...seg, fontFamily: "'Surfquest', Impact, sans-serif", fontWeight: 400, letterSpacing: '0.05em', fontSize: h * 0.5, background: tier === 'base' ? 'transparent' : f.bg, color: tier === 'base' ? ink : (f.fg === 'INK' ? ink : f.fg) }}>{s.num}</span>}
    </span>
  )
}

type Variant = 'old' | 'v1' | 'v2' | 'v3' | 'd' | 'e' | 'f' | 'g' | 'h'
function Tags({ s, v, h, dark }: { s: Sample; v: Variant; h: number; dark: boolean }) {
  const ink = dark ? '#ffffff' : '#0a1228'
  const counter = dark ? '#050912' : '#ffffff'
  const tier = cardTier(s)
  if (v === 'old') return <OldPills s={s} />
  const panel = dark ? '#0e1530' : '#ffffff'
  if (v === 'd') {
    return <>
      {s.rc && <FrameLabel kind="rc" text="RC" tier={tier} h={h} />}
      {s.auto && <FrameLabel kind="auto" text="Auto" tier={tier} h={h} />}
      {s.patch && <FrameLabel kind="patch" text="Patch" tier={tier} h={h} />}
      {s.num && <FrameLabel kind="num" text={s.num} tier={tier} h={h} big />}
    </>
  }
  if (v === 'g' || v === 'h') {
    const flat = v === 'h'
    return <>
      {s.rc && <Shield kind="rc" h={h * 1.25} tier={tier} flat={flat} />}
      {s.auto && <Shield kind="auto" h={h * 1.25} tier={tier} flat={flat} />}
      {s.patch && <Shield kind="patch" h={h * 1.25} tier={tier} flat={flat} />}
      {s.num && <Shield kind="num" h={h * 1.25} num={s.num} tier={tier} flat={flat} />}
    </>
  }
  if (v === 'e' || v === 'f') return <SlabStrip s={s} tier={tier} h={h} ink={ink} panel={v === 'f' ? (dark ? 'rgba(5,9,18,0.82)' : 'rgba(255,255,255,0.88)') : panel} />
  if (v === 'v3') {
    return <>
      {s.rc && <TagGlyph kind="rc" h={h} tier={tier} ink={ink} />}
      {s.auto && <TagGlyph kind="auto" h={h} tier={tier} ink={ink} />}
      {s.num && <TagGlyph kind="num" h={h} tier={tier} ink={ink} num={s.num} />}
      {s.patch && <TagGlyph kind="patch" h={h} tier={tier} ink={ink} />}
    </>
  }
  const bg = v === 'v1' || tier === 'base' ? ink : STOPS[tier]
  const tc = v === 'v1' || tier === 'base' ? counter : (tier === 'silver' ? '#10151d' : tier === 'gold' ? '#2a1a00' : '#fff')
  return <>
    {s.rc && <MaskIcon kind="rc" h={h} bg={bg} textColor={tc} />}
    {s.auto && <MaskIcon kind="auto" h={h} bg={bg} textColor={tc} />}
    {s.num && <MaskIcon kind="num" h={h} bg={bg} num={s.num} textColor={tc} />}
    {s.patch && <MaskIcon kind="patch" h={h} bg={bg} textColor={tc} />}
  </>
}

const TITLES: Record<Variant, [string, string]> = {
  old: ['Actuel (pastilles)', 'Ce qui était en ligne avant'],
  v1: ['1 · Monochrome', 'Une seule teinte (blanc / navy), sans couleur'],
  v2: ['2 · Monochrome + rareté', 'Bleu = auto/patch/numérotée · bronze ≤25 · argent ≤10 · or 1/1'],
  v3: ['3 · Vectoriel + rareté', 'Net à toute taille, dégradé métallique, éclat, halo doré pour le 1/1'],
  d: ['D · Étiquettes à double filet, couleurs des pastilles', 'RC orange · Auto vert · Patch bleu · Numéro violet (or / argent / bronze si rare) ; double filet comme le logo'],
  e: ['E · Bandeau de carte gradée (2 + 3 + 4)', 'Un seul bloc, segments séparés par des filets, tirage en grand, accent selon la rareté'],
  g: ['G · Écussons métal (comme l’exemple Fanatics), couleurs actuelles', 'Même forme pour les 4, biseau métallique, glyphe sous le texte ; le tirage passe en or/argent/bronze si rare'],
  h: ['H · Écussons plats (version DA)', 'Même forme, aplat de couleur, contour blanc à double filet, sans effet'],
  f: ['F · Bandeau sur l’image', 'Même bandeau E, posé en bas à gauche de la carte (sous le nom : plus rien)'],
}

export default function TagsCompare() {
  const [dark, setDark] = useState(true)
  const [h, setH] = useState(30)
  return (
    <div style={{ minHeight: '100vh', background: dark ? 'linear-gradient(160deg,#050912,#08153b 60%,#0a2468)' : '#f3f5fa', color: dark ? '#fff' : '#0a1228', padding: '20px clamp(12px,3vw,40px) 60px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href="/admin" style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'inherit', textDecoration: 'none' }}>← Admin</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Comparaison des icônes de cartes</h1>
        <span style={{ flex: 1 }} />
        {([[true, 'Sombre'], [false, 'Clair']] as [boolean, string][]).map(([d, l]) => (
          <button key={l} onClick={() => setDark(d)} style={{ padding: '8px 14px', fontWeight: 800, cursor: 'pointer', border: '2px solid currentColor', background: dark === d ? (dark ? '#fff' : '#0a1228') : 'transparent', color: dark === d ? (dark ? '#050912' : '#fff') : 'inherit' }}>{l}</button>
        ))}
        {[22, 30, 38].map(n => (
          <button key={n} onClick={() => setH(n)} style={{ padding: '8px 12px', fontWeight: 800, cursor: 'pointer', border: '2px solid currentColor', background: h === n ? (dark ? '#fff' : '#0a1228') : 'transparent', color: h === n ? (dark ? '#050912' : '#fff') : 'inherit' }}>{n}px</button>
        ))}
      </div>

      {(['old', 'd', 'g', 'h', 'e', 'f'] as Variant[]).map(v => (
        <section key={v} style={{ marginBottom: 34 }}>
          <h2 style={{ margin: '0 0 2px', fontSize: 18, fontWeight: 900 }}>{TITLES[v][0]}</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, opacity: 0.7 }}>{TITLES[v][1]}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {SAMPLES.map(s => (
              <div key={s.nom} style={{ background: dark ? '#0e1530' : '#fff', border: `2px solid ${dark ? '#1f4fd0' : '#003da6'}`, borderRadius: 8, padding: 8 }}>
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt={s.nom} loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', background: 'none', animation: 'none' }} />
                  {v === 'f' && <div style={{ position: 'absolute', left: 6, bottom: 6, maxWidth: 'calc(100% - 12px)' }}><Tags s={s} v={v} h={h} dark={dark} /></div>}
                </div>
                {v !== 'f' && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', minHeight: h + 4 }}>
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
