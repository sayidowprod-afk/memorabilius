'use client'
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { EXTRA_CSS } from '@/components/AchatExtras'
import { MA_CSS } from '@/components/MesAchatsView'
import { askConfirm } from '@/components/ConfirmHost'

// Suivi des envois en gradation : chaque envoi (PSA, BGS, CGC…) avec ses cartes, ses dates, son coût et son retour estimé.
// Quand les cartes reviennent, la note et le n° de certificat peuvent être reportés sur les fiches de la collection.
export type Statut = 'prepare' | 'envoye' | 'recu' | 'en_grading' | 'retourne' | 'termine'
export type EnvoiCarte = { id: string; carte_id: string | null; titre: string; photo_url: string | null; valeur_declaree: number | null; note_obtenue: string | null; numero_cert: string | null }
export type Envoi = {
  id: string; societe: string; reference: string | null; service: string | null; statut: Statut
  date_envoi: string | null; date_reception: string | null; date_retour_estimee: string | null; date_retour: string | null
  cout_total: number | null; suivi_aller: string | null; suivi_retour: string | null; notes: string | null; cartes: EnvoiCarte[]
}
export type CarteChoix = { id: string; nom: string | null; annee: string | null; collection: string | null; image_recto: string | null }

export const STATUTS: Array<{ k: Statut; label: string; color: string; date?: keyof Envoi }> = [
  { k: 'prepare', label: 'Préparé', color: '#3a4577' },
  { k: 'envoye', label: 'Envoyé', color: '#2f6bff', date: 'date_envoi' },
  { k: 'recu', label: 'Reçu par la société', color: '#09b1ba', date: 'date_reception' },
  { k: 'en_grading', label: 'En gradation', color: '#c98a12' },
  { k: 'retourne', label: 'Retourné', color: '#8a6cf0', date: 'date_retour' },
  { k: 'termine', label: 'Terminé', color: '#1e9e57' },
]
const SOCIETES = ['PSA', 'BGS', 'CGC', 'SGC', 'PCA', 'Autre']
const DAY = 86400000
const eur = (v: number | null) => (v === null ? '—' : v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }))
const dfmt = (s: string | null) => (s ? new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const idx = (s: Statut) => STATUTS.findIndex(x => x.k === s)

export type EnvoiDraft = Omit<Envoi, 'id'> & { id?: string }
export const NEW_ENVOI = (): EnvoiDraft => ({ societe: 'PSA', reference: null, service: null, statut: 'prepare', date_envoi: null, date_reception: null, date_retour_estimee: null, date_retour: null, cout_total: null, suivi_aller: null, suivi_retour: null, notes: null, cartes: [] })

// Retour attendu : jours restants (négatif = en retard). null si pas de date ou envoi déjà revenu.
function retour(e: Envoi, now: number): { jours: number; retard: boolean } | null {
  if (!e.date_retour_estimee || e.statut === 'retourne' || e.statut === 'termine') return null
  const j = Math.ceil((new Date(e.date_retour_estimee + 'T12:00:00').getTime() - now) / DAY)
  return { jours: j, retard: j < 0 }
}

export default function EnvoisGradationView({
  envois, now, loading = false, msg, onSave, onDelete, onStatus, onApply, onSearch,
}: {
  envois: Envoi[]; now: number; loading?: boolean; msg: string | null
  onSave: (d: EnvoiDraft) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
  onStatus: (e: Envoi, s: Statut) => Promise<string | null>
  onApply: (e: Envoi) => Promise<string | null>
  onSearch: (q: string) => Promise<CarteChoix[]>
}) {
  const [editing, setEditing] = useState<EnvoiDraft | null>(null)
  const [note, setNote] = useState<{ text: string; ko?: boolean } | null>(null)
  const [filtre, setFiltre] = useState<'cours' | 'termines' | 'tous'>('cours')
  const flash = (err: string | null, ok: string) => setNote(err ? { text: err, ko: true } : { text: ok })
  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(null), 6000); return () => clearTimeout(id) }, [note])

  const enCours = envois.filter(e => e.statut !== 'termine')
  const cartesEnCours = enCours.reduce((a, e) => a + e.cartes.length, 0)
  const annee = new Date(now).getFullYear()
  const coutAnnee = envois.filter(e => (e.date_envoi || '').startsWith(String(annee))).reduce((a, e) => a + (e.cout_total || 0), 0)
  const retards = enCours.filter(e => retour(e, now)?.retard).length
  const shown = envois.filter(e => filtre === 'tous' || (filtre === 'cours' ? e.statut !== 'termine' : e.statut === 'termine'))

  if (loading) return (
    <div className="ma-wrap"><style>{MA_CSS}</style><style>{EXTRA_CSS}</style>
      <h1 style={{ margin: '0 0 20px', fontSize: 38 }}>Suivi gradation</h1>
      <div className="ma-stats">{[0, 1, 2].map(k => <div key={k}><span className="ma-sk" style={{ height: 28, width: '55%' }} /><span className="ma-sk" style={{ height: 12, width: '80%', marginTop: 6 }} /></div>)}</div>
    </div>
  )

  return (
    <div className="ma-wrap">
      <style>{MA_CSS}</style><style>{EXTRA_CSS}</style><style>{CSS}</style>
      <div className="ma-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 38 }}>Suivi gradation</h1>
          <div className="ma-sub">Tes envois chez PSA, BGS, CGC… et leur retour. <Link href="/gradation" style={{ color: '#2f6bff', fontWeight: 700 }}>Estimer l’état d’une carte avant l’envoi</Link></div>
        </div>
        <div className="ma-actions"><button className="ma-btn primary" onClick={() => setEditing(NEW_ENVOI())}>+ Nouvel envoi</button></div>
      </div>

      {msg && <div className="ma-alert">{msg}</div>}
      {note && <div className={`ma-alert${note.ko ? '' : ' ok'}`} role="status">{note.text}</div>}

      <div className="ma-stats">
        <div><span className="da-num">{enCours.length}</span><small>envoi{enCours.length > 1 ? 's' : ''} en cours · {cartesEnCours} carte{cartesEnCours > 1 ? 's' : ''}</small></div>
        <div><span className="da-num" style={retards ? { color: '#d6293e' } : undefined}>{retards}</span><small>retard{retards > 1 ? 's' : ''} sur le retour estimé</small></div>
        <div><span className="da-num">{eur(coutAnnee || null)}</span><small>de frais de gradation en {annee}</small></div>
      </div>

      {envois.length > 0 && (
        <div className="ma-filters">
          {([['cours', 'En cours'], ['termines', 'Terminés'], ['tous', 'Tous']] as const).map(([k, l]) => <button key={k} type="button" className={`ma-fchip${filtre === k ? ' on' : ''}`} aria-pressed={filtre === k} onClick={() => setFiltre(k)}>{l}</button>)}
        </div>
      )}

      {envois.length === 0 ? (
        <div className="ma-empty ma-empty-rich">
          <div className="ma-empty-ico" aria-hidden="true">📮</div>
          <b>Aucun envoi pour l’instant</b>
          <p>Note ici les cartes que tu envoies en gradation : dates, n° de dossier, coût et retour estimé. À leur retour, la note se reporte sur tes fiches.</p>
          <button className="ma-btn primary" onClick={() => setEditing(NEW_ENVOI())}>+ Nouvel envoi</button>
        </div>
      ) : shown.length === 0 ? <div className="ma-empty">Aucun envoi dans cette catégorie.</div> : (
        <div className="ma-list">
          {shown.map(e => {
            const si = idx(e.statut), next = STATUTS[si + 1], r = retour(e, now)
            const graded = e.cartes.filter(c => c.note_obtenue)
            const canApply = (e.statut === 'retourne' || e.statut === 'termine') && e.cartes.some(c => c.carte_id && c.note_obtenue)
            return (
              <article key={e.id} className="ma-card eg-card">
                <div className="ma-body">
                  <div className="ma-line">
                    <span className="ma-src" style={{ background: '#3a4577', marginRight: 0 }}>{e.societe}</span>
                    <b className="eg-ref">{e.reference ? `Dossier ${e.reference}` : 'Sans n° de dossier'}</b>
                    <span className="ma-tag" style={{ background: STATUTS[si].color }}>{STATUTS[si].label}</span>
                    {e.service && <span className="ma-meta">{e.service}</span>}
                  </div>
                  <div className="ma-meta">
                    {e.cartes.length} carte{e.cartes.length > 1 ? 's' : ''}{e.cout_total !== null ? ` · ${eur(e.cout_total)}` : ''}
                    {e.date_envoi ? ` · envoyé le ${dfmt(e.date_envoi)}` : ''}
                    {graded.length ? ` · ${graded.length} note${graded.length > 1 ? 's' : ''} reçue${graded.length > 1 ? 's' : ''}` : ''}
                  </div>
                  {r && <div className={`ma-clock${r.retard ? ' urgent' : ''}`}>⏱ {r.retard ? `En retard de ${Math.abs(r.jours)} j` : r.jours === 0 ? 'Retour estimé aujourd’hui' : `Retour estimé dans ${r.jours} j`} ({dfmt(e.date_retour_estimee)})</div>}
                  <div className="eg-steps" aria-label="Avancement">
                    {STATUTS.map((s, i) => <div key={s.k} className={`eg-step${i <= si ? ' done' : ''}${i === si ? ' now' : ''}`}><i /><span>{s.label}</span></div>)}
                  </div>
                  {e.cartes.length > 0 && (
                    <div className="eg-cartes">
                      {e.cartes.slice(0, 8).map(c => (
                        <div key={c.id} className="eg-mini" title={c.titre}>
                          {c.photo_url ? <img src={c.photo_url} alt="" /> : <span aria-hidden="true">🃏</span>}
                          {c.note_obtenue && <b className="eg-note">{c.note_obtenue}</b>}
                        </div>
                      ))}
                      {e.cartes.length > 8 && <span className="ma-meta">+{e.cartes.length - 8}</span>}
                    </div>
                  )}
                  {e.notes && <div className="ma-meta ma-notetxt">📝 {e.notes}</div>}
                  <div className="ma-links">
                    {next && e.statut !== 'termine' && <button type="button" className="ma-linkbtn" onClick={async () => flash(await onStatus(e, next.k), `Statut : ${next.label}.`)}>→ Marquer « {next.label} »</button>}
                    {canApply && <button type="button" className="ma-linkbtn" onClick={async () => flash(await onApply(e), 'Notes reportées sur tes fiches.')}>Reporter les notes sur mes fiches</button>}
                    <button type="button" className="ma-linkbtn" onClick={() => setEditing({ ...e })}>Modifier</button>
                    <button type="button" className="ma-del" onClick={async () => { if (await askConfirm('Supprimer cet envoi ?', { danger: true, confirmLabel: 'Supprimer' })) onDelete(e.id) }}>Supprimer</button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing && <EnvoiModal draft={editing} onClose={() => setEditing(null)} onSearch={onSearch}
        onSave={async d => { const err = await onSave(d); if (!err) { setEditing(null); setNote({ text: 'Envoi enregistré.' }) } return err }} />}
    </div>
  )
}

const numOrNull = (s: string): number | null | undefined => {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n < 1000000 ? Math.round(n * 100) / 100 : undefined
}
const tmpId = () => 'new-' + Math.random().toString(36).slice(2, 10)

function EnvoiModal({ draft, onClose, onSave, onSearch }: { draft: EnvoiDraft; onClose: () => void; onSave: (d: EnvoiDraft) => Promise<string | null>; onSearch: (q: string) => Promise<CarteChoix[]> }) {
  const [d, setD] = useState<EnvoiDraft>(draft)
  const [cout, setCout] = useState(draft.cout_total === null ? '' : String(draft.cout_total))
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(draft.cartes.map(c => [c.id, c.valeur_declaree === null ? '' : String(c.valeur_declaree)])))
  const [q, setQ] = useState('')
  const [found, setFound] = useState<CarteChoix[]>([])
  const [free, setFree] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = <K extends keyof EnvoiDraft>(k: K, v: EnvoiDraft[K]) => setD(p => ({ ...p, [k]: v }))
  const str = (v: string) => (v.trim() === '' ? null : v.trim())
  const dateStr = (v: string | null) => v || ''

  const search = (v: string) => {
    setQ(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.trim().length < 2) { setFound([]); return }
    timer.current = setTimeout(async () => setFound(await onSearch(v.trim())), 300)
  }
  const addCarte = (c: Partial<EnvoiCarte> & { titre: string }) => {
    const id = tmpId()
    setD(p => ({ ...p, cartes: [...p.cartes, { id, carte_id: null, photo_url: null, valeur_declaree: null, note_obtenue: null, numero_cert: null, ...c }] }))
  }
  const patchCarte = (id: string, patch: Partial<EnvoiCarte>) => setD(p => ({ ...p, cartes: p.cartes.map(c => (c.id === id ? { ...c, ...patch } : c)) }))

  const submit = async () => {
    const c = numOrNull(cout)
    if (c === undefined) { setMsg('Coût invalide.'); return }
    const cartes: EnvoiCarte[] = []
    for (const k of d.cartes) {
      const v = numOrNull(vals[k.id] ?? '')
      if (v === undefined) { setMsg(`Valeur déclarée invalide : ${k.titre}`); return }
      if (!k.titre.trim()) { setMsg('Chaque carte doit avoir un titre.'); return }
      cartes.push({ ...k, valeur_declaree: v })
    }
    setBusy(true); setMsg(null)
    const err = await onSave({ ...d, cout_total: c, cartes })
    setBusy(false)
    if (err) setMsg(err)
  }

  return (
    <div className="ma-modal" role="dialog" aria-modal="true" aria-label={d.id ? 'Modifier l’envoi' : 'Nouvel envoi'} onClick={onClose}>
      <div className="ma-modal-box" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: 22 }}>{d.id ? 'Modifier l’envoi' : 'Nouvel envoi en gradation'}</h3>
        <div className="eg-form">
          <div className="ma-det-grid">
            <label>Société<select className="ma-det-in" value={d.societe} onChange={e => set('societe', e.target.value)}>{SOCIETES.map(s => <option key={s}>{s}</option>)}</select></label>
            <label>N° de dossier<input className="ma-det-in" maxLength={60} value={d.reference || ''} onChange={e => set('reference', str(e.target.value))} /></label>
            <label>Service<input className="ma-det-in" maxLength={60} value={d.service || ''} onChange={e => set('service', str(e.target.value))} placeholder="Value, Regular, Express…" /></label>
          </div>
          <div className="ma-det-grid">
            <label>Statut<select className="ma-det-in" value={d.statut} onChange={e => set('statut', e.target.value as Statut)}>{STATUTS.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}</select></label>
            <label>Coût total (€)<input className="ma-det-in" inputMode="decimal" value={cout} onChange={e => setCout(e.target.value)} placeholder="Gradation + port + assurance" /></label>
          </div>
          <div className="ma-det-grid">
            <label>Date d’envoi<input className="ma-det-in" type="date" value={dateStr(d.date_envoi)} onChange={e => set('date_envoi', e.target.value || null)} /></label>
            <label>Reçu par la société<input className="ma-det-in" type="date" value={dateStr(d.date_reception)} onChange={e => set('date_reception', e.target.value || null)} /></label>
            <label>Retour estimé<input className="ma-det-in" type="date" value={dateStr(d.date_retour_estimee)} onChange={e => set('date_retour_estimee', e.target.value || null)} /></label>
            <label>Retour chez moi<input className="ma-det-in" type="date" value={dateStr(d.date_retour)} onChange={e => set('date_retour', e.target.value || null)} /></label>
          </div>
          <div className="ma-det-grid">
            <label>Suivi du colis aller<input className="ma-det-in" maxLength={80} value={d.suivi_aller || ''} onChange={e => set('suivi_aller', str(e.target.value))} /></label>
            <label>Suivi du colis retour<input className="ma-det-in" maxLength={80} value={d.suivi_retour || ''} onChange={e => set('suivi_retour', str(e.target.value))} /></label>
          </div>
          <label>Note<textarea className="ma-det-in" rows={2} maxLength={500} value={d.notes || ''} onChange={e => set('notes', str(e.target.value))} /></label>

          <div className="eg-sec">Cartes de l’envoi ({d.cartes.length})</div>
          {d.cartes.map(c => (
            <div key={c.id} className="eg-row">
              {c.photo_url ? <img className="eg-thumb" src={c.photo_url} alt="" /> : <span className="eg-thumb eg-nothumb" aria-hidden="true">🃏</span>}
              <div className="eg-fields">
                <input className="ma-det-in" maxLength={200} value={c.titre} onChange={e => patchCarte(c.id, { titre: e.target.value })} aria-label="Titre de la carte" />
                <div className="eg-inline">
                  <input className="ma-det-in" inputMode="decimal" value={vals[c.id] ?? ''} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))} placeholder="Valeur déclarée €" aria-label="Valeur déclarée" />
                  <input className="ma-det-in" maxLength={20} value={c.note_obtenue || ''} onChange={e => patchCarte(c.id, { note_obtenue: str(e.target.value) })} placeholder="Note obtenue (9, 9.5…)" aria-label="Note obtenue" />
                  <input className="ma-det-in" maxLength={30} value={c.numero_cert || ''} onChange={e => patchCarte(c.id, { numero_cert: str(e.target.value) })} placeholder="N° de certificat" aria-label="Numéro de certificat" />
                </div>
              </div>
              <button type="button" className="ma-del" aria-label="Retirer la carte" onClick={() => setD(p => ({ ...p, cartes: p.cartes.filter(x => x.id !== c.id) }))}>×</button>
            </div>
          ))}
          <div className="eg-add">
            <input className="ma-det-in" value={q} onChange={e => search(e.target.value)} placeholder="Chercher dans ma collection (nom du joueur…)" aria-label="Chercher une carte de ma collection" />
            {found.length > 0 && (
              <div className="eg-found">
                {found.map(c => (
                  <button key={c.id} type="button" className="eg-pick" onClick={() => { addCarte({ carte_id: c.id, titre: [c.nom, c.annee, c.collection].filter(Boolean).join(' · ') || 'Carte', photo_url: c.image_recto }); setQ(''); setFound([]) }}>
                    {c.image_recto ? <img src={c.image_recto} alt="" /> : <span aria-hidden="true">🃏</span>}<span>{[c.nom, c.annee, c.collection].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="eg-inline" style={{ marginTop: 6 }}>
              <input className="ma-det-in" maxLength={200} value={free} onChange={e => setFree(e.target.value)} placeholder="… ou une carte hors collection (titre)" aria-label="Titre d’une carte hors collection" />
              <button type="button" className="ma-btn" disabled={!free.trim()} onClick={() => { addCarte({ titre: free.trim() }); setFree('') }}>Ajouter</button>
            </div>
          </div>
        </div>
        {msg && <div className="ma-alert" style={{ marginTop: 10 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="ma-btn primary" style={{ padding: '10px 18px' }} disabled={busy} onClick={submit}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          <button className="ma-btn ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.eg-ref { font-size: 15px; }
.eg-steps { display: flex; margin: 6px 0 2px; }
.eg-step { flex: 1; text-align: center; position: relative; font: 700 9.5px system-ui, sans-serif; color: var(--text3); letter-spacing: .02em; padding: 0 2px; }
.eg-step i { display: block; width: 14px; height: 14px; border: 2px solid var(--text3); background: var(--bg2); margin: 0 auto 4px; position: relative; z-index: 1; }
.eg-step::before { content: ''; position: absolute; top: 6px; left: -50%; right: 50%; height: 3px; background: var(--border); }
.eg-step:first-child::before { display: none; }
.eg-step.done { color: var(--text); } .eg-step.done i { background: #1e9e57; border-color: #1e9e57; } .eg-step.done::before { background: #1e9e57; }
.eg-step.now i { box-shadow: 0 0 0 4px rgba(47,107,255,.35); border-color: #2f6bff; background: #2f6bff; }
.eg-cartes { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.eg-mini { position: relative; width: 44px; height: 44px; background: var(--bg3); display: grid; place-items: center; font-size: 18px; }
.eg-mini img { width: 100%; height: 100%; object-fit: contain; background: none !important; }
.eg-note { position: absolute; right: -4px; bottom: -4px; background: #1e9e57; color: #fff; font: 800 10px system-ui, sans-serif; padding: 1px 4px; }
.eg-form { display: flex; flex-direction: column; gap: 10px; } .eg-form label { font: 700 12px system-ui, sans-serif; color: var(--text2); display: block; } .eg-form .ma-det-in { margin-top: 4px; }
.eg-sec { font: 800 11px system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: var(--text2); margin-top: 6px; border-top: 3px solid var(--border); padding-top: 10px; }
.eg-row { display: flex; gap: 8px; align-items: flex-start; border: 3px solid var(--border); padding: 8px; background: var(--bg3); }
.eg-thumb { width: 52px; height: 52px; object-fit: contain; background: var(--bg2); flex-shrink: 0; } .eg-nothumb { display: grid; place-items: center; font-size: 20px; }
.eg-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.eg-inline { display: flex; gap: 6px; flex-wrap: wrap; } .eg-inline .ma-det-in { flex: 1 1 110px; margin-top: 0; width: auto; }
.eg-found { border: 3px solid var(--border); background: var(--bg2); max-height: 220px; overflow-y: auto; margin-top: 4px; }
.eg-pick { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; background: transparent; border: 0; border-bottom: 1px solid var(--border); color: var(--text); padding: 6px 8px; cursor: pointer; font: 600 13px system-ui, sans-serif; }
.eg-pick:hover { background: var(--bg3); } .eg-pick img { width: 30px; height: 30px; object-fit: contain; background: none !important; }
@media (max-width: 520px) { .eg-step { font-size: 8.5px; } }
`
