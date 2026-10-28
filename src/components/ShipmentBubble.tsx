'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import type { Shipment } from '@/lib/shipping'
import ShipmentCard, { ShipSheet, type ShipmentAction } from '@/components/ShipmentCard'

// Bulle « Livraison » d'une conversation : charge la livraison (lecture réservée à l'acheteur et au vendeur par la RLS),
// puis exécute les actions via /api/shipments/[id]. `refreshKey` change à chaque nouveau message pour recharger le statut.
export default function ShipmentBubble({ id, userId, dark, refreshKey }: { id: string; userId: string; dark: boolean; refreshKey: number }) {
  const [s, setS] = useState<Shipment | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('shipments').select('*').eq('id', id).maybeSingle()
    setS((data as Shipment | null) ?? null)
  }, [id])
  useEffect(() => { load() }, [load, refreshKey])

  const act = async (action: ShipmentAction, tracking?: string) => {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/shipments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ action, tracking }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) toast.error(json.error || 'Action impossible.')
      else setSheet(false)
    } catch { toast.error('Connexion impossible. Réessaie.') }
    setBusy(false)
    load()
  }

  if (s === undefined) return <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>Chargement de la livraison…</div>
  if (s === null) return <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>📦 Livraison indisponible.</div>
  const role = s.seller_id === userId ? 'seller' : 'buyer'
  return (
    <>
      <ShipmentCard shipment={s} role={role} dark={dark} busy={busy} onAction={a => act(a)} onOpenSheet={() => setSheet(true)} />
      {sheet && <ShipSheet shipment={s} dark={dark} busy={busy} onClose={() => setSheet(false)} onShip={t => act('ship', t)} />}
    </>
  )
}
