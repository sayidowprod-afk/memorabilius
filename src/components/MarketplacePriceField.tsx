'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { toast } from '@/lib/toast'
import { parsePrice } from '@/lib/marketplace'

// Prix d'une carte « Vente/Trade » dans le viewer 3D (propriétaire) -- affiché en étiquette sur la carte.
export default function MarketplacePriceField({ cardId, price, onSaved }: {
  cardId: string
  price?: number | null
  onSaved: (price: number | null) => void
}) {
  const { dark } = useTheme()
  const [value, setValue] = useState(price != null ? String(price) : '')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setValue(price != null ? String(price) : '') }, [cardId, price])

  const parsed = parsePrice(value)
  const valid = parsed !== null

  const save = async (next: number | null) => {
    setBusy(true)
    // Mettre un prix marque aussi la carte « Vente/Trade » (même effet que le bouton).
    const patch = next === null ? { prix_vente: null } : { prix_vente: next, disponible_vente: true }
    const { error } = await supabase.from('cartes_manuelles').update(patch).eq('id', cardId)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(next === null ? 'Prix retiré' : 'Prix enregistré : étiquette ajoutée sur la carte')
    onSaved(next)
  }

  const border = dark ? '#3a3a3a' : '#d8dde8'
  return (
    <div style={{ gridColumn: '1 / -1', border: `1px solid ${border}`, borderRadius: 10, padding: 12, background: dark ? '#1c1c1c' : '#f7f9fd' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: dark ? '#ddd' : '#333', marginBottom: 8 }}>🏷️ Prix de la carte</div>
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
      </div>
    </div>
  )
}
