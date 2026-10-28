'use client'
import { useState } from 'react'
import { CARRIERS, STATUS_LABEL, DISCLAIMER, DISCLAIMER_SHORT, carrierAdvice, type Shipment } from '@/lib/shipping'
import { fmtPrice } from '@/lib/marketplace'

export type ShipmentAction = 'ship' | 'received' | 'cancel'

const STATUS_COLOR: Record<Shipment['status'], string> = { requested: '#e67e22', shipped: '#003DA6', delivered: '#27ae60', cancelled: '#999' }

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export function addressLines(s: Shipment): string[] {
  const lines: string[] = []
  if (s.recipient_name) lines.push(s.recipient_name)
  if (s.delivery_mode === 'relay' && s.relay_label) lines.push(`Point relais : ${s.relay_label}`)
  if (s.address_line1) lines.push(s.address_line1)
  if (s.address_line2) lines.push(s.address_line2)
  if (s.postal_code || s.city) lines.push(`${s.postal_code || ''} ${s.city || ''}`.trim())
  if (s.phone) lines.push(`Tél. ${s.phone}`)
  return lines
}

// Fiche destinataire imprimable (pour écrire à la main sur une enveloppe ou aider à saisir l'envoi chez le transporteur).
function printRecipient(s: Shipment) {
  const w = window.open('', '_blank', 'width=640,height=700')
  if (!w) return
  const lines = addressLines(s).map(l => `<div>${esc(l)}</div>`).join('')
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche destinataire</title>
<style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:14px;color:#666;margin:0 0 18px;font-weight:600}
.box{border:2px solid #111;padding:22px 26px;font-size:20px;line-height:1.55;max-width:420px}.ref{margin-top:18px;font-size:12px;color:#777}</style></head>
<body><h1>DESTINATAIRE — ${esc(CARRIERS[s.carrier].label)}</h1><div class="box">${lines}</div>
<div class="ref">Réf. Memorabilius ${esc(s.id.slice(0, 8))}</div><script>window.onload=function(){window.print()}<\/script></body></html>`)
  w.document.close()
}

const copy = async (text: string) => { try { await navigator.clipboard.writeText(text) } catch { /* presse-papiers indisponible */ } }

// ── Fiche « Préparer l'envoi » (vendeur) ─────────────────────────────────────────────────────────────────────────────
export function ShipSheet({ shipment: s, dark, busy, onClose, onShip }: {
  shipment: Shipment; dark: boolean; busy: boolean; onClose: () => void; onShip: (tracking: string) => void
}) {
  const [tracking, setTracking] = useState('')
  const [copied, setCopied] = useState(false)
  const c = CARRIERS[s.carrier]
  const lines = addressLines(s)
  const bg = dark ? '#16202e' : '#fff', text = dark ? '#eee' : '#1a1a1a', sub = dark ? '#9aa7b8' : '#666', border = dark ? '#2a3a5a' : '#d6def2'
  const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontWeight: 700, fontSize: 13, cursor: 'pointer' }
  const advice = carrierAdvice(s.declared_value)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, color: text, borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: 16 }}>📦 Préparer l&apos;envoi</b>
          <button onClick={onClose} aria-label="Fermer" style={{ ...btn, padding: '4px 10px' }}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: sub, marginBottom: 14 }}>{c.label}{s.delivery_mode === 'relay' ? ' · point relais / retrait' : ' · à domicile'}</div>

        <div style={{ border: `1.5px solid ${border}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: sub, marginBottom: 6 }}>Destinataire</div>
          {lines.length ? lines.map((l, i) => <div key={i} style={{ fontSize: 15, fontWeight: i === 0 ? 800 : 500, lineHeight: 1.5 }}>{l}</div>)
            : <div style={{ fontSize: 13, color: sub }}>Adresse effacée (données personnelles supprimées 30 jours après la livraison).</div>}
          {lines.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button style={btn} onClick={async () => { await copy(lines.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 1800) }}>{copied ? '✓ Copié' : '📋 Copier l’adresse'}</button>
              <button style={btn} onClick={() => printRecipient(s)}>🖨️ Imprimer la fiche</button>
            </div>
          )}
        </div>

        {advice && <div style={{ fontSize: 12.5, background: dark ? '#2a2417' : '#fff7e0', border: '1px solid #f0d58a', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>💡 {advice}</div>}

        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: sub, marginBottom: 6 }}>Comment faire</div>
        <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13.5, lineHeight: 1.55 }}>
          {c.steps.map((st, i) => <li key={i} style={{ marginBottom: 4 }}>{st}</li>)}
        </ol>
        <a href={c.createUrl} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', ...btn, textDecoration: 'none', background: '#003DA6', color: '#fff', border: 'none', marginBottom: 16 }}>
          {c.createLabel} ↗
        </a>

        <div style={{ fontSize: 12, lineHeight: 1.5, background: dark ? '#2a2417' : '#fff7e0', border: '1px solid #f0d58a', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>
          ⚠️ <b>Important.</b> {DISCLAIMER}{' '}N&apos;envoie la carte qu&apos;une fois le paiement reçu, à tes propres risques.
        </div>

        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: sub, display: 'block', marginBottom: 6 }}>Numéro de suivi (une fois le colis déposé)</label>
          <input value={tracking} onChange={e => setTracking(e.target.value)} placeholder="ex : 6A12345678901"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${border}`, background: dark ? '#0f1824' : '#fff', color: text, fontSize: 14 }} />
          <button disabled={busy} onClick={() => onShip(tracking.trim())}
            style={{ ...btn, width: '100%', marginTop: 10, background: '#27ae60', color: '#fff', border: 'none', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Enregistrement…' : '✓ Marquer comme envoyé'}
          </button>
          <div style={{ fontSize: 11.5, color: sub, marginTop: 8 }}>L&apos;acheteur est prévenu par message et notification. Tu peux marquer « envoyé » sans numéro et l&apos;ajouter par message.</div>
        </div>
      </div>
    </div>
  )
}

// ── Bulle de livraison dans la conversation ──────────────────────────────────────────────────────────────────────────
export default function ShipmentCard({ shipment: s, role, dark, busy, onAction, onOpenSheet }: {
  shipment: Shipment; role: 'buyer' | 'seller'; dark: boolean; busy: boolean
  onAction: (a: ShipmentAction) => void; onOpenSheet: () => void
}) {
  const c = CARRIERS[s.carrier]
  const lines = addressLines(s)
  const bg = dark ? '#1e2a3a' : '#f0f4ff', border = dark ? '#2a3a5a' : '#c5d5ff', text = dark ? '#eee' : '#1a1a1a', sub = dark ? '#9aa7b8' : '#666'
  const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 13, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }
  return (
    <div style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: 14, width: '100%', maxWidth: 420, color: text, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: dark ? '#7aa7ff' : '#003DA6' }}>📦 Livraison</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: dark && s.status === 'shipped' ? '#7aa7ff' : STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
      </div>

      {s.cards.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {s.cards.slice(0, 6).map(card => (
            <div key={card.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Pas d'arrondi sur la carte elle-même */}
              {card.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={card.image} alt="" style={{ width: 34, height: 48, objectFit: 'cover', borderRadius: 0, flexShrink: 0 }} />
                : <div style={{ width: 34, height: 48, background: dark ? '#0f1824' : '#dde4f5', flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{card.nom}</div>
                <div style={{ fontSize: 11.5, color: sub }}>{[card.annee, card.marque].filter(Boolean).join(' · ')}</div>
              </div>
              {card.prix != null && <div style={{ fontSize: 13, fontWeight: 800 }}>{fmtPrice(card.prix)}</div>}
            </div>
          ))}
        </div>
      )}
      {s.note && <div style={{ fontSize: 12.5, color: sub, marginBottom: 10, fontStyle: 'italic' }}>« {s.note} »</div>}

      <div style={{ fontSize: 13, marginBottom: 4 }}><b>{c.label}</b> · {s.delivery_mode === 'relay' ? 'point relais / retrait' : 'à domicile'}</div>
      <div style={{ fontSize: 12.5, color: sub, lineHeight: 1.5, marginBottom: 10 }}>
        {lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : <i>Adresse effacée (données supprimées 30 jours après la livraison).</i>}
      </div>

      {s.tracking_number && (
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Suivi : <b>{s.tracking_number}</b>{' '}
          <a href={c.trackUrl(s.tracking_number, s.postal_code)} target="_blank" rel="noopener noreferrer" style={{ color: dark ? '#7aa7ff' : '#003DA6', fontWeight: 700 }}>Suivre ↗</a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {role === 'seller' && s.status === 'requested' && (
          <>
            <button style={{ ...btn, background: '#003DA6', color: '#fff' }} disabled={busy} onClick={onOpenSheet}>📦 Préparer l&apos;envoi</button>
            <button style={{ ...btn, background: 'transparent', color: sub, border: `1px solid ${border}` }} disabled={busy} onClick={() => onAction('cancel')}>Refuser</button>
          </>
        )}
        {role === 'buyer' && s.status === 'requested' && (
          <button style={{ ...btn, background: 'transparent', color: sub, border: `1px solid ${border}` }} disabled={busy} onClick={() => onAction('cancel')}>Annuler la demande</button>
        )}
        {role === 'buyer' && s.status === 'shipped' && (
          <button style={{ ...btn, background: '#27ae60', color: '#fff' }} disabled={busy} onClick={() => onAction('received')}>✓ J&apos;ai reçu la carte</button>
        )}
      </div>
      {role === 'seller' && s.status === 'requested' && <div style={{ fontSize: 11.5, color: sub, marginTop: 8 }}>Frais d&apos;envoi à la charge de l&apos;acheteur : à convenir avec lui avant d&apos;envoyer.</div>}
      <div style={{ fontSize: 11, color: sub, marginTop: 8 }}>{DISCLAIMER_SHORT} Paiement et frais d&apos;envoi : à régler entre vous.</div>
    </div>
  )
}
