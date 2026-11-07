'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { toast } from '@/lib/toast'
import { parsePrice } from '@/lib/marketplace'

// Carte décrite pour chercher sa cote (mêmes paramètres que CardValueModule / /api/ebay-sold).
export type PriceSuggestCard = { name: string; set?: string; year?: string; num?: string; variant?: string; rc?: boolean; auto?: boolean; patch?: boolean; grade?: string; img?: string }
type Suggestion = { median: number; min: number; max: number; n: number; source: 'sold' | 'active' }

// Prix d'une carte « Vente/Trade » dans le viewer 3D (propriétaire) -- affiché en étiquette sur la carte.
// `suggest` : bouton « Prix conseillé » (médiane des ventes eBay récentes, à défaut des annonces en cours), à la demande
// pour ne pas consommer le quota eBay à chaque ouverture.
export default function MarketplacePriceField({ cardId, price, onSaved, suggest, reserved, onReleased }: {
  cardId: string
  price?: number | null
  onSaved: (price: number | null) => void
  suggest?: PriceSuggestCard
  reserved?: boolean          // carte réservée (offre acceptée) : le vendeur peut lever la réservation
  onReleased?: () => void
}) {
  const { dark } = useTheme()
  const [value, setValue] = useState(price != null ? String(price) : '')
  const [busy, setBusy] = useState(false)
  const [sug, setSug] = useState<null | 'loading' | 'none' | Suggestion>(null)

  useEffect(() => { setValue(price != null ? String(price) : ''); setSug(null) }, [cardId, price])

  const parsed = parsePrice(value)
  const valid = parsed !== null

  const askSuggestion = async () => {
    if (!suggest?.name) return
    setSug('loading')
    try {
      const params = new URLSearchParams({ name: suggest.name })
      if (suggest.set) params.set('set', suggest.set)
      if (suggest.year) params.set('year', suggest.year)
      if (suggest.num) params.set('num', suggest.num)
      if (suggest.variant) params.set('variant', suggest.variant)
      if (suggest.rc) params.set('rc', 'true')
      if (suggest.auto) params.set('auto', 'true')
      if (suggest.patch) params.set('patch', 'true')
      if (suggest.grade) params.set('grade', suggest.grade)
      if (suggest.img) params.set('img', suggest.img)
      const json = await (await fetch(`/api/ebay-sold?${params.toString()}`)).json()
      const pool: Array<{ price: number }> = json.priceSource === 'sold' ? json.sold : json.priceSource === 'active' ? json.active : []
      if (!pool?.length || !(json.median > 0)) { setSug('none'); return }
      setSug({ median: Math.round(json.median), min: Math.round(json.min), max: Math.round(json.max), n: pool.length, source: json.priceSource })
    } catch { setSug('none') }
  }

  const save = async (next: number | null) => {
    setBusy(true)
    // Mettre un prix marque aussi la carte « Vente/Trade » (même effet que le bouton).
    const patch = next === null ? { prix_vente: null } : { prix_vente: next, disponible_vente: true }
    const { error } = await supabase.from('cartes_manuelles').update(patch).eq('id', cardId)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(next === null ? 'Prix retiré' : 'Prix enregistré : étiquette ajoutée sur la carte')
    onSaved(next)
    // prévient les membres dont la wishlist attend cette carte à ce prix (prix cible) ; sans effet si personne n'est concerné
    if (next !== null) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) fetch('/api/wishlist-price-alert', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ cardId }) }).catch(() => {})
      })
    }
  }

  const release = async () => {
    setBusy(true)
    const { error } = await supabase.from('cartes_manuelles').update({ reservee: false }).eq('id', cardId)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Réservation levée : la carte peut de nouveau recevoir des offres')
    onReleased?.()
  }

  const border = dark ? '#3a3a3a' : '#d8dde8'
  return (
    <div style={{ gridColumn: '1 / -1', border: `1px solid ${border}`, borderRadius: 10, padding: 12, background: dark ? '#1c1c1c' : '#f7f9fd' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: dark ? '#ddd' : '#333', marginBottom: 8 }}>🏷️ Prix de la carte</div>
      {reserved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10, padding: '8px 10px', border: '2px solid #c98a12', background: dark ? '#2a2000' : '#fff6dc', fontSize: 12, fontWeight: 700, color: dark ? '#ffd98a' : '#7a4f00' }}>
          <span style={{ flex: '1 1 160px' }}>🔒 Réservée : une offre a été acceptée pour cette carte.</span>
          <button type="button" disabled={busy} onClick={release} style={{ border: '2px solid currentColor', background: 'transparent', color: 'inherit', padding: '4px 10px', fontWeight: 800, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.05em' }}>Lever la réservation</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 110px', minWidth: 100 }}>
          <input
            type="text" inputMode="decimal" value={value} placeholder="ex : 25"
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && valid && !busy) save(parsed) }}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 28px 10px 12px', borderRadius: 8, border: `1px solid ${border}`, background: dark ? '#2a2a2a' : '#fff', color: dark ? '#eee' : '#222', fontSize: 15, fontWeight: 700 }}
          />
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: dark ? '#aaa' : '#777' }}>€</span>
        </div>
        <button type="button" disabled={!valid || busy} onClick={() => save(parsed)}
          style={{ padding: '10px 14px', borderRadius: 8, border: 'none', background: '#003DA6', color: '#fff', fontWeight: 800, fontSize: 13, cursor: !valid || busy ? 'default' : 'pointer', opacity: !valid || busy ? 0.5 : 1 }}>
          {price != null ? 'Mettre à jour' : 'Ajouter le prix'}
        </button>
        {price != null && (
          <button type="button" disabled={busy} onClick={() => save(null)}
            style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: dark ? '#ddd' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Retirer
          </button>
        )}
        {suggest?.name && (
          <button type="button" disabled={sug === 'loading'} onClick={askSuggestion}
            style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: dark ? '#ddd' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {sug === 'loading' ? 'Recherche…' : '💡 Prix conseillé'}
          </button>
        )}
      </div>
      {sug === 'none' && <div style={{ marginTop: 8, fontSize: 12, color: dark ? '#aaa' : '#666' }}>Pas assez d’annonces ou de ventes trouvées pour cette carte : fixe ton prix à la main.</div>}
      {sug && typeof sug === 'object' && (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: dark ? '#ddd' : '#333' }}>
          <b>{sug.source === 'sold' ? 'Médiane des ventes récentes' : 'Médiane des annonces en cours'} : {sug.median} €</b>{' '}
          <span style={{ color: dark ? '#aaa' : '#666' }}>({sug.n} {sug.source === 'sold' ? `vente${sug.n > 1 ? 's' : ''}` : `annonce${sug.n > 1 ? 's' : ''}`} · de {sug.min} € à {sug.max} €)</span>
          {sug.source === 'active' && <div style={{ color: dark ? '#aaa' : '#666' }}>Ce sont des prix demandés par des vendeurs, pas des ventes conclues : vise un peu en dessous pour vendre vite.</div>}
          <div style={{ marginTop: 6 }}>
            <button type="button" onClick={() => setValue(String(sug.median))}
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #003DA6', background: 'transparent', color: '#003DA6', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
              Utiliser {sug.median} €
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
