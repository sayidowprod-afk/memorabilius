'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fmtPrice } from '@/lib/marketplace'
import { isOpen, hoursLeft, parsePrice, type Offer } from '@/lib/offers'

// Bulle « Offre » d'une conversation : charge l'offre (lecture réservée à l'acheteur et au vendeur par la RLS), puis exécute les actions
// via /api/offers/[id]. `refreshKey` change à chaque nouveau message pour recharger le statut.
export default function OfferBubble({ id, userId, dark, refreshKey }: { id: string; userId: string; dark: boolean; refreshKey: number }) {
  const [o, setO] = useState<Offer | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [counter, setCounter] = useState('')
  const [counterOpen, setCounterOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('offers').select('*').eq('id', id).maybeSingle()
    setO((data as Offer | null) ?? null)
  }, [id])
  useEffect(() => { load() }, [load, refreshKey])

  const act = async (action: 'accept' | 'refuse' | 'counter' | 'cancel', price?: number) => {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/offers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }, body: JSON.stringify({ action, price }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error || 'Action impossible.')
      else setCounterOpen(false)
    } catch { toast.error('Connexion impossible. Réessaie.') }
    setBusy(false)
    load()
  }

  const bg = dark ? '#16202e' : '#fff', fg = dark ? '#e8ecf3' : '#111', sub = dark ? '#9aa6bb' : '#666', border = dark ? '#2c3a52' : '#dde2ee'
  if (o === undefined) return <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>Chargement de l’offre…</div>
  if (o === null) return <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>💶 Offre indisponible.</div>

  const isSeller = o.seller_id === userId
  const open = isOpen(o)
  const expired = !open && (o.status === 'pending' || o.status === 'countered')
  const myTurn = open && ((o.status === 'pending' && isSeller) || (o.status === 'countered' && !isSeller))
  const finalPrice = o.status === 'countered' || (o.status === 'accepted' && o.counter_price != null) ? o.counter_price : o.price
  const label = o.status === 'accepted' ? '✅ Acceptée' : o.status === 'refused' ? '❌ Refusée' : o.status === 'cancelled' ? '↩️ Retirée' : expired ? '⌛ Expirée' : o.status === 'countered' ? '↔️ Contre-proposition' : '⏳ En attente de réponse'
  const color = o.status === 'accepted' ? '#1f9d55' : o.status === 'refused' || o.status === 'cancelled' || expired ? '#b42318' : '#c27c00'
  const btn: React.CSSProperties = { padding: '8px 12px', fontWeight: 800, fontSize: 12.5, border: '2px solid', cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase' }

  return (
    <div style={{ background: bg, color: fg, border: `2px solid ${border}`, padding: 12, maxWidth: 340, width: '100%' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: sub }}>💶 Offre de prix</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {o.card?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={o.card.image} alt="" style={{ width: 46, height: 64, objectFit: 'cover', flex: 'none' }} />
          : <div style={{ width: 46, height: 64, background: dark ? '#0f1824' : '#dde4f5', flex: 'none' }} />}
        <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.4 }}>
          <b>{o.card?.nom || 'Carte'}</b>
          <div style={{ color: sub, fontSize: 12 }}>{[o.card?.annee, o.card?.marque].filter(Boolean).join(' · ')}</div>
          <div style={{ marginTop: 4 }}>
            {o.card?.prix != null && <span style={{ color: sub }}>Prix demandé : <s>{fmtPrice(Number(o.card.prix))}</s><br /></span>}
            Offre : <b>{fmtPrice(Number(o.price))}</b>
            {o.counter_price != null && <><br />Contre-proposition : <b>{fmtPrice(Number(o.counter_price))}</b></>}
          </div>
        </div>
      </div>
      {o.message && <div style={{ fontSize: 12.5, marginTop: 8, color: sub, fontStyle: 'italic' }}>« {o.message} »</div>}
      <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color }}>{label}{o.status === 'accepted' ? ` à ${fmtPrice(Number(finalPrice))}` : ''}</div>
      {open && <div style={{ fontSize: 11.5, color: sub }}>Expire dans {hoursLeft(o.expires_at)} h</div>}

      {myTurn && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" disabled={busy} onClick={() => act('accept')} style={{ ...btn, background: '#1f9d55', borderColor: '#1f9d55', color: '#fff' }}>Accepter</button>
          {isSeller && <button type="button" disabled={busy} onClick={() => setCounterOpen(v => !v)} style={{ ...btn, background: 'transparent', borderColor: border, color: fg }}>Contre-proposer</button>}
          <button type="button" disabled={busy} onClick={() => act('refuse')} style={{ ...btn, background: '#b42318', borderColor: '#b42318', color: '#fff' }}>Refuser</button>
        </div>
      )}
      {myTurn && isSeller && counterOpen && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input inputMode="decimal" value={counter} onChange={e => setCounter(e.target.value)} placeholder="Ton prix (€)" style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: `1.5px solid ${border}`, background: dark ? '#0f1824' : '#fff', color: fg }} />
          <button type="button" disabled={busy} onClick={() => { const p = parsePrice(counter); if (p == null) { toast.error('Indique un prix valide.'); return } act('counter', p) }} style={{ ...btn, background: '#003DA6', borderColor: '#003DA6', color: '#fff' }}>Envoyer</button>
        </div>
      )}
      {open && !isSeller && (
        <div style={{ marginTop: 10 }}>
          <button type="button" disabled={busy} onClick={() => act('cancel')} style={{ ...btn, background: 'transparent', borderColor: border, color: sub }}>Retirer mon offre</button>
        </div>
      )}
    </div>
  )
}
