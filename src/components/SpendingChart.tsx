'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

// Graphique détaillé des dépenses : période choisie à la souris (glisser sur le graphique pour zoomer, mini-carte pour
// déplacer / redimensionner la fenêtre), raccourcis de période, dates exactes, granularité jour / semaine / mois,
// barres empilées par source, courbe de cumul, ligne de budget et infobulle détaillée.
export type ChartPurchase = { t: number; amount: number; source: string; titre: string | null }
type Gran = 'jour' | 'semaine' | 'mois'
type Bucket = { start: number; end: number; total: number; n: number; ebay: number; vinted: number; titres: string[] }

const DAY = 86400000
const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v >= 100 ? 0 : 2 })
const sod = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const som = (t: number) => { const d = new Date(sod(t)); d.setDate(1); return d.getTime() }
const sow = (t: number) => { const d = new Date(sod(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime() }
const startOf = (t: number, g: Gran) => (g === 'jour' ? sod(t) : g === 'semaine' ? sow(t) : som(t))
const nextOf = (t: number, g: Gran) => { const d = new Date(t); if (g === 'jour') d.setDate(d.getDate() + 1); else if (g === 'semaine') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1); return d.getTime() }
const inputDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fromInput = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
const fmtDay = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

function niceMax(v: number) {
  if (v <= 0) return 10
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}

function labelOf(b: Bucket, g: Gran) {
  const d = new Date(b.start)
  if (g === 'jour') return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })
  if (g === 'semaine') return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') + (d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : '')
}
function fullLabel(b: Bucket, g: Gran) {
  if (g === 'jour') return new Date(b.start).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  if (g === 'semaine') return `Semaine du ${fmtDay(b.start)} au ${fmtDay(b.end - DAY)}`
  return new Date(b.start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

const T = 16, B = 34
const MW = 800, MH = 56, MP = 6

const PRESETS: Array<[string, number | 'annee' | 'tout']> = [['30 j', 30], ['3 mois', 90], ['6 mois', 182], ['12 mois', 365], ['Cette année', 'annee'], ['Tout', 'tout']]

export default function SpendingChart({ purchases, budget, onPickMonth }: { purchases: ChartPurchase[]; budget: number | null; onPickMonth?: (y: number, m: number) => void }) {
  const today = sod(Date.now())
  const minT = useMemo(() => (purchases.length ? Math.min(...purchases.map(p => p.t)) : today - 365 * DAY), [purchases, today])
  const lo = som(Math.min(minT, today)), hi = today

  const [range, setRange] = useState<{ from: number; to: number }>({ from: Math.max(lo, today - 364 * DAY), to: today })
  const [stack, setStack] = useState<Array<{ from: number; to: number }>>([])
  const [granPref, setGranPref] = useState<'auto' | Gran>('auto')
  const [stacked, setStacked] = useState(true)
  const [cumul, setCumul] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const miniRef = useRef<SVGSVGElement>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => setW(Math.max(280, Math.round(el.clientWidth)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const miniDrag = useRef<{ mode: 'l' | 'r' | 'm'; x0: number; from: number; to: number } | null>(null)

  // le graphique prend la largeur réelle de son conteneur (lisible aussi sur téléphone)
  const W = w, L = 46, R = cumul ? 50 : 14, H = w < 520 ? 250 : 300, IW = W - L - R, IH = H - T - B

  const days = Math.round((range.to - range.from) / DAY) + 1
  const wanted: Gran = granPref !== 'auto' ? granPref : days <= 45 ? 'jour' : days <= 200 ? 'semaine' : 'mois'
  // jamais plus de ~366 barres : sinon on passe à une précision plus large (et on le dit)
  const countFor = (g: Gran) => (g === 'jour' ? days : g === 'semaine' ? Math.ceil(days / 7) + 1 : Math.ceil(days / 30.4) + 1)
  const gran: Gran = countFor(wanted) <= 366 ? wanted : wanted === 'jour' && countFor('semaine') <= 366 ? 'semaine' : 'mois'
  const adjusted = gran !== wanted

  const buckets = useMemo<Bucket[]>(() => {
    const out: Bucket[] = []
    let s = startOf(range.from, gran)
    while (s <= range.to && out.length < 1200) { const e = nextOf(s, gran); out.push({ start: s, end: e, total: 0, n: 0, ebay: 0, vinted: 0, titres: [] }); s = e }
    const idx = new Map(out.map((b, i) => [b.start, i]))
    for (const p of purchases) {
      if (p.t < range.from || p.t >= range.to + DAY) continue
      const i = idx.get(startOf(p.t, gran))
      if (i === undefined) continue
      const b = out[i]
      b.total += p.amount; b.n++
      if (p.source === 'vinted') b.vinted += p.amount; else b.ebay += p.amount
      if (p.titre && b.titres.length < 3) b.titres.push(p.titre)
    }
    return out
  }, [purchases, range, gran])

  const n = Math.max(1, buckets.length)
  const slot = IW / n
  const bw = Math.max(1.5, Math.min(slot * 0.74, 46))
  const budgetPer = budget && gran !== 'jour' ? (gran === 'mois' ? budget : budget * 7 / 30.4) : null
  const ymax = niceMax(Math.max(...buckets.map(b => b.total), budgetPer || 0, 1))
  const total = buckets.reduce((a, b) => a + b.total, 0)
  const count = buckets.reduce((a, b) => a + b.n, 0)
  const cum: number[] = []
  buckets.reduce((a, b, i) => (cum[i] = a + b.total), 0)
  const cmax = niceMax(total)
  const peak = buckets.reduce<Bucket | null>((m, b) => (!m || b.total > m.total ? b : m), null)

  // période précédente de même durée
  const len = range.to - range.from + DAY
  const prevTotal = purchases.filter(p => p.t >= range.from - len && p.t < range.from).reduce((a, p) => a + p.amount, 0)
  const hasPrev = range.from - len >= lo - 1

  const px = (clientX: number, el: SVGSVGElement | null, vw: number) => { const r = el!.getBoundingClientRect(); return ((clientX - r.left) / r.width) * vw }
  const idxAt = (x: number) => Math.max(0, Math.min(n - 1, Math.floor((x - L) / slot)))

  const zoomTo = (a: number, b: number) => {
    const i = Math.min(a, b), j = Math.max(a, b)
    const from = Math.max(lo, buckets[i].start), to = Math.min(hi, buckets[j].end - DAY)
    if (to - from < DAY) return
    setStack(s => [...s, range]); setHover(null); setRange({ from, to })
  }
  const presetRange = (v: number | 'annee' | 'tout') =>
    v === 'tout' ? { from: lo, to: hi }
      : v === 'annee' ? { from: Math.max(lo, new Date(new Date(today).getFullYear(), 0, 1).getTime()), to: hi }
        : { from: Math.max(lo, today - (v - 1) * DAY), to: hi }
  const setPreset = (v: number | 'annee' | 'tout') => { setStack([]); setHover(null); setRange(presetRange(v)) }
  const isActive = (v: number | 'annee' | 'tout') => { const p = presetRange(v); return p.from === range.from && p.to === range.to }

  // ── pointeur sur le graphique : survol, glisser pour zoomer, clic sur une barre mensuelle ──
  const ptr = useRef('mouse')
  const onDown = (e: React.PointerEvent<SVGRectElement>) => { ptr.current = e.pointerType; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture indisponible : on continue sans */ } const i = idxAt(px(e.clientX, svgRef.current, W)); setDrag({ a: i, b: i }) }
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const i = idxAt(px(e.clientX, svgRef.current, W))
    setHover(i)
    if (drag) setDrag({ a: drag.a, b: i })
  }
  const onUp = () => {
    if (drag) {
      if (drag.a !== drag.b) zoomTo(drag.a, drag.b)
      else if (ptr.current === 'mouse' && buckets[drag.a] && buckets[drag.a].n > 0) {
        if (gran === 'mois' && onPickMonth) { const d = new Date(buckets[drag.a].start); onPickMonth(d.getFullYear(), d.getMonth()) }
        if (gran !== 'jour') zoomTo(drag.a, drag.a)
      }
    }
    setDrag(null)
  }

  // ── mini-carte : déplacer / redimensionner la fenêtre ──
  const mw = MW - 2 * MP
  const tx = (t: number) => Math.min(MP + mw, Math.max(MP, MP + ((t - lo) / Math.max(DAY, hi + DAY - lo)) * mw))
  const xt = (x: number) => lo + ((x - MP) / mw) * (hi + DAY - lo)
  const miniMonths = useMemo(() => {
    const m: Array<{ s: number; v: number }> = []
    for (let s = lo; s <= hi; s = nextOf(s, 'mois')) m.push({ s, v: 0 })
    for (const p of purchases) { const k = m.find(x => x.s === som(p.t)); if (k) k.v += p.amount }
    return m
  }, [purchases, lo, hi])
  const mmax = Math.max(1, ...miniMonths.map(m => m.v))
  const clampRange = (from: number, to: number) => {
    const span = to - from
    if (from < lo) { from = lo; to = lo + span }
    if (to > hi) { to = hi; from = hi - span }
    return { from: Math.max(lo, sod(from)), to: Math.min(hi, sod(to)) }
  }
  const mDown = (e: React.PointerEvent<SVGRectElement>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture indisponible */ }
    const x = px(e.clientX, miniRef.current, MW), x1 = tx(range.from), x2 = tx(range.to + DAY)
    const mode = Math.abs(x - x1) < 12 ? 'l' : Math.abs(x - x2) < 12 ? 'r' : x > x1 && x < x2 ? 'm' : null
    if (mode) miniDrag.current = { mode, x0: x, from: range.from, to: range.to }
    else { const half = (range.to - range.from) / 2, c = xt(x); setStack([]); setRange(clampRange(c - half, c + half)) }
  }
  const mMove = (e: React.PointerEvent<SVGRectElement>) => {
    const d = miniDrag.current; if (!d) return
    const dt = xt(px(e.clientX, miniRef.current, MW)) - xt(d.x0)
    if (d.mode === 'm') setRange(clampRange(d.from + dt, d.to + dt))
    else if (d.mode === 'l') setRange({ from: Math.max(lo, Math.min(sod(d.from + dt), d.to - 6 * DAY)), to: d.to })
    else setRange({ from: d.from, to: Math.min(hi, Math.max(sod(d.to + dt), d.from + 6 * DAY)) })
  }
  const mUp = () => { miniDrag.current = null }

  const hb = hover !== null ? buckets[hover] : null
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(IW / (gran === 'mois' ? 40 : 54)))))
  const tickLabel = (v: number) => (v === 0 ? '0' : v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','))
  const yAt = (v: number, max: number) => T + IH - (v / max) * IH
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="spc-wrap">
      <style>{CSS}</style>

      <div className="spc-bar">
        <div className="spc-presets" role="group" aria-label="Période">
          {PRESETS.map(([label, v]) => <button key={label} className={isActive(v) ? 'on' : ''} onClick={() => setPreset(v)}>{label}</button>)}
        </div>
        <div className="spc-dates">
          <label>Du <input type="date" value={inputDate(range.from)} min={inputDate(lo)} max={inputDate(hi)} onChange={e => { const v = e.target.value; if (v) { setHover(null); setRange(r => { const f = Math.min(Math.max(lo, fromInput(v)), hi); return { from: f, to: Math.max(r.to, f) } }) } }} /></label>
          <label>au <input type="date" value={inputDate(range.to)} min={inputDate(lo)} max={inputDate(hi)} onChange={e => { const v = e.target.value; if (v) { setHover(null); setRange(r => { const t = Math.max(Math.min(hi, fromInput(v)), lo); return { from: Math.min(r.from, t), to: t } }) } }} /></label>
        </div>
      </div>

      <div className="spc-bar">
        <div className="spc-seg" role="group" aria-label="Précision">
          {(['auto', 'jour', 'semaine', 'mois'] as const).map(g => <button key={g} className={granPref === g ? 'on' : ''} onClick={() => setGranPref(g)}>{g === 'auto' ? `Auto (${gran})` : g}</button>)}
        </div>
        <div className="spc-opts">
          <label><input type="checkbox" checked={stacked} onChange={e => setStacked(e.target.checked)} /> Par source</label>
          <label><input type="checkbox" checked={cumul} onChange={e => setCumul(e.target.checked)} /> Cumul</label>
          {stack.length > 0 && <button className="spc-link" onClick={() => { const p = stack[stack.length - 1]; setStack(s => s.slice(0, -1)); setRange(p) }}>↩ Dézoomer</button>}
        </div>
      </div>

      <div className="spc-sum">
        <div><b>{eur(total)}</b><span>{fmtDay(range.from)} → {fmtDay(range.to)} · {days} j</span></div>
        <div><b>{count}</b><span>achat{count > 1 ? 's' : ''}</span></div>
        <div><b>{eur(total / n)}</b><span>par {gran === 'jour' ? 'jour' : gran === 'semaine' ? 'semaine' : 'mois'} en moyenne</span></div>
        <div><b>{peak && peak.total > 0 ? eur(peak.total) : '—'}</b><span>pic{peak && peak.total > 0 ? ` (${labelOf(peak, gran)})` : ''}</span></div>
        <div>
          <b className={hasPrev && total > prevTotal ? 'up' : hasPrev && total < prevTotal ? 'down' : ''}>
            {hasPrev ? `${total >= prevTotal ? '+' : '−'}${eur(Math.abs(total - prevTotal))}` : '—'}
          </b>
          <span>vs période précédente{hasPrev ? ` (${eur(prevTotal)})` : ''}</span>
        </div>
      </div>

      <div className="spc-plot" ref={plotRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="spc-svg" role="img" aria-label="Dépenses sur la période choisie" onPointerLeave={() => { if (!drag) setHover(null) }}>
          {ticks.map(k => (
            <g key={k}>
              <line x1={L} x2={W - R} y1={T + IH - k * IH} y2={T + IH - k * IH} stroke="currentColor" opacity={k === 0 ? 0.4 : 0.12} />
              <text x={L - 8} y={T + IH - k * IH + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.6">{tickLabel(ymax * k)}</text>
              {cumul && k > 0 && <text x={W - R + 8} y={T + IH - k * IH + 4} fontSize="11" fill="#f5c451">{tickLabel(cmax * k)}</text>}
            </g>
          ))}
          {budgetPer ? <line x1={L} x2={W - R} y1={yAt(budgetPer, ymax)} y2={yAt(budgetPer, ymax)} stroke="#f5c451" strokeWidth="2" strokeDasharray="6 5" /> : null}

          {buckets.map((b, i) => {
            const x = L + i * slot + (slot - bw) / 2
            const hE = (b.ebay / ymax) * IH, hV = (b.vinted / ymax) * IH, hT = (b.total / ymax) * IH
            const over = budgetPer !== null && b.total > budgetPer
            const dim = hover !== null && hover !== i ? 0.55 : 1
            return stacked ? (
              <g key={b.start} opacity={dim}>
                {hE > 0 && <rect x={x} y={T + IH - hE} width={bw} height={hE} fill="#2f6bff" />}
                {hV > 0 && <rect x={x} y={T + IH - hE - hV} width={bw} height={hV} fill="#09b1ba" />}
                {over && <rect x={x} y={T + IH - hT} width={bw} height={Math.max(3, hT)} fill="none" stroke="#d6293e" strokeWidth="2" />}
              </g>
            ) : (
              <rect key={b.start} x={x} y={T + IH - hT} width={bw} height={hT} fill={over ? '#d6293e' : '#2f6bff'} opacity={dim} />
            )
          })}

          {cumul && cum.length > 1 && (
            <polyline fill="none" stroke="#f5c451" strokeWidth="2.5" strokeLinejoin="round"
              points={cum.map((v, i) => `${L + i * slot + slot / 2},${yAt(v, cmax)}`).join(' ')} />
          )}

          {count === 0 && <text x={L + IW / 2} y={T + IH / 2} textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.55">Aucun achat sur cette période</text>}
          {buckets.map((b, i) => (i % labelEvery === 0 ? (
            <text key={b.start} x={L + i * slot + slot / 2} y={H - 12} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{labelOf(b, gran)}</text>
          ) : null))}

          {drag && drag.a !== drag.b && (
            <rect x={L + Math.min(drag.a, drag.b) * slot} y={T} width={(Math.abs(drag.b - drag.a) + 1) * slot} height={IH} fill="#5b8def" opacity="0.22" stroke="#5b8def" />
          )}
          {hb && !drag && <line x1={L + hover! * slot + slot / 2} x2={L + hover! * slot + slot / 2} y1={T} y2={T + IH} stroke="currentColor" opacity="0.35" />}
          <rect x={L} y={T} width={IW} height={IH + 20} fill="transparent" style={{ cursor: 'crosshair', touchAction: 'pan-y' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)} />
        </svg>

        {hb && !drag && (
          <div className="spc-tip" style={{ width: Math.min(250, W - 8), left: Math.min(Math.max(L + hover! * slot + slot / 2 - Math.min(250, W - 8) / 2, 4), Math.max(4, W - Math.min(250, W - 8) - 4)) }}>
            <b>{fullLabel(hb, gran)}</b>
            <div className="spc-tip-total">{eur(hb.total)}{budgetPer ? <small> / {eur(budgetPer)}</small> : null}</div>
            <div>{hb.n} achat{hb.n > 1 ? 's' : ''}{hb.ebay > 0 && hb.vinted > 0 ? ` · eBay ${eur(hb.ebay)} · Vinted ${eur(hb.vinted)}` : hb.n > 0 ? ` · ${hb.vinted > 0 ? 'Vinted' : 'eBay'}` : ''}</div>
            {hb.titres.map((t, k) => <div key={k} className="spc-tip-item">{t.length > 44 ? t.slice(0, 42) + '…' : t}</div>)}
            {cumul && <div>Cumul : {eur(cum[hover!])}</div>}
          </div>
        )}
        {adjusted && <div className="spc-hint">Précision « {wanted} » trop fine pour cette durée : affichage par {gran}.</div>}
        <div className="spc-hint">Glisse sur le graphique pour zoomer sur une période{gran !== 'jour' ? ' · clique sur une barre pour la détailler' : ''}.</div>
      </div>

      <svg ref={miniRef} viewBox={`0 0 ${MW} ${MH}`} className="spc-mini" role="img" aria-label="Vue d’ensemble : déplace ou redimensionne la fenêtre">
        {miniMonths.map(m => { const h = (m.v / mmax) * (MH - 14); return <rect key={m.s} x={tx(m.s) + 1} y={MH - 8 - h} width={Math.max(1, tx(nextOf(m.s, 'mois')) - tx(m.s) - 2)} height={Math.max(m.v > 0 ? 2 : 0, h)} fill="#5b8def" opacity="0.55" /> })}
        <rect x={MP} y={4} width={Math.max(0, tx(range.from) - MP)} height={MH - 12} fill="#000" opacity="0.38" />
        <rect x={tx(range.to + DAY)} y={4} width={Math.max(0, MP + mw - tx(range.to + DAY))} height={MH - 12} fill="#000" opacity="0.38" />
        <rect x={tx(range.from)} y={4} width={Math.max(2, tx(range.to + DAY) - tx(range.from))} height={MH - 12} fill="none" stroke="#f5c451" strokeWidth="2" />
        <rect x={tx(range.from) - 3} y={14} width="6" height={MH - 32} fill="#f5c451" />
        <rect x={tx(range.to + DAY) - 3} y={14} width="6" height={MH - 32} fill="#f5c451" />
        <rect x="0" y="0" width={MW} height={MH} fill="transparent" style={{ cursor: 'ew-resize', touchAction: 'none' }}
          onPointerDown={mDown} onPointerMove={mMove} onPointerUp={mUp} onPointerCancel={mUp} />
      </svg>
      <div className="spc-hint">Vue d’ensemble : déplace la fenêtre jaune ou tire ses bords pour choisir la période.</div>
    </div>
  )
}

const CSS = `
.spc-wrap { color: var(--text); }
.spc-bar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.spc-presets, .spc-seg { display: inline-flex; flex-wrap: wrap; border: 3px solid var(--border); }
.spc-presets button, .spc-seg button { background: transparent; border: 0; color: var(--text2); font: 800 11px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; padding: 7px 11px; cursor: pointer; }
.spc-presets button:hover, .spc-seg button:hover { color: var(--text); background: var(--bg3); }
.spc-seg button.on, .spc-presets button.on { background: #2f6bff; color: #fff; }
.spc-dates, .spc-opts { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--text2); }
.spc-dates input { background: var(--input-bg); color: var(--text); border: 2px solid var(--border); padding: 5px 7px; font: 600 12px system-ui, sans-serif; border-radius: 0; }
.spc-opts label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.spc-opts input { width: auto; margin: 0; }
.spc-link { background: none; border: 0; color: #2f6bff; font: 800 12px system-ui, sans-serif; cursor: pointer; text-transform: uppercase; letter-spacing: .04em; }
.spc-sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; margin: 4px 0 12px; }
.spc-sum > div { border: 2px solid var(--border); padding: 8px 10px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.spc-sum b { font: 400 22px 'Surfquest', Impact, 'Arial Narrow', sans-serif; line-height: 1.15; }
.spc-sum b.up { color: #d6293e; } .spc-sum b.down { color: #1e9e57; }
.spc-sum span { font-size: 11px; color: var(--text2); }
.spc-plot { position: relative; }
.spc-svg { width: 100%; height: auto; display: block; user-select: none; -webkit-user-select: none; }
.spc-mini { width: 100%; height: auto; display: block; margin-top: 10px; user-select: none; -webkit-user-select: none; background: var(--bg3); }
.spc-hint { font-size: 11px; color: var(--text3); margin-top: 6px; }
.spc-tip { position: absolute; top: 6px; z-index: 5; pointer-events: none; background: var(--bg2); border: 2px solid var(--text); padding: 8px 10px; font-size: 12px; line-height: 1.45; width: 250px; max-width: 80%; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
.spc-tip b { display: block; } .spc-tip b::first-letter { text-transform: uppercase; }
.spc-tip-total { font: 400 22px 'Surfquest', Impact, 'Arial Narrow', sans-serif; } .spc-tip-total small { font: 600 12px system-ui, sans-serif; color: var(--text2); }
.spc-tip-item { color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`
