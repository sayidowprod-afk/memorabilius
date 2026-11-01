'use client'
import { useMemo, useState } from 'react'
import type { Row, Rates } from '@/components/MesAchatsView'

// Tracker de dépenses de « Mes achats » : calculé automatiquement à partir des achats importés (eBay et Vinted),
// en euros. Vue mensuelle ou annuelle, budget mensuel, comparaison avec le mois / l'année précédents, répartition par source.
const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v >= 1000 ? 0 : 2 })
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

type Purchase = { amount: number; y: number; m: number; source: string; vendeur: string | null; titre: string | null }

function amountOf(r: Row, rates: Rates): number {
  const raw = r.total_paye ?? ((r.prix || 0) + (r.frais_port || 0) + (r.autres_frais || 0))
  const d = r.devise
  if (!d || d === 'EUR') return raw
  const rate = rates?.[d]
  return rate ? raw * rate : raw
}

function Delta({ now, before, label }: { now: number; before: number | null; label: string }) {
  if (before === null) return <div className="st-delta"><span>{label}</span><b>—</b></div>
  const diff = now - before
  const pct = before > 0 ? Math.round((diff / before) * 100) : null
  const cls = Math.abs(diff) < 0.005 ? '' : diff > 0 ? 'up' : 'down'
  return (
    <div className="st-delta">
      <span>{label} ({eur(before)})</span>
      <b className={cls}>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{eur(Math.abs(diff))}{pct !== null ? ` · ${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(pct)} %` : ''}</b>
    </div>
  )
}

