'use client'
/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { EXTRA_CSS } from '@/components/AchatExtras'
import { MA_CSS, type Row, type Rates } from '@/components/MesAchatsView'
import { achatCosts, encaisse, netOf, profitOf, statsOf, suggestAchat, type Vente } from '@/lib/ventesUi'
import { matchesQuery } from '@/lib/achatsUi'

// Affichage de « Mes ventes » (sans logique réseau) : ventes eBay importées + ventes saisies à la main, net encaissé, profit
// réalisé et rendement (vente moins coût d'achat, relié automatiquement à « Mes achats » quand les titres se ressemblent).
const eur = (v: number | null, d = 2) => (v === null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: d }))
const signed = (v: number) => `${v >= 0 ? '+' : '−'}${eur(Math.abs(v))}`
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')

export type VenteForm = { titre: string; prix: string; port_facture: string; frais: string; cout_port: string; cout_achat: string; acheteur: string; vendu_at: string; source: 'vinted' | 'autre'; notes: string; achat_id: string | null }
const EMPTY: VenteForm = { titre: '', prix: '', port_facture: '', frais: '', cout_port: '', cout_achat: '', acheteur: '', vendu_at: new Date().toISOString().slice(0, 10), source: 'vinted', notes: '', achat_id: null }

type Period = 'mois' | 'annee' | 'tout'

