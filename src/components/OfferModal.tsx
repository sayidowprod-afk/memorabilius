'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fmtPrice } from '@/lib/marketplace'
import { parsePrice, OFFER_TTL_HOURS } from '@/lib/offers'

interface SellerCard { id: string; nom: string; annee: string | null; marque: string | null; image_recto: string | null; prix_vente: number | null }

// Offre de prix (acheteur) : on choisit une carte à vendre chez ce membre et on propose un prix inférieur au sien.
// Aucun paiement : si le vendeur accepte, la suite (envoi, règlement) se passe entre membres.
export default function OfferModal({ sellerId, sellerName, dark, onClose, onCreated }: {
  sellerId: string; sellerName: string; dark: boolean; onClose: () => void; onCreated: () => void
}) {
  const [cards, setCards] = useState<SellerCard[] | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('cartes_manuelles')
        .select('id, nom, annee, marque, image_recto, prix_vente')
        .eq('user_id', sellerId).eq('disponible_vente', true).or('vendue.is.null,vendue.eq.false')
        .order('created_at', { ascending: false }).limit(200)
      if (!cancelled) setCards(((data as SellerCard[]) || []).filter(c => c.prix_vente != null))
    })()
    return () => { cancelled = true }
  }, [sellerId])

  const bg = dark ? '#16202e' : '#fff', fg = dark ? '#e8ecf3' : '#111', sub = dark ? '#9aa6bb' : '#666', border = dark ? '#2c3a52' : '#dde2ee'
  const picked = cards?.find(c => c.id === cardId) || null
  const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${border}`, background: dark ? '#0f1824' : '#fff', color: fg, fontSize: 14, boxSizing: 'border-box' }

  const submit = async () => {
    if (!picked) { toast.error('Choisis la carte.'); return }
    const p = parsePrice(price)
    if (p == null) { toast.error('Indique un prix valide.'); return }
    if (picked.prix_vente != null && p >= Number(picked.prix_vente)) { toast.error(`Ton offre doit être inférieure au prix demandé (${fmtPrice(Number(picked.prix_vente))}).`); return }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/offers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ sellerId, cardId: picked.id, price: p, message }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(json.error || 'Envoi impossible.'); setBusy(false); return }
      toast.success('Offre envoyée.')
      onCreated()
    } catch { toast.error('Connexion impossible. Réessaie.'); setBusy(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Faire une offre" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: bg, color: fg, width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto', padding: 18, border: `2px solid ${border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <b style={{ fontSize: 17 }}>💶 Faire une offre à {sellerName}</b>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: sub, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 12.5, color: sub, margin: '6px 0 12px', lineHeight: 1.5 }}>Propose un prix inférieur au sien. Il a {OFFER_TTL_HOURS} h pour accepter, refuser ou te répondre par un autre prix. Aucun paiement sur Memorabilius : la suite se règle entre vous.</p>

        <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: sub, margin: '0 0 6px' }}>1 · Carte</div>
        {cards === null ? <div style={{ fontSize: 13, color: sub }}>Chargement…</div> : cards.length === 0 ? (
          <div style={{ fontSize: 13, color: sub }}>Ce membre n’a aucune carte à vendre avec un prix affiché.</div>
        ) : (
          <div style={{ border: `1.5px solid ${border}`, maxHeight: 220, overflowY: 'auto' }}>
            {cards.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: `1px solid ${border}`, cursor: 'pointer', background: cardId === c.id ? (dark ? '#1c2b46' : '#eef3ff') : 'transparent' }}>
                <input type="radio" name="offer-card" checked={cardId === c.id} onChange={() => setCardId(c.id)} style={{ width: 16, height: 16, margin: 0, accentColor: '#003DA6' }} />
                {c.image_recto
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.image_recto} alt="" style={{ width: 28, height: 40, objectFit: 'cover' }} />
                  : <div style={{ width: 28, height: 40, background: dark ? '#0f1824' : '#dde4f5' }} />}
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.3 }}><b>{c.nom}</b><br /><span style={{ color: sub, fontSize: 11.5 }}>{[c.annee, c.marque].filter(Boolean).join(' · ')}</span></span>
                <b style={{ fontSize: 13 }}>{fmtPrice(Number(c.prix_vente))}</b>
              </label>
            ))}
          </div>
        )}

        <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: sub, margin: '14px 0 6px' }}>2 · Ton offre</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={picked ? `moins de ${fmtPrice(Number(picked.prix_vente))}` : 'Prix en €'} style={{ ...inp, flex: 1 }} />
          <span style={{ fontWeight: 800 }}>€</span>
        </div>
        <input value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} placeholder="Un petit mot (facultatif)" style={{ ...inp, marginTop: 8 }} />

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={submit} disabled={busy || !picked} className="btn-main btn-primary" style={{ flex: 1 }}>{busy ? 'Envoi…' : 'Envoyer l’offre'}</button>
          <button type="button" onClick={onClose} disabled={busy} className="da-confirm-btn">Annuler</button>
        </div>
      </div>
    </div>
  )
}
