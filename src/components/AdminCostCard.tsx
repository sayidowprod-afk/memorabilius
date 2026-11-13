'use client'
import { useEffect, useState } from 'react'

// 924 · Estimation du coût mensuel du site (admin) : lignes fixes modifiables + scans IA (0,00013 € par scan, Gemini 2.5 Flash), avec un seuil d'alerte.
// Les montants sont ceux que l'admin saisit (gardés dans ce navigateur) : c'est une estimation, pas une facture.
const SCAN_EUR = 0.00013
interface State { lines: { label: string; eur: number }[]; scansPerDay: number; threshold: number }
const DEFAULT: State = {
  lines: [{ label: 'Vercel', eur: 20 }, { label: 'Supabase', eur: 25 }, { label: 'Domaine', eur: 1.5 }, { label: 'Autres', eur: 0 }],
  scansPerDay: 500,
  threshold: 80,
}
const KEY = 'mb_admin_cost_v1'

export default function AdminCostCard() {
  const [s, setS] = useState<State>(DEFAULT)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...DEFAULT, ...JSON.parse(raw) }) } catch {}
    setReady(true)
  }, [])
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {} }, [s, ready])

  const fixed = s.lines.reduce((a, l) => a + (Number.isFinite(l.eur) ? l.eur : 0), 0)
  const ai = s.scansPerDay * 30 * SCAN_EUR
  const total = fixed + ai
  const over = total > s.threshold
  const box: React.CSSProperties = { background: 'var(--bg3, #17214a)', border: '2px solid var(--border, #243063)', color: 'inherit', padding: '6px 8px', fontSize: 14, minWidth: 0 }

  return (
    <section style={{ border: '2px solid ' + (over ? '#e74c3c' : 'var(--border, #243063)'), padding: 14, margin: '0 0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 16 }}>💶 Coût mensuel estimé</b>
        <span style={{ fontSize: 26, fontWeight: 800, color: over ? '#e74c3c' : 'inherit' }}>{total.toFixed(2)} €</span>
        <span style={{ fontSize: 12, color: 'var(--text2, #aab3d1)' }}>{over ? '⚠ au-dessus de ton seuil de ' + s.threshold + ' €' : 'sous ton seuil de ' + s.threshold + ' €'}</span>
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {s.lines.map((l, i) => (
          <label key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input value={l.label} onChange={e => setS(p => ({ ...p, lines: p.lines.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} style={box} aria-label="Nom de la ligne" />
            <input type="number" min={0} step={0.5} value={l.eur} onChange={e => setS(p => ({ ...p, lines: p.lines.map((x, j) => j === i ? { ...x, eur: parseFloat(e.target.value) || 0 } : x) }))} style={box} aria-label={'Montant ' + l.label} />
          </label>
        ))}
        <label style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <span>Scans IA par jour <span style={{ color: 'var(--text2, #aab3d1)' }}>→ {ai.toFixed(2)} € / mois</span></span>
          <input type="number" min={0} step={50} value={s.scansPerDay} onChange={e => setS(p => ({ ...p, scansPerDay: parseFloat(e.target.value) || 0 }))} style={box} aria-label="Scans par jour" />
        </label>
        <label style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <span>Seuil d’alerte (€ / mois)</span>
          <input type="number" min={0} step={5} value={s.threshold} onChange={e => setS(p => ({ ...p, threshold: parseFloat(e.target.value) || 0 }))} style={box} aria-label="Seuil d’alerte" />
        </label>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text2, #aab3d1)', margin: '10px 0 0' }}>Estimation à partir des montants saisis ici (gardés sur cet appareil). Les scans sont comptés à {SCAN_EUR.toString().replace('.', ',')} € pièce.</p>
    </section>
  )
}