export default function MesVentesView({
  ventes, achats, rates, connected, ebayStatut, busy, msg, now, onSync, onAdd, onPatch, onDelete, loading = false,
}: {
  ventes: Vente[]; achats: Row[]; rates: Rates; connected: boolean; ebayStatut?: string | null
  busy: boolean; msg: string | null; now: number; loading?: boolean
  onSync: () => void
  onAdd: (f: VenteForm) => Promise<string | null>
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
}) {
  const [period, setPeriod] = useState<Period>('annee')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<{ text: string; ko?: boolean } | null>(null)

  const d = new Date(now)
  const ym = d.toISOString().slice(0, 7), y = String(d.getFullYear())
  const inPeriod = (v: Vente) => period === 'tout' || (period === 'mois' ? (v.vendu_at || '').startsWith(ym) : (v.vendu_at || '').startsWith(y))
  const sorted = useMemo(() => [...ventes].sort((a, b) => (b.vendu_at || '').localeCompare(a.vendu_at || '')), [ventes])
  const list = sorted.filter(inPeriod)
  const shown = list.filter(v => matchesQuery({ titre: v.titre, vendeur: v.acheteur, tags: [], notes: v.notes } as unknown as Row, q))
  const st = statsOf(list, rates)

  const costs = useMemo(() => achatCosts(achats, rates), [achats, rates])
  const taken = new Set(ventes.map(v => v.achat_id).filter((x): x is string => !!x))
  const achatsSorted = useMemo(() => achats.filter(a => a.type === 'achat').sort((a, b) => (b.achete_at || '').localeCompare(a.achete_at || '')).slice(0, 300), [achats])

  const link = async (v: Vente, achatId: string | null) => {
    const cost = achatId ? costs.get(achatId) ?? null : null
    const err = await onPatch(v.id, { achat_id: achatId, ...(achatId && cost !== null ? { cout_achat: cost } : {}) })
    setNote(err ? { text: err, ko: true } : { text: achatId ? 'Achat relié : le profit est calculé.' : 'Lien retiré.' })
  }

  if (loading) {
    return (
      <div className="ma-wrap"><style>{MA_CSS}</style><style>{EXTRA_CSS}</style>
        <h1 style={{ margin: '0 0 20px', fontSize: 38 }}>Mes ventes</h1>
        <div className="ma-stats">{[0, 1, 2].map(k => <div key={k}><span className="ma-sk" style={{ height: 28, width: '55%' }} /><span className="ma-sk" style={{ height: 12, width: '80%', marginTop: 6 }} /></div>)}</div>
      </div>
    )
  }

  return (
    <div className="ma-wrap">
      <style>{MA_CSS}</style><style>{EXTRA_CSS}</style><style>{CSS}</style>
      <div className="ma-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 38 }}>Mes ventes</h1>
          <div className="ma-sub">{connected ? 'Ventes eBay importées automatiquement · ' : ''}Vinted, salons et échanges : ajoute-les à la main</div>
        </div>
        <div className="ma-actions">
          <button className="ma-btn" onClick={() => setAdding(true)}>+ Ajouter une vente</button>
          {connected && <button className="ma-btn" disabled={busy} onClick={onSync}>{busy ? 'Actualisation…' : 'Actualiser eBay'}</button>}
        </div>
      </div>

      {msg && <div className="ma-alert">{msg}</div>}
      {note && <div className={`ma-alert${note.ko ? '' : ' ok'}`} role="status">{note.text}</div>}
      {!connected && (
        <div className="ma-alert" style={{ borderLeftColor: '#2f6bff' }}>
          {ebayStatut === 'expire' ? 'Ta connexion eBay a expiré. ' : ''}Pour importer tes ventes eBay automatiquement, relie ton compte depuis <Link href="/mes-achats" style={{ color: '#2f6bff', fontWeight: 700 }}>Mes achats</Link>.
        </div>
      )}

      <div className="mv-bar">
        <div className="st-tabs" role="tablist" style={{ display: 'inline-flex', border: '3px solid var(--border)' }}>
          {([['mois', 'Ce mois'], ['annee', 'Cette année'], ['tout', 'Tout']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={period === k} className={`mv-tab${period === k ? ' on' : ''}`} onClick={() => setPeriod(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="ma-stats mv-stats">
        <div><span className="da-num">{st.n}</span><small>vente{st.n > 1 ? 's' : ''} · {eur(st.encaisse, 0)} encaissés</small></div>
        <div><span className="da-num">{eur(st.net, 0)}</span><small>net après frais et port ({eur(st.frais, 0)} de frais)</small></div>
        <div><span className={`da-num${st.avecCout ? (st.profit >= 0 ? ' mv-up' : ' mv-down') : ''}`}>{st.avecCout ? signed(st.profit) : '—'}</span><small>profit réalisé{st.roi !== null ? ` · rendement ${st.roi >= 0 ? '+' : '−'}${Math.abs(Math.round(st.roi * 100))} %` : ''}{st.sansCout > 0 ? ` · ${st.sansCout} vente${st.sansCout > 1 ? 's' : ''} sans coût d’achat` : ''}</small></div>
      </div>

      {sorted.length === 0 ? (
        <div className="ma-empty ma-empty-rich">
          <div className="ma-empty-ico" aria-hidden="true">💰</div>
          <b>Aucune vente pour l’instant</b>
          <p>{connected ? 'Tes ventes eBay apparaissent ici après une actualisation. Tu peux aussi ajouter une vente Vinted ou faite en salon.' : 'Relie eBay depuis Mes achats pour importer tes ventes, ou ajoute une vente à la main.'}</p>
          <div className="ma-actions" style={{ justifyContent: 'center' }}>
            {connected && <button className="ma-btn" disabled={busy} onClick={onSync}>Actualiser eBay</button>}
            <button className="ma-btn primary" onClick={() => setAdding(true)}>+ Ajouter une vente</button>
          </div>
        </div>
      ) : (
        <>
          <input className="ma-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une vente (carte, acheteur, note…)" aria-label="Rechercher dans mes ventes" />
          {shown.length === 0 && <div className="ma-empty">Aucune vente ne correspond{q.trim() ? ` à « ${q} »` : ' à cette période'}.</div>}
          <div className="ma-list">
            {shown.map(v => {
              const net = netOf(v, rates), prof = profitOf(v, rates), enc = encaisse(v, rates)
              const sug = v.cout_achat === null ? suggestAchat(v, achats, taken) : null
              const linked = v.achat_id ? achats.find(a => a.id === v.achat_id) : null
              const isOpen = open === v.id
              return (
                <article key={v.id} className={`ma-card mv-card src-${v.source === 'ebay' ? 'eb' : v.source === 'vinted' ? 'vi' : 'ot'}`}>
                  {v.photo_url ? <img className="ma-photo" src={v.photo_url} alt={v.titre || ''} loading="lazy" /> : <div className="ma-photo ma-nophoto" aria-hidden="true">🃏</div>}
                  <div className="ma-body">
                    <div className="ma-title"><span className={`ma-src ${v.source === 'ebay' ? 'eb' : v.source === 'vinted' ? 'vi' : 'ot'}`}>{v.source === 'ebay' ? 'eBay' : v.source === 'vinted' ? 'Vinted' : 'Autre'}</span>{v.titre || 'Vente'}</div>
                    <div className="ma-line">
                      <span className="da-num ma-price">{eur(enc)}</span>
                      {net !== null && <span className="ma-meta">net {eur(net)}</span>}
                      {prof !== null && <span className={`ma-gain ${prof >= 0 ? 'up' : 'down'}`}>{prof >= 0 ? '▲' : '▼'} profit {signed(prof)}{v.cout_achat ? ` (${prof >= 0 ? '+' : '−'}${Math.abs(Math.round((prof / (v.cout_achat || 1)) * 100))} %)` : ''}</span>}
                    </div>
                    <div className="ma-meta">
                      {v.acheteur ? `Acheteur : ${v.acheteur}` : ''}{v.vendu_at ? ` · vendu le ${day(v.vendu_at)}` : ''}
                      {v.frais !== null ? ` · frais ${eur(v.frais)}` : v.source === 'ebay' ? ' · frais eBay non renseignés' : ''}
                      {v.cout_port ? ` · port payé ${eur(v.cout_port)}` : ''}
                    </div>
                    {linked && <div className="ma-note wish" style={{ borderLeftColor: '#1e9e57' }}>✓ Relié à l’achat « {(linked.titre || '').slice(0, 60)} » · coût {eur(v.cout_achat)}</div>}
                    {!linked && v.cout_achat !== null && <div className="ma-meta">Coût d’achat saisi : {eur(v.cout_achat)}</div>}
                    {sug && (
                      <div className="ma-note dup">
                        Ça ressemble à ton achat « {(sug.achat.titre || '').slice(0, 60)} » ({eur(costs.get(sug.achat.id) ?? null)}){' '}
                        <button type="button" className="ma-linkbtn" onClick={() => link(v, sug.achat.id)}>Relier</button>
                      </div>
                    )}
                    {v.notes && <div className="ma-meta ma-notetxt">📝 {v.notes}</div>}
                    <div className="ma-steps">
                      <div className={`ma-step${v.vendu_at ? ' done' : ''}`}><i /><span>Vendu <em>{day(v.vendu_at)}</em></span></div>
                      <div className={`ma-step${v.paye_at ? ' done' : ''}`}><i /><span>Payé <em>{day(v.paye_at)}</em></span></div>
                      <div className={`ma-step${v.expedie_at ? ' done' : ''}`}><i /><span>{v.expedie_at ? 'Expédié' : 'À expédier'} <em>{day(v.expedie_at)}</em></span></div>
                    </div>
                    <div className="ma-links">
                      {v.lien && <a href={v.lien} target="_blank" rel="noopener noreferrer">Voir l’annonce</a>}
                      {v.lien_commande && <a href={v.lien_commande} target="_blank" rel="noopener noreferrer">Voir la commande</a>}
                      <button type="button" className="ma-linkbtn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.id)}>{isOpen ? 'Fermer' : 'Détails'}</button>
                      {v.source !== 'ebay' && <button type="button" className="ma-del" onClick={() => { if (window.confirm('Supprimer cette vente ?')) onDelete(v.id) }}>Supprimer</button>}
                    </div>
                  </div>
                  {isOpen && <VenteDetails v={v} achats={achatsSorted} costs={costs} taken={taken} onPatch={onPatch} onLink={link} onClose={() => setOpen(null)} />}
                </article>
              )
            })}
          </div>
        </>
      )}

      {adding && <AddModal achats={achatsSorted} costs={costs} taken={taken} onClose={() => setAdding(false)} onAdd={async f => { const e = await onAdd(f); if (!e) { setAdding(false); setNote({ text: 'Vente ajoutée.' }) } return e }} />}
    </div>
  )
}

function VenteDetails({ v, achats, costs, taken, onPatch, onLink, onClose }: {
  v: Vente; achats: Row[]; costs: Map<string, number>; taken: Set<string>
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<string | null>
  onLink: (v: Vente, achatId: string | null) => Promise<void>
  onClose: () => void
}) {
  const s = (n: number | null) => (n === null ? '' : String(n))
  const [frais, setFrais] = useState(s(v.frais)), [port, setPort] = useState(s(v.cout_port)), [cout, setCout] = useState(s(v.cout_achat)), [notes, setNotes] = useState(v.notes || '')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const n = (x: string) => (x.trim() === '' ? null : Number(x.replace(',', '.')))
  const bad = [frais, port, cout].some(x => { const m = n(x); return m !== null && (!Number.isFinite(m) || m < 0) })
  const save = async () => {
    if (bad) { setMsg('Montant invalide.'); return }
    setSaving(true); setMsg(null)
    const err = await onPatch(v.id, { frais: n(frais), cout_port: n(port), cout_achat: n(cout), notes })
    setSaving(false)
    if (err) setMsg(err); else onClose()
  }
  return (
    <div className="ma-det">
      <div className="ma-det-grid">
        <div className="ma-det-row"><label htmlFor={`f-${v.id}`}>Frais de la plateforme (€)</label><input id={`f-${v.id}`} className="ma-det-in" inputMode="decimal" value={frais} onChange={e => setFrais(e.target.value)} placeholder="Commission + paiement" /></div>
        <div className="ma-det-row"><label htmlFor={`p-${v.id}`}>Port payé par moi (€)</label><input id={`p-${v.id}`} className="ma-det-in" inputMode="decimal" value={port} onChange={e => setPort(e.target.value)} placeholder="Coût réel d’envoi" /></div>
        <div className="ma-det-row"><label htmlFor={`c-${v.id}`}>Coût d’achat (€)</label><input id={`c-${v.id}`} className="ma-det-in" inputMode="decimal" value={cout} onChange={e => setCout(e.target.value)} placeholder="Ce que la carte m’avait coûté" /></div>
      </div>
      <div className="ma-det-row">
        <label htmlFor={`a-${v.id}`}>Relier à un achat de « Mes achats »</label>
        <select id={`a-${v.id}`} className="ma-det-in" value={v.achat_id || ''} onChange={e => onLink(v, e.target.value || null)}>
          <option value="">Aucun</option>
          {achats.filter(a => !taken.has(a.id) || a.id === v.achat_id).map(a => <option key={a.id} value={a.id}>{(a.titre || 'Achat').slice(0, 60)} · {eur(costs.get(a.id) ?? null)}</option>)}
        </select>
      </div>
      <div className="ma-det-row"><label htmlFor={`n-${v.id}`}>Note</label><textarea id={`n-${v.id}`} className="ma-det-in" rows={2} maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} /></div>
      {msg && <div className="ma-alert" style={{ margin: 0 }}>{msg}</div>}
      <div className="ma-det-actions">
        <button type="button" className="ma-btn primary" style={{ padding: '9px 18px' }} disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="ma-btn ghost" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

function AddModal({ achats, costs, taken, onClose, onAdd }: { achats: Row[]; costs: Map<string, number>; taken: Set<string>; onClose: () => void; onAdd: (f: VenteForm) => Promise<string | null> }) {
  const [f, setF] = useState<VenteForm>(EMPTY)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof VenteForm, v: string | null) => setF(p => ({ ...p, [k]: v }))
  const submit = async () => {
    setBusy(true); setMsg(null)
    const err = await onAdd(f)
    setBusy(false)
    if (err) setMsg(err)
  }
  return (
    <div className="ma-modal" role="dialog" aria-modal="true" aria-label="Ajouter une vente" onClick={onClose}>
      <div className="ma-modal-box" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: 22 }}>Ajouter une vente</h3>
        <div className="mv-form">
          <label>Carte vendue<input className="ma-det-in" maxLength={200} value={f.titre} onChange={e => set('titre', e.target.value)} placeholder="Ex. Luka Doncic Prizm RC" /></label>
          <div className="ma-det-grid">
            <label>Prix de vente (€)<input className="ma-det-in" inputMode="decimal" value={f.prix} onChange={e => set('prix', e.target.value)} /></label>
            <label>Port facturé (€)<input className="ma-det-in" inputMode="decimal" value={f.port_facture} onChange={e => set('port_facture', e.target.value)} /></label>
            <label>Frais plateforme (€)<input className="ma-det-in" inputMode="decimal" value={f.frais} onChange={e => set('frais', e.target.value)} /></label>
            <label>Port payé par moi (€)<input className="ma-det-in" inputMode="decimal" value={f.cout_port} onChange={e => set('cout_port', e.target.value)} /></label>
          </div>
          <div className="ma-det-grid">
            <label>Plateforme<select className="ma-det-in" value={f.source} onChange={e => set('source', e.target.value)}><option value="vinted">Vinted</option><option value="autre">Autre (salon, échange…)</option></select></label>
            <label>Date de vente<input className="ma-det-in" type="date" value={f.vendu_at} onChange={e => set('vendu_at', e.target.value)} /></label>
            <label>Acheteur<input className="ma-det-in" maxLength={80} value={f.acheteur} onChange={e => set('acheteur', e.target.value)} /></label>
          </div>
          <label>Relier à un achat (pour le profit)
            <select className="ma-det-in" value={f.achat_id || ''} onChange={e => { const id = e.target.value || null; setF(p => ({ ...p, achat_id: id, cout_achat: id ? String(costs.get(id) ?? '') : p.cout_achat })) }}>
              <option value="">Aucun</option>
              {achats.filter(a => !taken.has(a.id)).map(a => <option key={a.id} value={a.id}>{(a.titre || 'Achat').slice(0, 60)} · {eur(costs.get(a.id) ?? null)}</option>)}
            </select>
          </label>
          <label>Coût d’achat (€)<input className="ma-det-in" inputMode="decimal" value={f.cout_achat} onChange={e => set('cout_achat', e.target.value)} placeholder="Rempli automatiquement si relié" /></label>
        </div>
        {msg && <div className="ma-alert" style={{ marginTop: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="ma-btn primary" style={{ padding: '10px 18px' }} disabled={busy} onClick={submit}>{busy ? 'Enregistrement…' : 'Enregistrer la vente'}</button>
          <button className="ma-btn ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.mv-bar { margin-bottom: 14px; }
.mv-tab { background: transparent; border: 0; color: var(--text2); font: 800 12px system-ui, sans-serif; letter-spacing: .06em; text-transform: uppercase; padding: 8px 16px; cursor: pointer; }
.mv-tab.on { background: #2f6bff; color: #fff; }
.mv-stats .da-num { font-size: 26px; } .mv-up { color: #1e9e57 !important; } .mv-down { color: #d6293e !important; }
.mv-card.src-ot { border-left: 6px solid #8a6cf0; } .ma-src.ot { background: #8a6cf0; }
.mv-form { display: flex; flex-direction: column; gap: 10px; } .mv-form label { font: 700 12px system-ui, sans-serif; color: var(--text2); display: block; } .mv-form .ma-det-in { margin-top: 4px; }
.mv-card .ma-det { flex-basis: 100%; }
`
