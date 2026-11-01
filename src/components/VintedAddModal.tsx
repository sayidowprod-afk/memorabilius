'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// Ajout d'un achat Vinted : lien d'annonce et/ou capture d'écran de la commande -> lecture automatique (titre, photo, prix,
// port, frais, total, vendeur, date) -> le membre vérifie, corrige et enregistre. Tout est modifiable à la main.
export type VintedInitial = { url?: string; imageUrl?: string; text?: string }

type Fields = { titre: string; prix: string; frais_port: string; autres_frais: string; vendeur: string; achete_at: string; expedie: boolean }
const EMPTY: Fields = { titre: '', prix: '', frais_port: '', autres_frais: '', vendeur: '', achete_at: new Date().toISOString().slice(0, 10), expedie: false }

const num = (s: string) => { const n = Number(s.replace(',', '.')); return s.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null }
const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })
}
// Capture réduite (1600 px max) en JPEG : assez nette pour lire les montants, assez légère pour l'envoi.
async function toJpegDataUrl(src: string): Promise<string> {
  const im = await loadImage(src)
  const k = Math.min(1, 1600 / Math.max(im.width, im.height))
  const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k)
  c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}
// Recadre la photo de l'article dans la capture (cadre donné par le modèle, sur 0..1000) en petite vignette.
async function cropThumb(dataUrl: string, box: [number, number, number, number]): Promise<string | null> {
  try {
    const im = await loadImage(dataUrl)
    const [y1, x1, y2, x2] = box
    const sx = (x1 / 1000) * im.width, sy = (y1 / 1000) * im.height, sw = ((x2 - x1) / 1000) * im.width, sh = ((y2 - y1) / 1000) * im.height
    const k = Math.min(1, 240 / Math.max(sw, sh))
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k))
    c.getContext('2d')!.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.75)
  } catch { return null }
}

