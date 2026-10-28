'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { CARRIERS, validateShipmentInput, carrierAdvice, type Carrier, type DeliveryMode } from '@/lib/shipping'
import { fmtPrice } from '@/lib/marketplace'

interface SellerCard { id: string; nom: string; annee: string | null; marque: string | null; image_recto: string | null; prix_vente: number | null }

const CHK: React.CSSProperties = { width: 16, height: 16, flex: 'none', margin: 0, padding: 0, accentColor: '#003DA6' }

const ADDR_KEY = (uid: string) => `ship_addr_v1_${uid}`

// Demande de livraison (acheteur) : une fois d'accord avec le vendeur par messages, on choisit la ou les cartes, le transporteur
// (La Poste / Mondial Relay) et l'adresse. Aucun paiement : prix et frais d'envoi se règlent entre membres, hors site.
export default function ShipmentRequestModal({ sellerId, sellerName, dark, onClose, onCreated }: {
  sellerId: string; sellerName: string; dark: boolean; onClose: () => void; onCreated: () => void
}) {
  const [cards, setCards] = useState<SellerCard[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [carrier, setCarrier] = useState<Carrier>('laposte_colissimo')
  const [mode, setMode] = useState<DeliveryMode>('home')
  const [f, setF] = useState({ recipientName: '', addressLine1: '', addressLine2: '', postalCode: '', city: '', phone: '', relayLabel: '' })
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uid, setUid] = useState<string | null>(null)

  // Cartes du vendeur disponibles (galerie publique) + adresse mémorisée sur cet appareil.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, prix_vente')
        .eq('user_id', sellerId).eq('disponible_vente', true).or('vendue.is.null,vendue.eq.false')
        .order('created_at', { ascending: false }).limit(200)
      if (!cancelled) setCards((data as SellerCard[]) || [])
      const { data: { user } } = await supabase.auth.getUser()
      if (user && !cancelled) {
        setUid(user.id)
        try { const saved = JSON.parse(localStorage.getItem(ADDR_KEY(user.id)) || 'null'); if (saved) setF(prev => ({ ...prev, ...saved })) } catch { /* ignore */ }
      }
    })()
    return () => { cancelled = true }
  }, [sellerId])

  const chooseCarrier = (c: Carrier) => {
    setCarrier(c)
    if (!CARRIERS[c].modes.includes(mode)) setMode(CARRIERS[c].modes[0])
  }

  const declared = useMemo(() => {
    const p = (cards || []).filter(c => picked.has(c.id) && c.prix_vente != null).map(c => Number(c.prix_vente))
    return p.length ? p.reduce((a, b) => a + b, 0) : null
  }, [cards, picked])

  const submit = async () => {
    const input = { sellerId, cardIds: [...picked], note, carrier, deliveryMode: mode, ...f }
    const check = validateShipmentInput(input)
    if (!check.ok) { toast.error(check.error); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify(input),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Demande impossible.'); setBusy(false); return }
      if (uid) {
        try {
          if (remember) localStorage.setItem(ADDR_KEY(uid), JSON.stringify({ recipientName: f.recipientName, addressLine1: f.addressLine1, addressLine2: f.addressLine2, postalCode: f.postalCode, city: f.city, phone: f.phone }))
          else localStorage.removeItem(ADDR_KEY(uid))
        } catch { /* ignore */ }
      }
      toast.success('Demande envoyée au vendeur')
      onCreated()
    } catch { toast.error('Connexion impossible. Réessaie.') }
    setBusy(false)
  }

  const bg = dark ? '#16202e' : '#fff', text = dark ? '#eee' : '#1a1a1a', sub = dark ? '#9aa7b8' : '#666', border = dark ? '#2a3a5a' : '#d6def2'
  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 8, border: `1.5px solid ${border}`, background: dark ? '#0f1824' : '#fff', color: text, fontSize: 14 }
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: sub, display: 'block', margin: '12px 0 5px' }
  const advice = carrierAdvice(declared)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, color: text, borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 16 }}>📦 Organiser la livraison</b>
          <button onClick={onClose} aria-label="Fermer" style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: sub, margin: '8px 0 0', lineHeight: 1.5 }}>
          À faire une fois d&apos;accord avec <b>{sellerName}</b>. Le paiement et les frais d&apos;envoi (à ta charge, à intégrer au prix convenu) se règlent entre vous, hors Memorabilius.
        </p>

        <span style={label}>1 · Carte(s) achetée(s)</span>
        {cards === null ? <div style={{ fontSize: 13, color: sub }}>Chargement…</div> : cards.length === 0 ? (
          <div style={{ fontSize: 13, color: sub }}>Aucune carte « Vente/Trade » chez ce vendeur : décris ci-dessous ce que tu achètes.</div>
        ) : (
          <div style={{ border: `1.5px solid ${border}`, borderRadius: 10, maxHeight: 210, overflowY: 'auto', overflowX: 'hidden' }}>
            {cards.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: `1px solid ${border}`, cursor: 'pointer' }}>
                <input style={CHK} type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked(p => { const n = new Set(p); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })} />
                {c.image_recto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image_recto} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 0 }} />
                  : <div style={{ width: 28, height: 40, background: dark ? '#0f1824' : '#dde4f5' }} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3 }}><b>{c.nom}</b><br /><span style={{ color: sub, fontSize: 11.5 }}>{[c.annee, c.marque].filter(Boolean).join(' · ')}</span></span>
                {c.prix_vente != null && <b style={{ fontSize: 13 }}>{fmtPrice(Number(c.prix_vente))}</b>}
              </label>
            ))}
          </div>
        )}
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Autre carte / lot : décris-le (facultatif si tu as coché une carte)" style={{ ...inp, marginTop: 8 }} />

        <span style={label}>2 · Transporteur</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Object.keys(CARRIERS) as Carrier[]).map(c => (
            <label key={c} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${carrier === c ? '#003DA6' : border}`, background: carrier === c ? (dark ? '#1b2c4d' : '#f0f4ff') : 'transparent' }}>
              <input type="radio" name="carrier" checked={carrier === c} onChange={() => chooseCarrier(c)} style={{ ...CHK, marginTop: 3 }} />
              <span style={{ fontSize: 13.5 }}><b>{CARRIERS[c].label}</b><br /><span style={{ color: sub, fontSize: 12 }}>{CARRIERS[c].hint}</span></span>
            </label>
          ))}
        </div>
        {advice && <div style={{ fontSize: 12.5, marginTop: 8, color: sub }}>💡 {advice}</div>}

        <span style={label}>3 · Livraison</span>
        {CARRIERS[carrier].modes.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {CARRIERS[carrier].modes.map(m => (
              <button key={m} type="button" onClick={() => setMode(m)} style={{ flex: 1, padding: '9px 10px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: `1.5px solid ${mode === m ? '#003DA6' : border}`, background: mode === m ? '#003DA6' : 'transparent', color: mode === m ? '#fff' : text }}>
                {m === 'home' ? 'À domicile' : 'Point de retrait'}
              </button>
            ))}
          </div>
        )}
        <input value={f.recipientName} onChange={e => setF({ ...f, recipientName: e.target.value })} placeholder="Nom et prénom du destinataire" autoComplete="name" style={inp} />
        {mode === 'home' ? (
          <>
            <input value={f.addressLine1} onChange={e => setF({ ...f, addressLine1: e.target.value })} placeholder="Adresse (numéro et rue)" autoComplete="address-line1" style={{ ...inp, marginTop: 8 }} />
            <input value={f.addressLine2} onChange={e => setF({ ...f, addressLine2: e.target.value })} placeholder="Complément (bâtiment, étage…) — facultatif" autoComplete="address-line2" style={{ ...inp, marginTop: 8 }} />
          </>
        ) : (
          <>
            <input value={f.relayLabel} onChange={e => setF({ ...f, relayLabel: e.target.value })} placeholder="Point relais choisi : nom, adresse, identifiant" style={{ ...inp, marginTop: 8 }} />
            <div style={{ fontSize: 11.5, color: sub, marginTop: 4 }}>
              Trouve un point près de chez toi sur{' '}
              <a href={CARRIERS[carrier].createUrl} target="_blank" rel="noopener noreferrer" style={{ color: dark ? '#7aa7ff' : '#003DA6', fontWeight: 700 }}>le site du transporteur ↗</a>, puis recopie son nom et son adresse.
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={f.postalCode} onChange={e => setF({ ...f, postalCode: e.target.value })} placeholder="Code postal" inputMode="numeric" autoComplete="postal-code" style={{ ...inp, flex: '0 0 120px' }} />
          <input value={f.city} onChange={e => setF({ ...f, city: e.target.value })} placeholder="Ville" autoComplete="address-level2" style={{ ...inp, flex: 1 }} />
        </div>
        <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="Téléphone (facultatif, utile pour le transporteur)" inputMode="tel" autoComplete="tel" style={{ ...inp, marginTop: 8 }} />
        <div style={{ fontSize: 11.5, color: sub, marginTop: 6 }}>France uniquement pour le moment.</div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, marginTop: 12, cursor: 'pointer' }}>
          <input style={CHK} type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Mémoriser mon adresse sur cet appareil (pas sur nos serveurs)
        </label>
        <div style={{ fontSize: 11.5, color: sub, marginTop: 8, lineHeight: 1.5 }}>
          🔒 Ton adresse n&apos;est visible que par {sellerName} pour cette livraison, et elle est effacée 30 jours après la livraison.
        </div>

        <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 10, border: 'none', background: '#003DA6', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Envoi…' : 'Envoyer la demande au vendeur'}
        </button>
      </div>
    </div>
  )
}
