'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fmtPrice } from '@/lib/marketplace'
import { isOpen, parsePrice, type Offer } from '@/lib/offers'

// Onglet « Offres de prix » d'Échanges :
//  1) les membres qui ont mis en favori une de mes cartes à vendre (je peux leur proposer un prix) ;
//  2) toutes mes offres, reçues et envoyées, avec leur état. Aucun paiement sur le site : une offre acceptée se poursuit en messages.
type Interested = { buyerId: string; buyerName: string; buyerAvatar: string | null; at: string; card: { id: string; nom: string; annee?: string | null; marque?: string | null; image?: string | null; prix: number } }
type Row = Offer & { otherName: string; otherId: string; mineAsSeller: boolean }

const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border, #ddd)', background: 'var(--bg2, rgba(255,255,255,.04))' }
const sub: React.CSSProperties = { color: 'var(--text2, #888)', fontSize: 12 }

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` }
}

function statusOf(o: Offer, seller: boolean): { label: string; color: string } {
  const sellerStarted = (o.card as { initiator?: string })?.initiator === 'seller'
  if (o.status === 'accepted') return { label: 'Acceptée', color: '#1e9e57' }
  if (o.status === 'refused') return { label: 'Refusée', color: '#e74c3c' }
  if (o.status === 'cancelled') return { label: 'Retirée', color: '#888' }
  if (!isOpen(o)) return { label: 'Expirée', color: '#888' }
  if (o.status === 'countered') return { label: sellerStarted ? (seller ? 'Proposition en attente de réponse' : 'Proposition à accepter') : (seller ? 'Contre-offre envoyée' : 'Contre-offre à accepter'), color: '#fdb927' }
  return { label: seller ? 'Offre à traiter' : 'Offre envoyée', color: '#7dc4ff' }
}

export default function PriceOffersTab({ userId }: { userId: string }) {
  const [interested, setInterested] = useState<Interested[] | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/offers/interested', { headers: await authHeaders() }).then(x => x.json())
      setInterested(Array.isArray(r?.interested) ? r.interested : [])
    } catch { setInterested([]) }
    const { data } = await supabase.from('offers').select('*').or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order('created_at', { ascending: false }).limit(60)
    const offers = (data as Offer[]) || []
    const ids = [...new Set(offers.map(o => (o.buyer_id === userId ? o.seller_id : o.buyer_id)))]
    const { data: profs } = ids.length ? await supabase.from('profiles').select('id, display_name').in('id', ids) : { data: [] as { id: string; display_name: string }[] }
    const names = new Map((profs || []).map(p => [p.id, p.display_name]))
    setRows(offers.map(o => { const other = o.buyer_id === userId ? o.seller_id : o.buyer_id; return { ...o, otherId: other, otherName: names.get(other) || 'Membre', mineAsSeller: o.seller_id === userId } }))
  }, [userId])
  useEffect(() => { load() }, [load])

  const propose = async (it: Interested) => {
    const key = `${it.buyerId}:${it.card.id}`, p = parsePrice(prices[key])
    if (p == null) { toast.error('Indique un prix valide.'); return }
    if (p > it.card.prix) { toast.error(`Ton prix ne peut pas dépasser le prix affiché (${fmtPrice(it.card.prix)}).`); return }
    setBusy(key)
    try {
      const res = await fetch('/api/offers/propose', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ buyerId: it.buyerId, cardId: it.card.id, price: p }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(j.error || 'Envoi impossible.')
      else { toast.success(`Proposition envoyée à ${it.buyerName}.`); await load() }
    } catch { toast.error('Connexion impossible. Réessaie.') }
    setBusy(null)
  }

  const H = ({ children }: { children: React.ReactNode }) => <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', margin: '4px 0 10px', color: 'var(--text2, #888)' }}>{children}</div>

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <section>
        <H>⭐ Intéressés par tes cartes à vendre</H>
        {interested === null ? <div style={sub}>Chargement…</div> : interested.length === 0 ? (
          <div style={sub}>Personne n’a mis tes cartes à vendre en favori pour l’instant. Quand ce sera le cas, tu pourras leur proposer un prix ici.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {interested.map(it => {
              const key = `${it.buyerId}:${it.card.id}`
              return (
                <div key={key} style={{ ...card, flexWrap: 'wrap' }}>
                  {it.card.image /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={it.card.image} alt="" style={{ width: 34, height: 48, objectFit: 'cover' }} /> : <div style={{ width: 34, height: 48, background: 'var(--bg3, #17214a)' }} />}
                  <div style={{ flex: '1 1 160px', minWidth: 0, fontSize: 13, lineHeight: 1.35 }}>
                    <b>{it.buyerName}</b> a mis en favori <b>{it.card.nom}</b>
                    <div style={sub}>{[it.card.annee, it.card.marque].filter(Boolean).join(' · ')} · ton prix {fmtPrice(it.card.prix)}</div>
                  </div>
                  <input inputMode="decimal" value={prices[key] ?? ''} onChange={e => setPrices(v => ({ ...v, [key]: e.target.value }))} placeholder="Ton prix €" aria-label={`Prix proposé à ${it.buyerName}`} style={{ width: 96, minHeight: 0, padding: '8px 10px' }} />
                  <button type="button" disabled={busy === key} onClick={() => propose(it)} className="btn-main btn-primary" style={{ whiteSpace: 'nowrap' }}>{busy === key ? 'Envoi…' : 'Proposer ce prix'}</button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <H>💶 Mes offres de prix</H>
        {rows === null ? <div style={sub}>Chargement…</div> : rows.length === 0 ? (
          <div style={sub}>Aucune offre pour l’instant. Sur une carte à vendre de l’onglet Annonces, le bouton « Faire une offre » te permet de proposer un prix.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {rows.map(o => {
              const st = statusOf(o, o.mineAsSeller), shown = o.status === 'countered' && o.counter_price != null ? o.counter_price : o.price
              return (
                <div key={o.id} style={{ ...card, flexWrap: 'wrap' }}>
                  {o.card?.image /* eslint-disable-next-line @next/next/no-img-element */ ? <img src={o.card.image} alt="" style={{ width: 34, height: 48, objectFit: 'cover' }} /> : <div style={{ width: 34, height: 48, background: 'var(--bg3, #17214a)' }} />}
                  <div style={{ flex: '1 1 170px', minWidth: 0, fontSize: 13, lineHeight: 1.35 }}>
                    <b>{o.card?.nom || 'Carte'}</b>
                    <div style={sub}>{o.mineAsSeller ? 'avec' : 'chez'} {o.otherName}{o.card?.prix != null ? ` · prix affiché ${fmtPrice(Number(o.card.prix))}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>{fmtPrice(Number(shown))}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: st.color }}>{st.label}</div>
                  </div>
                  <Link href={`/messages?to=${o.otherId}`} className="da-confirm-btn" style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>Répondre / voir</Link>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