export default function VintedAddModal({ token, initial, onClose, onSaved }: { token: string; initial?: VintedInitial | null; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState(initial?.url || '')
  const [image, setImage] = useState<string | null>(null) // data URL JPEG de la capture
  const [f, setF] = useState<Fields>(EMPTY)
  const [photo, setPhoto] = useState<string | null>(null)
  const [lien, setLien] = useState<string | null>(null)
  const [busy, setBusy] = useState<'read' | 'save' | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof Fields, v: string | boolean) => setF(p => ({ ...p, [k]: v }))

  const read = useCallback(async (u: string, img: string | null, texte?: string) => {
    if (!u.trim() && !img && !texte) { setMsg('Ajoute un lien d’annonce ou une capture de ta commande.'); return }
    setBusy('read'); setMsg(null); setInfo(null)
    try {
      const res = await fetch('/api/achats/vinted/lire', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: u.trim() || undefined, image: img || undefined, texte: texte || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(json.error || 'Lecture impossible : remplis à la main.'); return }
      const d = json.draft
      setF(p => ({
        titre: d.titre || p.titre,
        prix: d.prix != null ? String(d.prix) : p.prix,
        frais_port: d.frais_port != null ? String(d.frais_port) : p.frais_port,
        autres_frais: d.autres_frais != null ? String(d.autres_frais) : p.autres_frais,
        vendeur: d.vendeur || p.vendeur,
        achete_at: d.achete_at || p.achete_at,
        expedie: p.expedie,
      }))
      setLien(d.lien || null)
      let ph: string | null = d.photo_url || null
      if (!ph && img && d.photo_box) ph = await cropThumb(img, d.photo_box)
      setPhoto(ph)
      setInfo(`Lu ${json.lu?.capture && texte && !img ? 'dans le message partagé' : json.lu?.capture ? 'sur la capture' : ''}${json.lu?.capture && json.lu?.annonce ? ' et ' : ''}${json.lu?.annonce ? 'sur l’annonce' : ''} : vérifie les montants avant d’enregistrer.`)
    } catch { setMsg('Lecture impossible : remplis à la main.') } finally { setBusy(null) }
  }, [token])

  const pickFile = async (file: File | null | undefined) => {
    if (!file) return
    try {
      const reader = new FileReader()
      const raw: string = await new Promise((res, rej) => { reader.onload = () => res(String(reader.result)); reader.onerror = rej; reader.readAsDataURL(file) })
      const jpeg = await toJpegDataUrl(raw)
      setImage(jpeg)
      read(url, jpeg)
    } catch { setMsg('Image illisible.') }
  }

  // Partage reçu depuis l'appli Vinted : lecture automatique à l'ouverture.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !initial) return
    started.current = true
    ;(async () => {
      let img: string | null = null
      if (initial.imageUrl) {
        try {
          const blob = await (await fetch(initial.imageUrl)).blob()
          const raw: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob) })
          img = await toJpegDataUrl(raw); setImage(img)
        } catch { /* on continue avec le lien seul */ }
      }
      if (initial.url || img || initial.text) read(initial.url || '', img, initial.text)
    })()
  }, [initial, read])

  const prix = num(f.prix), port = num(f.frais_port), frais = num(f.autres_frais)
  const total = prix !== null ? Math.round((prix + (port || 0) + (frais || 0)) * 100) / 100 : null

  const save = async () => {
    if (!f.titre.trim()) { setMsg('Le titre est obligatoire.'); return }
    if (prix === null) { setMsg('Indique le prix de l’article.'); return }
    setBusy('save'); setMsg(null)
    try {
      const res = await fetch('/api/achats/vinted', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ titre: f.titre, prix, frais_port: port, autres_frais: frais, total_paye: total, vendeur: f.vendeur, achete_at: f.achete_at, expedie: f.expedie, photo_url: photo, lien: lien || url, devise: 'EUR' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(json.error || 'Enregistrement impossible.'); return }
      onSaved(); onClose()
    } catch { setMsg('Enregistrement impossible.') } finally { setBusy(null) }
  }

  return (
    <div className="ma-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <style>{CSS}</style>
      <div className="ma-modal-box vm-box" onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px', fontSize: 22 }}>Ajouter un achat Vinted</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>
          Ajoute une capture de ta commande (prix, port et frais lus automatiquement) et/ou le lien de l’annonce (titre et photo).
        </p>

        <div className="vm-row">
          <input className="ma-search vm-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="Lien de l’annonce Vinted (facultatif)" aria-label="Lien de l’annonce Vinted" />
          <button className="ma-btn" disabled={busy !== null} onClick={() => fileRef.current?.click()}>{image ? 'Changer la capture' : 'Ajouter une capture'}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {(url.trim() || image) && <button className="ma-btn ghost" style={{ marginBottom: 12 }} disabled={busy !== null} onClick={() => read(url, image)}>{busy === 'read' ? 'Lecture…' : 'Lire à nouveau'}</button>}
        {busy === 'read' && <div className="vm-info">Lecture en cours…</div>}
        {info && busy !== 'read' && <div className="vm-info">{info}</div>}

        <div className="vm-form">
          {photo && /* eslint-disable-next-line @next/next/no-img-element */ <img className="vm-photo" src={photo} alt="" />}
          <div className="vm-fields">
            <label>Titre<input className="ma-search vm-input" value={f.titre} onChange={e => set('titre', e.target.value)} maxLength={200} /></label>
            <div className="vm-grid">
              <label>Prix de l’article (€)<input className="ma-search vm-input" inputMode="decimal" value={f.prix} onChange={e => set('prix', e.target.value)} /></label>
              <label>Frais de port (€)<input className="ma-search vm-input" inputMode="decimal" value={f.frais_port} onChange={e => set('frais_port', e.target.value)} /></label>
              <label>Frais Vinted (€)<input className="ma-search vm-input" inputMode="decimal" value={f.autres_frais} onChange={e => set('autres_frais', e.target.value)} /></label>
              <label>Date d’achat<input className="ma-search vm-input" type="date" value={f.achete_at} onChange={e => set('achete_at', e.target.value)} /></label>
            </div>
            <label>Vendeur<input className="ma-search vm-input" value={f.vendeur} onChange={e => set('vendeur', e.target.value)} maxLength={80} /></label>
            <label className="vm-check"><input type="checkbox" checked={f.expedie} onChange={e => set('expedie', e.target.checked)} /> Le colis est déjà expédié</label>
            <div className="vm-total">Total payé : <b>{total !== null ? fmt(total) : '—'}</b></div>
          </div>
        </div>

        {msg && <div className="ma-alert" style={{ marginTop: 12 }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          <button className="ma-btn primary" disabled={busy !== null} onClick={save}>{busy === 'save' ? 'Enregistrement…' : 'Enregistrer l’achat'}</button>
          <button className="ma-btn ghost" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.vm-box { max-width: 560px !important; max-height: 92vh; overflow-y: auto; }
.vm-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.vm-row .vm-input { flex: 1 1 220px; margin: 0; }
.vm-input { margin: 4px 0 0 !important; }
.vm-info { font-size: 13px; color: var(--text2); margin-bottom: 10px; }
.vm-form { display: flex; gap: 14px; align-items: flex-start; }
.vm-photo { width: 96px; flex-shrink: 0; object-fit: contain; background: var(--bg3); border: 3px solid var(--border); }
.vm-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
.vm-fields label { font: 700 12px system-ui, sans-serif; color: var(--text2); display: block; }
.vm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.vm-check { display: flex !important; align-items: center; justify-content: flex-start; gap: 8px; font-size: 13px !important; color: var(--text) !important; }
.vm-check input { width: auto !important; margin: 0 !important; flex: 0 0 auto; }
.vm-total { font-size: 15px; }
@media (max-width: 520px) { .vm-form { flex-direction: column; } .vm-photo { width: 120px; } }
`