export default function SpendingTracker({ rows, rates, budget, onSaveBudget }: { rows: Row[]; rates: Rates; budget: number | null; onSaveBudget: (v: number | null) => void }) {
  const today = new Date()
  const [mode, setMode] = useState<'mois' | 'annee'>('mois')
  const [sel, setSel] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const purchases = useMemo<Purchase[]>(() => rows.filter(r => r.type === 'achat' && r.achete_at).map(r => {
    const d = new Date(r.achete_at!)
    return { amount: amountOf(r, rates), y: d.getFullYear(), m: d.getMonth(), source: (r as Row & { source?: string }).source || 'ebay', vendeur: r.vendeur, titre: r.titre }
  }), [rows, rates])

  const byMonth = useMemo(() => {
    const o: Record<string, number> = {}
    for (const p of purchases) o[monthKey(p.y, p.m)] = (o[monthKey(p.y, p.m)] || 0) + p.amount
    return o
  }, [purchases])
  const spent = (y: number, m: number) => byMonth[monthKey(y, m)] || 0
  const yearTotal = (y: number) => purchases.filter(p => p.y === y).reduce((a, p) => a + p.amount, 0)
  const hasYear = (y: number) => purchases.some(p => p.y === y)

  const years = [...new Set(purchases.map(p => p.y).concat(today.getFullYear()))].sort((a, b) => a - b)
  const isCurrentMonth = sel.y === today.getFullYear() && sel.m === today.getMonth()
  const prevM = sel.m === 0 ? { y: sel.y - 1, m: 11 } : { y: sel.y, m: sel.m - 1 }
  const move = (delta: number) => setSel(s => { const d = new Date(s.y, s.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  const monthPurchases = purchases.filter(p => p.y === sel.y && p.m === sel.m)
  const monthTotal = spent(sel.y, sel.m)
  const bySource = (list: Purchase[]) => {
    const o: Record<string, number> = {}
    for (const p of list) o[p.source] = (o[p.source] || 0) + p.amount
    return Object.entries(o).sort((a, b) => b[1] - a[1])
  }
  const yearPurchases = purchases.filter(p => p.y === sel.y)
  const yTotal = yearTotal(sel.y)
  const monthsElapsed = sel.y === today.getFullYear() ? today.getMonth() + 1 : sel.y < today.getFullYear() ? 12 : 0
  const biggest = (list: Purchase[]) => list.reduce<Purchase | null>((b, p) => (!b || p.amount > b.amount ? p : b), null)
  const topSeller = (list: Purchase[]) => {
    const o: Record<string, number> = {}
    for (const p of list) if (p.vendeur) o[p.vendeur] = (o[p.vendeur] || 0) + p.amount
    return Object.entries(o).sort((a, b) => b[1] - a[1])[0] || null
  }

  // projection de fin de mois (mois en cours seulement)
  const daysInMonth = new Date(sel.y, sel.m + 1, 0).getDate()
  const projected = isCurrentMonth && today.getDate() >= 5 && monthTotal > 0 ? (monthTotal / today.getDate()) * daysInMonth : null

  const pct = budget && budget > 0 ? monthTotal / budget : null
  const state = pct === null ? 'none' : pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok'

  // graphique : 12 mois de l'année sélectionnée
  const bars = Array.from({ length: 12 }, (_, m) => spent(sel.y, m))
  const max = Math.max(1, ...bars, budget || 0)
  const W = 600, H = 170, bw = 30, gap = (W - bw * 12) / 11

  const saveBudget = () => {
    const n = Number(draft.replace(',', '.'))
    if (draft.trim() === '') onSaveBudget(null)
    else if (Number.isFinite(n) && n >= 0 && n < 1000000) onSaveBudget(Math.round(n * 100) / 100)
    setEditing(false)
  }

  const list = mode === 'mois' ? monthPurchases : yearPurchases
  const big = biggest(list), seller = topSeller(list)

  return (
    <section className="st-wrap">
      <style>{CSS}</style>
      <div className="st-head">
        <h2 className="ma-h2" style={{ margin: 0 }}>Dépenses</h2>
        <div className="st-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'mois'} className={mode === 'mois' ? 'on' : ''} onClick={() => setMode('mois')}>Mois</button>
          <button role="tab" aria-selected={mode === 'annee'} className={mode === 'annee' ? 'on' : ''} onClick={() => setMode('annee')}>Année</button>
        </div>
      </div>

      <div className="st-nav">
        <button className="ma-btn ghost" aria-label={mode === 'mois' ? 'Mois précédent' : 'Année précédente'} onClick={() => (mode === 'mois' ? move(-1) : setSel(s => ({ ...s, y: s.y - 1 })))}>‹</button>
        <b className="st-period">{mode === 'mois' ? monthLabel(sel.y, sel.m) : sel.y}</b>
        <button className="ma-btn ghost" aria-label={mode === 'mois' ? 'Mois suivant' : 'Année suivante'} disabled={mode === 'mois' ? isCurrentMonth : sel.y >= today.getFullYear()}
          onClick={() => (mode === 'mois' ? move(1) : setSel(s => ({ ...s, y: s.y + 1 })))}>›</button>
        {!(isCurrentMonth && mode === 'mois') && <button className="ma-btn ghost" onClick={() => setSel({ y: today.getFullYear(), m: today.getMonth() })}>Aujourd’hui</button>}
      </div>

      <div className="st-grid">
        <div className="st-card">
          <div className="st-label">{mode === 'mois' ? 'Dépensé ce mois' : 'Dépensé sur l’année'}</div>
          <div className="da-num st-big">{eur(mode === 'mois' ? monthTotal : yTotal)}</div>
          <div className="st-meta">{list.length} achat{list.length > 1 ? 's' : ''}{list.length > 0 ? ` · panier moyen ${eur(list.reduce((a, p) => a + p.amount, 0) / list.length)}` : ''}</div>

          {mode === 'mois' ? (
            <>
              <Delta now={monthTotal} before={byMonth[monthKey(prevM.y, prevM.m)] !== undefined || hasYear(prevM.y) ? spent(prevM.y, prevM.m) : null} label={`vs ${new Date(prevM.y, prevM.m, 1).toLocaleDateString('fr-FR', { month: 'long' })}`} />
              <Delta now={monthTotal} before={hasYear(sel.y - 1) ? spent(sel.y - 1, sel.m) : null} label={`vs ${new Date(sel.y - 1, sel.m, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`} />
            </>
          ) : (
            <>
              <div className="st-meta">Moyenne : {eur(monthsElapsed > 0 ? yTotal / monthsElapsed : 0)} / mois</div>
              <Delta now={yTotal} before={hasYear(sel.y - 1) ? yearTotal(sel.y - 1) : null} label={`vs ${sel.y - 1}`} />
            </>
          )}
        </div>

        <div className={`st-card st-budget ${state}`}>
          <div className="st-label">Budget mensuel</div>
          {editing ? (
            <div className="st-edit">
              <input className="ma-search" style={{ margin: 0 }} autoFocus inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveBudget() }} placeholder="Montant en € (vide = aucun)" aria-label="Budget mensuel en euros" />
              <button className="ma-btn primary" style={{ padding: '9px 14px' }} onClick={saveBudget}>OK</button>
              <button className="ma-btn ghost" onClick={() => setEditing(false)}>×</button>
            </div>
          ) : budget === null ? (
            <>
              <div className="st-meta" style={{ margin: '6px 0 10px' }}>Fixe un budget pour suivre ce que tu dépenses chaque mois.</div>
              <button className="ma-btn" onClick={() => { setDraft(''); setEditing(true) }}>Définir un budget</button>
            </>
          ) : (
            <>
              <div className="da-num st-big">{mode === 'mois' ? eur(Math.abs(budget - monthTotal)) : eur(Math.abs(budget * monthsElapsed - yTotal))}</div>
              <div className="st-meta">
                {mode === 'mois'
                  ? (monthTotal <= budget ? `restant sur ${eur(budget)}` : `de dépassement sur ${eur(budget)}`)
                  : (yTotal <= budget * monthsElapsed ? `sous le budget cumulé (${eur(budget * monthsElapsed)})` : `au-dessus du budget cumulé (${eur(budget * monthsElapsed)})`)}
              </div>
              {mode === 'mois' && (
                <>
                  <div className="st-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((pct || 0) * 100))}>
                    <i style={{ width: `${Math.min(100, (pct || 0) * 100)}%` }} />
                  </div>
                  <div className="st-meta">{Math.round((pct || 0) * 100)} % utilisé{projected !== null ? ` · fin de mois estimée à ${eur(projected)}` : ''}</div>
                  {state === 'over' && <div className="st-flag">Budget dépassé ce mois-ci</div>}
                  {state === 'warn' && <div className="st-flag warn">Plus que {eur(Math.max(0, budget - monthTotal))} avant ton budget</div>}
                </>
              )}
              <button className="ma-btn ghost" style={{ marginTop: 10 }} onClick={() => { setDraft(String(budget)); setEditing(true) }}>Modifier le budget</button>
            </>
          )}
        </div>
      </div>

      <div className="st-card" style={{ marginTop: 10 }}>
        <div className="st-label">{sel.y} · mois par mois {budget ? '(trait pointillé = budget)' : ''}</div>
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="st-chart" role="img" aria-label={`Dépenses mensuelles ${sel.y}`}>
          {budget ? <line x1="0" x2={W} y1={H - (budget / max) * (H - 18)} y2={H - (budget / max) * (H - 18)} stroke="#f5c451" strokeWidth="2" strokeDasharray="6 5" /> : null}
          {bars.map((v, m) => {
            const h = Math.max(v > 0 ? 3 : 0, (v / max) * (H - 18)), x = m * (bw + gap)
            const on = mode === 'mois' && sel.m === m
            const future = sel.y === today.getFullYear() && m > today.getMonth()
            const over = budget && v > budget
            return (
              <g key={m} onClick={() => { setSel(s => ({ ...s, m })); setMode('mois') }} style={{ cursor: 'pointer' }}>
                <rect x={x - gap / 2} y="0" width={bw + gap} height={H + 22} fill="transparent" />
                <rect x={x} y={H - h} width={bw} height={h} fill={over ? '#d6293e' : '#2f6bff'} opacity={future ? 0.25 : on ? 1 : 0.62} />
                {on && <rect x={x - 2} y={H - h - 2} width={bw + 4} height={h + 4} fill="none" stroke="currentColor" strokeWidth="2" />}
                {v > 0 && (on || mode === 'annee') && <text x={x + bw / 2} y={H - h - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{Math.round(v)}</text>}
                <text x={x + bw / 2} y={H + 15} textAnchor="middle" fontSize="12" fill="currentColor" opacity={on ? 1 : 0.65} fontWeight={on ? 800 : 500}>{MONTHS_SHORT[m]}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="st-grid" style={{ marginTop: 10 }}>
        <div className="st-card">
          <div className="st-label">Répartition par source</div>
          {bySource(list).length === 0 ? <div className="st-meta">Aucun achat sur la période.</div> : bySource(list).map(([s, v]) => (
            <div key={s} className="st-src">
              <span>{s === 'vinted' ? 'Vinted' : 'eBay'}</span>
              <div className="st-srcbar"><i style={{ width: `${(v / (list.reduce((a, p) => a + p.amount, 0) || 1)) * 100}%`, background: s === 'vinted' ? '#09b1ba' : '#2f6bff' }} /></div>
              <b>{eur(v)}</b>
            </div>
          ))}
        </div>
        <div className="st-card">
          <div className="st-label">Sur la période</div>
          <div className="st-meta" style={{ lineHeight: 1.7 }}>
            {big ? <>Plus gros achat : <b>{eur(big.amount)}</b>{big.titre ? ` — ${big.titre.length > 42 ? big.titre.slice(0, 40) + '…' : big.titre}` : ''}<br /></> : 'Aucun achat sur la période.'}
            {seller && <>Vendeur le plus fréquent : <b>{seller[0]}</b> ({eur(seller[1])})<br /></>}
            {years.length > 1 && <>Années suivies : {years.filter(hasYear).join(', ')}</>}
          </div>
        </div>
      </div>
      <p className="st-note">Calcul automatique à partir de tes achats eBay et Vinted (articles + port + frais), convertis en euros. Seuls les achats importés sont comptés.</p>
    </section>
  )
}

const CSS = `
.st-wrap { margin-top: 8px; }
.st-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin: 28px 0 12px; }
.st-tabs { display: inline-flex; border: 3px solid var(--border); }
.st-tabs button { background: transparent; border: 0; color: var(--text2); font: 800 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 8px 16px; cursor: pointer; }
.st-tabs button.on { background: #2f6bff; color: #fff; }
.st-nav { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.st-period { font: 400 24px 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; min-width: 190px; text-align: center; }
.st-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: 10px; }
.st-card { border: 3px solid var(--border); background: var(--bg2); padding: 14px 16px; min-width: 0; }
.st-label { font: 800 11px system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--text2); margin-bottom: 4px; }
.st-big { font-size: 34px; line-height: 1.1; }
.st-meta { font-size: 13px; color: var(--text2); margin-top: 3px; }
.st-delta { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.st-delta span { color: var(--text2); }
.st-delta b.up { color: #d6293e; } .st-delta b.down { color: #1e9e57; }
.st-budget.over { border-color: #d6293e; } .st-budget.warn { border-color: #f5c451; } .st-budget.ok { border-color: #1e9e57; }
.st-bar { height: 12px; border: 2px solid var(--border); margin-top: 10px; background: var(--bg3); }
.st-bar i { display: block; height: 100%; background: #1e9e57; }
.st-budget.warn .st-bar i { background: #f5c451; } .st-budget.over .st-bar i { background: #d6293e; }
.st-flag { font: 800 12px system-ui, sans-serif; color: #d6293e; margin-top: 8px; text-transform: uppercase; letter-spacing: .04em; }
.st-flag.warn { color: #b8860b; }
.st-edit { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.st-edit input { flex: 1 1 150px; }
.st-chart { width: 100%; height: auto; display: block; margin-top: 8px; color: var(--text); }
.st-src { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: center; font-size: 13px; margin-top: 8px; }
.st-srcbar { height: 10px; background: var(--bg3); } .st-srcbar i { display: block; height: 100%; }
.st-note { font-size: 12px; color: var(--text3); margin: 10px 0 0; }
`
