'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react'
import type { Row } from '@/components/MesAchatsView'
import { ALERT_LABELS, type AlertPrefs } from '@/lib/achatsAlertPrefs'
import { CARRIER_NAMES } from '@/lib/achatsUi'

// Petits composants de « Mes achats » : diaporama photo, compte à rebours en direct, panneau de détails perso (étiquettes,
// notes, suivi de colis, valeur estimée, comparaison au marché), journal d'activité, réglages d'alertes, squelettes de chargement.

// ── Diaporama photo (clic sur une photo) ────────────────────────────────────
export type LightItem = { src: string; title: string }

export function Lightbox({ items, start, onClose }: { items: LightItem[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(Math.max(start, 0), items.length - 1))
  const go = (d: number) => setI(x => (x + d + items.length) % items.length)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])
  const it = items[i]
  if (!it) return null
  return (
    <div className="ma-modal ma-lb" role="dialog" aria-modal="true" aria-label="Photo en grand" onClick={onClose}>
      {items.length > 1 && <button className="ma-lb-nav l" aria-label="Photo précédente" onClick={e => { e.stopPropagation(); go(-1) }}>‹</button>}
      <figure className="ma-lb-fig" onClick={e => e.stopPropagation()}>
        <img src={it.src} alt={it.title} />
        <figcaption>{it.title}{items.length > 1 ? ` · ${i + 1} / ${items.length}` : ''}</figcaption>
      </figure>
      {items.length > 1 && <button className="ma-lb-nav r" aria-label="Photo suivante" onClick={e => { e.stopPropagation(); go(1) }}>›</button>}
      <button className="ma-lb-x" aria-label="Fermer" onClick={onClose}>×</button>
    </div>
  )
}

