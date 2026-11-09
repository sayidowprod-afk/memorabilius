'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'
import MesVentesView, { type VenteForm } from '@/components/MesVentesView'
import type { Row, Rates } from '@/components/MesAchatsView'
import type { Vente } from '@/lib/ventesUi'
import type { Offer } from '@/lib/offers'
import type { EbayAnnonce } from '@/lib/ebayTrading'

// « Mes ventes » : ventes eBay importées (lecture seule, même connexion que « Mes achats ») et ventes saisies à la main,
// avec net encaissé, profit réalisé et rendement. L'affichage est dans MesVentesView ; ici : session, chargement, synchronisation.
export default function MesVentes() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [ventes, setVentes] = useState<Vente[]>([])
  const [offers, setOffers] = useState<Array<Offer & { buyer_name: string | null }>>([])
  const [achats, setAchats] = useState<Row[]>([])
  const [rates, setRates] = useState<Rates>(null)
  const [statut, setStatut] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [annonces, setAnnonces] = useState<EbayAnnonce[]>([])

  // Offres de prix reçues sur mes cartes à vendre (entre membres de Memorabilius) qui attendent ma réponse
  const loadOffers = async (uid: string) => {
    try {
      const { data: o } = await supabase.from('offers').select('*').eq('seller_id', uid).eq('status', 'pending').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(30)
      const list = (o as Offer[]) || []
      const ids = Array.from(new Set(list.map(x => x.buyer_id)))
      const names = new Map<string, string>()
      if (ids.length) {
        const { data: ps } = await supabase.from('profiles').select('id, display_name').in('id', ids)
        for (const p of ps || []) names.set(p.id as string, (p.display_name as string) || '')
      }
      setOffers(list.map(x => ({ ...x, buyer_name: names.get(x.buyer_id) || null })))
    } catch { setOffers([]) }
  }

  const load = useCallback(async (uid: string) => {
    const [{ data: v }, { data: a }, { data: c }] = await Promise.all([
      supabase.from('ventes_membre').select('*').eq('user_id', uid).order('vendu_at', { ascending: false }).limit(1000),
      supabase.from('achats_membre').select('*').eq('user_id', uid).eq('type', 'achat').in('source', ['ebay', 'vinted']).limit(1000),
      supabase.from('ebay_connexions').select('statut').eq('user_id', uid).maybeSingle(),
    ])
    setVentes((v as Vente[]) || [])
    setAchats((a as Row[]) || [])
    setStatut(c?.statut || null)
    await loadOffers(uid)
  }, [])

  // Annonces eBay en cours (enchères, prix fixe) : lecture à la demande, affichée en haut ; une erreur ici ne gêne pas le reste de la page
  const loadAnnonces = useCallback(async (tok: string) => {
    try {
      const res = await fetch('/api/ebay/en-cours', { headers: { Authorization: `Bearer ${tok}` } })
      const json = await res.json().catch(() => ({}))
      setAnnonces(json && json.ok ? (json.annonces as EbayAnnonce[]) : [])
    } catch { setAnnonces([]) }
  }, [])

  const sync = useCallback(async (tok: string, uid: string, force: boolean) => {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch('/api/ebay/ventes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ force }) })
      const json = await res.json().catch(() => ({}))
      if (json && json.ok === false && !json.skipped && json.error !== 'Compte eBay non connecté.') setMsg(json.error || 'Actualisation impossible.')
      await load(uid)
      void loadAnnonces(tok)
    } finally { setBusy(false) }
  }, [load, loadAnnonces])

  useEffect(() => {
    (async () => {
      try {
        await withTimeout((async () => {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session) { router.replace('/connexion'); return }
          setToken(session.access_token)
          await load(session.user.id)
          setLoading(false)
          const { data: c } = await supabase.from('ebay_connexions').select('statut').eq('user_id', session.user.id).maybeSingle()
          if (c?.statut === 'connecte') await sync(session.access_token, session.user.id, false)
        })(), 20000, undefined)
      } finally { setLoading(false) }
    })()
  }, [router, load, sync])

  useEffect(() => { fetch('/api/ebay/taux').then(r => r.json()).then(j => setRates(j?.rates || null)).catch(() => {}) }, [])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id) }, [])

  const reload = async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) await load(session.user.id) }
  const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'Session expirée : reconnecte-toi.'
    try {
      const res = await fetch('/api/ventes', { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      await reload()
      return res.ok ? null : (json.error || 'Action impossible.')
    } catch { return 'Action impossible pour le moment.' }
  }

  // Répondre à une offre : même route que depuis la messagerie (le vendeur accepte, refuse ou contre-propose)
  const offerAct = async (id: string, action: 'accept' | 'refuse' | 'counter', price?: number): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return 'Session expirée : reconnecte-toi.'
    try {
      const res = await fetch(`/api/offers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action, price }) })
      const json = await res.json().catch(() => ({}))
      await loadOffers(session.user.id)
      return res.ok ? null : (json.error || 'Action impossible.')
    } catch { return 'Action impossible pour le moment.' }
  }

  return (
    <MesVentesView
      offers={offers} onOfferAct={offerAct} annonces={annonces}
      loading={loading} ventes={ventes} achats={achats} rates={rates} connected={statut === 'connecte'} ebayStatut={statut} busy={busy} msg={msg} now={now}
      onSync={() => { if (token) supabase.auth.getSession().then(({ data: { session } }) => session && sync(session.access_token, session.user.id, true)) }}
      onAdd={(f: VenteForm) => call('POST', f)}
      onPatch={(id, patch) => call('PATCH', { id, patch })}
      onDelete={async id => { await call('DELETE', { id }) }}
    />
  )
}
