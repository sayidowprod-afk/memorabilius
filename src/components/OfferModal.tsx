'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fmtPrice } from '@/lib/marketplace'
import { parsePrice, OFFER_TTL_HOURS } from '@/lib/offers'
import ModalShell from '@/components/ModalShell'

interface SellerCard { id: string; nom: string; annee: string | null; marque: string | null; image_recto: string | null; prix_vente: number | null }

// Offre de prix (acheteur) : on choisit une carte à vendre chez ce membre et on propose un prix inférieur au sien.
// Aucun paiement : si le vendeur accepte, la suite (envoi, règlement) se passe entre membres.
export default function OfferModal({ sellerId, sellerName, onClose, onCreated }: {
  sellerId: string; sellerName: string; dark?: boolean; onClose: () => void; onCreated: () => void
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

  const picked = cards?.find(c => c.id === cardId) || null
  const sub: React.CSSProperties = { color: 'var(--text2, #9aa6bb)' }
  const head: React.CSSProperties = { fontWeight: 800, fontSize: 'var(--fs-xs)', letterSpacing: '.08em', textTransform: 'uppercase', margin: '0 0 var(--sp-2)', ...sub }

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
    <ModalShell title={`💶 Offre à ${sellerName}`} onClose={onClose}
      footer={<>
        <button type="button" onClick={submit} disabled={busy || !picked} className="btn-main btn-primary">{busy ? 'Envoi…' : 'Envoyer l’offre'}</button>
        <button type="button" onClick={onClose} disabled={busy} className="da-confirm-btn">Annuler</button>
      </>}>
      <p style={{ fontSize: 'var(--fs-sm)', margin: '0 0 var(--sp-4)', lineHeight: 1.5, ...sub }}>Propose un prix inférieur au sien. Il a {OFFER_TTL_HOURS} h pour accepter, refuser ou te répondre par un autre prix. Aucun paiement sur Memorabilius : la suite se règle entre vous.</p>

      <div style={head}>1 · Carte</div>
      {cards === null ? <div style={{ fontSize: 'var(--fs-sm)', ...sub }}>Chargement…</div> : cards.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-sm)', ...sub }}>Ce membre n’a aucune carte à vendre avec un prix affiché.</div>
      ) : (
        <div style={{ border: '2px solid var(--border, #3a4a8a)', maxHeight: 220, overflowY: 'auto' }}>
          {cards.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', borderBottom: '1px solid var(--border, #3a4a8a)', cursor: 'pointer', background: cardId === c.id ? 'color-mix(in srgb, var(--accent, #003DA6) 25%, transparent)' : 'transparent' }}>
              <input type="radio" name="offer-card" checked={cardId === c.id} onChange={() => setCardId(c.id)} style={{ width: 18, height: 18, margin: 0, accentColor: '#003DA6', minHeight: 0 }} />
              {c.image_recto
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.image_recto} alt="" style={{ width: 28, height: 40, objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 40, background: 'var(--bg3, #17214a)' }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-sm)', lineHeight: 1.3 }}><b>{c.nom}</b><br /><span style={{ ...sub, fontSize: 'var(--fs-xs)' }}>{[c.annee, c.marque].filter(Boolean).join(' · ')}</span></span>
              <b style={{ fontSize: 'var(--fs-sm)' }}>{fmtPrice(Number(c.prix_vente))}</b>
            </label>
          ))}
        </div>
      )}

      <div style={{ ...head, marginTop: 'var(--sp-4)' }}>2 · Ton offre</div>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
        <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder={picked ? `moins de ${fmtPrice(Number(picked.prix_vente))}` : 'Prix en €'} aria-label="Prix proposé en euros" style={{ flex: 1 }} />
        <span style={{ fontWeight: 800 }}>€</span>
      </div>
      <input value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} placeholder="Un petit mot (facultatif)" aria-label="Message au vendeur" style={{ marginTop: 'var(--sp-2)' }} />
    </ModalShell>
  )
}
