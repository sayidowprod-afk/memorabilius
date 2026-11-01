'use client'
import { useMemo, useState } from 'react'
import type { Row, Rates } from '@/components/MesAchatsView'
import { groupOrders, orderTotals } from '@/lib/achatsOrders'
import SpendingChart from '@/components/SpendingChart'

// Tracker de dépenses de « Mes achats » : calculé automatiquement à partir des achats importés (eBay et Vinted),
// en euros. Vue mensuelle ou annuelle, budget mensuel, comparaison avec le mois / l'année précédents, répartition par source.
const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: v >= 1000 ? 0 : 2 })
const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`
const monthLabel = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

export type Budgets = {
  mensuel: number | null; annuel: number | null; budget_ebay: number | null; budget_vinted: number | null
  objectif_nom: string | null; objectif_cible: number | null; objectif_epargne: number; objectif_mensuel: number | null
}
export const NO_BUDGETS: Budgets = { mensuel: null, annuel: null, budget_ebay: null, budget_vinted: null, objectif_nom: null, objectif_cible: null, objectif_epargne: 0, objectif_mensuel: null }

// Barre de budget : verte, orange dès 80 %, rouge au-delà de 100 % (repère à 80 %).
function BudgetBar({ label, spent, budget }: { label: string; spent: number; budget: number }) {
  const pct = budget > 0 ? spent / budget : 0
  const state = pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok'
  return (
    <div className={`st-bb ${state}`}>
      <div className="st-bb-top"><span>{label}</span><b>{eur(spent)} / {eur(budget)}</b></div>
      <div className="st-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(pct * 100))}>
        <i style={{ width: `${Math.min(100, pct * 100)}%` }} /><u />
      </div>
      <div className="st-meta">{Math.round(pct * 100)} % utilisé{state === 'over' ? ` · dépassé de ${eur(spent - budget)}` : state === 'warn' ? ` · plus que ${eur(budget - spent)}` : ''}</div>
    </div>
  )
}

type Purchase = { amount: number; y: number; m: number; t: number; source: string; vendeur: string | null; titre: string | null }

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

export default function SpendingTracker({ rows, rates, budgets, onSaveBudgets }: { rows: Row[]; rates: Rates; budgets: Budgets; onSaveBudgets: (b: Budgets) => void }) {
  const budget = budgets.mensuel
  const today = new Date()
  const [mode, setMode] = useState<'mois' | 'annee'>('mois')
  const [sel, setSel] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ mensuel: '', annuel: '', ebay: '', vinted: '' })
  const [goalEdit, setGoalEdit] = useState(false)
  const [goal, setGoal] = useState({ nom: '', cible: '', mensuel: '' })
  const [add, setAdd] = useState('')

  // une commande de plusieurs articles (même vendeur) ne compte qu'une fois : total payé et port uniques
  const purchases = useMemo<Purchase[]>(() => groupOrders(rows.filter(r => r.type === 'achat' && r.achete_at)).map(g => {
    const r = g[0]
    const d = new Date(r.achete_at!)
    let amount = amountOf(r, rates)
    if (g.length > 1) {
      const raw = orderTotals(g).total, cur = r.devise, rate = cur && cur !== 'EUR' ? rates?.[cur] : 1
      amount = rate ? raw * rate : raw
    }
    const titre = g.length > 1 ? `Commande de ${g.length} articles` : r.titre
    return { amount, y: d.getFullYear(), m: d.getMonth(), t: d.getTime(), source: r.source || 'ebay', vendeur: r.vendeur, titre }
  }), [rows, rates])
  const chartData = useMemo(() => purchases.map(p => ({ t: p.t, amount: p.amount, source: p.source, titre: p.titre })), [purchases])

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
  // pas de comparaison avec une période antérieure aux premières données importées (eBay ne remonte que 60 jours au départ)
  const firstT = purchases.length ? Math.min(...purchases.map(p => p.t)) : Infinity
  const covered = (y: number, m: number) => new Date(y, m + 1, 1).getTime() > firstT
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


  const amt = (v: string): number | null => {
    const n = Number(v.replace(',', '.'))
    return v.trim() !== '' && Number.isFinite(n) && n >= 0 && n < 1000000 ? Math.round(n * 100) / 100 : null
  }
  const openBudgets = () => {
    const f = (v: number | null) => (v === null ? '' : String(v))
    setDraft({ mensuel: f(budgets.mensuel), annuel: f(budgets.annuel), ebay: f(budgets.budget_ebay), vinted: f(budgets.budget_vinted) })
    setEditing(true)
  }
  const saveBudgets = () => {
    onSaveBudgets({ ...budgets, mensuel: amt(draft.mensuel), annuel: amt(draft.annuel), budget_ebay: amt(draft.ebay), budget_vinted: amt(draft.vinted) })
    setEditing(false)
  }
  const srcMonth = (src: string) => monthPurchases.filter(p => p.source === src).reduce((a, p) => a + p.amount, 0)

  // objectif d'épargne : « je mets X € de côté pour une carte »
  const saved = budgets.objectif_epargne, target = budgets.objectif_cible
  const goalPct = target && target > 0 ? Math.min(1, saved / target) : 0
  const weeksLeft = target && budgets.objectif_mensuel && saved < target ? Math.ceil((target - saved) / (budgets.objectif_mensuel / 4.345)) : null
  const saveGoal = () => {
    onSaveBudgets({ ...budgets, objectif_nom: goal.nom.trim().slice(0, 80) || null, objectif_cible: amt(goal.cible), objectif_mensuel: amt(goal.mensuel) })
    setGoalEdit(false)
  }
  const addSaving = (v: number | null) => {
    if (v === null || v === 0) return
    onSaveBudgets({ ...budgets, objectif_epargne: Math.max(0, Math.round((saved + v) * 100) / 100) })
    setAdd('')
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
              <Delta now={monthTotal} before={covered(prevM.y, prevM.m) ? spent(prevM.y, prevM.m) : null} label={`vs ${new Date(prevM.y, prevM.m, 1).toLocaleDateString('fr-FR', { month: 'long' })}`} />
              <Delta now={monthTotal} before={covered(sel.y - 1, sel.m) ? spent(sel.y - 1, sel.m) : null} label={`vs ${new Date(sel.y - 1, sel.m, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`} />
            </>
          ) : (
            <>
              <div className="st-meta">Moyenne : {eur(monthsElapsed > 0 ? yTotal / monthsElapsed : 0)} / mois</div>
              <Delta now={yTotal} before={hasYear(sel.y - 1) ? yearTotal(sel.y - 1) : null} label={`vs ${sel.y - 1}${firstT > new Date(sel.y - 1, 0, 1).getTime() ? ' (année partielle)' : ''}`} />
            </>
          )}
        </div>

        <div className={`st-card st-budget ${state}`}>
          <div className="st-label">Budget mensuel</div>
          {budget === null ? (
            <>
              <div className="st-meta" style={{ margin: '6px 0 10px' }}>Fixe un budget pour suivre ce que tu dépenses chaque mois.</div>
              <button className="ma-btn" onClick={openBudgets}>Définir un budget</button>
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
              <button className="ma-btn ghost" style={{ marginTop: 10 }} onClick={openBudgets}>Modifier les budgets</button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="st-card" style={{ marginTop: 10 }}>
          <div className="st-label">Mes budgets (laisse vide pour ne pas en fixer)</div>
          <div className="st-form">
            <label>Par mois (€)<input className="ma-search" inputMode="decimal" value={draft.mensuel} onChange={e => setDraft({ ...draft, mensuel: e.target.value })} /></label>
            <label>Par an (€)<input className="ma-search" inputMode="decimal" value={draft.annuel} onChange={e => setDraft({ ...draft, annuel: e.target.value })} /></label>
            <label>eBay, par mois (€)<input className="ma-search" inputMode="decimal" value={draft.ebay} onChange={e => setDraft({ ...draft, ebay: e.target.value })} /></label>
            <label>Vinted, par mois (€)<input className="ma-search" inputMode="decimal" value={draft.vinted} onChange={e => setDraft({ ...draft, vinted: e.target.value })} /></label>
          </div>
          <div className="st-edit"><button className="ma-btn primary" style={{ padding: '9px 16px' }} onClick={saveBudgets}>Enregistrer</button><button className="ma-btn ghost" onClick={() => setEditing(false)}>Annuler</button></div>
        </div>
      )}

      {(budgets.annuel !== null || budgets.budget_ebay !== null || budgets.budget_vinted !== null) && (
        <div className="st-card" style={{ marginTop: 10 }}>
          <div className="st-label">Budgets suivis</div>
          <div className="st-bbs">
            {budgets.annuel !== null && <BudgetBar label={`Année ${sel.y}`} spent={yTotal} budget={budgets.annuel} />}
            {budgets.budget_ebay !== null && <BudgetBar label={`eBay · ${monthLabel(sel.y, sel.m)}`} spent={srcMonth('ebay')} budget={budgets.budget_ebay} />}
            {budgets.budget_vinted !== null && <BudgetBar label={`Vinted · ${monthLabel(sel.y, sel.m)}`} spent={srcMonth('vinted')} budget={budgets.budget_vinted} />}
          </div>
        </div>
      )}

      <div className="st-card st-goal" style={{ marginTop: 10 }}>
        <div className="st-label">Objectif d’épargne</div>
        {goalEdit ? (
          <>
            <div className="st-form">
              <label>Pour quelle carte ?<input className="ma-search" maxLength={80} value={goal.nom} onChange={e => setGoal({ ...goal, nom: e.target.value })} placeholder="Wembanyama Prizm PSA 10" /></label>
              <label>Prix visé (€)<input className="ma-search" inputMode="decimal" value={goal.cible} onChange={e => setGoal({ ...goal, cible: e.target.value })} /></label>
              <label>Mis de côté par mois (€)<input className="ma-search" inputMode="decimal" value={goal.mensuel} onChange={e => setGoal({ ...goal, mensuel: e.target.value })} /></label>
            </div>
            <div className="st-edit"><button className="ma-btn primary" style={{ padding: '9px 16px' }} onClick={saveGoal}>Enregistrer</button><button className="ma-btn ghost" onClick={() => setGoalEdit(false)}>Annuler</button></div>
          </>
        ) : !budgets.objectif_nom && target === null ? (
          <>
            <div className="st-meta" style={{ margin: '6px 0 10px' }}>Vise une carte précise et suis ce que tu mets de côté pour te la payer.</div>
            <button className="ma-btn" onClick={() => { setGoal({ nom: '', cible: '', mensuel: '' }); setGoalEdit(true) }}>Définir un objectif</button>
          </>
        ) : (
          <div className="st-goal-body">
            <div className="st-ring" style={{ background: `conic-gradient(${goalPct >= 1 ? '#1e9e57' : '#2f6bff'} 0 ${goalPct * 100}%, var(--bg3) 0)` }} role="img" aria-label={`${Math.round(goalPct * 100)} % de l’objectif`}>
              <span>{Math.round(goalPct * 100)} %</span>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="st-goal-name">{budgets.objectif_nom || 'Mon objectif'}</div>
              <div className="st-meta">{eur(saved)} / {target !== null ? eur(target) : '—'}{goalPct >= 1 ? ' · objectif atteint 🎉' : target !== null ? ` · encore ${eur(target - saved)}` : ''}</div>
              {weeksLeft !== null && <div className="st-meta">≈ {weeksLeft} semaine{weeksLeft > 1 ? 's' : ''} au rythme de {eur(budgets.objectif_mensuel!)} / mois</div>}
              <div className="st-edit">
                {[10, 50].map(v => <button key={v} className="ma-btn" style={{ padding: '6px 12px' }} onClick={() => addSaving(v)}>+ {v} €</button>)}
                <input className="ma-search" style={{ margin: 0, maxWidth: 110 }} inputMode="decimal" value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSaving(amt(add)) }} placeholder="Autre €" aria-label="Montant mis de côté" />
                <button className="ma-btn ghost" onClick={() => addSaving(amt(add))}>Ajouter</button>
                <button className="ma-btn ghost" onClick={() => { setGoal({ nom: budgets.objectif_nom || '', cible: target !== null ? String(target) : '', mensuel: budgets.objectif_mensuel !== null ? String(budgets.objectif_mensuel) : '' }); setGoalEdit(true) }}>Modifier</button>
                <button className="ma-btn ghost" onClick={() => onSaveBudgets({ ...budgets, objectif_nom: null, objectif_cible: null, objectif_epargne: 0, objectif_mensuel: null })}>Supprimer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="st-card" style={{ marginTop: 10 }}>
        <div className="st-label">Évolution des dépenses</div>
        <SpendingChart purchases={chartData} budget={budgets.mensuel} onPickMonth={(y, m) => { setSel({ y, m }); setMode('mois') }} />
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
.st-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 8px 0; }
.st-form label { font: 700 12px system-ui, sans-serif; color: var(--text2); display: block; }
.st-form .ma-search { margin: 4px 0 0; }
.st-bbs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; margin-top: 6px; }
.st-bb-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; flex-wrap: wrap; }
.st-bb .st-bar { position: relative; margin-top: 6px; } .st-bb .st-bar u { position: absolute; left: 80%; top: -3px; bottom: -3px; width: 2px; background: var(--text); opacity: .45; }
.st-bb.warn .st-bar i { background: #f5c451; } .st-bb.over .st-bar i { background: #d6293e; } .st-bb.over .st-meta { color: #d6293e; font-weight: 700; }
.st-goal-body { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-top: 6px; }
.st-ring { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
.st-ring span { width: 62px; height: 62px; border-radius: 50%; background: var(--bg2); display: grid; place-items: center; font: 800 15px system-ui, sans-serif; }
.st-goal-name { font: 400 22px 'Surfquest', Impact, 'Arial Narrow', sans-serif; text-transform: uppercase; line-height: 1.1; }
.st-note { font-size: 12px; color: var(--text3); margin: 10px 0 0; }
`