// ── Compte à rebours : à la seconde sous 1 h, barre qui se vide (rouge sous 1 h) ─
export function Clock({ fin, now }: { fin: string; now: number }) {
  const [tick, setTick] = useState(now)
  const ms = new Date(fin).getTime() - tick
  const fast = ms > 0 && ms < 3600000
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), fast ? 1000 : 30000)
    return () => clearInterval(id)
  }, [fast, fin])
  if (ms <= 0) return <div className="ma-clock">⏱ Terminée — résultat à la prochaine actualisation</div>
  const s = Math.floor(ms / 1000), min = Math.floor(s / 60), h = Math.floor(min / 60), d = Math.floor(h / 24)
  const text = fast ? `${String(min).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : d >= 1 ? `${d} j ${h % 24} h` : `${h} h ${String(min % 60).padStart(2, '0')}`
  const tone = ms < 3600000 ? 'r' : ms < 6 * 3600000 ? 'o' : 'b'
  return (
    <>
      <div className={`ma-clock${fast ? ' urgent' : ''}`}>⏱ Fin dans <span className="ma-tick">{text}</span></div>
      <div className="ma-timebar" aria-hidden="true"><i className={tone} style={{ width: `${Math.max(2, Math.min(100, (ms / 86400000) * 100))}%` }} /></div>
    </>
  )
}

// ── Squelette de chargement (mêmes blocs que la vraie page) ─────────────────
export function MesAchatsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="ma-stats">{[0, 1, 2].map(k => <div key={k}><span className="ma-sk" style={{ height: 28, width: '55%' }} /><span className="ma-sk" style={{ height: 12, width: '80%', marginTop: 6 }} /></div>)}</div>
      <div className="ma-grid">{[0, 1, 2, 3].map(k => (
        <div key={k} className="ma-card"><div className="ma-sk" style={{ width: 110, height: 110, flexShrink: 0 }} />
          <div className="ma-body"><span className="ma-sk" style={{ height: 14, width: '85%' }} /><span className="ma-sk" style={{ height: 24, width: '35%' }} /><span className="ma-sk" style={{ height: 12, width: '60%' }} /><span className="ma-sk" style={{ height: 12, width: '45%' }} /></div></div>
      ))}</div>
    </div>
  )
}

// ── Panneau « Détails » d'un achat ──────────────────────────────────────────
export type Compare = { median: number; n: number }
const TAG_IDEAS = ['à-grader', 'revendre', 'cadeau', 'à-vérifier']

export function DetailsPanel({ row, ids, priceEur, onPatch, onCompare, onClose }: {
  row: Row; ids: string[]; priceEur: number | null
  onPatch: (ids: string[], patch: Record<string, unknown>) => Promise<string | null>
  onCompare?: (titre: string) => Promise<Compare | null>
  onClose: () => void
}) {
  const [tags, setTags] = useState<string[]>(row.tags || [])
  const [tag, setTag] = useState('')
  const [notes, setNotes] = useState(row.notes || '')
  const [carrier, setCarrier] = useState(row.transporteur || '')
  const [num, setNum] = useState(row.suivi_numero || '')
  const [val, setVal] = useState(row.valeur_estimee != null ? String(row.valeur_estimee) : '')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [cmp, setCmp] = useState<null | 'loading' | 'none' | Compare>(null)

  const addTag = (t: string) => {
    const c = t.trim().replace(/^#/, '').toLowerCase().slice(0, 24)
    if (c && !tags.includes(c) && tags.length < 12) setTags([...tags, c])
    setTag('')
  }
  const save = async () => {
    const v = val.trim() === '' ? null : Number(val.replace(',', '.'))
    if (v !== null && (!Number.isFinite(v) || v < 0)) { setMsg('Valeur estimée invalide.'); return }
    setSaving(true); setMsg(null)
    const err = await onPatch(ids, { tags, notes, transporteur: carrier, suivi_numero: num, valeur_estimee: v })
    setSaving(false)
    if (err) setMsg(err); else onClose()
  }
  const compare = async () => {
    if (!onCompare || !row.titre) return
    setCmp('loading')
    const r = await onCompare(row.titre)
    setCmp(r && r.n > 0 ? r : 'none')
  }
  const diff = cmp && typeof cmp === 'object' && priceEur !== null && cmp.median > 0 ? Math.round(((priceEur - cmp.median) / cmp.median) * 100) : null
  const money = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  return (
    <div className="ma-det">
      <div className="ma-det-row">
        <label>Étiquettes</label>
        <div className="ma-chips">
          {tags.map(t => <button key={t} type="button" className="ma-chip on" onClick={() => setTags(tags.filter(x => x !== t))} title="Retirer">#{t} ×</button>)}
          <input className="ma-det-in" value={tag} maxLength={24} placeholder="+ étiquette" aria-label="Ajouter une étiquette"
            onChange={e => setTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tag) } }} onBlur={() => tag.trim() && addTag(tag)} />
        </div>
        <div className="ma-chips">{TAG_IDEAS.filter(t => !tags.includes(t)).map(t => <button key={t} type="button" className="ma-chip" onClick={() => addTag(t)}>#{t}</button>)}</div>
      </div>

      <div className="ma-det-row">
        <label htmlFor={`n-${row.id}`}>Note perso</label>
        <textarea id={`n-${row.id}`} className="ma-det-in" rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex. coins à vérifier avant l’envoi en gradation" />
      </div>

      <div className="ma-det-grid">
        <div className="ma-det-row">
          <label htmlFor={`c-${row.id}`}>Transporteur</label>
          <input id={`c-${row.id}`} className="ma-det-in" list={`cl-${row.id}`} value={carrier} maxLength={40} onChange={e => setCarrier(e.target.value)} placeholder="Colissimo, Mondial Relay…" />
          <datalist id={`cl-${row.id}`}>{CARRIER_NAMES.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="ma-det-row">
          <label htmlFor={`s-${row.id}`}>N° de suivi</label>
          <input id={`s-${row.id}`} className="ma-det-in" value={num} maxLength={60} onChange={e => setNum(e.target.value)} placeholder="6A12345678901" />
        </div>
        <div className="ma-det-row">
          <label htmlFor={`v-${row.id}`}>Valeur estimée (€)</label>
          <input id={`v-${row.id}`} className="ma-det-in" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} placeholder="Ce que ça vaut aujourd’hui" />
        </div>
      </div>

      {onCompare && row.titre && (
        <div className="ma-det-row">
          <button type="button" className="ma-btn ghost" disabled={cmp === 'loading'} onClick={compare}>{cmp === 'loading' ? 'Recherche des ventes…' : 'Comparer au marché'}</button>
          {cmp === 'none' && <div className="ma-meta">Pas assez de ventes récentes trouvées pour cette annonce.</div>}
          {cmp && typeof cmp === 'object' && (
            <div className="ma-cmp">
              <div>Médiane des ventes récentes : <b>{money(cmp.median)}</b> <span className="ma-meta">({cmp.n} vente{cmp.n > 1 ? 's' : ''})</span></div>
              {diff !== null && (
                <div className={`ma-verdict ${diff <= -10 ? 'ok' : diff >= 10 ? 'ko' : ''}`}>
                  {diff <= -10 ? `Bonne affaire : ${Math.abs(diff)} % sous le marché` : diff >= 10 ? `${diff} % au-dessus du marché` : 'Dans le prix du marché'}
                  {priceEur !== null && <span className="ma-meta"> · tu as payé {money(priceEur)} l’article</span>}
                </div>
              )}
              <button type="button" className="ma-linkbtn" onClick={() => setVal(String(cmp.median))}>Utiliser comme valeur estimée</button>
            </div>
          )}
        </div>
      )}

      {msg && <div className="ma-alert" style={{ margin: '8px 0 0' }}>{msg}</div>}
      <div className="ma-det-actions">
        <button type="button" className="ma-btn primary" style={{ padding: '9px 18px' }} disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="ma-btn ghost" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

// ── Journal d'activité ──────────────────────────────────────────────────────
export type LogEvent = { t: number; icon: string; texte: string }

export function ActivityLog({ events }: { events: LogEvent[] }) {
  const [all, setAll] = useState(false)
  if (!events.length) return <div className="ma-empty">Rien pour l’instant : les événements (surenchères, expéditions, réceptions…) apparaîtront ici.</div>
  const shown = all ? events : events.slice(0, 10)
  const fmt = (t: number) => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div className="ma-log">
      {shown.map((e, i) => <div key={i} className="ma-log-row"><span className="ma-log-t">{fmt(e.t)}</span><span aria-hidden="true">{e.icon}</span><span>{e.texte}</span></div>)}
      {events.length > 10 && <button type="button" className="ma-linkbtn" onClick={() => setAll(a => !a)}>{all ? 'Voir moins' : `Voir les ${events.length - 10} autres`}</button>}
    </div>
  )
}

// ── Réglages d'alertes ──────────────────────────────────────────────────────
export function PrefsModal({ prefs, onSave, onClose }: { prefs: AlertPrefs; onSave: (p: AlertPrefs) => void; onClose: () => void }) {
  const [p, setP] = useState<AlertPrefs>(prefs)
  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <div className="ma-modal" role="dialog" aria-modal="true" aria-label="Réglages des alertes" onClick={onClose}>
      <div className="ma-modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 22 }}>Alertes</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>Choisis ce que tu veux recevoir. Les alertes arrivent dans la cloche et en notification sur ton téléphone.</p>
        {ALERT_LABELS.map(a => (
          <label key={a.kind} className="ma-pref">
            <span><b>{a.label}</b><small>{a.sub}</small></span>
            <input type="checkbox" checked={p[a.kind]} onChange={e => setP({ ...p, [a.kind]: e.target.checked })} />
          </label>
        ))}
        <label className="ma-pref">
          <span><b>Ne pas déranger</b><small>Pas de notification sur le téléphone pendant cette plage (la cloche garde tout)</small></span>
          <input type="checkbox" checked={p.nuit} onChange={e => setP({ ...p, nuit: e.target.checked })} />
        </label>
        {p.nuit && (
          <div className="ma-pref-hours">
            de <select value={p.nuitDebut} onChange={e => setP({ ...p, nuitDebut: Number(e.target.value) })} aria-label="Début">{hours.map(h => <option key={h} value={h}>{h} h</option>)}</select>
            à <select value={p.nuitFin} onChange={e => setP({ ...p, nuitFin: Number(e.target.value) })} aria-label="Fin">{hours.map(h => <option key={h} value={h}>{h} h</option>)}</select>
            <small>(heure de Paris)</small>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="ma-btn primary" style={{ padding: '10px 18px' }} onClick={() => { onSave(p); onClose() }}>Enregistrer</button>
          <button className="ma-btn ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

export const EXTRA_CSS = `
.ma-sk { display: block; background: linear-gradient(90deg, var(--bg3) 25%, var(--border) 50%, var(--bg3) 75%); background-size: 400px 100%; animation: ma-shim 1.3s linear infinite; }
@keyframes ma-shim { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
.ma-lb { background: rgba(0,0,0,.86); }
.ma-lb-fig { margin: 0; max-width: min(92vw, 900px); max-height: 92vh; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ma-lb-fig img { max-width: 100%; max-height: 80vh; object-fit: contain; background: none !important; animation: none !important; }
.ma-lb-fig figcaption { color: #fff; font-size: 13px; text-align: center; }
.ma-lb-nav, .ma-lb-x { position: fixed; background: rgba(0,0,0,.5); color: #fff; border: 3px solid #fff; font: 800 26px system-ui; width: 48px; height: 48px; cursor: pointer; border-radius: 0; }
.ma-lb-nav { top: 50%; transform: translateY(-50%); } .ma-lb-nav.l { left: 12px; } .ma-lb-nav.r { right: 12px; }
.ma-lb-x { top: 12px; right: 12px; }
.ma-photo.zoom { cursor: zoom-in; }
.ma-tick { font-variant-numeric: tabular-nums; }
.ma-clock.urgent { animation: ma-pulse 1s ease-in-out infinite; }
@keyframes ma-pulse { 50% { opacity: .6; } }
.ma-timebar { height: 6px; background: var(--bg3); margin-top: 2px; }
.ma-timebar i { display: block; height: 100%; transition: width 1s linear; }
.ma-timebar i.b { background: #2f6bff; } .ma-timebar i.o { background: #c98a12; } .ma-timebar i.r { background: #d6293e; }
.ma-det { border-top: 3px solid var(--border); margin-top: 8px; padding-top: 10px; display: flex; flex-direction: column; gap: 10px; flex-basis: 100%; }
.ma-det label { font: 800 11px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--text2); display: block; margin-bottom: 4px; }
.ma-det-in { width: 100%; box-sizing: border-box; border: 3px solid var(--border); background: var(--input-bg); color: var(--text); font: 600 13px system-ui, sans-serif; padding: 8px 10px; border-radius: 0; }
.ma-det-in:focus { outline: none; border-color: #2f6bff; }
.ma-det-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
.ma-det-actions { display: flex; gap: 8px; }
.ma-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 4px; }
.ma-chips .ma-det-in { width: auto; flex: 1 1 110px; padding: 5px 8px; }
.ma-chip { border: 2px solid var(--border); background: var(--bg2); color: var(--text2); font: 800 11px system-ui, sans-serif; padding: 3px 8px; cursor: pointer; border-radius: 0; }
.ma-chip.on { background: #2f6bff; border-color: #2f6bff; color: #fff; }
.ma-cmp { margin-top: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
.ma-verdict { font-weight: 800; } .ma-verdict.ok { color: #1e9e57; } .ma-verdict.ko { color: #d6293e; }
.ma-linkbtn { background: none; border: 0; padding: 0; color: #2f6bff; font: 800 12px system-ui, sans-serif; letter-spacing: .05em; text-transform: uppercase; cursor: pointer; text-align: left; }
.ma-log { border: 3px solid var(--border); background: var(--bg2); padding: 8px 14px; display: flex; flex-direction: column; gap: 2px; }
.ma-log-row { display: grid; grid-template-columns: 112px 22px 1fr; gap: 6px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--border); }
.ma-log-row:last-of-type { border-bottom: 0; }
.ma-log-t { color: var(--text3); font-size: 12px; }
.ma-pref { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
.ma-pref span { display: flex; flex-direction: column; gap: 2px; font-size: 14px; } .ma-pref small { color: var(--text2); font-size: 12px; }
.ma-pref input { width: 22px; height: 22px; flex-shrink: 0; accent-color: #2f6bff; }
.ma-pref-hours { display: flex; gap: 8px; align-items: center; padding: 10px 0; font-size: 13px; }
.ma-pref-hours select { border: 3px solid var(--border); background: var(--input-bg); color: var(--text); padding: 5px; font: 700 13px system-ui, sans-serif; }
@media (max-width: 520px) { .ma-log-row { grid-template-columns: 1fr; gap: 0; } .ma-log-row span:nth-child(2) { display: none; } }
`
